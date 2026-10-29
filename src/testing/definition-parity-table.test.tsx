import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { z } from "zod"

import { createFormKit, type FormBinding } from "../create-form-kit.js"
import { createDefaultSlots } from "../default-slots/index.js"
import { createNativeControls } from "../native-controls/index.js"
import type { FormDefinition } from "../types.js"
import { createDefinitionTester } from "./definition-tester.js"

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})

/** One user step that the tester and the mounted form both perform. */
type Step =
	| { readonly type: "set"; readonly path: string; readonly value: string }
	| { readonly type: "append"; readonly path: string }
	| { readonly type: "remove"; readonly path: string; readonly index: number }
	| {
			readonly type: "move"
			readonly path: string
			readonly index: number
			readonly direction: "up" | "down"
	  }

type Scenario = {
	readonly name: string
	readonly definition: FormDefinition
	readonly values: Record<string, unknown>
	readonly steps: readonly Step[]
}

const companySchema = z.object({
	accountType: z.string(),
	companyName: z.string(),
})
const speakersSchema = z.object({
	speakers: z.array(
		z.object({
			name: z.string(),
			talks: z.array(z.object({ title: z.string() })),
		}),
	),
})

const scenarios: readonly Scenario[] = [
	{
		name: "whenHidden reset",
		definition: kit.defineForm(companySchema, (ui) => [
			ui.field("accountType", { control: "text" }),
			ui.field("companyName", {
				control: "text",
				visible: (values) => values.accountType === "company",
				whenHidden: "reset",
			}),
		]),
		values: { accountType: "company", companyName: "" },
		steps: [
			{ type: "set", path: "companyName", value: "Acme" },
			{ type: "set", path: "accountType", value: "personal" },
		],
	},
	{
		name: "nested array actions",
		definition: kit.defineForm(speakersSchema, (ui) => [
			ui.array("speakers", {
				itemDefault: { name: "", talks: [] },
				children: (speaker) => [
					speaker.field("name", { control: "text" }),
					speaker.array("talks", {
						itemDefault: { title: "Untitled" },
						children: (talk) => [talk.field("title", { control: "text" })],
					}),
				],
			}),
		]),
		values: { speakers: [{ name: "Ada", talks: [{ title: "Engines" }] }] },
		steps: [
			{ type: "append", path: "speakers" },
			{ type: "set", path: "speakers.1.name", value: "Grace" },
			{ type: "append", path: "speakers.1.talks" },
			{ type: "move", path: "speakers", index: 1, direction: "up" },
			{ type: "remove", path: "speakers.1.talks", index: 0 },
			{ type: "set", path: "speakers.0.talks.0.title", value: "Compilers" },
		],
	},
	{
		name: "read-only array",
		definition: kit.defineForm(speakersSchema, (ui) => [
			ui.array("speakers", {
				itemDefault: { name: "", talks: [] },
				readOnly: true,
				children: (speaker) => [speaker.field("name", { control: "text" })],
			}),
		]),
		values: { speakers: [{ name: "Ada", talks: [] }] },
		steps: [{ type: "append", path: "speakers" }],
	},
]

describe("definition tester parity table", () => {
	it.each(scenarios)("$name", ({ definition, values, steps }) => {
		const tester = createDefinitionTester(
			definition as never,
			{ values } as never,
		)
		let form!: FormBinding
		function View() {
			form = kit.useForm(definition as never, {
				defaultValues: values as never,
			}) as unknown as FormBinding
			return (
				<kit.Form form={form as never}>
					<kit.Fields />
				</kit.Form>
			)
		}
		const { container } = render(<View />)

		for (const step of steps) {
			runTester(tester as unknown as TesterSteps, step)
			runForm(container, step)
			expect(form.api.getValues()).toEqual(tester.values)
		}
	})
})

type TesterSteps = {
	setValue(path: string, value: unknown): unknown
	append(path: string): unknown
	remove(path: string, index: number): unknown
	move(path: string, from: number, to: number): unknown
}

function runTester(tester: TesterSteps, step: Step): void {
	switch (step.type) {
		case "set":
			tester.setValue(step.path, step.value)
			return
		case "append":
			tester.append(step.path)
			return
		case "remove":
			tester.remove(step.path, step.index)
			return
		case "move":
			tester.move(
				step.path,
				step.index,
				step.direction === "up" ? step.index - 1 : step.index + 1,
			)
	}
}

function runForm(container: HTMLElement, step: Step): void {
	switch (step.type) {
		case "set":
			fireEvent.change(
				query(
					container,
					`[data-fp-node="field"][data-fp-path="${step.path}"] input`,
				),
				{ target: { value: step.value } },
			)
			return
		case "append":
			fireEvent.click(
				query(
					container,
					`[data-fp-node="array"][data-fp-path="${step.path}"] > [data-fp-array-action="add"]`,
				),
			)
			return
		case "remove":
		case "move": {
			const action =
				step.type === "remove" ? "remove" : `move-${step.direction}`
			fireEvent.click(
				query(
					container,
					`[data-fp-path="${step.path}.${step.index}"] > fieldset > [data-fp-array-action="${action}"]`,
				),
			)
		}
	}
}

function query(container: HTMLElement, selector: string): HTMLElement {
	const element = container.querySelector(selector)
	if (!(element instanceof HTMLElement)) {
		throw new Error(`Expected an element for ${selector}`)
	}
	return element
}
