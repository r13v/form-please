import type { FieldValues, UseFormReturn } from "react-hook-form"
import type { ManagedValidationOptions } from "./form-kit-types.js"
import { cloneFormValue } from "./form-value.js"
import type { ValuePatch, ValueTransaction } from "./value-middleware.js"

/** Publishes one managed value transaction and schedules change validation. */
export function commitManagedTransaction<
	Input extends FieldValues,
	Context,
	Output,
>(
	api: UseFormReturn<Input, Context, Output>,
	transaction: ValueTransaction<Input, Context>,
	validation: ManagedValidationOptions,
): void {
	if (transaction.patches.length === 0) return
	api.setValues(topLevelUpdates(transaction), { shouldDirty: true })
	if (!shouldValidateManagedTransaction(api, transaction, validation)) return
	const paths = patchedFieldPaths(transaction.patches)
	void api.trigger(
		paths === undefined || paths.length === 0
			? undefined
			: (paths as Parameters<typeof api.trigger>[0]),
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
): void {
	if (transaction.source.type === "persistence") {
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
	const sourcePath =
		transaction.source.type === "control" || transaction.source.type === "array"
			? String(transaction.source.path)
			: undefined
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
