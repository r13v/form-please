"use client"

import { describe, expect, it } from "vitest"
import { z } from "zod"

import { defineControl } from "./control-definition.js"
import { createFormKit } from "./create-form-kit.js"
import { createDefaultSlots } from "./default-slots/index.js"
import { resolveDefinition } from "./definition.js"

const schema = z.object({
	items: z.array(z.object({ name: z.string() })),
	name: z.string(),
	profile: z.object({ age: z.number() }),
})

const kit = createFormKit({
	controls: { text: defineControl<string>({ component: () => null }) },
	slots: createDefaultSlots(),
})

const field = { control: "text", kind: "field", label: "Name", path: "name" }

/** Creates a definition from an unchecked authoring source. */
function define(ui: unknown) {
	return () => kit.defineForm(schema, { ui } as never)
}

/** Creates and resolves a definition from an unchecked authoring source. */
function resolve(ui: unknown) {
	return () =>
		resolveDefinition(
			kit.defineForm(schema, { ui } as never),
			{ items: [], name: "", profile: { age: 1 } },
			undefined,
			{},
		)
}

describe("form kit grid validation", () => {
	it("rejects a grid that cannot express a layout", () => {
		const controls = { text: defineControl<string>({ component: () => null }) }
		const slots = createDefaultSlots()

		for (const [grid, message] of [
			[[], "grid must be a non-empty array"],
			[{}, "grid must be a non-empty array"],
			[[1, 0], "grid values must be positive integers"],
			[[1, -2], "grid values must be positive integers"],
			[[1, 2.5], "grid values must be positive integers"],
			[[1, "2"], "grid values must be positive integers"],
			[[1, Number.NaN], "grid values must be positive integers"],
			[[1, 2, 2], "grid cannot contain duplicate 2"],
			[[2, 4], "createFormKit grid must include 1"],
		] as const) {
			expect(() =>
				createFormKit({ controls, grid: grid as never, slots }),
			).toThrow(message)
		}
	})

	it("sorts and deduplicates a valid grid before freezing it", () => {
		const sorted = createFormKit({
			controls: { text: defineControl<string>({ component: () => null }) },
			grid: [4, 1, 2],
			slots: createDefaultSlots(),
		})

		expect(sorted.grid).toEqual([1, 2, 4])
		expect(Object.isFrozen(sorted.grid)).toBe(true)
	})
})

describe("form definition validation", () => {
	it("requires a Standard Schema and a ui array", () => {
		for (const badSchema of [undefined, null, {}, { "~standard": {} }]) {
			expect(() =>
				kit.defineForm(badSchema as never, { ui: [] } as never),
			).toThrow("Form schema must implement Standard Schema validate")
		}
		for (const source of [undefined, null, { ui: {} }, { ui: undefined }, []]) {
			expect(() => kit.defineForm(schema, source as never)).toThrow(
				"Form definition must contain a ui array",
			)
		}
		expect(() => kit.defineForm(schema, (() => undefined) as never)).toThrow(
			"Form definition builder must return a ui array",
		)
	})

	it("rejects node shapes the renderer cannot interpret", () => {
		for (const node of [null, undefined, "field", 1, [], () => null]) {
			expect(define([node])).toThrow("UI nodes must be objects")
		}
		for (const kind of [undefined, null, "group", "fields", ""]) {
			expect(define([{ kind }])).toThrow(
				`Unknown UI node kind "${String(kind)}"`,
			)
		}
	})

	it("requires a registered control for every generated field", () => {
		for (const control of [undefined, null, 1, "textarea", "toString"]) {
			expect(define([{ ...field, control }])).toThrow(
				`Unknown control "${String(control)}"`,
			)
		}
	})

	it("requires an explicit array itemDefault and children", () => {
		expect(
			define([{ children: [field], kind: "array", path: "items" }]),
		).toThrow('Array "items" requires itemDefault')
		expect(
			define([
				{
					children: [field],
					itemDefault: undefined,
					kind: "array",
					path: "items",
				},
			]),
		).not.toThrow()

		for (const children of [undefined, null, {}, "field"]) {
			expect(
				define([
					{ children, itemDefault: { name: "" }, kind: "array", path: "items" },
				]),
			).toThrow('array node "array:items" requires children')
			expect(define([{ children, kind: "section" }])).toThrow(
				"requires children",
			)
		}
	})

	it("rejects paths React Hook Form cannot address", () => {
		for (const path of [undefined, null, "", 1]) {
			expect(define([{ ...field, path }])).toThrow(
				"Field and array paths must be non-empty strings",
			)
		}
		for (const path of ["items[0]", "items.", ".name", "a..b", "a[b]"]) {
			expect(define([{ ...field, path }])).toThrow(
				`Path "${path}" uses invalid React Hook Form syntax`,
			)
		}
		for (const path of [
			"__proto__",
			"constructor",
			"prototype",
			"a.__proto__",
		]) {
			expect(define([{ ...field, path }])).toThrow(
				`Path "${path}" contains an invalid segment`,
			)
		}
		for (const path of ["0", "0.name", "12"]) {
			expect(define([{ ...field, path }])).toThrow(
				`Path "${path}" starts with an array index`,
			)
		}
		expect(define([{ ...field, path: "profile.age" }])).not.toThrow()
	})

	it("rejects unusable and colliding node ids", () => {
		for (const id of ["", 1, {}, null]) {
			expect(define([{ ...field, id }])).toThrow(
				"UI node ids must be non-empty strings",
			)
		}
		expect(define([field, { ...field }])).toThrow(
			'Duplicate UI node id "field:name"',
		)
		expect(
			define([
				{ ...field, id: "same" },
				{ ...field, id: "same", path: "profile.age" },
			]),
		).toThrow('Duplicate UI node id "same"')
		expect(
			define([{ ...field }, { ...field, path: "profile.age" }]),
		).not.toThrow()
	})

	it("checks static layout while defining and dynamic layout while resolving", () => {
		for (const columns of [0, 5, 2.5, "2", null]) {
			const node = { children: [field], columns, kind: "section" }
			expect(define([node])).toThrow(
				"Section layout columns must use the kit grid",
			)
			expect(resolve([{ ...node, columns: () => columns }])).toThrow(
				"Section layout columns must use the kit grid",
			)
		}
		for (const span of [0, 5, 2.5, "2", null]) {
			expect(define([{ ...field, span }])).toThrow(
				"Layout span must use the kit grid",
			)
		}
		expect(resolve([{ ...field, span: () => 5 }])).toThrow(
			"Layout span must use the kit grid",
		)
		expect(
			resolve([
				{ children: [{ ...field, span: 3 }], columns: 2, kind: "section" },
			]),
		).toThrow("Layout span must use the kit grid")
		expect(
			resolve([
				{ children: [{ ...field, span: "full" }], columns: 2, kind: "section" },
			]),
		).not.toThrow()
	})

	it("rejects an asynchronous resolver at definition resolution time", () => {
		const definition = kit.defineForm(schema, {
			ui: [{ ...field, label: async () => "Name" }],
		} as never)

		expect(() =>
			resolveDefinition(
				definition,
				{ items: [], name: "", profile: { age: 1 } },
				undefined,
				{},
			),
		).toThrow("UI resolvers must be synchronous")
	})
})
