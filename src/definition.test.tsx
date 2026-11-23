"use client"

import { afterEach, describe, expect, it, vi } from "vitest"
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

/** Builder helpers after their generic types erase. */
type UncheckedBuilder = Record<
	"array" | "field" | "render" | "section",
	(key: unknown, options: unknown) => unknown
>

/**
 * Recreates one unchecked node description with the builder helper of its
 * kind, so validation sees helper-created nodes with any property values.
 * A value without a known kind stays as it is.
 */
function buildNode(ui: UncheckedBuilder, node: unknown): unknown {
	if (!isNodeDescription(node)) return node

	const { kind, path, id, children, ...options } = node
	const keyOptions = "id" in node ? { id } : {}
	if (kind === "field") return ui.field(path, { ...options, ...keyOptions })
	if (kind === "render") return ui.render(id, options)
	if (kind === "section") {
		const sectionChildren = Array.isArray(children)
			? children.map((child) => buildNode(ui, child))
			: children
		return ui.section(id, { ...options, children: sectionChildren })
	}

	return ui.array(path, {
		...options,
		...keyOptions,
		children: (item: UncheckedBuilder) =>
			Array.isArray(children)
				? children.map((child) => buildNode(item, child))
				: children,
	})
}

/** Tests whether a value describes a field, section, array, or render node. */
function isNodeDescription(
	node: unknown,
): node is Record<string, unknown> & { readonly kind: string } {
	const kinds = ["array", "field", "render", "section"]

	return (
		typeof node === "object" &&
		node !== null &&
		"kind" in node &&
		kinds.includes(node.kind as string)
	)
}

/** Builds a definition from unchecked node descriptions. */
function define(nodes: readonly unknown[]) {
	return () =>
		kit.defineForm(schema, ((ui: UncheckedBuilder) =>
			nodes.map((node) => buildNode(ui, node))) as never)
}

/** Builds and resolves a definition from unchecked node descriptions. */
function resolve(nodes: readonly unknown[]) {
	return () =>
		resolveDefinition(
			define(nodes)(),
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
	it("rejects fragment placement options without an at path", () => {
		const fragment = kit.defineFragment(z.object({ age: z.number() }), () => [])
		for (const options of [{}, null, "profile"]) {
			expect(() => fragment.fields(options as never)).toThrow(
				"Fragment placement options must contain an at path",
			)
		}
	})

	it("requires a Standard Schema and a builder function", () => {
		for (const badSchema of [undefined, null, {}, { "~standard": {} }]) {
			expect(() => kit.defineForm(badSchema as never, () => [])).toThrow(
				"Form schema must implement Standard Schema validate",
			)
		}
		for (const source of [undefined, null, { ui: [] }, { ui: [field] }, []]) {
			expect(() => kit.defineForm(schema, source as never)).toThrow(
				"[FP141] Form definition requires a builder function",
			)
			expect(() => kit.defineFragment(schema, source as never)).toThrow(
				"[FP141] Fragment definition requires a builder function",
			)
		}
		expect(() => kit.defineForm(schema, (() => undefined) as never)).toThrow(
			"Form definition builder must return a ui array",
		)
	})

	it("validates managed-update policy while defining the form", () => {
		for (const [options, message] of [
			[null, "update options must be an object"],
			[[], "update options must be an object"],
			[{ beforeUpdate: "no" }, "beforeUpdate must be a function"],
			[{ afterUpdate: {} }, "afterUpdate must be a function"],
			[{ middleware: {} }, "middleware must be an array"],
			[
				{ middleware: [() => undefined, null] },
				"middleware must contain functions",
			],
		] as const) {
			expect(() => kit.defineForm(schema, () => [], options as never)).toThrow(
				message,
			)
		}
	})

	it("rejects list entries that no builder helper created", () => {
		for (const node of [null, undefined, "field", 1, [], () => null]) {
			expect(define([node])).toThrow("UI nodes must be objects")
		}
		const handWritten = [
			field,
			{ ...field, kind: "group" },
			{ kind: undefined },
		]
		for (const node of handWritten) {
			expect(() => kit.defineForm(schema, (() => [node]) as never)).toThrow(
				"[FP119] UI nodes must come from a builder helper",
			)
		}
		expect(() =>
			kit.defineForm(schema, (ui) => [
				ui.section("group", { children: [field as never] }),
			]),
		).toThrow("[FP119] UI nodes must come from a builder helper")
		expect(() => kit.defineFragment(schema, (() => [field]) as never)).toThrow(
			"[FP119] UI nodes must come from a builder helper",
		)
		expect(define([field])).not.toThrow()
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
			).toThrow("Array builder children must return a ui array")
			expect(define([{ children, id: "group", kind: "section" }])).toThrow(
				'section node "group" requires children',
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
		const definition = define([{ ...field, label: async () => "Name" }])()

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

describe("static subtree reuse", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	const values = { items: [], name: "Ada", profile: { age: 1 } }
	const staticDefinition = kit.defineForm(schema, (ui) => [
		ui.section("profile", {
			title: "Profile",
			children: [
				ui.field("name", { control: "text", label: "Name" }),
				ui.render("note", { component: () => null }),
			],
		}),
	])

	it("reuses a static subtree after a value change without a new visit", () => {
		const first = resolveDefinition(staticDefinition, values, undefined, {})
		const freeze = vi.spyOn(Object, "freeze")

		const next = resolveDefinition(
			staticDefinition,
			{ ...values, name: "Grace" },
			undefined,
			{},
			first,
		)

		expect(freeze).not.toHaveBeenCalled()
		expect(next).toBe(first)
	})

	it("resolves a static subtree again when the context or a flag changes", () => {
		const context = { locale: "en" }
		const first = resolveDefinition(staticDefinition, values, context, {})
		const nextContext = { locale: "de" }

		const withContext = resolveDefinition(
			staticDefinition,
			values,
			nextContext,
			{},
			first,
		)
		const disabled = resolveDefinition(
			staticDefinition,
			values,
			nextContext,
			{ disabled: true },
			withContext,
		)
		const readOnly = resolveDefinition(
			staticDefinition,
			values,
			nextContext,
			{ disabled: true, readOnly: true },
			disabled,
		)

		expect(withContext.nodes.map((node) => node.context)).toEqual([
			nextContext,
			nextContext,
			nextContext,
		])
		expect(disabled.nodes.every((node) => node.disabled)).toBe(true)
		expect(readOnly.nodes.every((node) => node.readOnly)).toBe(true)
	})

	it("resolves a static node again under an ancestor with a resolver", () => {
		const definition = kit.defineForm(schema, (ui) => [
			ui.section("profile", {
				visible: ({ name }) => name !== "hide",
				children: [ui.field("name", { control: "text", label: "Name" })],
			}),
		])
		const first = resolveDefinition(definition, values, undefined, {})

		const next = resolveDefinition(
			definition,
			{ ...values, name: "hide" },
			undefined,
			{},
			first,
		)

		expect(next.nodes.map((node) => [node.id, node.visible])).toEqual([
			["field:name", false],
			["profile", false],
		])
	})

	it("does not reuse nodes from another definition with the same IDs", () => {
		const first = resolveDefinition(staticDefinition, values, undefined, {})
		const relabeled = kit.defineForm(schema, (ui) => [
			ui.section("profile", {
				title: "Profile",
				children: [
					ui.field("name", { control: "text", label: "Full name" }),
					ui.render("note", { component: () => null }),
				],
			}),
		])

		const next = resolveDefinition(relabeled, values, undefined, {}, first)

		expect(next.nodes.find((node) => node.id === "field:name")?.label).toBe(
			"Full name",
		)
	})

	it("reconciles array rows with static row content", () => {
		const definition = kit.defineForm(schema, (ui) => [
			ui.array("items", {
				itemDefault: { name: "" },
				children: (item) => [
					item.field("name", { control: "text", label: "Name" }),
				],
			}),
		])
		const one = resolveDefinition(
			definition,
			{ ...values, items: [{ name: "A" }] },
			undefined,
			{},
		)
		const two = resolveDefinition(
			definition,
			{ ...values, items: [{ name: "A" }, { name: "B" }] },
			undefined,
			{},
			one,
		)
		const back = resolveDefinition(
			definition,
			{ ...values, items: [{ name: "B" }] },
			undefined,
			{},
			two,
		)

		const rows = (resolved: typeof one) => {
			const array = resolved.ui[0]
			return array?.kind === "array" ? array.itemChildren : []
		}
		expect(rows(two).map((row) => row.map((node) => node.id))).toEqual([
			["items.0.field:name"],
			["items.1.field:name"],
		])
		expect(rows(two)[0]).toBe(rows(one)[0])
		expect(rows(back)).toHaveLength(1)
		expect(back.nodes.map((node) => node.id)).toEqual([
			"items.0.field:name",
			"array:items",
		])
	})
})
