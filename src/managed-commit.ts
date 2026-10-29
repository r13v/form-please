import { type FieldValues, get, type UseFormReturn } from "react-hook-form"
import type { ManagedValidationOptions } from "./form-kit-types.js"
import {
	areFormValuesEqual,
	cloneFormValue,
	isFormValueObject,
} from "./form-value.js"
import type {
	RestorePolicy,
	ValuePatch,
	ValueTransaction,
} from "./value-middleware.js"

/** Publishes one managed value transaction and schedules change validation. */
export function commitManagedTransaction<
	Input extends FieldValues,
	Context,
	Output,
>(
	api: UseFormReturn<Input, Context, Output>,
	transaction: ValueTransaction<Input, Context>,
	validation: ManagedValidationOptions,
	arrayRoots: ReadonlySet<string>,
): void {
	if (transaction.patches.length === 0) return
	const updates = topLevelUpdates(transaction) as FieldValues
	const current = api.getValues() as FieldValues
	const leafPaths: string[] = []
	for (const root of Object.keys(updates)) {
		if (!arrayRoots.has(root)) continue
		// RHF 7.91 resets useFieldArray row IDs when setValues covers an array, even an unchanged one.
		collectChangedLeafPaths(current[root], updates[root], root, leafPaths)
		delete updates[root]
	}
	if (Object.keys(updates).length > 0) {
		api.setValues(updates as Partial<Input>, { shouldDirty: true })
	}
	for (const path of leafPaths) {
		api.setValue(
			path as Parameters<typeof api.setValue>[0],
			get(transaction.nextValues, path),
			{ shouldDirty: true },
		)
	}
	if (!shouldValidateManagedTransaction(api, transaction, validation)) return
	void api.trigger(
		patchedFieldPaths(transaction.patches) as Parameters<typeof api.trigger>[0],
	)
}

/** Restores complete values while retaining RHF state outside value history. */
export function commitManagedRestore<
	Input extends FieldValues,
	Context,
	Output,
>(
	api: UseFormReturn<Input, Context, Output>,
	transaction: ValueTransaction<Input, Context>,
	validation: ManagedValidationOptions,
	policy: RestorePolicy,
): void {
	if (!policy.keepFormState) {
		api.reset(cloneFormValue(transaction.nextValues) as Input, {
			keepDefaultValues: true,
		})
		return
	}
	api.reset(cloneFormValue(transaction.nextValues) as Input, {
		keepDefaultValues: true,
		keepErrors: true,
		keepIsSubmitted: true,
		keepIsSubmitSuccessful: true,
		keepIsValid: true,
		keepSubmitCount: true,
		keepTouched: true,
	})
	if (!shouldValidateManagedTransaction(api, transaction, validation)) return
	void api.trigger()
}

/**
 * Collects the deepest paths where `next` differs from `current`. Arrays of
 * equal length and plain objects are compared by entry, so a path never names
 * an array whose rows only changed values.
 */
function collectChangedLeafPaths(
	current: unknown,
	next: unknown,
	path: string,
	paths: string[],
): void {
	if (areFormValuesEqual(current, next)) return
	if (
		Array.isArray(current) &&
		Array.isArray(next) &&
		current.length === next.length
	) {
		for (const [index, item] of next.entries()) {
			collectChangedLeafPaths(current[index], item, `${path}.${index}`, paths)
		}
		return
	}
	if (isFormValueObject(current) && isFormValueObject(next)) {
		for (const key of new Set([
			...Object.keys(current),
			...Object.keys(next),
		])) {
			collectChangedLeafPaths(current[key], next[key], `${path}.${key}`, paths)
		}
		return
	}
	paths.push(path)
}

/** Selects complete changed roots because RHF `setValues` shallow-merges them. */
function topLevelUpdates<Input extends FieldValues, Context>(
	transaction: ValueTransaction<Input, Context>,
): Partial<Input> {
	if (transaction.patches.some((patch) => patch.path.length === 0)) {
		return transaction.nextValues as Partial<Input>
	}
	const updates: FieldValues = {}
	const nextValues = transaction.nextValues as FieldValues
	for (const patch of transaction.patches) {
		const root = patch.path[0]
		if (root !== undefined) updates[String(root)] = nextValues[String(root)]
	}
	return updates as Partial<Input>
}

/** Mirrors RHF change validation modes for managed value proposals. */
function shouldValidateManagedTransaction<
	Input extends FieldValues,
	Context,
	Output,
>(
	api: UseFormReturn<Input, Context, Output>,
	transaction: ValueTransaction<Input, Context>,
	validation: ManagedValidationOptions,
): boolean {
	// RHF validates every change in `all` mode, before it applies reValidateMode.
	if (validation.mode === "all") return true
	if (validation.isSubmitted()) {
		return validation.reValidateMode === "onChange"
	}
	if (validation.mode === "onChange") return true
	if (validation.mode !== "onTouched") return false
	const paths = patchedFieldPaths(transaction.patches)
	if (paths === undefined && hasTouchedField(api.formState.touchedFields)) {
		return true
	}
	const { source } = transaction
	const sourcePath = "path" in source ? String(source.path) : undefined
	const touchedPaths = new Set(paths ?? [])
	if (sourcePath !== undefined) touchedPaths.add(sourcePath)
	return [...touchedPaths].some(
		(path) =>
			api.getFieldState(path as Parameters<typeof api.getFieldState>[0])
				.isTouched,
	)
}

/** Tests whether an RHF touched-field tree contains one touched leaf. */
function hasTouchedField(value: unknown): boolean {
	if (value === true) return true
	if (value === null || typeof value !== "object") return false
	return Object.values(value).some(hasTouchedField)
}

/** Converts Immer patch paths to deduplicated RHF paths for one trigger call. */
function patchedFieldPaths(
	patches: readonly ValuePatch[],
): readonly string[] | undefined {
	if (patches.some((patch) => patch.path.length === 0)) return undefined
	return [
		...new Set(
			patches.map((patch) =>
				patch.path.map((segment) => String(segment)).join("."),
			),
		),
	]
}
