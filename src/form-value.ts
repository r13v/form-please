/** Clones editable form data while preserving browser-owned leaf values. */
export function cloneFormValue<Value>(value: Value): Value {
	const ancestors = new WeakSet<object>()
	const clone = <Current>(current: Current): Current => {
		if (current instanceof Date) return new Date(current) as Current
		if (current instanceof RegExp) {
			const result = new RegExp(current.source, current.flags)
			result.lastIndex = current.lastIndex
			return result as Current
		}
		if (typeof Blob !== "undefined" && current instanceof Blob) return current
		if (typeof FileList !== "undefined" && current instanceof FileList) {
			return current
		}
		if (
			!(
				current instanceof Set ||
				current instanceof Map ||
				Array.isArray(current) ||
				isFormValueObject(current)
			)
		) {
			return current
		}

		if (ancestors.has(current))
			throw new TypeError("Form values must be acyclic")
		ancestors.add(current)
		try {
			if (current instanceof Set) {
				return new Set([...current].map(clone)) as Current
			}
			if (current instanceof Map) {
				return new Map(
					[...current].map(([key, item]) => [clone(key), clone(item)]),
				) as Current
			}
			if (Array.isArray(current)) return current.map(clone) as Current
			return Object.fromEntries(
				Object.entries(current).map(([key, item]) => [key, clone(item)]),
			) as Current
		} finally {
			ancestors.delete(current)
		}
	}

	return clone(value)
}

/** Compares editable form values using the same leaf boundaries as cloning. */
export function areFormValuesEqual(left: unknown, right: unknown): boolean {
	const leftAncestors = new WeakSet<object>()
	const rightAncestors = new WeakSet<object>()
	const compareStructured = (
		leftValue: object,
		rightValue: object,
		compare: () => boolean,
	): boolean => {
		if (leftAncestors.has(leftValue) || rightAncestors.has(rightValue)) {
			throw new TypeError("Form values must be acyclic")
		}
		leftAncestors.add(leftValue)
		rightAncestors.add(rightValue)
		try {
			return compare()
		} finally {
			leftAncestors.delete(leftValue)
			rightAncestors.delete(rightValue)
		}
	}
	const compare = (leftValue: unknown, rightValue: unknown): boolean => {
		if (Object.is(leftValue, rightValue)) return true
		if (leftValue instanceof Date && rightValue instanceof Date) {
			return Object.is(leftValue.getTime(), rightValue.getTime())
		}
		if (leftValue instanceof RegExp && rightValue instanceof RegExp) {
			return (
				leftValue.source === rightValue.source &&
				leftValue.flags === rightValue.flags &&
				leftValue.lastIndex === rightValue.lastIndex
			)
		}
		if (leftValue instanceof Set && rightValue instanceof Set) {
			if (leftValue.size !== rightValue.size) return false
			return compareStructured(leftValue, rightValue, () => {
				const rightItems = [...rightValue]
				return [...leftValue].every((item, index) =>
					compare(item, rightItems[index]),
				)
			})
		}
		if (leftValue instanceof Map && rightValue instanceof Map) {
			if (leftValue.size !== rightValue.size) return false
			return compareStructured(leftValue, rightValue, () => {
				const rightEntries = [...rightValue]
				return [...leftValue].every(
					([key, item], index) =>
						compare(key, rightEntries[index]?.[0]) &&
						compare(item, rightEntries[index]?.[1]),
				)
			})
		}
		if (Array.isArray(leftValue) && Array.isArray(rightValue)) {
			if (leftValue.length !== rightValue.length) return false
			return compareStructured(leftValue, rightValue, () =>
				leftValue.every((item, index) => compare(item, rightValue[index])),
			)
		}
		if (!isFormValueObject(leftValue) || !isFormValueObject(rightValue)) {
			return false
		}
		const leftKeys = Object.keys(leftValue)
		const rightKeys = Object.keys(rightValue)
		if (leftKeys.length !== rightKeys.length) return false
		return compareStructured(leftValue, rightValue, () =>
			leftKeys.every(
				(key) =>
					Object.hasOwn(rightValue, key) &&
					compare(leftValue[key], rightValue[key]),
			),
		)
	}

	return compare(left, right)
}

/** Tests whether a form value is an object that can be cloned by entries. */
export function isFormValueObject(
	value: unknown,
): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === null || prototype === Object.prototype
}
