/** Clones editable form data while preserving browser-owned leaf values. */
export function cloneFormValue<Value>(value: Value): Value {
	if (value instanceof Date) return new Date(value) as Value
	if (value instanceof RegExp) {
		const clone = new RegExp(value.source, value.flags)
		clone.lastIndex = value.lastIndex
		return clone as Value
	}
	if (value instanceof Set) {
		return new Set([...value].map((item) => cloneFormValue(item))) as Value
	}
	if (value instanceof Map) {
		return new Map(
			[...value].map(([key, item]) => [
				cloneFormValue(key),
				cloneFormValue(item),
			]),
		) as Value
	}
	if (typeof Blob !== "undefined" && value instanceof Blob) return value
	if (typeof FileList !== "undefined" && value instanceof FileList) return value
	if (Array.isArray(value)) {
		return value.map((item) => cloneFormValue(item)) as Value
	}
	if (isFormValueObject(value)) {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, cloneFormValue(item)]),
		) as Value
	}
	return value
}

/** Compares editable form values using the same leaf boundaries as cloning. */
export function areFormValuesEqual(left: unknown, right: unknown): boolean {
	if (Object.is(left, right)) return true
	if (left instanceof Date && right instanceof Date) {
		return Object.is(left.getTime(), right.getTime())
	}
	if (left instanceof RegExp && right instanceof RegExp) {
		return (
			left.source === right.source &&
			left.flags === right.flags &&
			left.lastIndex === right.lastIndex
		)
	}
	if (left instanceof Set && right instanceof Set) {
		if (left.size !== right.size) return false
		const leftItems = [...left]
		const rightItems = [...right]
		return leftItems.every((item, index) =>
			areFormValuesEqual(item, rightItems[index]),
		)
	}
	if (left instanceof Map && right instanceof Map) {
		if (left.size !== right.size) return false
		const rightEntries = [...right]
		return [...left].every(
			([key, item], index) =>
				areFormValuesEqual(key, rightEntries[index]?.[0]) &&
				areFormValuesEqual(item, rightEntries[index]?.[1]),
		)
	}
	if (Array.isArray(left) && Array.isArray(right)) {
		return (
			left.length === right.length &&
			left.every((item, index) => areFormValuesEqual(item, right[index]))
		)
	}
	if (!isFormValueObject(left) || !isFormValueObject(right)) return false
	const leftKeys = Object.keys(left)
	const rightKeys = Object.keys(right)
	return (
		leftKeys.length === rightKeys.length &&
		leftKeys.every(
			(key) =>
				Object.hasOwn(right, key) && areFormValuesEqual(left[key], right[key]),
		)
	)
}

/** Tests whether a form value is an object that can be cloned by entries. */
export function isFormValueObject(
	value: unknown,
): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === null || prototype === Object.prototype
}
