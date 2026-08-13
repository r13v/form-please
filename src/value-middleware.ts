import {
	type Draft,
	enableMapSet,
	enablePatches,
	Immer,
	type Patch,
} from "immer"
import type { FieldValues } from "react-hook-form"

import type { ArrayFieldPath, DeepReadonly, FieldPath } from "./types.js"

enableMapSet()
enablePatches()

const valueImmer = new Immer({ autoFreeze: false })

/** One authoritative Immer operation in a proposed value update. */
export type ValuePatch = Readonly<
	Omit<Patch, "path" | "value"> & {
		/** Path segments understood by Immer rather than an RHF dot path. */
		readonly path: readonly (string | number)[]
		/** Replacement or added value when the operation carries one. */
		readonly value?: unknown
	}
>

/** A replacement value or the empty result of a mutating Immer recipe. */
// biome-ignore lint/suspicious/noConfusingVoidType: A mutating Immer recipe intentionally returns void.
type FormUpdateRecipeResult<Input> = Input | undefined | void

/** A synchronous Immer recipe used to derive one managed value update. */
export type FormUpdateRecipe<Input> = (
	draft: Draft<Input>,
) => FormUpdateRecipeResult<Input>

/** Identifies the managed operation that proposed a value transaction. */
export type ValueTransactionSource<Input extends FieldValues> =
	| {
			readonly type: "control"
			readonly path: FieldPath<Input>
	  }
	| {
			readonly type: "array"
			readonly path: ArrayFieldPath<Input>
			readonly action: "append"
			readonly index: number
	  }
	| {
			readonly type: "array"
			readonly path: ArrayFieldPath<Input>
			readonly action: "remove"
			readonly index: number
	  }
	| {
			readonly type: "array"
			readonly path: ArrayFieldPath<Input>
			readonly action: "move"
			readonly fromIndex: number
			readonly toIndex: number
	  }
	| {
			readonly type: "update"
	  }
	| {
			readonly type: "history"
			readonly action: "undo" | "redo" | "seek" | "import"
	  }
	| {
			readonly type: "persistence"
			readonly action: "restore"
	  }

/** A proposed or final managed value update used by hooks and middleware. */
export type ValueTransaction<Input extends FieldValues, Context = unknown> = {
	/** Values before the managed update began. */
	readonly previousValues: DeepReadonly<Input>
	/** Values derived by applying `patches` to `previousValues`. */
	readonly nextValues: DeepReadonly<Input>
	/** The authoritative operations used to derive `nextValues`. */
	readonly patches: readonly ValuePatch[]
	/** The generated or imperative operation that proposed the update. */
	readonly source: ValueTransactionSource<Input>
	/** Current application context for this form binding. */
	readonly context: DeepReadonly<Context>
}

/** Accepts an adjusted proposal or cancels it before middleware. */
// biome-ignore lint/suspicious/noConfusingVoidType: Accepting a mutating hook intentionally returns void.
export type BeforeUpdateResult = false | void

/** Adjusts or cancels one proposed managed value update. */
type BeforeUpdate<Input extends FieldValues, Context> = (
	draft: Draft<Input>,
	transaction: ValueTransaction<Input, Context>,
) => BeforeUpdateResult

/** Observes one final managed value transaction after commit. */
type AfterUpdate<Input extends FieldValues, Context> = (
	transaction: ValueTransaction<Input, Context>,
) => void

/** Operations available while configuring middleware for one form. */
export type FormMiddlewareApi<Input extends FieldValues> = {
	/** Reads the current RHF values as a synchronous readonly view. */
	getValues(): DeepReadonly<Input>
	/** Starts a managed update when no transaction is currently active. */
	update(recipe: FormUpdateRecipe<Input>): unknown
}

/** Forwards authoritative patches to the next middleware or terminal. */
export type FormMiddlewareNext = (patches: readonly ValuePatch[]) => unknown

/** One synchronous Redux-shaped value middleware. */
export type FormMiddleware<Input extends FieldValues, Context = unknown> = (
	api: FormMiddlewareApi<Input>,
) => (
	next: FormMiddlewareNext,
) => (transaction: ValueTransaction<Input, Context>) => unknown

/** Applies a terminal transaction to the RHF-owned runtime. */
export type ValueTransactionCommit<Input extends FieldValues, Context> = (
	transaction: ValueTransaction<Input, Context>,
) => void

type CoordinatorOptions<Input extends FieldValues, Context> = {
	readonly middleware: readonly FormMiddleware<Input, Context>[]
	readonly getValues: () => Input
	readonly getContext: () => Context
	readonly getBeforeUpdate?: () => BeforeUpdate<Input, Context> | undefined
	readonly getAfterUpdate?: () => AfterUpdate<Input, Context> | undefined
	readonly commit: ValueTransactionCommit<Input, Context>
	readonly restore?: ValueTransactionCommit<Input, Context>
}

type ManagedDispatchOptions<Input extends FieldValues, Context> = {
	readonly allowTopLevelRemoval?: boolean
	readonly commit?: ValueTransactionCommit<Input, Context>
	readonly arrayPath?: readonly (string | number)[]
}

/** Internal managed-update coordinator used by one form binding. */
export type ValueCoordinator<Input extends FieldValues, Context> = {
	/** Starts an imperative update with an `update` source. */
	update(recipe: FormUpdateRecipe<Input>): unknown
	/** Starts a generated control or array update. */
	dispatch(
		recipe: FormUpdateRecipe<Input>,
		source: ValueTransactionSource<Input>,
		options?: ManagedDispatchOptions<Input, Context>,
	): unknown
}

/** Package-private operations shared with optional managed-value features. */
export type ValueCoordinatorCapability<Input extends FieldValues, Context> = {
	/** Reads the current RHF-owned values. */
	getValues(): DeepReadonly<Input>
	/** Reads the terminal commit while a middleware frame is active. */
	getCommittedTransaction(): ValueTransaction<Input, Context> | undefined
	/** Dispatches a complete feature restore through the managed pipeline. */
	restore(
		recipe: FormUpdateRecipe<Input>,
		source: Extract<
			ValueTransactionSource<Input>,
			{ type: "history" | "persistence" }
		>,
	): unknown
}

const valueCoordinatorCapabilityKey = Symbol.for(
	"form-please.value-coordinator-capability",
)

/** Reads the package-private coordinator capability from an integration host. */
export function getValueCoordinatorCapability<
	Input extends FieldValues,
	Context = unknown,
>(target: object): ValueCoordinatorCapability<Input, Context> {
	const capability =
		target === null ||
		(typeof target !== "object" && typeof target !== "function")
			? undefined
			: (target as Record<PropertyKey, unknown>)[valueCoordinatorCapabilityKey]
	if (capability === undefined) {
		throw new TypeError(
			"Managed value feature requires a current Form Please form binding",
		)
	}
	return capability as ValueCoordinatorCapability<Input, Context>
}

/** Copies one package-private coordinator capability to another integration host. */
export function attachValueCoordinatorCapability(
	target: object,
	source: object,
): void {
	const capability = getValueCoordinatorCapability(source)
	Object.defineProperty(target, valueCoordinatorCapabilityKey, {
		value: capability,
	})
}

type TransactionDispatch<Input extends FieldValues, Context> = (
	transaction: ValueTransaction<Input, Context>,
) => unknown

type ActiveDispatch<Input extends FieldValues, Context> = {
	readonly allowTopLevelRemoval: boolean
	readonly commit: ValueTransactionCommit<Input, Context>
	committed?: ValueTransaction<Input, Context>
	readonly arrayStructure?: {
		readonly path: readonly (string | number)[]
		readonly patches: readonly ValuePatch[]
	}
}

/** Creates one fixed middleware chain around an RHF terminal. */
export function createValueCoordinator<
	Input extends FieldValues,
	Context = unknown,
>(
	options: CoordinatorOptions<Input, Context>,
): ValueCoordinator<Input, Context> {
	let activeDispatch: ActiveDispatch<Input, Context> | undefined
	let pipelineReady = false
	let pipeline: TransactionDispatch<Input, Context>

	const api: FormMiddlewareApi<Input> = {
		getValues: () => options.getValues() as DeepReadonly<Input>,
		update: (recipe) => dispatch(recipe, { type: "update" }),
	}
	const capability: ValueCoordinatorCapability<Input, Context> = {
		getCommittedTransaction: () => activeDispatch?.committed,
		getValues: api.getValues,
		restore: (recipe, source) => {
			if (options.restore === undefined) {
				throw new TypeError("This form binding does not support value restore")
			}
			return dispatch(recipe, source, {
				allowTopLevelRemoval: true,
				commit: options.restore,
			})
		},
	}
	Object.defineProperty(api, valueCoordinatorCapabilityKey, {
		value: capability,
	})

	const terminal: TransactionDispatch<Input, Context> = (transaction) => {
		if (activeDispatch === undefined) {
			throw new TypeError("Value middleware next called outside a transaction")
		}
		activeDispatch.commit(transaction)
		activeDispatch.committed = transaction
		return transaction
	}

	pipeline = options.middleware.reduceRight<
		TransactionDispatch<Input, Context>
	>((nextDispatch, middleware, index) => {
		let frame:
			| {
					called: boolean
					open: boolean
					readonly transaction: ValueTransaction<Input, Context>
			  }
			| undefined
		const configured = middleware(api)
		const handle = configured((patches) => {
			if (frame === undefined || !frame.open) {
				throw new TypeError(
					`Value middleware ${index} must call next synchronously`,
				)
			}
			if (frame.called) {
				throw new TypeError(
					`Value middleware ${index} cannot call next more than once`,
				)
			}
			frame.called = true
			const replacement = createTransaction(
				frame.transaction.previousValues as Input,
				patches,
				frame.transaction.source,
				frame.transaction.context as Context,
				activeDispatch?.allowTopLevelRemoval === true,
			)
			assertActiveArrayStructure(replacement.patches, activeDispatch)
			return nextDispatch(replacement)
		})
		return (transaction) => {
			if (frame !== undefined) {
				throw new TypeError(
					`Value middleware ${index} cannot dispatch recursively`,
				)
			}
			frame = { called: false, open: true, transaction }
			try {
				return handle(transaction)
			} finally {
				frame.open = false
				frame = undefined
			}
		}
	}, terminal)
	pipelineReady = true

	function dispatch(
		recipe: FormUpdateRecipe<Input>,
		source: ValueTransactionSource<Input>,
		dispatchOptions: ManagedDispatchOptions<Input, Context> = {},
	): unknown {
		if (!pipelineReady) {
			throw new TypeError(
				"Form middleware cannot update values while the pipeline initializes",
			)
		}
		if (activeDispatch !== undefined) {
			throw new TypeError(
				"Form middleware cannot start a nested value transaction",
			)
		}
		const previousValues = options.getValues()
		const [, producedPatches] = valueImmer.produceWithPatches(
			previousValues,
			// biome-ignore lint/suspicious/noConfusingVoidType: The public mutating recipe intentionally returns void.
			(draft) => recipe(draft) as Draft<Input> | undefined | void,
		)
		if (producedPatches.length === 0) return undefined

		const patches = producedPatches as readonly ValuePatch[]
		const transaction = createTransaction(
			previousValues,
			patches,
			source,
			options.getContext(),
			dispatchOptions.allowTopLevelRemoval === true,
		)
		const arrayStructure =
			dispatchOptions.arrayPath === undefined
				? undefined
				: {
						path: dispatchOptions.arrayPath,
						patches: structuralArrayPatches(patches, dispatchOptions.arrayPath),
					}
		activeDispatch = {
			allowTopLevelRemoval: dispatchOptions.allowTopLevelRemoval === true,
			commit: dispatchOptions.commit ?? options.commit,
			...(arrayStructure === undefined ? {} : { arrayStructure }),
		}
		try {
			const effectiveTransaction = applyBeforeUpdate(
				transaction,
				options.getBeforeUpdate?.(),
				activeDispatch.allowTopLevelRemoval,
			)
			if (effectiveTransaction === undefined) return undefined
			assertActiveArrayStructure(effectiveTransaction.patches, activeDispatch)

			let result: unknown
			let pipelineError: unknown
			let pipelineFailed = false
			try {
				result = pipeline(effectiveTransaction)
			} catch (error) {
				pipelineError = error
				pipelineFailed = true
			}

			const committed = activeDispatch.committed
			let afterError: unknown
			let afterFailed = false
			if (committed !== undefined) {
				try {
					const afterResult = options.getAfterUpdate?.()?.(committed)
					assertSynchronousHookResult(afterResult, "afterUpdate")
				} catch (error) {
					afterError = error
					afterFailed = true
				}
			}

			if (pipelineFailed) {
				if (afterFailed) throw updateAggregateError(pipelineError, afterError)
				throw pipelineError
			}
			if (!afterFailed) return result
			if (!isPromiseLike(result)) throw afterError
			return Promise.resolve(result).then(
				() => {
					throw afterError
				},
				(error: unknown) => {
					throw updateAggregateError(error, afterError)
				},
			)
		} finally {
			activeDispatch = undefined
		}
	}

	const coordinator: ValueCoordinator<Input, Context> = {
		dispatch,
		update: (recipe) => dispatch(recipe, { type: "update" }),
	}
	Object.defineProperty(coordinator, valueCoordinatorCapabilityKey, {
		value: capability,
	})
	return coordinator
}

/** Applies the current before-update hook and rebuilds its effective patches. */
function applyBeforeUpdate<Input extends FieldValues, Context>(
	transaction: ValueTransaction<Input, Context>,
	beforeUpdate: BeforeUpdate<Input, Context> | undefined,
	allowTopLevelRemoval: boolean,
): ValueTransaction<Input, Context> | undefined {
	if (beforeUpdate === undefined) return transaction

	const hookState = { cancelled: false }
	const [nextValues, adjustmentPatches] = valueImmer.produceWithPatches(
		transaction.nextValues as Input,
		(draft) => {
			const hookResult = beforeUpdate(draft, transaction)
			assertSynchronousHookResult(hookResult, "beforeUpdate")
			hookState.cancelled = hookResult === false
		},
	)
	if (hookState.cancelled) return undefined
	if (adjustmentPatches.length === 0) return transaction

	const combinedPatches = [
		...transaction.patches,
		...adjustmentPatches,
	] as readonly ValuePatch[]
	const patches =
		transaction.source.type === "array"
			? combinedPatches
			: effectivePatches(
					transaction.previousValues as Input,
					nextValues,
					combinedPatches,
				)
	if (patches.length === 0) return undefined
	return createTransaction(
		transaction.previousValues as Input,
		patches,
		transaction.source,
		transaction.context as Context,
		allowTopLevelRemoval,
	)
}

/** Removes superseded proposal operations and keeps only their final values. */
function effectivePatches<Input extends FieldValues>(
	previousValues: Input,
	nextValues: Input,
	patches: readonly ValuePatch[],
): readonly ValuePatch[] {
	const paths = patches.some((patch) => patch.path.length === 0)
		? Array.from(
				new Set([...Object.keys(previousValues), ...Object.keys(nextValues)]),
				(key) => [key] as const,
			)
		: compactPatchPaths(patches.map((patch) => patch.path))
	return paths.flatMap((path): readonly ValuePatch[] => {
		const previous = readPatchTarget(previousValues, path)
		const next = readPatchTarget(nextValues, path)
		if (
			previous.exists === next.exists &&
			Object.is(previous.value, next.value)
		) {
			return []
		}
		if (!next.exists) return [{ op: "remove", path }]
		return [
			{
				op: previous.exists ? "replace" : "add",
				path,
				value: next.value,
			},
		]
	})
}

/** Selects the shallowest unique paths that contain every affected value. */
function compactPatchPaths(
	paths: readonly (readonly (string | number)[])[],
): readonly (readonly (string | number)[])[] {
	const compacted: (readonly (string | number)[])[] = []
	for (const path of paths) {
		if (compacted.some((candidate) => isPathPrefix(candidate, path))) continue
		for (let index = compacted.length - 1; index >= 0; index -= 1) {
			if (isPathPrefix(path, compacted[index] ?? [])) compacted.splice(index, 1)
		}
		if (!compacted.some((candidate) => samePath(candidate, path))) {
			compacted.push(path)
		}
	}
	return compacted
}

/** Reads whether one Immer path exists and the value currently stored there. */
function readPatchTarget(
	root: unknown,
	path: readonly (string | number)[],
): { readonly exists: boolean; readonly value: unknown } {
	let current = root
	for (const segment of path) {
		if (current === null || typeof current !== "object") {
			return { exists: false, value: undefined }
		}
		if (!Object.hasOwn(current, segment)) {
			return { exists: false, value: undefined }
		}
		current = (current as Record<string | number, unknown>)[segment]
	}
	return { exists: true, value: current }
}

/** Reports whether the first Immer path contains the second path. */
function isPathPrefix(
	prefix: readonly (string | number)[],
	path: readonly (string | number)[],
): boolean {
	return (
		prefix.length < path.length &&
		prefix.every((segment, index) => segment === path[index])
	)
}

/** Compares two Immer segment paths. */
function samePath(
	left: readonly (string | number)[],
	right: readonly (string | number)[],
): boolean {
	return (
		left.length === right.length &&
		left.every((segment, index) => segment === right[index])
	)
}

/** Rejects a Promise-like value returned by a synchronous update hook. */
function assertSynchronousHookResult(
	result: unknown,
	hook: "beforeUpdate" | "afterUpdate",
): void {
	if (!isPromiseLike(result)) return
	void Promise.resolve(result).catch(() => undefined)
	throw new TypeError(`${hook} must be synchronous`)
}

/** Detects Promise-like results without constraining their concrete class. */
function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
	return (
		value !== null &&
		(typeof value === "object" || typeof value === "function") &&
		"then" in value &&
		typeof value.then === "function"
	)
}

/** Preserves both failures when committed middleware and afterUpdate throw. */
function updateAggregateError(
	primary: unknown,
	after: unknown,
): AggregateError {
	return new AggregateError(
		[primary, after],
		"Managed update failed after commit",
	)
}

/** Creates a consistent immutable-view transaction from authoritative patches. */
function createTransaction<Input extends FieldValues, Context>(
	previousValues: Input,
	patches: readonly ValuePatch[],
	source: ValueTransactionSource<Input>,
	context: Context,
	allowTopLevelRemoval: boolean,
): ValueTransaction<Input, Context> {
	const nextValues = valueImmer.applyPatches(
		previousValues,
		patches as readonly Patch[],
	)
	if (!allowTopLevelRemoval) {
		assertNoTopLevelRemoval(previousValues, nextValues, patches)
	}
	return {
		context: context as DeepReadonly<Context>,
		nextValues: nextValues as DeepReadonly<Input>,
		patches,
		previousValues: previousValues as DeepReadonly<Input>,
		source,
	}
}

/** Rejects a value shape that RHF `setValues` cannot represent exactly. */
function assertNoTopLevelRemoval(
	previousValues: FieldValues,
	nextValues: FieldValues,
	patches: readonly ValuePatch[],
): void {
	const removesTopLevel = patches.some(
		(patch) => patch.op === "remove" && patch.path.length === 1,
	)
	const omitsPreviousKey = Object.keys(previousValues).some(
		(key) => !Object.hasOwn(nextValues, key),
	)
	if (removesTopLevel || omitsPreviousKey) {
		throw new TypeError(
			"Managed updates cannot remove a top-level form value; assign undefined instead",
		)
	}
}

/** Keeps an array action's length and ordering patches unchanged. */
function assertActiveArrayStructure<Input extends FieldValues, Context>(
	patches: readonly ValuePatch[],
	active: ActiveDispatch<Input, Context> | undefined,
): void {
	if (active?.arrayStructure === undefined) return
	const actual = structuralArrayPatches(patches, active.arrayStructure.path)
	const expected = active.arrayStructure.patches
	if (
		actual.length !== expected.length ||
		actual.some((patch, index) => !samePatch(patch, expected[index]))
	) {
		throw new TypeError(
			"Array middleware cannot change length or order beyond the source action, or replace the active array or its parent",
		)
	}
}

/** Selects patches that can replace an array or its direct row ordering. */
function structuralArrayPatches(
	patches: readonly ValuePatch[],
	arrayPath: readonly (string | number)[],
): readonly ValuePatch[] {
	return patches.filter((patch) => {
		const sharedLength = Math.min(patch.path.length, arrayPath.length)
		for (let index = 0; index < sharedLength; index += 1) {
			if (patch.path[index] !== arrayPath[index]) return false
		}
		return (
			patch.path.length <= arrayPath.length ||
			patch.path.length === arrayPath.length + 1
		)
	})
}

/** Compares structural patches without cloning their potentially opaque values. */
function samePatch(left: ValuePatch, right: ValuePatch | undefined): boolean {
	if (
		right === undefined ||
		left.op !== right.op ||
		!Object.is(left.value, right.value) ||
		!samePath(left.path, right.path)
	) {
		return false
	}
	return true
}
