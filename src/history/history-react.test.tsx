"use client"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { useState } from "react"
import { useFormState } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { FormBinding } from "../create-form-kit.js"
import { createFormKit } from "../create-form-kit.js"
import { createDefaultSlots } from "../default-slots/index.js"
import { createNativeControls } from "../native-controls/index.js"
import { createHistoryMiddleware, type HistoryHandle } from "./history.js"
import { type UseHistoryResult, useHistory } from "./use-history.js"

const schema = z.object({
	items: z.array(z.object({ name: z.string() })),
	name: z.string(),
	optional: z.string().optional(),
})
type Input = z.input<typeof schema>

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const definitionSource = {
	ui: [
		{ control: "text", kind: "field", label: "Name", path: "name" },
		{
			children: [
				{ control: "text", kind: "field", label: "Item name", path: "name" },
			],
			itemDefault: { name: "" },
			kind: "array",
			label: "Items",
			path: "items",
		},
	],
} as const

describe("history React Hook Form integration", () => {
	it("publishes navigation state through the React history hook", async () => {
		const feature = createHistoryMiddleware({ groupWindow: 0 })
		const definition = kit.defineForm(schema, definitionSource, {
			middleware: [feature],
		})
		let history!: UseHistoryResult<Input>

		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { items: [], name: "Ada" },
			})
			history = useHistory(form, feature)
			return (
				<kit.AutoForm form={form}>
					<output data-testid="history-position">
						{history.snapshot.index}:{history.snapshot.length}
					</output>
				</kit.AutoForm>
			)
		}

		render(<View />)
		expect(screen.getByTestId("history-position").textContent).toBe("0:0")

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Grace" },
		})
		await waitFor(() =>
			expect(screen.getByTestId("history-position").textContent).toBe("1:1"),
		)
		expect(history.snapshot.canUndo).toBe(true)

		await act(async () => {
			expect(await history.undo()).toBe("applied")
		})
		await waitFor(() =>
			expect(screen.getByTestId("history-position").textContent).toBe("0:1"),
		)
		expect(history.snapshot.canRedo).toBe(true)
	})

	it("keeps one hook result identity until navigation state changes", async () => {
		const feature = createHistoryMiddleware({ groupWindow: 0 })
		const definition = kit.defineForm(schema, definitionSource, {
			middleware: [feature],
		})
		const results: UseHistoryResult<Input>[] = []
		let rerender!: () => void

		function View() {
			const [tick, setTick] = useState(0)
			rerender = () => setTick(tick + 1)
			const form = kit.useForm(definition, {
				defaultValues: { items: [], name: "Ada" },
			})
			results.push(useHistory(form, feature))
			return <kit.AutoForm form={form} />
		}

		render(<View />)
		const initial = results.at(-1)

		act(() => rerender())
		expect(results.at(-1)).toBe(initial)
		expect(Object.isFrozen(initial)).toBe(true)

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Grace" },
		})
		await waitFor(() => expect(results.at(-1)).not.toBe(initial))
		expect(results.at(-1)?.snapshot).toEqual({
			canRedo: false,
			canUndo: true,
			index: 1,
			length: 1,
		})
	})

	it("restores optional top-level keys and generated array structure", async () => {
		const feature = createHistoryMiddleware({ groupWindow: 0 })
		const definition = kit.defineForm(schema, definitionSource, {
			middleware: [feature],
		})
		let form!: FormBinding<typeof schema>
		let history!: HistoryHandle<Input>

		function View() {
			form = kit.useForm(definition, {
				defaultValues: { items: [], name: "Ada" },
			})
			history = feature.handle(form)
			return <kit.AutoForm form={form} />
		}

		render(<View />)
		act(() => {
			form.update((draft) => {
				draft.optional = "temporary"
			})
		})
		expect(form.api.getValues()).toHaveProperty("optional", "temporary")

		await act(async () => {
			expect(await history.undo()).toBe("applied")
		})
		expect(form.api.getValues()).not.toHaveProperty("optional")

		await act(async () => {
			expect(await history.redo()).toBe("applied")
		})
		expect(form.api.getValues()).toHaveProperty("optional", "temporary")

		fireEvent.click(screen.getByRole("button", { name: "Add item" }))
		expect(screen.getByLabelText("Item name")).toBeDefined()
		expect(form.api.getValues().items).toHaveLength(1)

		await act(async () => {
			expect(await history.undo()).toBe("applied")
		})
		expect(screen.queryByLabelText("Item name")).toBeNull()
		expect(form.api.getValues().items).toHaveLength(0)

		await act(async () => {
			expect(await history.redo()).toBe("applied")
		})
		expect(screen.getByLabelText("Item name")).toBeDefined()
		expect(form.api.getValues().items).toHaveLength(1)
	})

	it("preserves touched and errors while recalculating dirty from defaults", async () => {
		const feature = createHistoryMiddleware({ groupWindow: 0 })
		const definition = kit.defineForm(schema, definitionSource, {
			beforeUpdate(_draft, transaction) {
				if (transaction.source.type === "history") {
					expect(transaction.source.action).toBe("undo")
				}
			},
			middleware: [feature],
		})
		let form!: FormBinding<typeof schema>
		let history!: HistoryHandle<Input>

		function View() {
			form = kit.useForm(definition, {
				defaultValues: { items: [], name: "Ada" },
			})
			history = feature.handle(form)
			const state = useFormState({ control: form.api.control })
			return (
				<kit.AutoForm form={form}>
					<output data-testid="state">
						{JSON.stringify({
							dirty: state.isDirty,
							error: state.errors.name?.message,
							touched: state.touchedFields.name,
						})}
					</output>
				</kit.AutoForm>
			)
		}

		render(<View />)
		const name = screen.getByLabelText("Name")
		fireEvent.change(name, { target: { value: "Grace" } })
		fireEvent.blur(name)
		act(() => {
			form.api.setError("name", { message: "Keep this error", type: "manual" })
		})
		await waitFor(() =>
			expect(readState()).toEqual({
				dirty: true,
				error: "Keep this error",
				touched: true,
			}),
		)

		await act(async () => {
			expect(await history.undo()).toBe("applied")
		})
		await waitFor(() =>
			expect(readState()).toEqual({
				dirty: false,
				error: "Keep this error",
				touched: true,
			}),
		)
		expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
			"Ada",
		)
	})
})

function readState(): unknown {
	return JSON.parse(screen.getByTestId("state").textContent ?? "null")
}
