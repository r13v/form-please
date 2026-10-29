import { get } from "react-hook-form"

import { assertNever } from "./assert-never.js"
import { cloneFormValue, isFormValueObject } from "./form-value.js"

/** Creates one independent item from a generated array's configured default. */
export function cloneItemDefault(value: unknown): unknown {
	const candidate = typeof value === "function" ? value() : value
	if (!isFormValueObject(candidate)) {
		throw new TypeError("Generated array item defaults must be plain objects")
	}
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

/** One generated array action with the item indexes that it uses. */
export type ArrayAction =
	| { readonly action: "append"; readonly index: number }
	| { readonly action: "remove"; readonly index: number }
	| {
			readonly action: "move"
			readonly fromIndex: number
			readonly toIndex: number
	  }

/**
 * Applies one generated array action to `items`. The React runtime and the
 * headless tester share it, so both reject the same indexes.
 */
export function applyArrayAction(
	items: unknown[],
	path: string,
	action: ArrayAction,
	item?: unknown,
): void {
	switch (action.action) {
		case "append":
			assertArrayIndex(path, action.index, items.length + 1, "index")
			items.splice(action.index, 0, item)
			return
		case "remove":
			assertArrayIndex(path, action.index, items.length, "index")
			items.splice(action.index, 1)
			return
		case "move": {
			assertArrayIndex(path, action.fromIndex, items.length, "fromIndex")
			assertArrayIndex(path, action.toIndex, items.length, "toIndex")
			const [moved] = items.splice(action.fromIndex, 1)
			items.splice(action.toIndex, 0, moved)
			return
		}
		default:
			assertNever(action, "Unsupported generated array action")
	}
}

/** Validates an index that must identify one generated array position. */
function assertArrayIndex(
	path: string,
	index: number,
	length: number,
	name: "fromIndex" | "index" | "toIndex",
): void {
	if (Number.isSafeInteger(index) && index >= 0 && index < length) return
	throw new RangeError(
		`Generated array ${name} for "${path}" must be between 0 and ${Math.max(
			length - 1,
			0,
		)}`,
	)
}
