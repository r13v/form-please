import type { FieldError, FieldValues } from "react-hook-form"
import type { FormIssueStore } from "./form-issues.js"

import {
	areFormValuesEqual,
	cloneFormValue,
	isFormValueObject,
} from "./form-value.js"
import { fieldPathSegments, getMutableArrayValue } from "./generated-array.js"
import { remapArraySchemaIssues } from "./standard-schema-resolver.js"
import type { DeepReadonly } from "./types.js"
import type {
	ValueCoordinator,
	ValueTransactionCommit,
} from "./value-middleware.js"

/** A typed managed operation for one generated object array. */
export type FormArray<Item> = {
	reconcile<Key extends string | number>(
		keys: readonly Key[],
		options: {
			readonly key: (row: DeepReadonly<Item>) => Key
			readonly create: (key: Key) => Item
		},
	): unknown
}

/** Public RHF operations supplied by the mounted generated array. */
export type ArrayOperations = {
	readonly append: (value: unknown, options?: { shouldFocus: boolean }) => void
	readonly move: (from: number, to: number) => void
	readonly remove: (index: number) => void
}

const mountedArrays = new WeakMap<object, Map<string, ArrayOperations>>()

/** Registers only mounted generated arrays; no separate live values are retained. */
export function registerGeneratedArray(
	control: object,
	path: string,
	operations: ArrayOperations,
): () => void {
	let arrays = mountedArrays.get(control)
	if (arrays === undefined) {
		arrays = new Map()
		mountedArrays.set(control, arrays)
	}
	arrays.set(path, operations)
	return () => {
		if (arrays.get(path) === operations) arrays.delete(path)
	}
}

/** Reconciles a selection through one managed transaction and native row operations. */
export function reconcileGeneratedArray(
	form: {
		readonly api: {
			readonly control: object
			getValues(): FieldValues
			getFieldState(path: string): { readonly error?: FieldError }
			setError(path: string, error: FieldError): void
			clearErrors(path: string): void
		}
		readonly dispatch: ValueCoordinator<FieldValues, unknown>["dispatch"]
		readonly commit: ValueTransactionCommit<FieldValues, unknown>
		readonly issues: Pick<FormIssueStore, "remapArray">
	},
	path: string,
	keys: readonly (string | number)[],
	options: {
		readonly key: (row: unknown) => string | number
		readonly create: (key: string | number) => unknown
	},
): unknown {
	const arrays = mountedArrays.get(form.api.control)
	const operations = arrays?.get(path)
	if (arrays === undefined || operations === undefined) {
		throw new TypeError(
			`Reconcile requires a mounted generated array at "${path}"`,
		)
	}
	const previousValues = form.api.getValues()
	const rows = getMutableArrayValue(previousValues, path)
	const selected = new Set(keys)
	if (selected.size !== keys.length) {
		throw new TypeError("Reconcile selected keys must be unique")
	}
	const currentKeys = rows.map(options.key)
	const existing = new Map<string | number, number>()
	for (const [index, key] of currentKeys.entries()) {
		if (typeof key !== "string" && typeof key !== "number") {
			throw new TypeError("Reconcile keys must be strings or numbers")
		}
		if (existing.has(key))
			throw new TypeError("Reconcile current keys must be unique")
		existing.set(key, index)
	}
	if (
		keys.length === rows.length &&
		keys.every((key, index) => Object.is(key, currentKeys[index]))
	) {
		return undefined
	}
	const indexes = new Map<number, number>()
	const nextRows = keys.map((key, index) => {
		if (typeof key !== "string" && typeof key !== "number") {
			throw new TypeError("Reconcile keys must be strings or numbers")
		}
		const previousIndex = existing.get(key)
		if (previousIndex !== undefined) {
			indexes.set(previousIndex, index)
			return rows[previousIndex]
		}
		const row = cloneFormValue(options.create(key))
		if (
			row === null ||
			typeof row !== "object" ||
			Array.isArray(row) ||
			!Object.is(options.key(row), key)
		) {
			throw new TypeError(
				"Reconcile create must return an object with the requested key",
			)
		}
		return row
	})
	return form.dispatch(
		(draft) => {
			const items = getMutableArrayValue(draft, path)
			items.splice(0, items.length, ...nextRows)
		},
		{ type: "array", action: "reconcile", path },
		{
			commit: (transaction) => {
				const finalRows = getMutableArrayValue(transaction.nextValues, path)
				if (
					finalRows.length !== keys.length ||
					finalRows.some(
						(row, index) => !Object.is(options.key(row), keys[index]),
					)
				) {
					throw new TypeError(
						"Reconcile middleware cannot change the selected array keys or order",
					)
				}
				for (const [index, row] of nextRows.entries()) {
					assertNestedArraysUnchanged(row, finalRows[index])
				}
				for (const otherPath of arrays.keys()) {
					if (otherPath === path || otherPath.startsWith(`${path}.`)) continue
					const segments = fieldPathSegments(previousValues, otherPath)
					if (
						transaction.patches.some(
							(patch) =>
								patch.path.length <= segments.length + 1 &&
								segments
									.slice(0, patch.path.length)
									.every((segment, index) => segment === patch.path[index]),
						)
					) {
						throw new TypeError(
							"Reconcile middleware cannot change another generated array structure",
						)
					}
				}
				const arrayError = form.api.getFieldState(path).error
				let rootError: FieldError | undefined = (
					arrayError as
						| (FieldError & { readonly root?: FieldError })
						| undefined
				)?.root
				if (rootError === undefined && arrayError?.type !== undefined) {
					rootError = {
						type: arrayError.type,
						message: arrayError.message,
						types: arrayError.types,
					}
				}
				let objectRowErrors: [string, unknown][] = []
				if (!Array.isArray(arrayError)) {
					objectRowErrors = Object.entries(arrayError ?? {}).filter(([index]) =>
						/^(0|[1-9]\d*)$/.test(index),
					)
				}
				remapArraySchemaIssues(arrayError, path, indexes)
				form.issues.remapArray(path, indexes, () => {
					const workingKeys = [...currentKeys]
					for (let index = workingKeys.length - 1; index >= 0; index--) {
						if (!selected.has(workingKeys[index] as string | number)) {
							operations.remove(index)
							workingKeys.splice(index, 1)
						}
					}
					for (const [index, key] of keys.entries()) {
						const from = workingKeys.findIndex((candidate) =>
							Object.is(candidate, key),
						)
						if (from === -1) {
							operations.append(finalRows[index], { shouldFocus: false })
							workingKeys.push(key)
						}
						const position = from === -1 ? workingKeys.length - 1 : from
						if (position !== index) {
							operations.move(position, index)
							const [moved] = workingKeys.splice(position, 1)
							workingKeys.splice(index, 0, moved as string | number)
						}
					}
					// A schema can report the array error before indexed errors, producing an object branch.
					// RHF native operations only remap array-shaped error branches.
					if (objectRowErrors.length > 0) {
						form.api.clearErrors(path)
						for (const [oldIndex, error] of objectRowErrors) {
							const newIndex = indexes.get(Number(oldIndex))
							if (newIndex !== undefined)
								form.api.setError(`${path}.${newIndex}`, error as FieldError)
						}
					}
					if (rootError !== undefined)
						form.api.setError(`${path}.root`, rootError)
					form.commit(transaction)
				})
			},
		},
	)
}

/** Rejects middleware changes to nested arrays of reconciled rows. */
function assertNestedArraysUnchanged(proposed: unknown, actual: unknown): void {
	if (Array.isArray(proposed) || Array.isArray(actual)) {
		if (!areFormValuesEqual(proposed, actual)) {
			throw new TypeError(
				"Reconcile middleware cannot change nested array values",
			)
		}
		return
	}
	if (!isFormValueObject(proposed) && !isFormValueObject(actual)) return
	let left: Record<string, unknown> = {}
	let right: Record<string, unknown> = {}
	if (isFormValueObject(proposed)) left = proposed
	if (isFormValueObject(actual)) right = actual
	for (const key of new Set([...Object.keys(left), ...Object.keys(right)])) {
		assertNestedArraysUnchanged(left[key], right[key])
	}
}
