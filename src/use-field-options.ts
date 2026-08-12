"use client"

import { useEffect, useRef, useState } from "react"

import type { FieldOptionsResolver } from "./types.js"

const emptyOptions: readonly unknown[] = Object.freeze([])

type DependencyRoot = "context" | "values"

type Dependency = {
	readonly path: readonly PropertyKey[]
	readonly root: DependencyRoot
	readonly value: unknown
}

type ActiveRun = {
	readonly controller: AbortController
	readonly dependencies: Dependency[]
	stale: boolean
}

type Tracker = {
	readonly dependencies: Dependency[]
	readonly proxyTargets: WeakMap<object, object>
	track(root: DependencyRoot, value: unknown): unknown
}

/** Resolves one static or reactive field-option source. */
export function useFieldOptions(
	source: unknown,
	values: unknown,
	context: unknown,
): readonly unknown[] {
	const [resolved, setResolved] = useState(emptyOptions)
	const [revision, setRevision] = useState(0)
	const activeRef = useRef<ActiveRun | undefined>(undefined)
	const latestRef = useRef({ context, values })
	latestRef.current = { context, values }

	useEffect(() => {
		const active = activeRef.current
		if (
			typeof source !== "function" ||
			active === undefined ||
			active.stale ||
			!dependenciesChanged(active.dependencies, values, context)
		) {
			return
		}

		active.stale = true
		active.controller.abort()
		setResolved(emptyOptions)
		setRevision((current) => current + 1)
	}, [context, source, values])

	// biome-ignore lint/correctness/useExhaustiveDependencies: context and values are intentionally filtered through tracked property reads before revision changes.
	useEffect(() => {
		if (typeof source !== "function") {
			activeRef.current = undefined
			return
		}

		setResolved(emptyOptions)
		const controller = new AbortController()
		const tracker = createTracker()
		const active: ActiveRun = {
			controller,
			dependencies: tracker.dependencies,
			stale: false,
		}
		activeRef.current = active

		const reloadIfInputsChanged = (): boolean => {
			const latest = latestRef.current
			if (
				!dependenciesChanged(active.dependencies, latest.values, latest.context)
			) {
				return false
			}
			active.stale = true
			controller.abort()
			setResolved(emptyOptions)
			setRevision((current) => current + 1)
			return true
		}

		const load = async () => {
			try {
				const result = await (
					source as FieldOptionsResolver<unknown, unknown, unknown>
				)({
					context: tracker.track("context", context),
					signal: controller.signal,
					values: tracker.track("values", values),
				})
				if (active.stale || controller.signal.aborted) return
				if (reloadIfInputsChanged()) return
				setResolved(readOptionArray(result, tracker.proxyTargets))
			} catch {
				if (active.stale || controller.signal.aborted) return
				if (reloadIfInputsChanged()) return
				setResolved(emptyOptions)
			}
		}

		void load()
		return () => {
			active.stale = true
			controller.abort()
		}
	}, [revision, source])

	return Array.isArray(source) ? source : resolved
}

/** Creates deeply tracked readonly views for one resolver invocation. */
function createTracker(): Tracker {
	const dependencies: Dependency[] = []
	const proxies = new WeakMap<object, Map<string, object>>()
	const proxyTargets = new WeakMap<object, object>()

	const trackValue = (
		root: DependencyRoot,
		value: unknown,
		path: readonly PropertyKey[],
	): unknown => {
		if (!isTrackable(value)) return value
		const pathKey = dependencyKey(root, path)
		const existing = proxies.get(value)?.get(pathKey)
		if (existing !== undefined) return existing

		const proxy = new Proxy(value, {
			get(target, key, receiver) {
				const nextPath = [...path, key]
				const result = Reflect.get(target, key, receiver)
				recordDependency(dependencies, root, nextPath, result)
				return trackValue(root, result, nextPath)
			},
			getOwnPropertyDescriptor(target, key) {
				recordDependency(dependencies, root, path, target)
				return Reflect.getOwnPropertyDescriptor(target, key)
			},
			has(target, key) {
				recordDependency(dependencies, root, path, target)
				return Reflect.has(target, key)
			},
			ownKeys(target) {
				recordDependency(dependencies, root, path, target)
				return Reflect.ownKeys(target)
			},
		})
		const byPath = proxies.get(value) ?? new Map<string, object>()
		byPath.set(pathKey, proxy)
		proxies.set(value, byPath)
		proxyTargets.set(proxy, value)
		return proxy
	}

	return {
		dependencies,
		proxyTargets,
		track: (root, value) => {
			if (!isTrackable(value)) {
				recordDependency(dependencies, root, [], value)
				return value
			}
			return trackValue(root, value, [])
		},
	}
}

/** Records one property read once per resolver invocation. */
function recordDependency(
	dependencies: Dependency[],
	root: DependencyRoot,
	path: readonly PropertyKey[],
	value: unknown,
) {
	const key = dependencyKey(root, path)
	const existing = dependencies.find(
		(dependency) => dependencyKey(dependency.root, dependency.path) === key,
	)
	if (existing === undefined) dependencies.push({ path, root, value })
}

/** Tests tracked values against the latest resolver inputs. */
function dependenciesChanged(
	dependencies: readonly Dependency[],
	values: unknown,
	context: unknown,
): boolean {
	return dependencies.some(
		(dependency) =>
			!Object.is(
				readPath(
					dependency.root === "values" ? values : context,
					dependency.path,
				),
				dependency.value,
			),
	)
}

/** Reads one tracked property path without proxying the latest input. */
function readPath(root: unknown, path: readonly PropertyKey[]): unknown {
	let current = root
	for (const key of path) {
		if (
			current === null ||
			(typeof current !== "object" && typeof current !== "function")
		) {
			return undefined
		}
		current = Reflect.get(current, key)
	}
	return current
}

/** Returns a validated array and removes tracking proxies from direct options. */
function readOptionArray(
	value: unknown,
	proxyTargets: WeakMap<object, object>,
): readonly unknown[] {
	const direct = isObject(value) ? proxyTargets.get(value) : undefined
	const options = direct ?? value
	if (!Array.isArray(options)) {
		throw new TypeError("Field options resolvers must return an array")
	}
	let changed = false
	const unwrapped = options.map((option) => {
		const target = isObject(option) ? proxyTargets.get(option) : undefined
		if (target === undefined) return option
		changed = true
		return target
	})
	return changed ? unwrapped : options
}

/** Tests whether a value can be observed without breaking native objects. */
function isTrackable(value: unknown): value is object {
	if (!isObject(value)) return false
	const prototype = Object.getPrototypeOf(value)
	return (
		prototype === null ||
		prototype === Object.prototype ||
		prototype === Array.prototype
	)
}

/** Tests whether a value can be used as a WeakMap key. */
function isObject(value: unknown): value is object {
	return (
		value !== null && (typeof value === "object" || typeof value === "function")
	)
}

/** Produces a stable internal identity for one tracked property path. */
function dependencyKey(
	root: DependencyRoot,
	path: readonly PropertyKey[],
): string {
	return `${root}:${path
		.map((key) =>
			typeof key === "symbol"
				? `symbol:${String(key.description)}`
				: String(key),
		)
		.join("\u0000")}`
}
