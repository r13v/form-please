import type { FieldOptionsResolver } from "./types.js"

/** The shared immutable empty option collection. */
export const emptyFieldOptions: readonly unknown[] = Object.freeze([])

type DependencyRoot = "context" | "values"

/** One value read by an active field-options resolver. */
export type FieldOptionsDependency = {
	readonly path: readonly PropertyKey[]
	readonly root: DependencyRoot
	readonly value: unknown
}

/** One production field-options resolver invocation. */
export type FieldOptionsRun = {
	readonly dependencies: FieldOptionsDependency[]
	resolve(): Promise<readonly unknown[]>
}

/** Identifies a resolver result that violates the field-options contract. */
export class FieldOptionsContractError extends TypeError {}

type Tracker = {
	readonly dependencies: FieldOptionsDependency[]
	readonly proxyTargets: WeakMap<object, object>
	track(root: DependencyRoot, value: unknown): unknown
}

/** Creates one lazy field-options invocation with the inputs tracked by React. */
export function createFieldOptionsResolution(
	source: unknown,
	values: unknown,
	context: unknown,
	signal: AbortSignal,
): FieldOptionsRun {
	if (typeof source !== "function") {
		throw new TypeError("Field options source must be a resolver")
	}
	const tracker = createTracker()
	return {
		dependencies: tracker.dependencies,
		resolve: async () => {
			const result = await (
				source as FieldOptionsResolver<unknown, unknown, unknown>
			)({
				context: tracker.track("context", context),
				signal,
				values: tracker.track("values", values),
			})
			return readOptionArray(result, tracker.proxyTargets)
		},
	}
}

/** Tests tracked resolver inputs against a later values and context pair. */
export function fieldOptionsInputsChanged(
	dependencies: readonly FieldOptionsDependency[],
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

/** Creates deeply tracked readonly views for one resolver invocation. */
function createTracker(): Tracker {
	const dependencies: FieldOptionsDependency[] = []
	const dependencyKeys = new Set<string>()
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
				recordDependency(dependencies, dependencyKeys, root, nextPath, result)
				return trackValue(root, result, nextPath)
			},
			getOwnPropertyDescriptor(target, key) {
				recordDependency(dependencies, dependencyKeys, root, path, target)
				return Reflect.getOwnPropertyDescriptor(target, key)
			},
			has(target, key) {
				recordDependency(dependencies, dependencyKeys, root, path, target)
				return Reflect.has(target, key)
			},
			ownKeys(target) {
				recordDependency(dependencies, dependencyKeys, root, path, target)
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
				recordDependency(dependencies, dependencyKeys, root, [], value)
				return value
			}
			return trackValue(root, value, [])
		},
	}
}

/** Records one property read once per resolver invocation. */
function recordDependency(
	dependencies: FieldOptionsDependency[],
	keys: Set<string>,
	root: DependencyRoot,
	path: readonly PropertyKey[],
	value: unknown,
) {
	const key = dependencyKey(root, path)
	if (keys.has(key)) return
	keys.add(key)
	dependencies.push({ path, root, value })
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
		throw new FieldOptionsContractError(
			"Field options resolvers must return an array",
		)
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
