import type { StandardSchemaV1 } from "@standard-schema/spec"
import {
	type FieldError,
	type FieldErrors,
	type FieldValues,
	get,
	type Resolver,
	set,
} from "react-hook-form"

import { cloneFormValue } from "./form-value.js"
import type { FormIssue, StandardSchema } from "./types.js"

/** Identifies errors created by the Standard Schema resolver. */
const standardSchemaErrorType = "standard-schema"
/** Stores schema issues that do not select an input path. */
const pathlessErrorKey = ""
/** Attaches original schema issues to React Hook Form error objects. */
const standardSchemaIssues = Symbol("standard-schema-issues")
/** Marks an error branch that contains an attached schema issue. */
const hasStandardSchemaDescendant = Symbol("has-standard-schema-descendant")

/** Adapts a Standard Schema validator to a React Hook Form resolver. */
export function createStandardSchemaResolver<
	Input extends FieldValues,
	Context,
	Output,
>(schema: StandardSchema<Input, Output>): Resolver<Input, Context, Output> {
	return async (values) => {
		const result = await schema["~standard"].validate(cloneFormValue(values))
		if (result.issues === undefined) {
			return { errors: {}, values: result.value }
		}

		return {
			errors: issuesToFieldErrors<Input>(result.issues),
			values: {},
		}
	}
}

/** Converts one React Hook Form field error to public form issues. */
export function fieldErrorToIssues(
	error: unknown,
	path?: string,
): readonly FormIssue[] {
	const messages = [
		...issuesForError(error, path),
		...(isRecord(error) ? issuesForError(error.root, path) : []),
	]
	return uniqueIssues(messages)
}

/** Flattens a React Hook Form error tree into unique public form issues. */
export function fieldErrorsToIssues(errors: unknown): readonly FormIssue[] {
	const issues: FormIssue[] = []
	const visit = (value: unknown, path?: string): void => {
		if (!isRecord(value)) return
		issues.push(...fieldErrorToIssues(value, path))
		const valueIsFieldError = isFieldError(value)

		for (const [key, child] of Object.entries(value)) {
			if (key === pathlessErrorKey) {
				visit(child)
				continue
			}
			if (key === "root" && !hasStandardSchemaContent(child)) continue
			if (
				valueIsFieldError &&
				isFieldErrorMetadataKey(key) &&
				!hasStandardSchemaContent(child)
			) {
				continue
			}
			visit(child, path === undefined ? key : `${path}.${key}`)
		}
	}

	visit(errors)
	return uniqueIssues(issues)
}

/** Tests whether an error tree contains an issue for an exact field path. */
export function hasFieldError(errors: unknown, path: string): boolean {
	if (fieldErrorToIssues(get(errors as FieldValues, path), path).length > 0) {
		return true
	}
	return (
		isRecord(errors) &&
		fieldErrorToIssues(get(errors[pathlessErrorKey] as FieldValues, path), path)
			.length > 0
	)
}

/** Converts Standard Schema issues to a React Hook Form error tree. */
function issuesToFieldErrors<Input extends FieldValues>(
	issues: ReadonlyArray<StandardSchemaV1.Issue>,
): FieldErrors<Input> {
	const errors: FieldErrors<FieldValues> = {}
	const sortedIssues = issues
		.map((issue, index) => ({ issue, index, path: standardPath(issue.path) }))
		.sort(
			(left, right) =>
				pathDepth(left.path) - pathDepth(right.path) ||
				left.index - right.index,
		)

	for (const { issue, index, path } of sortedIssues) {
		const key = path ?? pathlessErrorKey
		setFieldError(errors, key, toFormIssue(issue.message, path), index)
		if (path === "root" || path?.startsWith("root.")) {
			const shadow = isRecord(errors[pathlessErrorKey])
				? errors[pathlessErrorKey]
				: {}
			errors[pathlessErrorKey] = shadow
			setFieldError(shadow, path, toFormIssue(issue.message, path), index)
		}
	}

	return errors as FieldErrors<Input>
}

/** Inserts one schema issue into a React Hook Form error tree. */
function setFieldError(
	errors: Record<string, unknown>,
	path: string,
	issue: FormIssue,
	index: number,
): void {
	const existing = path === pathlessErrorKey ? errors[path] : get(errors, path)
	const next = mergeFieldError(existing, issue, index)
	if (path === pathlessErrorKey) {
		errors[path] = next
	} else if (existing !== next) {
		set(errors, path, next)
	}
	markStandardSchemaPath(errors, path)
}

/** Adds a schema issue to an existing or new field error. */
function mergeFieldError(
	existing: unknown,
	issue: FormIssue,
	index: number,
): FieldError {
	if (isRecord(existing) && typeof existing.message === "string") {
		existing.types = {
			...(isRecord(existing.types) ? existing.types : {}),
			[`${standardSchemaErrorType}.${index}`]: issue.message,
		}
		attachStandardSchemaIssue(existing, issue)
		return existing as FieldError
	}

	const fieldError = isRecord(existing) ? existing : {}
	Object.assign(fieldError, {
		message: issue.message,
		type: standardSchemaErrorType,
		types: { [`${standardSchemaErrorType}.${index}`]: issue.message },
	})
	attachStandardSchemaIssue(fieldError, issue)
	return fieldError as FieldError
}

/** Reads attached schema issues or derives issues from a field error. */
function issuesForError(value: unknown, path?: string): readonly FormIssue[] {
	const attached = attachedStandardSchemaIssues(value)
	if (attached.length > 0) return attached
	return ownErrorMessages(value).map((message) => ({
		message,
		...(path === undefined ? {} : { path }),
	}))
}

/** Collects unique messages stored directly on a field error. */
function ownErrorMessages(value: unknown): readonly string[] {
	if (!isRecord(value) || !isFieldError(value)) return []
	const messages = [
		typeof value.message === "string" ? value.message : undefined,
		...(isRecord(value.types)
			? Object.values(value.types).filter(
					(message): message is string => typeof message === "string",
				)
			: []),
	].filter((message): message is string => message !== undefined)
	return [...new Set(messages)]
}

/** Tests whether a record contains React Hook Form field-error metadata. */
function isFieldError(value: Record<string, unknown>): boolean {
	return (
		attachedStandardSchemaIssues(value).length > 0 ||
		typeof value.message === "string" ||
		typeof value.type === "string"
	)
}

/** Tests whether a key belongs to field-error metadata instead of a child path. */
function isFieldErrorMetadataKey(key: string): boolean {
	return key === "message" || key === "ref" || key === "type" || key === "types"
}

/** Creates a public issue and includes its path when available. */
function toFormIssue(message: string, path?: string): FormIssue {
	return { message, ...(path === undefined ? {} : { path }) }
}

/** Preserves an original schema issue on a React Hook Form error object. */
function attachStandardSchemaIssue(
	error: Record<string, unknown>,
	issue: FormIssue,
): void {
	Object.defineProperty(error, standardSchemaIssues, {
		configurable: true,
		value: [...attachedStandardSchemaIssues(error), issue],
	})
}

/** Reads original schema issues attached to a React Hook Form error object. */
function attachedStandardSchemaIssues(value: unknown): readonly FormIssue[] {
	if (!isRecord(value)) return []
	const issues = (value as Record<PropertyKey, unknown>)[standardSchemaIssues]
	return Array.isArray(issues) ? (issues as readonly FormIssue[]) : []
}

/** Marks each error object along a schema issue path. */
function markStandardSchemaPath(
	errors: Record<string, unknown>,
	path: string,
): void {
	if (path === pathlessErrorKey) return
	let current: unknown = errors
	for (const segment of path.split(".")) {
		if (!isRecord(current)) return
		current = current[segment]
		if (!isRecord(current)) return
		Object.defineProperty(current, hasStandardSchemaDescendant, {
			configurable: true,
			value: true,
		})
	}
}

/** Tests whether an error object contains or leads to a schema issue. */
function hasStandardSchemaContent(value: unknown): boolean {
	if (!isRecord(value)) return false
	return (
		attachedStandardSchemaIssues(value).length > 0 ||
		(value as Record<PropertyKey, unknown>)[hasStandardSchemaDescendant] ===
			true
	)
}

/** Converts Standard Schema path segments to React Hook Form dot notation. */
function standardPath(
	path: StandardSchemaV1.Issue["path"],
): string | undefined {
	if (path === undefined || path.length === 0) return undefined
	return path
		.map((segment) =>
			String(
				typeof segment === "object" && segment !== null && "key" in segment
					? segment.key
					: segment,
			),
		)
		.join(".")
}

/** Counts the segments in a dot path. */
function pathDepth(path: string | undefined): number {
	return path === undefined ? 0 : path.split(".").length
}

/** Removes issues with duplicate path and message values. */
function uniqueIssues(issues: readonly FormIssue[]): readonly FormIssue[] {
	const messagesByPath = new Map<string | undefined, Set<string>>()
	return issues.filter((issue) => {
		const messages = messagesByPath.get(issue.path)
		if (messages?.has(issue.message) === true) return false
		if (messages === undefined) {
			messagesByPath.set(issue.path, new Set([issue.message]))
		} else {
			messages.add(issue.message)
		}
		return true
	})
}

/** Tests whether a value is a non-null object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object"
}
