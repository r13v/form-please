import type { StandardSchemaV1 } from "@standard-schema/spec"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { createFormKit, type DefineFormOptions } from "../create-form-kit.js"
import { createDefaultSlots } from "../default-slots/index.js"
import { createNativeControls } from "../native-controls/index.js"
import type { BeforeUpdate, FormMiddleware } from "../value-middleware.js"
import {
	createDefinitionTester,
	type DefinitionFieldSnapshot,
} from "./definition-tester.js"

type Values = { readonly name: string; readonly reviewed: boolean }
type Context = {
	readonly canEdit: boolean
	readonly canView: boolean
	readonly locale: string
}

const schema: StandardSchemaV1<Values> = {
	"~standard": {
		version: 1,
		vendor: "definition-render-parity",
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
			ui.field("name", {
				className: "profile-name",
				control: "text",
				disabled: (_values, { context }) => !context.canEdit,
				label: (values, { context }) =>
					`${context.locale}:${values.name}:${values.reviewed}`,
				props: (values, { context }) => ({
					placeholder: `${context.locale}:${values.name}`,
				}),
				required: true,
				span: 2,
				visible: (_values, { context }) => context.canView,
			}),
		],
		options,
	)
}

const definition = defineTestForm()
const values = { name: "Ada", reviewed: false }

const normalizeName: BeforeUpdate<Values, Context> = (draft, transaction) => {
	if (transaction.source.type === "control") {
		draft.name = transaction.nextValues.name.toUpperCase()
	}
}

const markReviewed: FormMiddleware<Values, Context> =
	() => (next) => (transaction) =>
		next([
			...transaction.patches,
			{ op: "replace", path: ["reviewed"], value: true },
		])

function ActualForm({ context }: { readonly context: Context }) {
	const form = kit.useForm(definition, { context, defaultValues: values })
	return (
		<kit.Form form={form}>
			<kit.Fields />
		</kit.Form>
	)
}

describe("definition tester parity", () => {
	it("matches the observable generated field across context rerenders", () => {
		const initialContext = {
			canEdit: true,
			canView: true,
			locale: "en",
		}
		const tester = createDefinitionTester(definition, {
			context: initialContext,
			values,
		})
		const rendered = render(<ActualForm context={initialContext} />)

		expectRenderedField(rendered.container, tester.field("name"))

		const lockedContext = {
			canEdit: false,
			canView: true,
			locale: "fr",
		}
		tester.setContext(lockedContext)
		rendered.rerender(<ActualForm context={lockedContext} />)
		expectRenderedField(rendered.container, tester.field("name"))

		const hiddenContext = { ...lockedContext, canView: false }
		tester.setContext(hiddenContext)
		rendered.rerender(<ActualForm context={hiddenContext} />)
		expect(tester.field("name").visible).toBe(false)
		expect(rendered.container.querySelector('[data-fp-path="name"]')).toBeNull()
	})

	it("matches the mounted form managed update lifecycle", async () => {
		const context = { canEdit: true, canView: true, locale: "en" }
		const afterUpdate = vi.fn()
		const configurations = vi.fn()
		const isolatedMiddleware: FormMiddleware<Values, Context> = (api) => {
			configurations()
			return markReviewed(api)
		}
		const lifecycleDefinition = defineTestForm({
			afterUpdate,
			beforeUpdate: normalizeName,
			middleware: [isolatedMiddleware],
		})
		let renderedValues: Values | undefined
		const tester = createDefinitionTester(lifecycleDefinition, {
			context,
			values,
		})
		const rendered = render(
			<LifecycleForm
				context={context}
				definition={lifecycleDefinition}
				readValues={(next) => {
					renderedValues = next
				}}
			/>,
		)
		expect(configurations).toHaveBeenCalledTimes(2)

		const input =
			rendered.container.querySelector<HTMLInputElement>('input[name="name"]')
		expect(input).not.toBeNull()
		fireEvent.change(input as HTMLInputElement, {
			target: { value: "grace" },
		})
		const tested = tester.setValue("name", "grace")

		await waitFor(() => {
			expect(renderedValues).toEqual(tested.after.values)
			expect(rendered.container.textContent).toContain("en:GRACE:true")
		})
		expect(tested.committed).toBe(true)
		expect(afterUpdate).toHaveBeenCalledTimes(2)
		expect(afterUpdate.mock.calls[0]?.[0]).toMatchObject({
			nextValues: tested.transaction?.nextValues,
			patches: tested.transaction?.patches,
			source: tested.transaction?.source,
		})
	})
})

type ArrayValues = { readonly speakers: readonly { readonly name: string }[] }

const arraySchema: StandardSchemaV1<ArrayValues> = {
	"~standard": {
		version: 1,
		vendor: "definition-render-parity-array",
		validate: (value) => ({ value: value as ArrayValues }),
	},
}
const arrayValues: ArrayValues = {
	speakers: [{ name: "Ada" }, { name: "Grace" }],
}

function defineArrayForm(afterUpdate: () => void) {
	return kit.defineForm(
		arraySchema,
		(ui) => [
			ui.array("speakers", {
				children: (item) => [item.field("name", { control: "text" })],
				itemDefault: { name: "" },
				label: "Speakers",
			}),
		],
		{ afterUpdate },
	)
}

describe("definition tester array parity", () => {
	it.each([
		{
			button: "Add item",
			run: (tester: ArrayTester) => tester.append("speakers"),
		},
		{
			button: "Move item 1 down",
			run: (tester: ArrayTester) => tester.move("speakers", 0, 1),
		},
		{
			button: "Remove item 1",
			run: (tester: ArrayTester) => tester.remove("speakers", 0),
		},
	])("matches the mounted form for $button", ({ button, run }) => {
		const context = { canEdit: true, canView: true, locale: "en" }
		const afterUpdate = vi.fn()
		const arrayDefinition = defineArrayForm(afterUpdate)
		let readRenderedValues = (): ArrayValues | undefined => undefined
		const tester = createDefinitionTester(arrayDefinition, {
			context,
			values: arrayValues,
		})
		render(
			<ArrayForm
				context={context}
				definition={arrayDefinition}
				exposeValues={(read) => {
					readRenderedValues = read
				}}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: button }))
		expect(afterUpdate).toHaveBeenCalledTimes(1)
		const tested = run(tester)

		expect(tested.committed).toBe(true)
		expect(readRenderedValues()).toEqual(tested.after.values)
		expect(afterUpdate).toHaveBeenCalledTimes(2)
		expect(afterUpdate.mock.calls[0]?.[0]).toMatchObject({
			nextValues: tested.transaction?.nextValues,
			patches: tested.transaction?.patches,
			source: tested.transaction?.source,
		})
	})
})

type ArrayTester = ReturnType<
	typeof createDefinitionTester<ReturnType<typeof defineArrayForm>>
>

function ArrayForm({
	context,
	definition,
	exposeValues,
}: {
	readonly context: Context
	readonly definition: ReturnType<typeof defineArrayForm>
	readonly exposeValues: (read: () => ArrayValues) => void
}) {
	const form = kit.useForm(definition, {
		context,
		defaultValues: arrayValues,
	})
	exposeValues(() => form.api.getValues())
	return (
		<kit.Form form={form}>
			<kit.Fields />
		</kit.Form>
	)
}

function LifecycleForm({
	context,
	definition,
	readValues,
}: {
	readonly context: Context
	readonly definition: ReturnType<typeof defineTestForm>
	readonly readValues: (values: Values) => void
}) {
	const form = kit.useForm(definition, {
		context,
		defaultValues: values,
	})
	readValues(form.api.getValues())
	return (
		<kit.Form form={form}>
			<kit.Fields />
		</kit.Form>
	)
}

function expectRenderedField(
	container: HTMLElement,
	field: DefinitionFieldSnapshot<typeof definition>,
): void {
	const root = container.querySelector<HTMLElement>('[data-fp-path="name"]')
	const input = container.querySelector<HTMLInputElement>('input[name="name"]')
	expect(root).not.toBeNull()
	expect(input).not.toBeNull()
	expect(root?.id).toBe(field.id)
	expect(root?.className).toBe(field.className)
	expect(root?.dataset.fpSpan).toBe(String(field.span))
	expect(root?.hasAttribute("data-disabled")).toBe(field.disabled)
	expect(root?.hasAttribute("data-required")).toBe(field.required)
	expect(input?.disabled).toBe(field.disabled)
	expect(input?.required).toBe(field.required)
	expect(input?.placeholder).toBe(
		(field.props as { readonly placeholder?: string } | undefined)?.placeholder,
	)
	if (typeof field.label === "string") {
		expect(root?.textContent).toContain(field.label)
	}
}
