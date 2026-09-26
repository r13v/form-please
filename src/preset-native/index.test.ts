"use client"

import { describe, expect, it } from "vitest"

import { nativeFormKit } from "./index.js"

describe("nativeFormKit preset", () => {
	it("provides an immutable native kit", () => {
		expect(Object.isFrozen(nativeFormKit)).toBe(true)
		expect(Object.isFrozen(nativeFormKit.controls)).toBe(true)
		expect(Object.isFrozen(nativeFormKit.slots)).toBe(true)
		expect(Object.keys(nativeFormKit.controls)).toEqual([
			"text",
			"textarea",
			"select",
			"radio",
			"checkbox",
			"number",
			"date",
			"time",
			"file",
		])
	})
})
