import { describe, expect, it } from "vitest"

import {
	areFormValuesEqual,
	cloneFormValue,
	isFormValueObject,
} from "./form-value.js"

describe("form value clone and equality boundary", () => {
	it("clones structured leaves and shares browser-owned ones", () => {
		const blob = new Blob(["profile"])
		const source = {
			blob,
			createdAt: new Date("2026-08-05T00:00:00.000Z"),
			pattern: /form/gi,
		}
		source.pattern.lastIndex = 2
		const clone = cloneFormValue(source)

		expect(clone).not.toBe(source)
		expect(clone.createdAt).not.toBe(source.createdAt)
		expect(clone.createdAt).toEqual(source.createdAt)
		expect(clone.pattern).not.toBe(source.pattern)
		expect(clone.pattern).toEqual(source.pattern)
		expect(clone.pattern.lastIndex).toBe(2)
		expect(clone.blob).toBe(blob)
	})

	it("detaches every mutable collection a later edit could corrupt", () => {
		const seat = { number: 1 }
		const id = { id: 1 }
		const source = { ids: new Set([id]), seats: new Map([["row", seat]]) }
		const clone = cloneFormValue(source)

		expect(clone.seats).not.toBe(source.seats)
		expect(clone.ids).not.toBe(source.ids)
		expect(areFormValuesEqual(clone, source)).toBe(true)

		seat.number = 99
		id.id = 99

		expect([...clone.seats][0]?.[1]).toEqual({ number: 1 })
		expect([...clone.ids][0]).toEqual({ id: 1 })
		expect(areFormValuesEqual(clone, source)).toBe(false)
	})

	it("compares structured leaves by value instead of identity", () => {
		expect(areFormValuesEqual(new Date(Number.NaN), new Date(Number.NaN))).toBe(
			true,
		)
		expect(areFormValuesEqual(new Date(0), new Date(1))).toBe(false)
		expect(areFormValuesEqual(/a/g, /a/g)).toBe(true)
		expect(areFormValuesEqual(/a/g, /a/i)).toBe(false)
		expect(areFormValuesEqual(new Map([["a", 1]]), new Map([["a", 1]]))).toBe(
			true,
		)
		expect(areFormValuesEqual(new Map([["a", 1]]), new Map([["a", 2]]))).toBe(
			false,
		)
		expect(areFormValuesEqual(new Map([["a", 1]]), new Map([["b", 1]]))).toBe(
			false,
		)
		expect(
			areFormValuesEqual(
				new Map([["a", 1]]),
				new Map([
					["a", 1],
					["b", 2],
				]),
			),
		).toBe(false)
		expect(areFormValuesEqual(new Set([1]), new Set([1]))).toBe(true)
	})

	it("treats insertion order as significant for iterable collections", () => {
		const left = new Map([
			["a", 1],
			["b", 2],
		])
		const right = new Map([
			["b", 2],
			["a", 1],
		])

		expect(areFormValuesEqual(left, right)).toBe(false)
		expect(areFormValuesEqual(new Set([1, 2]), new Set([2, 1]))).toBe(false)
		expect(areFormValuesEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
	})

	it("never reports two different leaf kinds as equal", () => {
		const cases: readonly [unknown, unknown][] = [
			[new Map([["a", 1]]), { a: 1 }],
			[new Set([1]), [1]],
			[new Date(0), 0],
			[/a/, "a"],
			[[1], { 0: 1 }],
			[null, {}],
			[undefined, null],
			[{ a: undefined }, {}],
			[Number.NaN, Number.NaN],
		]

		for (const [left, right] of cases) {
			expect(areFormValuesEqual(left, right)).toBe(
				Object.is(left, right) || Number.isNaN(left as number),
			)
			expect(areFormValuesEqual(right, left)).toBe(
				areFormValuesEqual(left, right),
			)
		}
	})

	it("keeps -0, sparse holes, and own keys with undefined values", () => {
		const holed: (number | undefined)[] = [1, undefined, 3]
		delete holed[1]
		const sparse = cloneFormValue(holed)
		expect(1 in sparse).toBe(false)
		expect(sparse).toHaveLength(3)

		const clone = cloneFormValue({ amount: -0, optional: undefined })
		expect(Object.is(clone.amount, -0)).toBe(true)
		expect(Object.hasOwn(clone, "optional")).toBe(true)
		expect(areFormValuesEqual({ amount: -0 }, { amount: 0 })).toBe(false)
	})

	it("passes application-owned class instances through as opaque leaves", () => {
		class Money {
			constructor(readonly cents: number) {}
		}
		const money = new Money(100)
		const clone = cloneFormValue({ price: money })

		expect(clone.price).toBe(money)
		expect(isFormValueObject(money)).toBe(false)
		expect(
			areFormValuesEqual({ price: money }, { price: new Money(100) }),
		).toBe(false)
	})

	it("accepts prototype-less records produced by decoding", () => {
		const decoded = Object.assign(Object.create(null), { name: "Ada" })

		expect(isFormValueObject(decoded)).toBe(true)
		expect(areFormValuesEqual(decoded, { name: "Ada" })).toBe(true)
		expect(Object.getPrototypeOf(cloneFormValue(decoded))).toBe(
			Object.prototype,
		)
	})
})
