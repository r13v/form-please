import { z } from "zod"

import { createFormKit } from "../../src/create-form-kit.js"
import { createDefaultSlots } from "../../src/default-slots/index.js"
import type * as RootPublic from "../../src/index.js"
import { createNativeControls } from "../../src/native-controls/index.js"
import {
	createDefinitionTester,
	type DefinitionTestContext,
	type DefinitionTestValues,
} from "../../src/testing/index.js"

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <
		Value,
	>() => Value extends Right ? 1 : 2
		? true
		: false
type Expect<Condition extends true> = Condition

const schema = z.object({
	active: z.boolean(),
	items: z.array(z.object({ name: z.string() })),
	name: z.string(),
})
type Input = z.input<typeof schema>
type Context = {
	readonly locale: string
	readonly permissions: readonly string[]
}

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
}).forContext<Context>()
const definition = kit.defineForm(
	schema,
	(ui) => [
		ui.field("name", { control: "text" }),
		ui.field("active", { control: "checkbox" }),
		ui.array("items", {
			children: (item) => [item.field("name", { control: "text" })],
			itemDefault: { name: "" },
		}),
	],
	{
		beforeUpdate(draft, transaction) {
			draft.name = transaction.context.locale
			transaction.nextValues.active satisfies boolean
			transaction.source.type satisfies
				| "array"
				| "control"
				| "history"
				| "persistence"
				| "update"
		},
		middleware: [
			() => (next) => (transaction) => {
				transaction.context.permissions satisfies readonly string[]
				return next(transaction.patches)
			},
		],
	},
)

const tester = createDefinitionTester(definition, {
	context: { locale: "en", permissions: [] },
	values: { active: true, items: [{ name: "Ada" }], name: "Ada" },
})

tester.field("name").control satisfies
	| "checkbox"
	| "date"
	| "file"
	| "number"
	| "select"
	| "text"
	| "textarea"
	| "time"
tester.field("items.0.name").path satisfies string
tester.array("items").path satisfies string
tester.setValue("name", "Grace")
tester.setValue("active", false)
tester.setValue("items.0.name", "Grace")
tester.append("items")
tester.move("items", 0, 0)
tester.remove("items", 0)
tester.setContext({ locale: "fr", permissions: ["edit"] })
tester.rerender({ readOnly: true })
tester.update((draft) => {
	draft.items[0] = { name: "Lin" }
})

// @ts-expect-error Definition field paths are schema-owned.
tester.field("missing")
// @ts-expect-error Generated control values must match the selected schema path.
tester.setValue("active", "yes")
// @ts-expect-error Generated array actions require an object-array path.
tester.append("name")
// @ts-expect-error Concrete context keeps every required property.
tester.setContext({ locale: "fr" })
// @ts-expect-error Concrete form context is required by the tester.
createDefinitionTester(definition, {
	values: { active: true, items: [], name: "Ada" },
})

type _Values = Expect<Equal<DefinitionTestValues<typeof definition>, Input>>
type _Context = Expect<Equal<DefinitionTestContext<typeof definition>, Context>>
type _NoRootTesting = Expect<
	Equal<
		"createDefinitionTester" extends keyof typeof RootPublic ? true : false,
		false
	>
>

void tester
