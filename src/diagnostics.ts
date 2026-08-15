import type { ResolvedDefinition } from "./definition.js"

/** One opaque managed-update identity shared across diagnostic stages. */
export type ManagedDiagnosticToken = object

/** A package-private managed-update stage published by the coordinator. */
export type ManagedDiagnosticEvent =
	| Readonly<{
			kind: "managed"
			phase: "start"
			time: number
			token: ManagedDiagnosticToken
			transaction: unknown
	  }>
	| Readonly<{
			error?: unknown
			kind: "managed"
			outcome: "adjusted" | "cancelled" | "failed" | "unchanged"
			phase: "before-update"
			time: number
			token: ManagedDiagnosticToken
			transaction?: unknown
	  }>
	| Readonly<{
			index: number
			kind: "managed"
			name?: string
			phase: "middleware-enter"
			time: number
			token: ManagedDiagnosticToken
			transaction: unknown
	  }>
	| Readonly<{
			error?: unknown
			forwardedPatches?: unknown
			index: number
			kind: "managed"
			name?: string
			outcome: "cancelled" | "failed" | "forwarded"
			phase: "middleware-exit"
			result?: unknown
			time: number
			token: ManagedDiagnosticToken
	  }>
	| Readonly<{
			error?: unknown
			kind: "managed"
			outcome: "failed" | "start" | "success"
			phase: "commit"
			time: number
			token: ManagedDiagnosticToken
			transaction: unknown
	  }>
	| Readonly<{
			error?: unknown
			kind: "managed"
			outcome: "failed" | "skipped" | "success"
			phase: "after-update"
			time: number
			token: ManagedDiagnosticToken
			transaction?: unknown
	  }>
	| Readonly<{
			duration: number
			error?: unknown
			kind: "managed"
			outcome: "cancelled" | "committed" | "failed"
			phase: "end"
			result?: unknown
			time: number
			token: ManagedDiagnosticToken
	  }>
	| Readonly<{
			duration: number
			error?: unknown
			kind: "managed"
			outcome: "fulfilled" | "rejected"
			phase: "settled"
			time: number
			token: ManagedDiagnosticToken
	  }>

/** One async selectable-options request stage. */
type OptionsDiagnosticEvent = Readonly<{
	dependencies?: readonly Readonly<{
		path: readonly PropertyKey[]
		root: "context" | "values"
		value: unknown
	}>[]
	duration?: number
	error?: unknown
	kind: "options"
	optionCount?: number
	path: string
	request: object
	status: "aborted" | "fulfilled" | "pending" | "rejected" | "stale"
	time: number
}>

/** One current resolved-definition publication. */
type DefinitionDiagnosticEvent = Readonly<{
	duration?: number
	kind: "definition"
	resolved: ResolvedDefinition
	time: number
}>

/** One focus outcome after an invalid generated form submission. */
type FocusDiagnosticEvent = Readonly<{
	kind: "focus"
	path?: string
	target: "field" | "summary" | "unavailable"
	time: number
}>

/** All package-private events observed by the optional devtools entry. */
export type FormDiagnosticEvent =
	| DefinitionDiagnosticEvent
	| FocusDiagnosticEvent
	| ManagedDiagnosticEvent
	| OptionsDiagnosticEvent

/** A read-only optional-feature view consumed by the Features tab. */
export type FormDiagnosticFeature = Readonly<{
	getDetails(): unknown
	getSnapshot(): unknown
	kind: "history" | "persistence"
	subscribe(listener: () => void): () => void
}>

/** One diagnostic consumer attached to an exact coordinator capability. */
export type FormDiagnosticSink = Readonly<{
	publish(event: FormDiagnosticEvent): void
}>

const diagnosticSinks = new WeakMap<object, Set<FormDiagnosticSink>>()
const diagnosticFeatures = new WeakMap<object, FormDiagnosticFeature[]>()

/** Attaches one optional consumer without changing the public form binding. */
export function attachFormDiagnosticSink(
	target: object,
	sink: FormDiagnosticSink,
): () => void {
	const sinks = diagnosticSinks.get(target) ?? new Set<FormDiagnosticSink>()
	sinks.add(sink)
	diagnosticSinks.set(target, sinks)
	let attached = true
	return () => {
		if (!attached) return
		attached = false
		sinks.delete(sink)
		if (sinks.size === 0) diagnosticSinks.delete(target)
	}
}

/** Tests whether an exact form currently has a diagnostic consumer. */
export function hasFormDiagnosticSink(target: object): boolean {
	return (diagnosticSinks.get(target)?.size ?? 0) > 0
}

/** Publishes one event only to consumers for the exact form capability. */
export function publishFormDiagnosticEvent(
	target: object,
	event: FormDiagnosticEvent,
): void {
	const sinks = diagnosticSinks.get(target)
	if (sinks === undefined) return
	for (const sink of [...sinks]) sink.publish(event)
}

/** Registers one configured optional feature for automatic discovery. */
export function registerFormDiagnosticFeature(
	target: object,
	feature: FormDiagnosticFeature,
): void {
	const features = diagnosticFeatures.get(target) ?? []
	const existing = features.find((candidate) => candidate.kind === feature.kind)
	if (existing !== undefined) return
	features.push(feature)
	diagnosticFeatures.set(target, features)
}

/** Reads configured optional features without importing their public entries. */
export function getFormDiagnosticFeatures(
	target: object,
): readonly FormDiagnosticFeature[] {
	return diagnosticFeatures.get(target) ?? []
}

/** Reads a monotonic clock when the host provides one. */
export function formDiagnosticNow(): number {
	return typeof performance === "undefined" ? Date.now() : performance.now()
}
