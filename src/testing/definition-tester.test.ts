import type { StandardSchemaV1 } from "@standard-schema/spec"
import { describe, expect, it, vi } from "vitest"

import { createFormKit, type DefineFormOptions } from "../create-form-kit.js"
import { createDefaultSlots } from "../default-slots/index.js"
import { createNativeControls } from "../native-controls/index.js"
import type { FormMiddleware } from "../value-middleware.js"
import { createDefinitionTester } from "./definition-tester.js"

type Values = {
	readonly broken: string
	readonly contacts: readonly { readonly name: string }[]
	readonly country: string
	readonly kind: string
	readonly reviewed: boolean
	readonly taxId: string
}

type Context = {
	readonly canEdit: boolean
	readonly locale: string
}

const schema: StandardSchemaV1<Values> = {
	"~standard": {
		version: 1,
		vendor: "definition-tester",
		validate: (value) => ({ value: value as Values }),
	},
}

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
}).forContext<Context>()

function defineTestForm(options?: DefineFormOptions<typeof schema, Context>) {
	return kit.defineForm(
		schema,
		(ui) => [
			ui.field("kind", {
				control: "select",
				options: [
					{ label: "Person", value: "person" },
					{ label: "Company", value: "company" },
				],
			}),
			ui.section("identity", {
				columns: 2,
				title: (values) => `${values.kind}:${values.reviewed}`,
				children: [
					ui.field("taxId", {
						className: "identity-tax-id",
						control: "text",
						disabled: (_values, { context }) => !context.canEdit,
						label: (values, { context }) => `${context.locale}:${values.taxId}`,
						props: (values, { context }) => ({
							autoComplete: "off",
							placeholder: `${context.locale}:${values.taxId}`,
						}),
						required: true,
						span: 2,
						visible: (values) => values.kind === "company",
					}),
				],
			}),
			ui.field("country", {
				control: "select",
				options: async ({ context, values }) => [
					{
						label: `${context.locale}:${values.country}`,
						value: values.country,
					},
				],
			}),
			ui.field("broken", {
				control: "select",
				options: async () =>
					"not-an-array" as unknown as readonly {
						readonly label: string
						readonly value: string
					}[],
			}),
			ui.array("contacts", {
				children: (contact) => [
					contact.field("name", {
						control: "text",
						label: (values) => `Contact:${values.country}`,
					}),
				],
				itemDefault: { name: "" },
			}),
		],
		options,
	)
}

const definition = defineTestForm()

const initialValues: Values = {
	broken: "",
	contacts: [{ name: "Ada" }],
	country: "GB",
	kind: "person",
	reviewed: false,
	taxId: "",
}

describe("createDefinitionTester", () => {
	it("inspects resolved definition behavior with strict selectors", () => {
		const tester = createDefinitionTester(definition, {
			context: { canEdit: true, locale: "en" },
			values: initialValues,
		})

		expect(tester.field("taxId")).toMatchObject({
			className: "identity-tax-id",
			disabled: false,
			label: "en:",
			path: "taxId",
			props: { autoComplete: "off", placeholder: "en:" },
			required: true,
			span: 2,
			visible: false,
		})
		expect(tester.array("contacts").itemDefault).toEqual({ name: "" })
		expect(tester.field("contacts.0.name").label).toBe("Contact:GB")
		expect(tester.node("identity")).toMatchObject({
			columns: 2,
			kind: "section",
			title: "person:false",
		})
		expect(() => tester.node("missing")).toThrow(
			'No resolved node with id "missing". Available node ids:',
		)
		expect(() => tester.field("missing" as "taxId")).toThrow(
			'No resolved field at path "missing". Available field paths:',
		)
	})

	it("runs control proposals through beforeUpdate and middleware before resolving", () => {
		const afterUpdate = vi.fn()
		const reviewedMiddleware: FormMiddleware<Values, Context> =
			() => (next) => (transaction) =>
				next([
					...transaction.patches,
					{ op: "replace", path: ["reviewed"], value: true },
				])
		const configuredDefinition = defineTestForm({
			afterUpdate,
			beforeUpdate(draft, transaction) {
				if (
					transaction.source.type === "control" &&
					transaction.source.path === "kind"
				) {
					draft.taxId = `${transaction.context.locale}-id`
				}
			},
			middleware: [reviewedMiddleware],
		})
		const tester = createDefinitionTester(configuredDefinition, {
			context: { canEdit: true, locale: "en" },
			values: initialValues,
		})

		const change = tester.setValue("kind", "company")

		expect(change.committed).toBe(true)
		expect(change.transaction?.source).toEqual({
			path: "kind",
			type: "control",
		})
		expect(change.after.values).toEqual({
			...initialValues,
			kind: "company",
			reviewed: true,
			taxId: "en-id",
		})
		expect(change.after.field("taxId")).toMatchObject({
			label: "en:en-id",
			props: { autoComplete: "off", placeholder: "en:en-id" },
			visible: true,
		})
		expect(change.changes).toEqual([
			{
				changes: [
					{ after: true, before: false, property: "visible" },
					{ after: "en:en-id", before: "en:", property: "label" },
					{
						after: "en:en-id",
						before: "en:",
						property: "props.placeholder",
					},
				],
				kind: "field",
				nodeId: "field:taxId",
				path: "taxId",
				type: "changed",
			},
			{
				changes: [
					{
						after: "company:true",
						before: "person:false",
						property: "title",
					},
				],
				kind: "section",
				nodeId: "identity",
				type: "changed",
			},
		])
		expect(change.result).toBe(change.transaction)
		expect(afterUpdate).toHaveBeenCalledWith(change.transaction)
		expect(tester.current).toBe(change.after)
	})

	it("reports a cancelled beforeUpdate without changing the resolution", () => {
		const configuredDefinition = defineTestForm({
			beforeUpdate(_draft, transaction) {
				if (transaction.source.type === "control") return false
			},
		})
		const tester = createDefinitionTester(configuredDefinition, {
			context: { canEdit: true, locale: "en" },
			values: initialValues,
		})

		const change = tester.setValue("kind", "company")

		expect(change).toMatchObject({
			committed: false,
			transaction: undefined,
			changes: [],
		})
		expect(change.after).toBe(change.before)
		expect(tester.values).toEqual(initialValues)
	})

	it("distinguishes context rerenders from managed updates", () => {
		const sources: string[] = []
		const configuredDefinition = defineTestForm({
			beforeUpdate(draft, transaction) {
				sources.push(transaction.source.type)
				if (transaction.source.type === "control") {
					draft.taxId = `${transaction.context.locale}-hook`
				}
			},
		})
		const tester = createDefinitionTester(configuredDefinition, {
			context: { canEdit: true, locale: "en" },
			values: initialValues,
		})

		const contextChange = tester.setContext({
			canEdit: false,
			locale: "fr",
		})
		expect(sources).toEqual([])
		expect(contextChange.after.field("taxId")).toMatchObject({
			disabled: true,
			label: "fr:",
			props: { autoComplete: "off", placeholder: "fr:" },
		})

		const update = tester.update((draft) => {
			draft.taxId = "manual"
		})
		expect(sources).toEqual(["update"])
		expect(update.committed).toBe(true)
		expect(update.transaction?.source).toEqual({ type: "update" })
		expect(update.after.values.taxId).toBe("manual")

		const definitionUpdate = tester.setValue("kind", "company")
		expect(sources).toEqual(["update", "control"])
		expect(definitionUpdate.after.values.taxId).toBe("fr-hook")
	})

	it("runs generated array actions through the same managed lifecycle", () => {
		const sources: string[] = []
		const configuredDefinition = defineTestForm({
			beforeUpdate(draft, transaction) {
				if (transaction.source.type !== "array") return
				sources.push(transaction.source.action)
				if (transaction.source.action === "append") {
					const item = draft.contacts[transaction.source.index]
					if (item !== undefined) item.name = "New"
				}
			},
		})
		const tester = createDefinitionTester(configuredDefinition, {
			context: { canEdit: true, locale: "en" },
			values: initialValues,
		})

		const appended = tester.append("contacts")
		expect(appended.committed).toBe(true)
		expect(appended.transaction?.source).toEqual({
			action: "append",
			index: 1,
			path: "contacts",
			type: "array",
		})
		expect(appended.after.values.contacts).toEqual([
			{ name: "Ada" },
			{ name: "New" },
		])
		expect(appended.changes).toContainEqual({
			node: expect.objectContaining({
				id: "contacts.1.field:name",
				path: "contacts.1.name",
			}),
			type: "added",
		})

		const moved = tester.move("contacts", 1, 0)
		expect(moved.transaction?.source).toEqual({
			action: "move",
			fromIndex: 1,
			path: "contacts",
			toIndex: 0,
			type: "array",
		})
		expect(moved.after.values.contacts).toEqual([
			{ name: "New" },
			{ name: "Ada" },
		])

		const removed = tester.remove("contacts", 1)
		expect(removed.transaction?.source).toEqual({
			action: "remove",
			index: 1,
			path: "contacts",
			type: "array",
		})
		expect(removed.after.values.contacts).toEqual([{ name: "New" }])
		expect(removed.changes).toContainEqual({
			node: expect.objectContaining({ id: "contacts.1.field:name" }),
			type: "removed",
		})
		expect(sources).toEqual(["append", "move", "remove"])
	})

	it("resolves options with the production executor and exposes failures", async () => {
		const tester = createDefinitionTester(definition, {
			context: { canEdit: true, locale: "en" },
			values: initialValues,
		})

		await expect(tester.resolveOptions("kind")).resolves.toEqual([
			{ label: "Person", value: "person" },
			{ label: "Company", value: "company" },
		])
		await expect(tester.resolveOptions("country")).resolves.toEqual([
			{ label: "en:GB", value: "GB" },
		])
		await expect(tester.resolveOptions("broken")).rejects.toThrow(
			"Field options resolvers must return an array",
		)
		await expect(tester.resolveOptions("taxId")).rejects.toThrow(
			'Resolved field "taxId" does not define options',
		)
	})
})
