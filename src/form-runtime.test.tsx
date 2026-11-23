"use client"

import { act, renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { kit } from "./test-fixtures.js"

describe("form.fieldPaths", () => {
	const schema = z.object({
		name: z.string(),
		company: z.object({ enabled: z.boolean(), title: z.string() }),
		rows: z.array(
			z.object({
				title: z.string(),
				items: z.array(z.object({ label: z.string() })),
			}),
		),
	})
	const definition = kit.defineForm(schema, (ui) => [
		ui.field("name", { control: "text" }),
		ui.section("company", {
			children: [
				ui.field("company.title", {
					control: "text",
					visible: (values) => values.company.enabled,
				}),
			],
		}),
		ui.array("rows", {
			itemDefault: { title: "", items: [] },
			children: (row) => [
				row.field("title", { control: "text" }),
				row.array("items", {
					itemDefault: { label: "" },
					children: (item) => [item.field("label", { control: "text" })],
				}),
			],
		}),
	])

	it("lists visible fields with absolute row paths while nothing is mounted", () => {
		const { result } = renderHook(() =>
			kit.useForm(definition, {
				defaultValues: {
					name: "",
					company: { enabled: false, title: "" },
					rows: [
						{ title: "", items: [{ label: "" }] },
						{ title: "", items: [] },
					],
				},
			}),
		)
		const form = result.current

		expect(form.fieldPaths()).toEqual([
			"name",
			"rows.0.title",
			"rows.0.items.0.label",
			"rows.1.title",
		])
		expect(form.fieldPaths("company")).toEqual([])
		expect(form.fieldPaths("rows.0.array:items")).toEqual([
			"rows.0.items.0.label",
		])
		expect(form.fieldPaths("rows.0.items.0.field:label")).toEqual([
			"rows.0.items.0.label",
		])

		act(() => form.api.setValue("company.enabled", true))

		expect(form.fieldPaths("company")).toEqual(["company.title"])
	})
})

describe("form.update result", () => {
	const schema = z.object({ name: z.string(), note: z.string() })
	const saved = Promise.resolve("saved")
	const definition = kit.defineForm(
		schema,
		(ui) => [ui.field("name", { control: "text" })],
		{
			beforeUpdate: (draft) => (draft.name === "cancel" ? false : undefined),
			middleware: [
				() => (next) => (transaction) => {
					if (transaction.nextValues.name === "hold") return "held"
					const committed = next(transaction.patches)

					return transaction.nextValues.name === "async" ? saved : committed
				},
			],
		},
	)

	function mount() {
		const { result } = renderHook(() =>
			kit.useForm(definition, { defaultValues: { name: "", note: "" } }),
		)

		return result.current
	}

	it("returns the final transaction and the middleware result of a commit", async () => {
		const form = mount()

		let update = form.update(() => undefined)
		act(() => {
			update = form.update((draft) => {
				draft.name = "Ada"
			})
		})
		expect(update.committed).toBe(true)
		if (!update.committed) return
		expect(update.transaction.nextValues).toEqual({ name: "Ada", note: "" })
		expect(update.transaction.source).toEqual({ type: "update" })
		expect(update.result).toBe(update.transaction)

		act(() => {
			update = form.update((draft) => {
				draft.name = "async"
			})
		})
		expect(update).toMatchObject({
			committed: true,
			result: saved,
			transaction: { nextValues: { name: "async" } },
		})
		if (update.committed) await expect(update.result).resolves.toBe("saved")
	})

	it.each([
		["an empty recipe", () => undefined, undefined],
		[
			"a beforeUpdate cancel",
			(draft: { name: string }) => {
				draft.name = "cancel"
			},
			undefined,
		],
		[
			"a middleware that does not call next",
			(draft: { name: string }) => {
				draft.name = "hold"
			},
			"held",
		],
	])("returns an uncommitted result for %s", (_case, recipe, result) => {
		const form = mount()

		expect(form.update(recipe)).toStrictEqual({ committed: false, result })
		expect(form.api.getValues()).toEqual({ name: "", note: "" })
	})
})

describe("form.context", () => {
	type Context = { readonly showTitle: boolean }
	const schema = z.object({ name: z.string(), title: z.string() })
	const definition = kit.forContext<Context>().defineForm(schema, (ui) => [
		ui.field("name", { control: "text" }),
		ui.field("title", {
			control: "text",
			visible: (_values, { context }) => context.showTitle,
		}),
	])

	it("gives the committed context, and an equal context keeps the first object", () => {
		const first: Context = { showTitle: false }
		const second: Context = { showTitle: true }
		const rendered: { context: Context; paths: string[] }[] = []
		const { result, rerender } = renderHook(
			({ context }: { readonly context: Context }) => {
				const form = kit.forContext<Context>().useForm(definition, {
					context,
					defaultValues: { name: "", title: "" },
				})
				rendered.push({ context: form.context, paths: form.fieldPaths() })
				return form
			},
			{ initialProps: { context: first } },
		)

		rerender({ context: second })

		// The render that passes the new context still reads the committed one.
		expect(rendered.at(-1)).toEqual({ context: first, paths: ["name"] })
		expect(result.current.context).toBe(second)
		expect(result.current.fieldPaths()).toEqual(["name", "title"])

		rerender({ context: { showTitle: true } })

		expect(result.current.context).toBe(second)
	})
})
