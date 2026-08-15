import type { FieldValues } from "react-hook-form"

import type { FormBinding, FormDiagnosticsRuntime } from "../create-form-kit.js"
import type { ResolvedDefinition } from "../definition.js"
import {
	attachFormDiagnosticSink,
	type FormDiagnosticEvent,
	type FormDiagnosticFeature,
	type FormDiagnosticSink,
	formDiagnosticNow,
	getFormDiagnosticFeatures,
	type ManagedDiagnosticEvent,
} from "../diagnostics.js"
import { areFormValuesEqual, cloneFormValue } from "../form-value.js"
import type { ValueTransaction } from "../value-middleware.js"

type RuntimeTransaction = ValueTransaction<FieldValues, unknown>

/** One readable stage in a managed value update. */
type DevtoolsUpdateStage = Readonly<{
	error?: unknown
	input?: unknown
	label: string
	output?: unknown
	result?: unknown
	status: "cancelled" | "failed" | "forwarded" | "info" | "success"
	time: number
}>

/** One managed or direct React Hook Form value publication. */
export type DevtoolsUpdateEvent = Readonly<{
	asyncOutcome?: "fulfilled" | "rejected"
	duration?: number
	error?: unknown
	id: number
	kind: "managed" | "raw"
	name?: string
	nextValues?: unknown
	patches?: unknown
	paths: readonly string[]
	previousValues?: unknown
	result?: unknown
	source?: unknown
	stages: readonly DevtoolsUpdateStage[]
	startedAt: number
	status: "cancelled" | "committed" | "failed" | "running"
	type?: string
}>

/** The latest and previous request for one selectable field. */
export type DevtoolsOptionsState = Readonly<{
	current: DevtoolsOptionsRequest
	path: string
	previous?: DevtoolsOptionsRequest
}>

/** One observed asynchronous options request. */
export type DevtoolsOptionsRequest = Readonly<{
	dependencies: readonly Readonly<{
		path: readonly PropertyKey[]
		root: "context" | "values"
		value: unknown
	}>[]
	duration?: number
	error?: unknown
	optionCount?: number
	request: object
	startedAt: number
	status: "aborted" | "fulfilled" | "pending" | "rejected" | "stale"
}>

/** One feature snapshot change retained for local inspection. */
type DevtoolsFeatureTransition = Readonly<{
	causeId?: number
	snapshot: unknown
	time: number
}>

/** Current diagnostic state for one configured optional feature. */
export type DevtoolsFeatureState = Readonly<{
	details: unknown
	kind: "history" | "persistence"
	snapshot: unknown
	transitions: readonly DevtoolsFeatureTransition[]
}>

/** The last resolved-definition publication. */
export type DevtoolsResolution = Readonly<{
	causeId?: number
	changedNodeIds: readonly string[]
	duration?: number
	time: number
}>

/** Immutable external-store snapshot rendered by the devtools component. */
export type DevtoolsStoreSnapshot = Readonly<{
	features: readonly DevtoolsFeatureState[]
	lastFocus?: Readonly<{
		path?: string
		target: "field" | "summary" | "unavailable"
		time: number
	}>
	options: readonly DevtoolsOptionsState[]
	recording: boolean
	resolved?: ResolvedDefinition
	resolution?: DevtoolsResolution
	revision: number
	updates: readonly DevtoolsUpdateEvent[]
}>

type MutableUpdate = {
	asyncOutcome?: DevtoolsUpdateEvent["asyncOutcome"]
	duration?: number
	error?: unknown
	id: number
	kind: DevtoolsUpdateEvent["kind"]
	middlewareInputs: Map<number, unknown>
	name?: string
	nextValues?: unknown
	patches?: unknown
	paths: string[]
	previousValues?: unknown
	result?: unknown
	source?: unknown
	stages: DevtoolsUpdateStage[]
	startedAt: number
	status: DevtoolsUpdateEvent["status"]
	type?: string
}

type MutableOptions = {
	current: DevtoolsOptionsRequest
	path: string
	previous?: DevtoolsOptionsRequest
}

type MutableFeature = {
	adapter: FormDiagnosticFeature
	details: unknown
	kind: FormDiagnosticFeature["kind"]
	snapshot: unknown
	transitions: DevtoolsFeatureTransition[]
}

const maxUpdates = 100
const maxFeatureTransitions = 20

/** Aggregates private runtime publications for one exact form capability. */
export class FormPleaseDevtoolsStore implements FormDiagnosticSink {
	readonly #active = new WeakMap<object, MutableUpdate>()
	readonly #committing = new Set<object>()
	readonly #featureReleases: (() => void)[] = []
	readonly #features = new Map<FormDiagnosticFeature["kind"], MutableFeature>()
	readonly #listeners = new Set<() => void>()
	readonly #options = new Map<string, MutableOptions>()
	readonly #updates: MutableUpdate[] = []
	#connectionCount = 0
	#connected = false
	#form: FormBinding
	#lastFocus: DevtoolsStoreSnapshot["lastFocus"]
	#lastValues: FieldValues
	#nextUpdateId = 1
	#pendingCauseId: number | undefined
	#recording = true
	#releaseRHF: (() => void) | undefined
	#releaseSink: (() => void) | undefined
	#resolution: DevtoolsResolution | undefined
	#runtime: FormDiagnosticsRuntime
	#snapshot: DevtoolsStoreSnapshot = Object.freeze({
		features: Object.freeze([]),
		options: Object.freeze([]),
		recording: true,
		revision: 0,
		updates: Object.freeze([]),
	})

	constructor(form: FormBinding, runtime: FormDiagnosticsRuntime) {
		this.#form = form
		this.#runtime = runtime
		this.#lastValues = cloneFormValue(form.api.getValues())
		this.#setResolved(runtime.resolved)
	}

	/** Keeps the store across binding views from the same hook lifetime. */
	updateHost(form: FormBinding, runtime: FormDiagnosticsRuntime): void {
		this.#form = form
		this.#runtime = runtime
	}

	/** Connects all observers after the devtools component mounts. */
	connect(): () => void {
		this.#connectionCount++
		if (!this.#connected) {
			this.#connected = true
			this.#lastValues = cloneFormValue(this.#form.api.getValues())
			this.#setResolved(this.#runtime.resolved)
			this.#releaseSink = attachFormDiagnosticSink(
				this.#runtime.diagnosticTarget,
				this,
			)
			this.#releaseRHF = this.#form.api.subscribe({
				callback: ({ name, type, values }) =>
					this.#observeValues(values, name, type),
				formState: { values: true },
			})
			this.#connectFeatures()
			this.#emit()
		}
		let released = false
		return () => {
			if (released) return
			released = true
			if (this.#connectionCount > 0) this.#connectionCount--
			if (this.#connectionCount === 0) this.#disconnectObservers()
		}
	}

	/** Releases subscriptions without discarding the current journal. */
	disconnect(): void {
		this.#connectionCount = 0
		this.#disconnectObservers()
	}

	#disconnectObservers(): void {
		if (!this.#connected) return
		this.#connected = false
		this.#releaseSink?.()
		this.#releaseSink = undefined
		this.#releaseRHF?.()
		this.#releaseRHF = undefined
		this.#committing.clear()
		for (const release of this.#featureReleases.splice(0)) release()
	}

	getSnapshot = (): DevtoolsStoreSnapshot => this.#snapshot

	subscribe = (listener: () => void): (() => void) => {
		this.#listeners.add(listener)
		return () => this.#listeners.delete(listener)
	}

	publish = (event: FormDiagnosticEvent): void => {
		switch (event.kind) {
			case "definition":
				this.#observeDefinition(event)
				break
			case "focus":
				this.#lastFocus = {
					...(event.path === undefined ? {} : { path: event.path }),
					target: event.target,
					time: event.time,
				}
				this.#emit()
				break
			case "managed":
				this.#observeManaged(event)
				break
			case "options":
				this.#observeOptions(event)
				break
		}
	}

	setRecording(recording: boolean): void {
		if (recording === this.#recording) return
		this.#recording = recording
		this.#emit()
	}

	clearUpdates(): void {
		this.#updates.length = 0
		this.#pendingCauseId = undefined
		this.#emit()
	}

	getRuntime(): FormDiagnosticsRuntime {
		return this.#runtime
	}

	#observeDefinition(
		event: Extract<FormDiagnosticEvent, { kind: "definition" }>,
	): void {
		const previous = this.#snapshot.resolved
		this.#setResolved(event.resolved)
		const changedNodeIds = changedNodes(previous, event.resolved)
		this.#resolution = Object.freeze({
			...(this.#pendingCauseId === undefined
				? {}
				: { causeId: this.#pendingCauseId }),
			changedNodeIds: Object.freeze(changedNodeIds),
			...(event.duration === undefined ? {} : { duration: event.duration }),
			time: event.time,
		})
		this.#pendingCauseId = undefined
		this.#emit()
	}

	#observeManaged(event: ManagedDiagnosticEvent): void {
		if (event.phase === "start") {
			if (!this.#recording) return
			const transaction = event.transaction as RuntimeTransaction
			const update: MutableUpdate = {
				id: this.#nextUpdateId++,
				kind: "managed",
				middlewareInputs: new Map(),
				nextValues: transaction.nextValues,
				patches: transaction.patches,
				paths: patchPaths(transaction.patches),
				previousValues: transaction.previousValues,
				source: transaction.source,
				stages: [
					{
						input: transaction,
						label: "Proposal",
						status: "info",
						time: event.time,
					},
				],
				startedAt: event.time,
				status: "running",
			}
			this.#active.set(event.token, update)
			this.#updates.push(update)
			this.#compactUpdates()
			this.#emit()
			return
		}

		const update = this.#active.get(event.token)
		if (event.phase === "commit" && event.outcome === "start") {
			this.#committing.add(event.token)
			if (update !== undefined) this.#pendingCauseId = update.id
		}
		if (event.phase === "commit" && event.outcome !== "start") {
			this.#committing.delete(event.token)
			if (
				event.outcome === "failed" &&
				update !== undefined &&
				this.#pendingCauseId === update.id
			) {
				this.#pendingCauseId = undefined
			}
		}
		if (update === undefined) return

		switch (event.phase) {
			case "before-update": {
				const transaction = event.transaction as RuntimeTransaction | undefined
				if (transaction !== undefined) {
					update.nextValues = transaction.nextValues
					update.patches = transaction.patches
					update.paths = patchPaths(transaction.patches)
				}
				update.stages.push({
					...(event.error === undefined ? {} : { error: event.error }),
					...(transaction === undefined ? {} : { output: transaction }),
					label: "beforeUpdate",
					status: beforeUpdateStatus(event.outcome),
					time: event.time,
				})
				break
			}
			case "middleware-enter":
				update.middlewareInputs.set(event.index, event.transaction)
				break
			case "middleware-exit":
				update.stages.push({
					...(event.error === undefined ? {} : { error: event.error }),
					...(event.forwardedPatches === undefined
						? {}
						: { output: event.forwardedPatches }),
					input: update.middlewareInputs.get(event.index),
					label: event.name ?? `Middleware ${event.index + 1}`,
					...(event.result === undefined ? {} : { result: event.result }),
					status: event.outcome,
					time: event.time,
				})
				break
			case "commit":
				if (event.outcome === "success") {
					const transaction = event.transaction as RuntimeTransaction
					update.nextValues = transaction.nextValues
					update.patches = transaction.patches
					update.paths = patchPaths(transaction.patches)
				}
				if (event.outcome !== "start") {
					update.stages.push({
						...(event.error === undefined ? {} : { error: event.error }),
						label: "React Hook Form commit",
						status: event.outcome === "failed" ? "failed" : "success",
						time: event.time,
					})
				}
				break
			case "after-update":
				update.stages.push({
					...(event.error === undefined ? {} : { error: event.error }),
					label: "afterUpdate",
					status: afterUpdateStatus(event.outcome),
					time: event.time,
				})
				break
			case "end":
				update.duration = event.duration
				update.error = event.error
				update.result = event.result
				update.status = event.outcome
				this.#refreshFeatures(false)
				break
			case "settled":
				update.asyncOutcome = event.outcome
				update.duration = event.duration
				update.error = event.error
				break
		}
		this.#emit()
	}

	#observeOptions(
		event: Extract<FormDiagnosticEvent, { kind: "options" }>,
	): void {
		const existing = this.#options.get(event.path)
		if (event.status === "pending") {
			const current: DevtoolsOptionsRequest = Object.freeze({
				dependencies: Object.freeze([]),
				request: event.request,
				startedAt: event.time,
				status: "pending",
			})
			this.#options.set(event.path, {
				current,
				path: event.path,
				...(existing === undefined ? {} : { previous: existing.current }),
			})
			this.#emit()
			return
		}
		if (existing === undefined || existing.current.request !== event.request) {
			return
		}
		existing.current = Object.freeze({
			dependencies: Object.freeze([...(event.dependencies ?? [])]),
			...(event.duration === undefined ? {} : { duration: event.duration }),
			...(event.error === undefined ? {} : { error: event.error }),
			...(event.optionCount === undefined
				? {}
				: { optionCount: event.optionCount }),
			request: event.request,
			startedAt: existing.current.startedAt,
			status: event.status,
		})
		this.#emit()
	}

	#observeValues(values: FieldValues, name?: string, type?: string): void {
		const nextValues = cloneFormValue(values)
		if (areFormValuesEqual(this.#lastValues, nextValues)) return
		const previousValues = this.#lastValues
		this.#lastValues = nextValues
		if (this.#committing.size > 0 || !this.#recording) return

		const time = formDiagnosticNow()
		const update: MutableUpdate = {
			id: this.#nextUpdateId++,
			kind: "raw",
			middlewareInputs: new Map(),
			...(name === undefined ? {} : { name }),
			nextValues,
			paths: name === undefined ? [] : [name],
			previousValues,
			stages: [
				{
					label: "Direct RHF publication",
					status: "info",
					time,
				},
			],
			startedAt: time,
			status: "committed",
			...(type === undefined ? {} : { type }),
		}
		this.#updates.push(update)
		this.#compactUpdates()
		this.#pendingCauseId = update.id
		this.#refreshFeatures(false)
		this.#emit()
	}

	#connectFeatures(): void {
		for (const adapter of getFormDiagnosticFeatures(
			this.#runtime.diagnosticTarget,
		)) {
			if (!this.#features.has(adapter.kind)) {
				const snapshot = adapter.getSnapshot()
				this.#features.set(adapter.kind, {
					adapter,
					details: adapter.getDetails(),
					kind: adapter.kind,
					snapshot,
					transitions: [{ snapshot, time: formDiagnosticNow() }],
				})
			}
		}
		for (const state of this.#features.values()) {
			this.#featureReleases.push(
				state.adapter.subscribe(() => {
					state.snapshot = state.adapter.getSnapshot()
					state.details = state.adapter.getDetails()
					if (this.#recording) {
						state.transitions.push({
							...(this.#pendingCauseId === undefined
								? {}
								: { causeId: this.#pendingCauseId }),
							snapshot: state.snapshot,
							time: formDiagnosticNow(),
						})
						if (state.transitions.length > maxFeatureTransitions) {
							state.transitions.splice(
								0,
								state.transitions.length - maxFeatureTransitions,
							)
						}
					}
					this.#emit()
				}),
			)
		}
		this.#refreshFeatures(false)
	}

	#refreshFeatures(emit: boolean): void {
		for (const state of this.#features.values()) {
			state.snapshot = state.adapter.getSnapshot()
			state.details = state.adapter.getDetails()
		}
		if (emit) this.#emit()
	}

	#setResolved(resolved: ResolvedDefinition | undefined): void {
		if (resolved === undefined) return
		this.#snapshot = Object.freeze({ ...this.#snapshot, resolved })
	}

	#compactUpdates(): void {
		if (this.#updates.length <= maxUpdates) return
		this.#updates.splice(0, this.#updates.length - maxUpdates)
	}

	#emit(): void {
		this.#snapshot = Object.freeze({
			features: Object.freeze(
				[...this.#features.values()].map((feature) =>
					Object.freeze({
						details: feature.details,
						kind: feature.kind,
						snapshot: feature.snapshot,
						transitions: Object.freeze([...feature.transitions]),
					}),
				),
			),
			...(this.#lastFocus === undefined ? {} : { lastFocus: this.#lastFocus }),
			options: Object.freeze(
				[...this.#options.values()]
					.sort((left, right) => left.path.localeCompare(right.path))
					.map((state) => Object.freeze({ ...state })),
			),
			recording: this.#recording,
			...(this.#snapshot.resolved === undefined
				? {}
				: { resolved: this.#snapshot.resolved }),
			...(this.#resolution === undefined
				? {}
				: { resolution: this.#resolution }),
			revision: this.#snapshot.revision + 1,
			updates: Object.freeze(
				this.#updates.map((update) =>
					Object.freeze({
						...(update.asyncOutcome === undefined
							? {}
							: { asyncOutcome: update.asyncOutcome }),
						...(update.duration === undefined
							? {}
							: { duration: update.duration }),
						...(update.error === undefined ? {} : { error: update.error }),
						id: update.id,
						kind: update.kind,
						...(update.name === undefined ? {} : { name: update.name }),
						...(update.nextValues === undefined
							? {}
							: { nextValues: update.nextValues }),
						...(update.patches === undefined
							? {}
							: { patches: update.patches }),
						paths: Object.freeze([...update.paths]),
						...(update.previousValues === undefined
							? {}
							: { previousValues: update.previousValues }),
						...(update.result === undefined ? {} : { result: update.result }),
						...(update.source === undefined ? {} : { source: update.source }),
						stages: Object.freeze([...update.stages]),
						startedAt: update.startedAt,
						status: update.status,
						...(update.type === undefined ? {} : { type: update.type }),
					}),
				),
			),
		})
		for (const listener of [...this.#listeners]) listener()
	}
}

/** Finds node identities whose resolved references changed. */
function changedNodes(
	previous: ResolvedDefinition | undefined,
	next: ResolvedDefinition,
): string[] {
	if (previous === undefined) return next.nodes.map((node) => node.id)
	const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]))
	return next.nodes
		.filter((node) => previousNodes.get(node.id) !== node)
		.map((node) => node.id)
}

/** Converts authoritative Immer patch paths to RHF dot paths. */
function patchPaths(patches: RuntimeTransaction["patches"]): string[] {
	return [
		...new Set(
			patches.map((patch) => patch.path.map((part) => String(part)).join(".")),
		),
	]
}

function beforeUpdateStatus(
	outcome: "adjusted" | "cancelled" | "failed" | "unchanged",
): DevtoolsUpdateStage["status"] {
	if (outcome === "failed") return "failed"
	if (outcome === "cancelled") return "cancelled"
	if (outcome === "adjusted") return "forwarded"
	return "success"
}

function afterUpdateStatus(
	outcome: "failed" | "skipped" | "success",
): DevtoolsUpdateStage["status"] {
	if (outcome === "failed") return "failed"
	if (outcome === "skipped") return "info"
	return "success"
}
