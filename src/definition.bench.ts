import { bench, describe } from "vitest"
import { z } from "zod"

import { defineControl } from "./control-definition.js"
import { createFormKit } from "./create-form-kit.js"
import { createDefaultSlots } from "./default-slots/index.js"
import { type ResolvedDefinition, resolveDefinition } from "./definition.js"

type BenchmarkValues = {
	fields: Record<string, string>
	rows: { a: string; b: string; c: string }[]
	toggle: string
}

/** Builder helpers after their generic types erase. */
type UncheckedBuilder = Record<
	"array" | "field" | "render" | "section",
	(key: unknown, options: unknown) => unknown
>

const sectionCount = 10
const fieldsPerSection = 10
const rowCount = 20
const resolverNodeCount = 5

const kit = createFormKit({
	controls: { text: defineControl<string>({ component: () => null }) },
	slots: createDefaultSlots(),
})

const schema = z.object({
	fields: z.record(z.string(), z.string()),
	rows: z.array(z.object({ a: z.string(), b: z.string(), c: z.string() })),
	toggle: z.string(),
})

/**
 * Static sections and fields, one array with static rows, and a few nodes
 * whose resolver functions read the edited value.
 */
const definition = kit.defineForm(schema, ((ui: UncheckedBuilder) => [
	ui.field("toggle", { control: "text", label: "Toggle" }),
	...Array.from({ length: resolverNodeCount }, (_, index) =>
		ui.field(`fields.dynamic${index}`, {
			control: "text",
			label: (values: BenchmarkValues) => `Dynamic ${values.toggle}`,
			visible: (values: BenchmarkValues) => values.toggle !== "hidden",
		}),
	),
	...Array.from({ length: sectionCount }, (_, section) =>
		ui.section(`section${section}`, {
			title: `Section ${section}`,
			columns: 2,
			children: Array.from({ length: fieldsPerSection }, (_, index) =>
				ui.field(`fields.s${section}f${index}`, {
					control: "text",
					label: `Field ${section}.${index}`,
				}),
			),
		}),
	),
	ui.array("rows", {
		itemDefault: { a: "", b: "", c: "" },
		children: (row: UncheckedBuilder) => [
			row.field("a", { control: "text", label: "A" }),
			row.field("b", { control: "text", label: "B" }),
			row.field("c", { control: "text", label: "C" }),
		],
	}),
]) as never)

/**
 * Resolves the definition after each value change. Without the previous
 * result, resolution visits every static node again; with it, resolution
 * reuses the static subtrees.
 */
function createValueChange(reusePrevious: boolean): () => void {
	let values: BenchmarkValues = {
		fields: {},
		rows: Array.from({ length: rowCount }, () => ({ a: "", b: "", c: "" })),
		toggle: "A",
	}
	let resolved: ResolvedDefinition = resolveDefinition(
		definition,
		values as never,
		undefined,
		{},
	)

	return () => {
		values = { ...values, toggle: values.toggle === "A" ? "B" : "A" }
		resolved = resolveDefinition(
			definition,
			values as never,
			undefined,
			{},
			reusePrevious ? resolved : undefined,
		)
	}
}

const shape = `${sectionCount * fieldsPerSection} static fields, ${rowCount} array rows, ${resolverNodeCount} resolver nodes`

describe("resolve after a value change", () => {
	bench(`${shape}, with the previous result`, createValueChange(true))
	bench(`${shape}, without the previous result`, createValueChange(false))
})
