import type { FieldValues } from "react-hook-form"

import type { FormBinding } from "../create-form-kit.js"
import { registerFormDiagnosticFeature } from "../diagnostics.js"
import {
	areFormValuesEqual,
	cloneFormValue,
	isFormValueObject,
} from "../form-value.js"
import type { StandardSchema } from "../types.js"
import {
	type FormMiddlewareApi,
	type FormMiddlewareNext,
	getValueCoordinatorCapability,
	type ValueCoordinatorCapability,
	type ValueTransaction,
	type ValueTransactionSource,
} from "../value-middleware.js"
import {
	decodePersistenceEnvelope,
	encodePersistenceEnvelope,
	type JsonValue,
	normalizePersistenceCodecs,
	type PersistenceCodec,
	type PersistenceMigration,
} from "./encoding.js"

/** An application-owned keyed persistence transport. */
export type FormPersistenceAdapter = Readonly<{
	load(key: string): Promise<JsonValue | undefined>
	save(key: string, value: JsonValue): Promise<void>
	remove(key: string): Promise<void>
}>

type IdleSave = Readonly<{ status: "idle" }>
type PersistenceSaveState =
	| IdleSave
	| Readonly<{ status: "scheduled" }>
	| Readonly<{ status: "saving" }>
	| Readonly<{
			status: "failed"
			error: unknown
			operation: "save" | "clear"
	  }>

/** Observable restore and save state for one persisted form. */
export type PersistenceSnapshot =
	| Readonly<{
			phase: "idle" | "restoring" | "active" | "conflict"
			save: PersistenceSaveState
	  }>
	| Readonly<{
			phase: "failed"
			error: unknown
			save: IdleSave
	  }>

/** Result of one persistence restore attempt. */
export type PersistenceRestoreResult =
	| "applied"
	| "empty"
	| "cancelled"
	| "transformed"
	| "conflict"

/** Operations and observable state for one exact persisted form. */
export type PersistenceHandle = Readonly<{
	restore(): Promise<PersistenceRestoreResult>
	start(): void
	flush(): Promise<void>
	clear(): Promise<void>
	getSnapshot(): PersistenceSnapshot
	subscribe(listener: () => void): () => void
}>

/** Additional context supplied when a persistence operation fails. */
export type PersistenceErrorDetails = Readonly<{
	/** The persistence operation that reported the error. */
	operation: "restore" | "save" | "clear"
}>

type PersistenceOperation = PersistenceErrorDetails["operation"]

/** Configuration for one reusable persistence middleware feature. */
export type CreatePersistenceOptions = Readonly<{
	adapter: FormPersistenceAdapter
	key: string
	version: number
	codecs?: readonly PersistenceCodec[]
	migrate?: PersistenceMigration
	saveDelay?: number
	onError?: (error: unknown, details: PersistenceErrorDetails) => void
}>

/** Reusable middleware with exact-form persistence handle lookup. */
export type PersistenceFeature = {
	<Input extends FieldValues, Context = unknown>(
		api: FormMiddlewareApi<Input>,
	): (
		next: FormMiddlewareNext,
	) => (transaction: ValueTransaction<Input, Context>) => unknown
	readonly handle: <Schema extends StandardSchema, Context = unknown>(
		form: FormBinding<Schema, Context>,
	) => PersistenceHandle
}

type PersistenceSource<Input extends FieldValues> = Extract<
	ValueTransactionSource<Input>,
	{ type: "persistence" }
>

type PendingRestore<Input extends FieldValues> = {
	readonly target: Input
	outcome?: Extract<PersistenceRestoreResult, "applied" | "transformed">
}

type SubscribableFormApi<Input extends FieldValues> = Readonly<{
	subscribe(options: {
		readonly formState: Readonly<{ values: true }>
		readonly callback: (details: Readonly<{ values: Input }>) => void
	}): () => void
}>

type NormalizedOptions = Readonly<{
	adapter: FormPersistenceAdapter
	key: string
	version: number
	codecs: readonly PersistenceCodec[]
	migrate?: PersistenceMigration
	saveDelay: number
	onError?: CreatePersistenceOptions["onError"]
}>

const idleSave = Object.freeze({ status: "idle" as const })
const persistenceFeatureClaimKey = Symbol.for(
	"form-please.persistence-feature-claim",
)
const hookRetainers = new WeakMap<PersistenceHandle, () => () => void>()

/** Retains RHF observation for one mounted usePersistence hook. */
export function retainPersistenceHook(
	persistence: PersistenceHandle,
): () => void {
	const retain = hookRetainers.get(persistence)
	if (retain === undefined) {
		throw new TypeError("usePersistence requires a package persistence handle")
	}
	return retain()
}

/** Creates one optional persisted-form middleware feature. */
export function createPersistenceMiddleware(
	options: CreatePersistenceOptions,
): PersistenceFeature {
	const normalized = normalizeOptions(options)
	const states = new WeakMap<object, PersistenceState<FieldValues, unknown>>()
	let feature: PersistenceFeature

	feature = (<Input extends FieldValues, Context = unknown>(
		api: FormMiddlewareApi<Input>,
	) => {
		const capability = getValueCoordinatorCapability<Input, Context>(api)
		claimPersistenceCapability(capability, feature)
		const state = new PersistenceState(capability, normalized)
		states.set(
			capability,
			state as unknown as PersistenceState<FieldValues, unknown>,
		)
		return (next: FormMiddlewareNext) =>
			(transaction: ValueTransaction<Input, Context>) =>
				state.forward(next, transaction)
	}) as PersistenceFeature

	Object.defineProperty(feature, "handle", {
		enumerable: true,
		value(form: FormBinding) {
			const capability = getValueCoordinatorCapability(form)
			const state = states.get(capability)
			if (state === undefined || readPersistenceClaim(capability) !== feature) {
				throw new TypeError(
					"This persistence feature is not configured for the supplied form",
				)
			}
			state.attach(form)
			return state.handle
		},
	})

	return Object.freeze(feature)
}

class PersistenceState<Input extends FieldValues, Context> {
	readonly handle: PersistenceHandle
	readonly #capability: ValueCoordinatorCapability<Input, Context>
	readonly #options: NormalizedOptions
	readonly #listeners = new Set<() => void>()
	#snapshot: PersistenceSnapshot = Object.freeze({
		phase: "idle",
		save: idleSave,
	})
	#api: SubscribableFormApi<Input> | undefined
	#unsubscribe: (() => void) | undefined
	#observedValues: Input
	#savedValues: Input | undefined
	#revision = 0
	#savedRevision = -1
	#suppressedRevision = -1
	#highestQueuedRevision = -1
	#timer: ReturnType<typeof setTimeout> | undefined
	#tail: Promise<void> = Promise.resolve()
	#statusOperation = 0
	#suppressValueEvents = 0
	#pendingRestore: PendingRestore<Input> | undefined
	#restorePromise: Promise<PersistenceRestoreResult> | undefined
	#restoreResult: PersistenceRestoreResult | undefined
	#activation: "none" | "restore" | "start" = "none"
	#retainedHooks = 0

	constructor(
		capability: ValueCoordinatorCapability<Input, Context>,
		options: NormalizedOptions,
	) {
		this.#capability = capability
		this.#options = options
		this.#observedValues = cloneFormValue(capability.getValues() as Input)
		this.handle = Object.freeze({
			clear: () => this.#clear(),
			flush: () => this.#flush(),
			getSnapshot: () => this.#snapshot,
			restore: () => this.#restore(),
			start: () => this.#start(),
			subscribe: (listener) => this.#subscribe(listener),
		})
		hookRetainers.set(this.handle, () => this.#retainHook())
		registerFormDiagnosticFeature(capability, {
			getDetails: () => this.#diagnosticDetails(),
			getSnapshot: () => this.#snapshot,
			kind: "persistence",
			subscribe: (listener) => this.#subscribe(listener),
		})
	}

	#diagnosticDetails(): unknown {
		return Object.freeze({
			activation: this.#activation,
			highestQueuedRevision: this.#highestQueuedRevision,
			key: this.#options.key,
			observing: this.#unsubscribe !== undefined,
			queued: this.#highestQueuedRevision > this.#savedRevision,
			restoredAs: this.#restoreResult,
			revision: this.#revision,
			saveDelay: this.#options.saveDelay,
			savedRevision: this.#savedRevision,
			version: this.#options.version,
		})
	}

	attach(form: FormBinding): void {
		this.#api ??= form.api as unknown as SubscribableFormApi<Input>
	}

	forward(
		next: FormMiddlewareNext,
		transaction: ValueTransaction<Input, Context>,
	): unknown {
		let result: unknown
		try {
			result = next(transaction.patches)
		} catch (error) {
			this.#observeCommit()
			throw error
		}
		this.#observeCommit()
		return result
	}

	#subscribe(listener: () => void): () => void {
		if (typeof listener !== "function") {
			throw new TypeError("Persistence listener must be a function")
		}
		this.#listeners.add(listener)
		let subscribed = true
		return () => {
			if (!subscribed) return
			subscribed = false
			this.#listeners.delete(listener)
		}
	}

	#ensureSubscribed(): void {
		if (this.#unsubscribe !== undefined) return
		if (this.#api === undefined) {
			throw new TypeError(
				"Persistence operations require a current Form Please form handle",
			)
		}
		this.#observedValues = this.#currentValues()
		this.#unsubscribe = this.#api.subscribe({
			callback: ({ values }) => this.#observeValues(values),
			formState: { values: true },
		})
	}

	#retainHook(): () => void {
		this.#ensureSubscribed()
		this.#retainedHooks++
		let retained = true
		return () => {
			if (!retained) return
			retained = false
			this.#retainedHooks--
			if (this.#retainedHooks > 0) return
			this.#unsubscribe?.()
			this.#unsubscribe = undefined
			// A scheduled or in-flight save intentionally keeps the last observed edit.
		}
	}

	#observeValues(values: Input): void {
		if (this.#suppressValueEvents > 0) return
		const detached = cloneFormValue(values)
		if (areFormValuesEqual(this.#observedValues, detached)) return
		this.#observedValues = detached
		this.#revision++
		if (this.#snapshot.phase === "active") this.#schedule()
	}

	#observeCommit(): void {
		const transaction = this.#capability.getCommittedTransaction()
		const pending = this.#pendingRestore
		if (
			transaction === undefined ||
			pending === undefined ||
			transaction.source.type !== "persistence"
		) {
			return
		}
		pending.outcome = areFormValuesEqual(transaction.nextValues, pending.target)
			? "applied"
			: "transformed"
	}

	#restore(): Promise<PersistenceRestoreResult> {
		if (this.#restorePromise !== undefined) return this.#restorePromise
		if (this.#snapshot.phase === "active") {
			if (this.#activation === "restore" && this.#restoreResult !== undefined) {
				return Promise.resolve(this.#restoreResult)
			}
			return Promise.reject(
				new TypeError("Persistence restore cannot run after start"),
			)
		}
		if (this.#snapshot.phase === "conflict") {
			return Promise.resolve("conflict")
		}

		const operation = this.#performRestore()
		this.#restorePromise = operation
		operation.then(
			() => {
				if (this.#restorePromise === operation) this.#restorePromise = undefined
			},
			() => {
				if (this.#restorePromise === operation) this.#restorePromise = undefined
			},
		)
		return operation
	}

	async #performRestore(): Promise<PersistenceRestoreResult> {
		this.#ensureSubscribed()
		this.#cancelTimer()
		this.#setSnapshot(Object.freeze({ phase: "restoring", save: idleSave }))
		const startingRevision = this.#revision

		let stored: JsonValue | undefined
		try {
			stored = await this.#options.adapter.load(this.#options.key)
		} catch (error) {
			this.#failRestore(error)
			throw error
		}
		if (this.#revision !== startingRevision) return this.#conflict()

		if (stored === undefined) {
			this.#activation = "restore"
			this.#restoreResult = "empty"
			this.#suppressedRevision = this.#revision
			this.#setSnapshot(Object.freeze({ phase: "active", save: idleSave }))
			return "empty"
		}

		let decoded: Awaited<ReturnType<typeof decodePersistenceEnvelope>>
		try {
			decoded = await decodePersistenceEnvelope(stored, {
				codecs: this.#options.codecs,
				migrate: this.#options.migrate,
				version: this.#options.version,
			})
			if (!isFormValueObject(decoded.value)) {
				throw new TypeError("Persisted form input must be an object")
			}
		} catch (error) {
			this.#failRestore(error)
			throw error
		}
		if (this.#revision !== startingRevision) return this.#conflict()

		const target = cloneFormValue(decoded.value as Input)
		const pending: PendingRestore<Input> = { target }
		this.#pendingRestore = pending
		this.#suppressValueEvents++
		let dispatchResult: unknown
		let dispatchError: unknown
		let dispatchFailed = false
		try {
			dispatchResult = this.#capability.restore(() => cloneFormValue(target), {
				action: "restore",
				type: "persistence",
			} satisfies PersistenceSource<Input>)
		} catch (error) {
			dispatchError = error
			dispatchFailed = true
		} finally {
			this.#suppressValueEvents--
			this.#pendingRestore = undefined
			this.#observedValues = this.#currentValues()
		}

		let outcome = pending.outcome
		if (
			outcome !== undefined &&
			!areFormValuesEqual(this.#observedValues, target)
		) {
			outcome = "transformed"
		}
		if (outcome !== undefined) {
			this.#activateRestore(outcome, decoded.migrated)
		}

		if (dispatchFailed) {
			this.#reportError(dispatchError, "restore")
			if (outcome === undefined) this.#setRestoreFailure(dispatchError)
			throw dispatchError
		}
		try {
			await dispatchResult
		} catch (error) {
			this.#reportError(error, "restore")
			if (outcome === undefined) this.#setRestoreFailure(error)
			throw error
		}

		if (outcome === undefined) {
			this.#activation = "none"
			this.#restoreResult = "cancelled"
			this.#setSnapshot(Object.freeze({ phase: "idle", save: idleSave }))
			return "cancelled"
		}
		return outcome
	}

	#activateRestore(
		outcome: "applied" | "transformed",
		migrated: boolean,
	): void {
		this.#activation = "restore"
		this.#restoreResult = outcome
		this.#savedValues = cloneFormValue(this.#observedValues)
		this.#savedRevision = this.#revision
		this.#suppressedRevision = -1
		this.#setSnapshot(Object.freeze({ phase: "active", save: idleSave }))
		if (migrated || outcome === "transformed") this.#schedule(0, true)
	}

	#conflict(): PersistenceRestoreResult {
		this.#activation = "none"
		this.#restoreResult = "conflict"
		this.#setSnapshot(Object.freeze({ phase: "conflict", save: idleSave }))
		return "conflict"
	}

	#failRestore(error: unknown): void {
		this.#reportError(error, "restore")
		this.#setRestoreFailure(error)
	}

	#setRestoreFailure(error: unknown): void {
		this.#activation = "none"
		this.#restoreResult = undefined
		this.#setSnapshot(Object.freeze({ error, phase: "failed", save: idleSave }))
	}

	#start(): void {
		this.#ensureSubscribed()
		if (this.#snapshot.phase === "restoring") {
			throw new TypeError("Persistence cannot start while restore is running")
		}
		if (this.#snapshot.phase === "active") return
		const saveCurrent =
			this.#snapshot.phase === "conflict" || this.#snapshot.phase === "failed"
		this.#activation = "start"
		this.#restoreResult = undefined
		this.#setSnapshot(Object.freeze({ phase: "active", save: idleSave }))
		if (saveCurrent) this.#schedule(0, true)
		else this.#suppressedRevision = this.#revision
	}

	async #flush(): Promise<void> {
		if (this.#snapshot.phase !== "active") {
			throw new TypeError("Persistence flush requires active persistence")
		}
		this.#cancelTimer()
		await this.#queueSave(true)
	}

	async #clear(): Promise<void> {
		if (this.#snapshot.phase === "restoring") {
			throw new TypeError(
				"Persistence clear cannot run while restore is running",
			)
		}
		this.#cancelTimer()
		if (this.#snapshot.phase === "failed") {
			this.#setSnapshot(Object.freeze({ phase: "idle", save: idleSave }))
		}
		const clearedRevision = this.#revision
		this.#suppressedRevision = clearedRevision
		const operation = ++this.#statusOperation
		this.#setSave(Object.freeze({ status: "saving" }))
		await this.#enqueue(async () => {
			try {
				await this.#options.adapter.remove(this.#options.key)
				this.#savedValues = undefined
				this.#savedRevision = Math.max(this.#savedRevision, clearedRevision)
				if (operation === this.#statusOperation) {
					if (
						this.#snapshot.phase === "active" &&
						this.#revision > clearedRevision
					) {
						this.#schedule()
					} else this.#setSave(idleSave)
				}
			} catch (error) {
				this.#reportError(error, "clear")
				if (operation === this.#statusOperation) {
					this.#setSave(
						Object.freeze({
							error,
							operation: "clear" as const,
							status: "failed",
						}) satisfies PersistenceSaveState,
					)
				}
				throw error
			}
		})
	}

	#schedule(delay = this.#options.saveDelay, force = false): void {
		if (this.#snapshot.phase !== "active") return
		this.#cancelTimer()
		this.#statusOperation++
		this.#setSave(Object.freeze({ status: "scheduled" }))
		this.#timer = setTimeout(() => {
			this.#timer = undefined
			void this.#queueSave(force).catch(() => undefined)
		}, delay)
	}

	#queueSave(force: boolean): Promise<void> {
		const requestedRevision = this.#revision
		if (
			!force &&
			(requestedRevision <= this.#savedRevision ||
				requestedRevision <= this.#suppressedRevision ||
				requestedRevision <= this.#highestQueuedRevision)
		) {
			if (this.#snapshot.phase === "active") this.#setSave(idleSave)
			return this.#tail
		}
		this.#highestQueuedRevision = Math.max(
			this.#highestQueuedRevision,
			requestedRevision,
		)
		const operation = ++this.#statusOperation
		return this.#enqueue(async () => {
			if (!force && requestedRevision <= this.#savedRevision) {
				if (operation === this.#statusOperation) this.#setSave(idleSave)
				return
			}
			const revision = this.#revision
			const values = this.#currentValues()
			if (!force && areFormValuesEqual(values, this.#savedValues)) {
				this.#savedRevision = Math.max(this.#savedRevision, revision)
				if (operation === this.#statusOperation) this.#setSave(idleSave)
				return
			}
			if (operation === this.#statusOperation) {
				this.#setSave(Object.freeze({ status: "saving" }))
			}
			try {
				const envelope = await encodePersistenceEnvelope(values, {
					codecs: this.#options.codecs,
					version: this.#options.version,
				})
				await this.#options.adapter.save(this.#options.key, envelope)
				this.#savedValues = values
				this.#savedRevision = Math.max(this.#savedRevision, revision)
				if (operation === this.#statusOperation) {
					if (this.#snapshot.phase === "active" && this.#revision > revision) {
						this.#schedule()
					} else this.#setSave(idleSave)
				}
			} catch (error) {
				this.#reportError(error, "save")
				if (operation === this.#statusOperation) {
					this.#setSave(
						Object.freeze({
							error,
							operation: "save" as const,
							status: "failed",
						}) satisfies PersistenceSaveState,
					)
				}
				throw error
			}
		})
	}

	#enqueue(operation: () => Promise<void>): Promise<void> {
		const result = this.#tail.catch(() => undefined).then(operation)
		this.#tail = result
		return result
	}

	#currentValues(): Input {
		return cloneFormValue(this.#capability.getValues() as Input)
	}

	#cancelTimer(): void {
		if (this.#timer !== undefined) clearTimeout(this.#timer)
		this.#timer = undefined
	}

	#reportError(error: unknown, operation: PersistenceOperation): void {
		try {
			this.#options.onError?.(error, { operation })
		} catch {
			// The persistence operation remains the authoritative failure.
		}
	}

	#setSave(save: PersistenceSaveState): void {
		if (this.#snapshot.phase === "failed") return
		this.#setSnapshot(Object.freeze({ phase: this.#snapshot.phase, save }))
	}

	#setSnapshot(snapshot: PersistenceSnapshot): void {
		this.#snapshot = snapshot
		for (const listener of [...this.#listeners]) listener()
	}
}

function claimPersistenceCapability(
	capability: object,
	feature: PersistenceFeature,
): void {
	if (readPersistenceClaim(capability) !== undefined) {
		throw new TypeError("A form can configure only one persistence feature")
	}
	Object.defineProperty(capability, persistenceFeatureClaimKey, {
		value: feature,
	})
}

function readPersistenceClaim(capability: object): unknown {
	return (capability as Record<PropertyKey, unknown>)[
		persistenceFeatureClaimKey
	]
}

function normalizeOptions(
	options: CreatePersistenceOptions,
): NormalizedOptions {
	if (typeof options !== "object" || options === null) {
		throw new TypeError("Persistence options must be an object")
	}
	if (
		typeof options.adapter !== "object" ||
		options.adapter === null ||
		typeof options.adapter.load !== "function" ||
		typeof options.adapter.save !== "function" ||
		typeof options.adapter.remove !== "function"
	) {
		throw new TypeError(
			"Persistence adapter must define load, save, and remove",
		)
	}
	if (typeof options.key !== "string" || options.key.length === 0) {
		throw new TypeError("Persistence key must be a non-empty string")
	}
	if (!Number.isSafeInteger(options.version) || options.version < 0) {
		throw new TypeError("Persistence version must be a non-negative integer")
	}
	const saveDelay = options.saveDelay ?? 500
	if (!Number.isFinite(saveDelay) || saveDelay < 0) {
		throw new TypeError(
			"Persistence saveDelay must be a finite non-negative number",
		)
	}
	if (options.migrate !== undefined && typeof options.migrate !== "function") {
		throw new TypeError("Persistence migrate must be a function")
	}
	if (options.onError !== undefined && typeof options.onError !== "function") {
		throw new TypeError("Persistence onError must be a function")
	}
	return Object.freeze({
		adapter: options.adapter,
		codecs: normalizePersistenceCodecs(options.codecs),
		key: options.key,
		migrate: options.migrate,
		onError: options.onError,
		saveDelay,
		version: options.version,
	})
}
