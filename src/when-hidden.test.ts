import type { StandardSchemaV1 } from "@standard-schema/spec"
import { describe, expect, it } from "vitest"

import { createFormKit } from "./create-form-kit.js"
import { createDefaultSlots } from "./default-slots/index.js"
import { createNativeControls } from "./native-controls/index.js"
import { createDefinitionTester } from "./testing/definition-tester.js"
import {
	createValueCoordinator,
	getValueCoordinatorCapability,
	type ValueTransaction,
} from "./value-middleware.js"

type Values = {
	readonly accountType: string
	readonly companyName: string
	readonly vatId: string
	readonly status: string
	readonly internalNote: string
	readonly contacts: readonly { readonly email: string }[]
}

type Context = {
	readonly mode: "create" | "edit"
}

const schema: StandardSchemaV1<Values> = {
	"~standard": {
		version: 1,
		vendor: "when-hidden",
		validate: (value) => ({ value: value as Values }),
	},
}

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
}).forContext<Context>()

const initialValues: Values = {
	accountType: "company",
	companyName: "",
	vatId: "",
	status: "draft",
	internalNote: "",
	contacts: [{ email: "first@example.com" }],
}

function defineTestForm(seen: ValueTransaction<Values, Context>[] = []) {
	return kit.defineForm(
		schema,
		(ui) => [
			ui.field("accountType", { control: "text" }),
			ui.section("company", {
				visible: (values) => values.accountType === "company",
				children: [
					ui.field("companyName", { control: "text", whenHidden: "reset" }),
				],
			}),
			ui.field("vatId", {
				control: "text",
				visible: (values) => values.companyName.length > 0,
				whenHidden: "reset",
			}),
			ui.field("status", {
				control: "text",
				visible: (values) => values.accountType === "company",
				whenHidden: (_values, { context }) =>
					context.mode === "create" ? { value: "reset" } : "keep",
			}),
			ui.field("internalNote", {
				control: "text",
				visible: (_values, { context }) => context.mode === "edit",
				whenHidden: "reset",
			}),
			ui.array("contacts", {
				itemDefault: { email: "" },
				children: (item) => [
					item.field("email", {
						control: "text",
						visible: (values) => values.accountType === "company",
						whenHidden: "reset",
					}),
				],
			}),
		],
		{
			middleware: [
				() => (next) => (transaction) => {
					seen.push(transaction as ValueTransaction<Values, Context>)
					return next(transaction.patches)
				},
			],
		},
	)
}

function createTester(
	mode: Context["mode"] = "create",
	values: Values = initialValues,
) {
	const seen: ValueTransaction<Values, Context>[] = []
	const tester = createDefinitionTester(defineTestForm(seen), {
		context: { mode },
		values,
	})
	return { seen, tester }
}

describe("whenHidden", () => {
	it("applies each action in the transaction that hides the field", () => {
		const { seen, tester } = createTester()
		tester.setValue("companyName", "Acme")
		tester.setValue("vatId", "EU123")
		tester.setValue("status", "active")
		tester.setValue("contacts.0.email", "changed@example.com")
		seen.length = 0

		tester.setValue("accountType", "personal")

		expect(tester.values).toEqual({
			accountType: "personal",
			companyName: "",
			vatId: "",
			status: "reset",
			internalNote: "",
			contacts: [{ email: "first@example.com" }],
		})
		expect(seen).toHaveLength(1)
		expect(seen[0]?.source).toEqual({ type: "control", path: "accountType" })
		expect(seen[0]?.nextValues).toEqual(tester.values)
	})

	it("resolves the action with the transaction context", () => {
		const { tester } = createTester("edit")
		tester.setValue("status", "active")

		tester.setValue("accountType", "personal")

		expect(tester.values.status).toBe("active")
	})

	it("keeps values of fields that were hidden before the transaction", () => {
		const { tester } = createTester("create", {
			...initialValues,
			accountType: "personal",
			companyName: "Loaded",
		})

		tester.setValue("status", "active")
		tester.update((draft) => {
			draft.companyName = "Edited while hidden"
		})

		expect(tester.values.companyName).toBe("Edited while hidden")
	})

	it("does not reset a field that a context change hides", () => {
		const { tester } = createTester("edit")
		tester.setValue("internalNote", "Keep me")

		tester.setContext({ mode: "create" })
		tester.setValue("status", "active")

		expect(tester.values.internalNote).toBe("Keep me")
	})

	it("rejects reset for an array item without an initial value", () => {
		const { tester } = createTester()
		tester.append("contacts")

		expect(() => tester.setValue("accountType", "personal")).toThrow(
			'Field "contacts.1.email" has no initial value for whenHidden "reset"',
		)
	})

	it("rejects an invalid static action", () => {
		expect(() =>
			kit.defineForm(schema, (ui) => [
				// @ts-expect-error The action must be "keep", "reset", or { value }.
				ui.field("status", { control: "text", whenHidden: "clear" }),
			]),
		).toThrow('Field "status" whenHidden must be "keep", "reset"')
	})

	it("checks an explicit value against the field type", () => {
		kit.defineForm(schema, (ui) => [
			// @ts-expect-error The explicit value must match the field value type.
			ui.field("status", { control: "text", whenHidden: { value: 42 } }),
		])
	})

	it("does not apply writes to history or persistence restores", () => {
		let values = { hidden: "restored" }
		const coordinator = createValueCoordinator<typeof values>({
			commit: () => undefined,
			getContext: () => undefined,
			getValues: () => values,
			middleware: [],
			resolveHiddenFieldWrites: () => [{ path: "hidden", value: "" }],
			restore: (transaction) => {
				values = transaction.nextValues as typeof values
			},
		})

		getValueCoordinatorCapability<typeof values>(coordinator).restore(
			(draft) => {
				draft.hidden = "from history"
			},
			{ type: "history", action: "undo" },
		)

		expect(values.hidden).toBe("from history")
	})
})
