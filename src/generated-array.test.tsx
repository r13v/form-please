"use client"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useFormContext, useWatch } from "react-hook-form"
import { describe, expect, expectTypeOf, it } from "vitest"
import { z } from "zod"
import { applyArrayAction, cloneItemDefault } from "./generated-array.js"
import { kit } from "./test-fixtures.js"
import type { FieldPath, PathValue } from "./types.js"

describe("generated arrays", () => {
	it.each([
		{ action: "append", index: 3 },
		{ action: "remove", index: 2 },
		{ action: "move", fromIndex: 0, toIndex: 2 },
		{ action: "move", fromIndex: 0.5, toIndex: 1 },
	] as const)(
		"rejects an array action index outside the items: %j",
		(action) => {
			const items = ["a", "b"]
			expect(() => applyArrayAction(items, "rows", action, "c")).toThrow(
				RangeError,
			)
			expect(items).toEqual(["a", "b"])
		},
	)

	it.each([
		["a Promise", async () => ({ name: "" })],
		["an array", () => []],
	])("rejects an item default factory that returns %s", (_name, factory) => {
		expect(() => cloneItemDefault(factory)).toThrow(
			"Generated array item defaults must be plain objects",
		)
	})

	it.each([undefined, null, "not an array"])(
		"rejects generated array value %j before rendering its actions",
		(speakers) => {
			const arraySchema = z.object({
				speakers: z.array(z.object({ name: z.string() })),
			})
			const arrayDefinition = kit.defineForm(arraySchema, {
				ui: [
					{
						children: [
							{ control: "text", kind: "field", label: "Name", path: "name" },
						],
						itemDefault: { name: "" },
						kind: "array",
						label: "Speakers",
						path: "speakers",
					},
				],
			})

			function View() {
				const form = kit.useForm(arrayDefinition, {
					defaultValues: { speakers: speakers as never },
				})
				return <kit.AutoForm form={form} />
			}

			expect(() => render(<View />)).toThrow(
				'Generated array path "speakers" must contain an array',
			)
		},
	)

	it("uses React Hook Form dot paths for array items", () => {
		type Input = { readonly speakers: readonly { readonly name: string }[] }

		expectTypeOf<"speakers.0.name">().toMatchTypeOf<FieldPath<Input>>()
		expectTypeOf<PathValue<Input, "speakers.0.name">>().toEqualTypeOf<string>()
	})

	it("keeps conditional fields, RHF arrays, and nested validation in one store", async () => {
		const complexSchema = z.object({
			format: z.enum(["remote", "in-person"]),
			room: z.string(),
			speakers: z.array(
				z.object({
					name: z.string().min(2, "Enter the speaker name"),
				}),
			),
		})
		const complexDefinition = kit.defineForm(
			complexSchema,
			{
				ui: [
					{
						kind: "field",
						path: "format",
						control: "select",
						label: "Format",
						options: ["remote", "in-person"],
					},
					{
						kind: "field",
						path: "room",
						control: "text",
						label: "Room",
						visible: (values) => values.format === "in-person",
					},
					{
						kind: "array",
						path: "speakers",
						label: "Speakers",
						itemDefault: { name: "" },
						children: [
							{
								kind: "field",
								path: "name",
								control: "text",
								label: "Speaker name",
							},
						],
					},
				],
			},
			{
				middleware: [
					() => (next) => (transaction) => {
						if (transaction.source.type !== "array") {
							return next(transaction.patches)
						}
						if (transaction.source.action === "remove") return "cancelled"
						if (transaction.source.action === "append") {
							return next([
								...transaction.patches,
								{ op: "replace", path: ["room"], value: "B-20" },
							])
						}
						return next(transaction.patches)
					},
				],
			},
		)
		type ComplexInput = z.input<typeof complexSchema>

		function ComplexState() {
			const api = useFormContext<ComplexInput>()
			const values = useWatch({ control: api.control })
			return (
				<>
					<output aria-label="Manual format">{values.format}</output>
					<output aria-label="Speaker order">
						{values.speakers?.map((speaker) => speaker?.name).join(",") ?? ""}
					</output>
				</>
			)
		}

		function View() {
			const form = kit.useForm(complexDefinition, {
				defaultValues: {
					format: "remote",
					room: "A-12",
					speakers: [{ name: "Ada" }, { name: "Grace" }],
				},
			})
			return (
				<kit.Form form={form}>
					<kit.Fields />
					<ComplexState />
					<kit.Submit>Save complex form</kit.Submit>
				</kit.Form>
			)
		}

		render(<View />)
		expect(screen.queryByLabelText("Room")).toBeNull()
		expect(screen.getByLabelText("Manual format").textContent).toBe("remote")

		const firstSpeakerItem = screen
			.getAllByLabelText("Speaker name")[0]
			?.closest('[data-fp-node="array-item"]')
		fireEvent.click(screen.getByRole("button", { name: "Move speaker 1 down" }))
		expect(screen.getByLabelText("Speaker order").textContent).toBe("Grace,Ada")
		expect(
			screen
				.getAllByLabelText("Speaker name")[1]
				?.closest('[data-fp-node="array-item"]'),
		).toBe(firstSpeakerItem)

		fireEvent.click(screen.getByRole("button", { name: "Add speaker" }))
		expect(screen.getAllByLabelText("Speaker name")).toHaveLength(3)
		fireEvent.click(screen.getByRole("button", { name: "Remove speaker 1" }))
		expect(screen.getAllByLabelText("Speaker name")).toHaveLength(3)
		fireEvent.click(screen.getByRole("button", { name: "Save complex form" }))
		expect(await screen.findByText("Enter the speaker name")).toBeTruthy()
		const invalidSpeaker = screen.getAllByLabelText("Speaker name").at(-1)
		if (invalidSpeaker === undefined) {
			throw new Error("Expected the added speaker field")
		}
		expect(invalidSpeaker.getAttribute("name")).toBe("speakers.2.name")
		expect(
			invalidSpeaker
				.closest('[data-fp-node="field"]')
				?.getAttribute("data-fp-path"),
		).toBe("speakers.2.name")
		expect(
			invalidSpeaker
				.closest('[data-fp-node="array-item"]')
				?.getAttribute("data-fp-path"),
		).toBe("speakers.2")
		expect(document.activeElement).toBe(invalidSpeaker)
		fireEvent.change(invalidSpeaker, {
			target: { value: "Lin" },
		})
		await waitFor(() => {
			expect(screen.queryByText("Enter the speaker name")).toBeNull()
		})

		fireEvent.change(screen.getByLabelText("Format"), {
			target: { value: "in-person" },
		})
		expect(
			((await screen.findByLabelText("Room")) as HTMLInputElement).value,
		).toBe("B-20")
	})
})
