// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
import type { FormMiddleware } from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { createDefinitionTester } from "form-please/testing"
import { expect, test } from "vitest"
import { z } from "zod"

const schema = z.object({
	contacts: z.array(z.object({ name: z.string() })),
	kind: z.enum(["person", "company"]),
	taxId: z.string(),
})
type Input = z.input<typeof schema>
type Context = { readonly locale: string }

const kit = nativeFormKit.forContext<Context>()
const definition = kit.defineForm(schema, (ui) => [
	ui.field("kind", {
		control: "select",
		options: [
			{ label: "Person", value: "person" },
			{ label: "Company", value: "company" },
		],
	}),
	ui.field("taxId", {
		control: "text",
		label: (_values, { context }) => `${context.locale}: Tax ID`,
		visible: (values) => values.kind === "company",
	}),
	ui.array("contacts", {
		children: (contact) => [
			contact.field("name", { control: "text", label: "Contact" }),
		],
		itemDefault: { name: "" },
	}),
])

// [!region inspect-and-transition]
test("shows every definition effect of changing kind", () => {
	const tester = createDefinitionTester(definition, {
		context: { locale: "en" },
		values: { contacts: [], kind: "person", taxId: "" },
	})

	expect(tester.field("taxId").visible).toBe(false)

	const change = tester.setValue("kind", "company")

	expect(change.after.field("taxId").visible).toBe(true)
	expect(change.changes).toEqual([
		{
			changes: [{ after: true, before: false, property: "visible" }],
			kind: "field",
			nodeId: "field:taxId",
			path: "taxId",
			type: "changed",
		},
	])
})
// [!endregion inspect-and-transition]

// [!region managed-lifecycle]
const normalizeTaxId: FormMiddleware<Input, Context> =
	() => (next) => (transaction) =>
		next(transaction.patches)

test("runs the real managed update lifecycle", () => {
	const managedDefinition = kit.defineForm(
		schema,
		{ ui: [] },
		{
			beforeUpdate(draft, transaction) {
				if (
					transaction.source.type === "control" &&
					transaction.source.path === "kind" &&
					transaction.nextValues.kind === "person"
				) {
					draft.taxId = ""
				}
			},
			middleware: [normalizeTaxId],
		},
	)
	const tester = createDefinitionTester(managedDefinition, {
		context: { locale: "en" },
		values: { contacts: [], kind: "company", taxId: "GB123" },
	})

	const change = tester.setValue("kind", "person")

	expect(change.committed).toBe(true)
	expect(change.after.values.taxId).toBe("")
	expect(change.transaction?.source).toEqual({
		path: "kind",
		type: "control",
	})
})
// [!endregion managed-lifecycle]

// [!region context-and-arrays]
const tester = createDefinitionTester(definition, {
	context: { locale: "en" },
	values: { contacts: [], kind: "company", taxId: "" },
})

const localeChange = tester.setContext({ locale: "fr" })
expect(localeChange.after.field("taxId").label).toBe("fr: Tax ID")

const appended = tester.append("contacts")
expect(appended.transaction?.source).toEqual({
	action: "append",
	index: 0,
	path: "contacts",
	type: "array",
})
expect(appended.after.field("contacts.0.name").label).toBe("Contact")
// [!endregion context-and-arrays]
