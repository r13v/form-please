import { get } from "react-hook-form"

import { cloneFormValue } from "./form-value.js"

/** Creates one independent item from a generated array's configured default. */
export function cloneItemDefault(value: unknown): unknown {
	const candidate = typeof value === "function" ? value() : value
	return cloneFormValue(candidate)
}

/** Reads a generated array value or reports a malformed form input. */
export function getMutableArrayValue(values: unknown, path: string): unknown[] {
	const value = get(values, path)
	if (!Array.isArray(value)) {
		throw new TypeError(`Generated array path "${path}" must contain an array`)
	}
	return value
}

/** Converts an RHF dot path to Immer segments using numeric array indices. */
export function fieldPathSegments(
	values: unknown,
	path: string,
): readonly (string | number)[] {
	let current = values
	return path.split(".").map((segment) => {
		const key =
			Array.isArray(current) && /^(0|[1-9]\d*)$/.test(segment)
				? Number(segment)
				: segment
		current =
			current !== null && typeof current === "object"
				? (current as Record<string | number, unknown>)[key]
				: undefined
		return key
	})
}
