import {
	type FieldError,
	type FieldValues,
	get,
	type UseFormReturn,
} from "react-hook-form"

import { areFormValuesEqual, cloneFormValue } from "./form-value.js"
import {
	formIssueErrorType,
	isFieldErrorMetadataKey,
	isRecord,
	pathlessErrorKey,
} from "./standard-schema-resolver.js"
import type { FormIssue } from "./types.js"

/** The owner of an issue that the schema resolver did not create. */
type FormIssueSource = "action" | "external"

type StoredIssue = {
	readonly issue: FormIssue
	readonly source: FormIssueSource
	/** The value at the issue path when the issue was stored. */
	readonly value: unknown
}

/** Action and external issues that live beside schema errors in RHF state. */
export type FormIssueStore = {
	/** Returns the stored issues in insertion order. */
	list(): readonly FormIssue[]
	/** Returns stored issues whose path value still equals the given values. */
	current(values: FieldValues): readonly FormIssue[]
	/** Tests whether a stored issue selects this exact path. */
	has(path: string): boolean
	/** Replaces every stored issue of one source and publishes it to RHF. */
	replace(source: FormIssueSource, issues: readonly FormIssue[]): void
	/** Removes stored issues whose path value differs from the given values. */
	clearChanged(values: FieldValues): void
	/**
	 * Moves issues of array rows to new indexes, removing unmapped rows, and
	 * keeps them while `apply` moves the row values.
	 */
	remapArray(
		arrayPath: string,
		indexes: ReadonlyMap<number, number>,
		apply: () => void,
	): void
	/** Forgets every stored issue without touching RHF errors. */
	forget(): void
}

/** Creates the issue store for one form binding. */
export function createFormIssueStore(
	getApi: () => UseFormReturn<FieldValues, unknown, unknown>,
): FormIssueStore {
	let stored: readonly StoredIssue[] = []
	let remapping = false

	const commit = (next: readonly StoredIssue[]): void => {
		const paths = new Set(
			[...stored, ...next].map((entry) => entry.issue.path ?? ""),
		)
		stored = next
		const api = getApi()
		for (const path of paths) {
			publishPath(api, path, issuesAt(next, path))
		}
	}

	return {
		list: () => stored.map((entry) => entry.issue),
		current: (values) =>
			stored
				.filter((entry) => isCurrent(entry, values))
				.map((entry) => entry.issue),
		has: (path) => stored.some((entry) => entry.issue.path === path),
		replace(source, issues) {
			if (
				issues.some(
					(issue) => issue.path === "root" || issue.path?.startsWith("root."),
				)
			) {
				throw new TypeError(
					"Action and external issues cannot use the reserved React Hook Form root path",
				)
			}
			const values = getApi().getValues()
			commit([
				...stored.filter((entry) => entry.source !== source),
				...issues.map((issue) => ({
					issue: Object.freeze({ ...issue }),
					source,
					value: readPathValue(values, issue.path),
				})),
			])
		},
		clearChanged(values) {
			if (remapping) return
			const next = stored.filter((entry) => isCurrent(entry, values))
			if (next.length !== stored.length) commit(next)
		},
		remapArray(arrayPath, indexes, apply) {
			const prefix = `${arrayPath}.`
			stored = stored.flatMap((entry) => {
				const path = entry.issue.path
				if (path === undefined || !path.startsWith(prefix)) return [entry]
				const [index = "", ...rest] = path.slice(prefix.length).split(".")
				if (!/^\d+$/.test(index)) return [entry]
				const nextIndex = indexes.get(Number(index))
				if (nextIndex === undefined) return []
				const nextPath = [arrayPath, String(nextIndex), ...rest].join(".")
				return [
					{
						...entry,
						issue: Object.freeze({ ...entry.issue, path: nextPath }),
					},
				]
			})
			remapping = true
			try {
				apply()
			} finally {
				remapping = false
			}
			// Issues of the array and its ancestors stay with the reordered array.
			const values = getApi().getValues()
			stored = stored.map((entry) => {
				const path = entry.issue.path
				return path !== undefined &&
					(path === arrayPath || arrayPath.startsWith(`${path}.`))
					? { ...entry, value: readPathValue(values, path) }
					: entry
			})
			const next = stored.filter((entry) => isCurrent(entry, values))
			if (next.length !== stored.length) commit(next)
		},
		forget() {
			stored = []
		},
	}
}

/** Tests whether the value at an issue path has not changed since storage. */
function isCurrent(entry: StoredIssue, values: FieldValues): boolean {
	return areFormValuesEqual(
		readPathValue(values, entry.issue.path),
		entry.value,
	)
}

/** Selects the messages of stored issues for one path. */
function issuesAt(entries: readonly StoredIssue[], path: string) {
	return entries
		.filter((entry) => (entry.issue.path ?? "") === path)
		.map((entry) => entry.issue.message)
}

/**
 * Replaces the stored messages at one RHF path. Stored messages use their own
 * `types` keys, so schema messages and child errors at the path stay intact.
 */
function publishPath(
	api: UseFormReturn<FieldValues, unknown, unknown>,
	path: string,
	next: readonly string[],
): void {
	const errors = api.formState.errors as FieldValues
	const current: unknown =
		path === pathlessErrorKey ? errors[path] : get(errors, path)
	const error = isRecord(current) ? current : {}
	const foreignTypes = Object.fromEntries(
		Object.entries(isRecord(error.types) ? error.types : {}).filter(
			(entry): entry is [string, string] =>
				!entry[0].startsWith(`${formIssueErrorType}.`) &&
				typeof entry[1] === "string",
		),
	)
	const foreignMessage =
		error.type !== formIssueErrorType && typeof error.message === "string"
			? error.message
			: undefined
	const message = foreignMessage ?? next[0]
	if (message === undefined) {
		if (current === undefined) return
		const children = Object.entries(error).filter(
			([key]) => !isFieldErrorMetadataKey(key),
		)
		// RHF clears every error for an empty name, so pass the pathless key in an array.
		api.clearErrors([path])
		for (const [key, child] of children) {
			api.setError(path ? `${path}.${key}` : key, child as FieldError)
		}
		return
	}
	api.setError(path, {
		message,
		type:
			foreignMessage === undefined
				? formIssueErrorType
				: String(error.type ?? ""),
		types: {
			...foreignTypes,
			...Object.fromEntries(
				next.map((text, index) => [`${formIssueErrorType}.${index}`, text]),
			),
		},
	})
}

/** Reads an independent snapshot of the value that an issue path selects. */
function readPathValue(values: FieldValues, path: string | undefined): unknown {
	if (path === undefined) return undefined
	return cloneFormValue(get(values, path))
}
