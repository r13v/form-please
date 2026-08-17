"use client"

import { useEffect, useRef, useState } from "react"

import {
	formDiagnosticNow,
	hasFormDiagnosticSink,
	publishFormDiagnosticEvent,
} from "./diagnostics.js"
import {
	createFieldOptionsResolution,
	emptyFieldOptions,
	FieldOptionsContractError,
	type FieldOptionsDependency,
	fieldOptionsInputsChanged,
} from "./field-options.js"

type ActiveRun = {
	readonly controller: AbortController
	readonly dependencies: FieldOptionsDependency[]
	readonly diagnostic?: {
		finished: boolean
		readonly path: string
		readonly request: object
		readonly startedAt: number
		readonly target: object
	}
	stale: boolean
}

type FieldOptionsDiagnostics = Readonly<{
	path: string
	target: object
}>

type ContractFailure = {
	readonly active: ActiveRun
	readonly error: unknown
	readonly source: unknown
}

/** Resolves one static or reactive field-option source. */
export function useFieldOptions(
	source: unknown,
	values: unknown,
	context: unknown,
	diagnostics?: FieldOptionsDiagnostics,
): readonly unknown[] {
	const diagnosticPath = diagnostics?.path
	const diagnosticTarget = diagnostics?.target
	const [resolved, setResolved] = useState(emptyFieldOptions)
	const [revision, setRevision] = useState(0)
	const [contractFailure, setContractFailure] = useState<
		ContractFailure | undefined
	>()
	const activeRef = useRef<ActiveRun | undefined>(undefined)
	const latestRef = useRef({ context, values })
	latestRef.current = { context, values }

	useEffect(() => {
		const active = activeRef.current
		if (
			typeof source !== "function" ||
			active === undefined ||
			active.stale ||
			!fieldOptionsInputsChanged(active.dependencies, values, context)
		) {
			return
		}

		active.stale = true
		finishOptionsDiagnostic(active, "stale")
		active.controller.abort()
		setResolved(emptyFieldOptions)
		setRevision((current) => current + 1)
	}, [context, source, values])

	// biome-ignore lint/correctness/useExhaustiveDependencies: context and values are intentionally filtered through tracked property reads before revision changes.
	useEffect(() => {
		if (typeof source !== "function") {
			activeRef.current = undefined
			setContractFailure(undefined)
			return
		}

		setResolved(emptyFieldOptions)
		setContractFailure(undefined)
		const controller = new AbortController()
		const run = createFieldOptionsResolution(
			source,
			values,
			context,
			controller.signal,
		)
		const active: ActiveRun = {
			controller,
			dependencies: run.dependencies,
			...(diagnosticPath !== undefined &&
			diagnosticTarget !== undefined &&
			hasFormDiagnosticSink(diagnosticTarget)
				? {
						diagnostic: {
							finished: false,
							path: diagnosticPath,
							request: {},
							startedAt: formDiagnosticNow(),
							target: diagnosticTarget,
						},
					}
				: {}),
			stale: false,
		}
		activeRef.current = active
		if (active.diagnostic !== undefined) {
			publishFormDiagnosticEvent(active.diagnostic.target, {
				kind: "options",
				path: active.diagnostic.path,
				request: active.diagnostic.request,
				status: "pending",
				time: active.diagnostic.startedAt,
			})
		}

		const reloadIfInputsChanged = (): boolean => {
			const latest = latestRef.current
			if (
				!fieldOptionsInputsChanged(
					active.dependencies,
					latest.values,
					latest.context,
				)
			) {
				return false
			}
			active.stale = true
			finishOptionsDiagnostic(active, "stale")
			controller.abort()
			setResolved(emptyFieldOptions)
			setRevision((current) => current + 1)
			return true
		}

		const load = async (): Promise<void> => {
			try {
				const options = await run.resolve()
				if (active.stale || controller.signal.aborted) return
				if (reloadIfInputsChanged()) return
				setResolved(options)
				finishOptionsDiagnostic(active, "fulfilled", {
					optionCount: options.length,
				})
			} catch (error) {
				if (active.stale || controller.signal.aborted) return
				if (reloadIfInputsChanged()) return
				setResolved(emptyFieldOptions)
				if (error instanceof FieldOptionsContractError) {
					setContractFailure({ active, error, source })
				}
				finishOptionsDiagnostic(active, "rejected", { error })
			}
		}

		void load()
		return () => {
			active.stale = true
			finishOptionsDiagnostic(active, "aborted")
			controller.abort()
		}
	}, [diagnosticPath, diagnosticTarget, revision, source])

	if (
		contractFailure !== undefined &&
		contractFailure.source === source &&
		!contractFailure.active.stale &&
		!fieldOptionsInputsChanged(
			contractFailure.active.dependencies,
			values,
			context,
		)
	) {
		throw contractFailure.error
	}
	return Array.isArray(source) ? source : resolved
}

/** Completes one observable options request exactly once. */
function finishOptionsDiagnostic(
	active: ActiveRun,
	status: "aborted" | "fulfilled" | "rejected" | "stale",
	details: { readonly error?: unknown; readonly optionCount?: number } = {},
): void {
	const diagnostic = active.diagnostic
	if (diagnostic === undefined || diagnostic.finished) return
	diagnostic.finished = true
	const time = formDiagnosticNow()
	publishFormDiagnosticEvent(diagnostic.target, {
		...details,
		dependencies: active.dependencies.map(({ path, root, value }) => ({
			path,
			root,
			value,
		})),
		duration: time - diagnostic.startedAt,
		kind: "options",
		path: diagnostic.path,
		request: diagnostic.request,
		status,
		time,
	})
}
