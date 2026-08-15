import type { FieldValues } from "react-hook-form"

import type { FormBinding } from "../create-form-kit.js"
import { registerFormDiagnosticFeature } from "../diagnostics.js"
import {
	areFormValuesEqual,
	cloneFormValue,
	isFormValueObject,
} from "../form-value.js"
import type { FormInput, StandardSchema } from "../types.js"
import {
	type FormMiddlewareApi,
	type FormMiddlewareNext,
	getValueCoordinatorCapability,
	type ValueCoordinatorCapability,
	type ValueTransaction,
	type ValueTransactionSource,
} from "../value-middleware.js"

/** Navigation state for one managed value history. */
export type HistorySnapshot = Readonly<{
	canUndo: boolean
	canRedo: boolean
	index: number
	length: number
}>

/** Result of one user-directed history navigation. */
export type HistoryOperationResult =
	| "applied"
	| "unavailable"
	| "cancelled"
	| "transformed"

/** An in-memory sequence of retained form inputs and its current position. */
export type HistoryJournal<Input extends FieldValues> = Readonly<{
	version: 1
	entries: readonly Input[]
	index: number
}>

/** User operations for one exact form and history feature pair. */
export type HistoryHandle<Input extends FieldValues> = Readonly<{
	getSnapshot(): HistorySnapshot
	subscribe(listener: () => void): () => void
	undo(): Promise<HistoryOperationResult>
	redo(): Promise<HistoryOperationResult>
	seek(index: number): Promise<HistoryOperationResult>
	clear(): void
	export(): HistoryJournal<Input>
	import(journal: unknown): Promise<HistoryOperationResult>
}>

/** Retention and control-edit grouping for managed value history. */
export type CreateHistoryOptions = Readonly<{
	limit?: number
	groupWindow?: number
}>

type BindingInput<Schema extends StandardSchema> = Extract<
	FormInput<Schema>,
	FieldValues
>

/** Reusable middleware with form-specific history handle lookup. */
export type HistoryFeature = {
	<Input extends FieldValues, Context = unknown>(
		api: FormMiddlewareApi<Input>,
	): (
		next: FormMiddlewareNext,
	) => (transaction: ValueTransaction<Input, Context>) => unknown
	readonly handle: <Schema extends StandardSchema, Context = unknown>(
		form: FormBinding<Schema, Context>,
	) => HistoryHandle<BindingInput<Schema>>
}

type HistorySource<Input extends FieldValues> = Extract<
	ValueTransactionSource<Input>,
	{ type: "history" }
>

type PendingRestore<Input extends FieldValues> = {
	readonly action: HistorySource<Input>["action"]
	readonly target: Input
	readonly targetIndex: number
	readonly journal?: NormalizedJournal<Input>
	outcome?: HistoryOperationResult
}

type NormalizedJournal<Input extends FieldValues> = {
	readonly entries: Input[]
	readonly index: number
}

type ActiveGroup = {
	readonly path: string
	lastUpdate: number
}

const historyFeatureClaimKey = Symbol.for("form-please.history-feature-claim")

/** Creates one optional managed-value history feature. */
export function createHistoryMiddleware(
	options: CreateHistoryOptions = {},
): HistoryFeature {
	const limit = normalizeLimit(options.limit)
	const groupWindow = normalizeGroupWindow(options.groupWindow)
	const states = new WeakMap<object, HistoryState<FieldValues, unknown>>()
	let feature: HistoryFeature

	feature = (<Input extends FieldValues, Context = unknown>(
		api: FormMiddlewareApi<Input>,
	) => {
		const capability = getValueCoordinatorCapability<Input, Context>(api)
		claimHistoryCapability(capability, feature)
		const state = new HistoryState(capability, limit, groupWindow)
		states.set(
			capability,
			state as unknown as HistoryState<FieldValues, unknown>,
		)
		return (next: FormMiddlewareNext) =>
			(transaction: ValueTransaction<Input, Context>) =>
				state.forward(next, transaction)
	}) as HistoryFeature

	Object.defineProperty(feature, "handle", {
		enumerable: true,
		value(form: object) {
			const capability = getValueCoordinatorCapability(form)
			const state = states.get(capability)
			if (state === undefined || readHistoryClaim(capability) !== feature) {
				throw new TypeError(
					"This history feature is not configured for the supplied form",
				)
			}
			return state.handle
		},
	})

	return Object.freeze(feature)
}

class HistoryState<Input extends FieldValues, Context> {
	readonly handle: HistoryHandle<Input>
	readonly #capability: ValueCoordinatorCapability<Input, Context>
	readonly #groupWindow: number
	readonly #limit: number
	readonly #listeners = new Set<() => void>()
	#entries: Input[]
	#cursor = 0
	#snapshot = createHistorySnapshot(0, 0)
	#activeGroup: ActiveGroup | undefined
	#pendingRestore: PendingRestore<Input> | undefined
	#operationInFlight = false

	constructor(
		capability: ValueCoordinatorCapability<Input, Context>,
		limit: number,
		groupWindow: number,
	) {
		this.#capability = capability
		this.#limit = limit
		this.#groupWindow = groupWindow
		this.#entries = [cloneFormValue(capability.getValues() as Input)]
		this.handle = Object.freeze({
			getSnapshot: () => this.#snapshot,
			subscribe: (listener) => this.#subscribe(listener),
			undo: () => this.#navigate(-1, "undo"),
			redo: () => this.#navigate(1, "redo"),
			seek: (index) => this.#seek(index),
			clear: () => this.#clear(),
			export: () => this.#export(),
			import: (journal) => this.#import(journal),
		})
		registerFormDiagnosticFeature(capability, {
			getDetails: () => this.#diagnosticDetails(),
			getSnapshot: () => this.#snapshot,
			kind: "history",
			subscribe: (listener) => this.#subscribe(listener),
		})
	}

	#diagnosticDetails(): unknown {
		const retained = this.#entries[this.#cursor]
		return Object.freeze({
			activeGroup:
				this.#activeGroup === undefined
					? undefined
					: Object.freeze({ ...this.#activeGroup }),
			diverged:
				retained !== undefined &&
				!areFormValuesEqual(retained, this.#capability.getValues()),
			groupWindow: this.#groupWindow,
			limit: this.#limit,
			operationInFlight: this.#operationInFlight,
		})
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
			throw new TypeError("History listener must be a function")
		}
		this.#listeners.add(listener)
		let subscribed = true
		return () => {
			if (!subscribed) return
			subscribed = false
			this.#listeners.delete(listener)
		}
	}

	#observeCommit(): void {
		const transaction = this.#capability.getCommittedTransaction()
		if (transaction === undefined) return
		if (transaction.source.type === "history") {
			this.#finishRestore(transaction)
			return
		}
		this.#recordManagedUpdate(transaction)
	}

	#recordManagedUpdate(transaction: ValueTransaction<Input, Context>): void {
		this.#adoptBoundary(transaction.previousValues as Input)
		if (
			areFormValuesEqual(transaction.previousValues, transaction.nextValues)
		) {
			return
		}

		this.#truncateRedo()
		const values = cloneFormValue(transaction.nextValues as Input)
		const now = Date.now()
		const source = transaction.source
		const continuesGroup =
			this.#groupWindow > 0 &&
			source.type === "control" &&
			this.#activeGroup?.path === source.path &&
			now - this.#activeGroup.lastUpdate <= this.#groupWindow &&
			this.#cursor === this.#entries.length - 1

		if (continuesGroup && this.#activeGroup !== undefined) {
			this.#entries[this.#cursor] = values
			this.#activeGroup.lastUpdate = now
			return
		}

		this.#entries.push(values)
		this.#cursor = this.#entries.length - 1
		this.#activeGroup =
			this.#groupWindow > 0 && source.type === "control"
				? { lastUpdate: now, path: String(source.path) }
				: undefined
		this.#compact()
		this.#updateSnapshot()
	}

	async #navigate(
		offset: -1 | 1,
		action: "undo" | "redo",
	): Promise<HistoryOperationResult> {
		if (this.#operationInFlight) return "unavailable"
		this.#adoptLiveBoundary()
		this.#activeGroup = undefined
		const targetIndex = this.#cursor + offset
		if (targetIndex < 0 || targetIndex >= this.#entries.length) {
			return "unavailable"
		}
		return this.#restore(targetIndex, action)
	}

	async #seek(index: number): Promise<HistoryOperationResult> {
		if (!Number.isSafeInteger(index)) {
			throw new TypeError("History seek index must be an integer")
		}
		if (this.#operationInFlight) return "unavailable"
		this.#adoptLiveBoundary()
		this.#activeGroup = undefined
		if (index < 0 || index >= this.#entries.length) return "unavailable"
		return this.#restore(index, "seek")
	}

	async #restore(
		targetIndex: number,
		action: HistorySource<Input>["action"],
		journal?: NormalizedJournal<Input>,
	): Promise<HistoryOperationResult> {
		const target = cloneFormValue(
			journal?.entries[targetIndex] ?? this.#entries[targetIndex],
		)
		if (target === undefined) return "unavailable"

		const pending: PendingRestore<Input> = {
			action,
			target,
			targetIndex,
			...(journal === undefined ? {} : { journal }),
		}
		this.#pendingRestore = pending
		this.#operationInFlight = true

		let dispatchResult: unknown
		try {
			dispatchResult = this.#capability.restore(() => cloneFormValue(target), {
				action,
				type: "history",
			})
		} catch (error) {
			this.#pendingRestore = undefined
			this.#operationInFlight = false
			throw error
		}

		const outcome = pending.outcome ?? "cancelled"
		this.#pendingRestore = undefined
		try {
			await dispatchResult
			return outcome
		} finally {
			this.#operationInFlight = false
		}
	}

	#finishRestore(transaction: ValueTransaction<Input, Context>): void {
		const pending = this.#pendingRestore
		if (
			pending === undefined ||
			transaction.source.type !== "history" ||
			transaction.source.action !== pending.action
		) {
			return
		}

		if (areFormValuesEqual(transaction.nextValues, pending.target)) {
			if (pending.journal === undefined) {
				this.#cursor = pending.targetIndex
			} else {
				this.#entries = pending.journal.entries.map(cloneFormValue)
				this.#cursor = pending.journal.index
			}
			this.#activeGroup = undefined
			pending.outcome = "applied"
			this.#updateSnapshot()
			return
		}

		this.#truncateRedo()
		this.#entries.push(cloneFormValue(transaction.nextValues as Input))
		this.#cursor = this.#entries.length - 1
		this.#activeGroup = undefined
		this.#compact()
		pending.outcome = "transformed"
		this.#updateSnapshot()
	}

	#clear(): void {
		this.#adoptLiveBoundary()
		this.#entries = [cloneFormValue(this.#capability.getValues() as Input)]
		this.#cursor = 0
		this.#activeGroup = undefined
		this.#updateSnapshot()
	}

	#export(): HistoryJournal<Input> {
		this.#adoptLiveBoundary()
		return Object.freeze({
			entries: Object.freeze(this.#entries.map(cloneFormValue)),
			index: this.#cursor,
			version: 1,
		})
	}

	async #import(journal: unknown): Promise<HistoryOperationResult> {
		if (this.#operationInFlight) return "unavailable"
		this.#adoptLiveBoundary()
		this.#activeGroup = undefined
		const normalized = normalizeJournal<Input>(journal, this.#limit)
		return this.#restore(normalized.index, "import", normalized)
	}

	#adoptLiveBoundary(): void {
		this.#adoptBoundary(this.#capability.getValues() as Input)
	}

	#adoptBoundary(values: Input): void {
		const retained = this.#entries[this.#cursor]
		if (retained !== undefined && areFormValuesEqual(retained, values)) return
		this.#entries = [cloneFormValue(values)]
		this.#cursor = 0
		this.#activeGroup = undefined
		this.#updateSnapshot()
	}

	#truncateRedo(): void {
		if (this.#cursor < this.#entries.length - 1) {
			this.#entries.splice(this.#cursor + 1)
		}
	}

	#compact(): void {
		if (this.#limit === Number.POSITIVE_INFINITY) return
		const excess = this.#entries.length - 1 - this.#limit
		if (excess <= 0) return
		this.#entries.splice(0, excess)
		this.#cursor = Math.max(0, this.#cursor - excess)
		if (this.#cursor === 0) this.#activeGroup = undefined
	}

	#updateSnapshot(): void {
		const length = this.#entries.length - 1
		const next = createHistorySnapshot(this.#cursor, length)
		if (
			next.canUndo === this.#snapshot.canUndo &&
			next.canRedo === this.#snapshot.canRedo &&
			next.index === this.#snapshot.index &&
			next.length === this.#snapshot.length
		) {
			return
		}
		this.#snapshot = next
		for (const listener of [...this.#listeners]) listener()
	}
}

function claimHistoryCapability(
	capability: object,
	feature: HistoryFeature,
): void {
	if (readHistoryClaim(capability) !== undefined) {
		throw new TypeError("A form can configure only one history feature")
	}
	Object.defineProperty(capability, historyFeatureClaimKey, { value: feature })
}

function readHistoryClaim(capability: object): unknown {
	return (capability as Record<PropertyKey, unknown>)[historyFeatureClaimKey]
}

function createHistorySnapshot(index: number, length: number): HistorySnapshot {
	return Object.freeze({
		canRedo: index < length,
		canUndo: index > 0,
		index,
		length,
	})
}

function normalizeJournal<Input extends FieldValues>(
	input: unknown,
	limit: number,
): NormalizedJournal<Input> {
	if (input === null || typeof input !== "object" || Array.isArray(input)) {
		throw new TypeError("History journal must be an object")
	}
	const source = input as Record<string, unknown>
	if (source.version !== 1) {
		throw new TypeError(
			`Unsupported history journal version ${String(source.version)}`,
		)
	}
	if (!Array.isArray(source.entries) || source.entries.length === 0) {
		throw new TypeError("History journal must contain at least one entry")
	}
	if (limit !== Number.POSITIVE_INFINITY && source.entries.length - 1 > limit) {
		throw new TypeError("History journal exceeds the configured limit")
	}
	if (
		!Number.isSafeInteger(source.index) ||
		(source.index as number) < 0 ||
		(source.index as number) >= source.entries.length
	) {
		throw new TypeError("History journal index is outside its entries")
	}
	for (const entry of source.entries) {
		if (!isFormValueObject(entry)) {
			throw new TypeError("History journal entries must be form value objects")
		}
	}
	return {
		entries: source.entries.map((entry) => cloneFormValue(entry as Input)),
		index: source.index as number,
	}
}

function normalizeLimit(limit = 100): number {
	if (
		limit !== Number.POSITIVE_INFINITY &&
		(!Number.isSafeInteger(limit) || limit < 0)
	) {
		throw new TypeError(
			"History limit must be a non-negative integer or Infinity",
		)
	}
	return limit
}

function normalizeGroupWindow(groupWindow = 750): number {
	if (!Number.isFinite(groupWindow) || groupWindow < 0) {
		throw new TypeError(
			"History groupWindow must be a finite non-negative number",
		)
	}
	return groupWindow
}
