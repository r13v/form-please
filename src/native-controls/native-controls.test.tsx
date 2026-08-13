"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import type { ControlProps } from "../types.js"
import {
	createNativeControls,
	type NativeFileProps,
	type NativeNumberProps,
	type NativeSelectOption,
	type NativeSelectProps,
	type NativeTextProps,
} from "./native-controls.js"

describe("createNativeControls", () => {
	it("returns the supported frozen control registry", () => {
		const controls = createNativeControls()

		expect(Object.isFrozen(controls)).toBe(true)
		expect(Object.keys(controls)).toEqual([
			"text",
			"textarea",
			"select",
			"checkbox",
			"number",
			"date",
			"time",
			"file",
		])
	})

	it("writes text and optional number values through the binding", () => {
		const controls = createNativeControls()
		const setText = vi.fn()
		const setNumber = vi.fn()

		render(
			<>
				<controls.text.component
					{...controlProps<string | undefined, NativeTextProps>({
						props: { type: "search" },
						name: "title",
						setValue: setText,
						value: "Ada",
					})}
				/>
				<controls.number.component
					{...controlProps<number | undefined, NativeNumberProps>({
						props: { min: 0 },
						name: "age",
						setValue: setNumber,
						value: 7,
					})}
				/>
			</>,
		)

		fireEvent.change(screen.getByRole("searchbox"), {
			target: { value: "Grace" },
		})
		fireEvent.change(screen.getByRole("spinbutton"), {
			target: { value: "" },
		})
		fireEvent.change(screen.getByRole("spinbutton"), {
			target: { value: "42" },
		})

		expect(setText).toHaveBeenCalledWith("Grace")
		expect(setNumber).toHaveBeenNthCalledWith(1, undefined)
		expect(setNumber).toHaveBeenNthCalledWith(2, 42)
	})

	it("represents an optional select value explicitly", () => {
		const controls = createNativeControls()
		const setValue = vi.fn()

		render(
			<controls.select.component
				{...controlProps<
					string | undefined,
					NativeSelectProps,
					NativeSelectOption
				>({
					props: { emptyOption: { label: "Choose" } },
					name: "status",
					options: [{ label: "Draft", value: "draft" }],
					setValue,
					value: undefined,
				})}
			/>,
		)

		const select = screen.getByRole("combobox")
		fireEvent.change(select, { target: { value: "draft" } })
		fireEvent.change(select, { target: { value: "" } })

		expect(setValue).toHaveBeenNthCalledWith(1, "draft")
		expect(setValue).toHaveBeenNthCalledWith(2, undefined)
	})

	it("clears the number value while the input holds unparsable text", () => {
		const controls = createNativeControls()
		const setValue = vi.fn()

		render(
			<controls.number.component
				{...controlProps<number | undefined, NativeNumberProps>({
					name: "amount",
					props: {},
					setValue,
					value: 7,
				})}
			/>,
		)
		const input = screen.getByRole("spinbutton")

		// A number input sanitizes partial text to "", so the field value clears
		// until the typed number parses again.
		for (const partial of ["-", "e", "1e", "."]) {
			fireEvent.change(input, { target: { value: partial } })
			expect(setValue).toHaveBeenLastCalledWith(undefined)
		}

		fireEvent.change(input, { target: { value: "-5.5" } })
		expect(setValue).toHaveBeenLastCalledWith(-5.5)
	})

	it("renders a number value that no longer round-trips through the input", () => {
		const controls = createNativeControls()
		const props = { name: "amount", props: {}, setValue: vi.fn() }

		const view = render(
			<controls.number.component
				{...controlProps<number | undefined, NativeNumberProps>({
					...props,
					value: -0,
				})}
			/>,
		)
		expect(screen.getByRole("spinbutton")).toHaveProperty("value", "0")

		view.rerender(
			<controls.number.component
				{...controlProps<number | undefined, NativeNumberProps>({
					...props,
					value: Number.NaN,
				})}
			/>,
		)
		expect(screen.getByRole("spinbutton")).toHaveProperty("value", "")
	})

	it("preserves a selected value that the current options omit", () => {
		const controls = createNativeControls()
		const setValue = vi.fn()

		render(
			<controls.select.component
				{...controlProps<
					string | undefined,
					NativeSelectProps,
					NativeSelectOption
				>({
					name: "status",
					options: [{ label: "Draft", value: "draft" }],
					props: { emptyOption: { label: "Choose" } },
					setValue,
					value: "archived",
				})}
			/>,
		)

		expect(screen.getByRole("combobox")).toHaveProperty("value", "")
		expect(setValue).not.toHaveBeenCalled()
		expect(
			screen.getAllByRole("option").map((option) => option.textContent),
		).toEqual(["Choose", "Draft"])
	})

	it("rejects a select configuration that cannot express undefined", () => {
		const controls = createNativeControls()
		const select = (
			props: NativeSelectProps,
			value: string | undefined,
			options: readonly NativeSelectOption[],
		) => (
			<controls.select.component
				{...controlProps<
					string | undefined,
					NativeSelectProps,
					NativeSelectOption
				>({ name: "status", options, props, setValue: vi.fn(), value })}
			/>
		)

		expect(() => render(select({}, undefined, []))).toThrow(
			"requires props.emptyOption to represent undefined",
		)
		expect(() =>
			render(
				select({ emptyOption: { label: "Choose" } }, "", [
					{ label: "Empty", value: "" },
				]),
			),
		).toThrow(
			'cannot combine props.emptyOption with an option whose value is ""',
		)
	})

	it("does not write checkbox state when the form is read-only", async () => {
		const controls = createNativeControls()
		const setValue = vi.fn()
		const user = userEvent.setup()

		render(
			<controls.checkbox.component
				{...controlProps<boolean, Record<string, never>>({
					props: {},
					name: "accepted",
					readOnly: true,
					setValue,
					value: true,
				})}
			/>,
		)

		const checkbox = screen.getByRole("checkbox") as HTMLInputElement
		await user.click(checkbox)
		expect(setValue).not.toHaveBeenCalled()
	})

	it("binds a selected file and clears the native input when state clears", async () => {
		const controls = createNativeControls()
		const user = userEvent.setup()

		function Harness() {
			const [value, setValue] = useState<File | undefined>()
			return (
				<>
					<controls.file.component
						{...controlProps<File | undefined, NativeFileProps>({
							props: { accept: ".png" },
							name: "avatar",
							setValue,
							value,
						})}
					/>
					<button type="button" onClick={() => setValue(undefined)}>
						Clear
					</button>
				</>
			)
		}

		render(<Harness />)
		const input = document.querySelector('input[type="file"]')
		if (!(input instanceof HTMLInputElement)) {
			throw new Error("Expected a file input")
		}
		await user.upload(input, new File(["avatar"], "avatar.png"))
		expect(input.files).toHaveLength(1)
		await user.click(screen.getByRole("button", { name: "Clear" }))
		expect(input.files).toHaveLength(0)
	})
})

function controlProps<Value, OwnProps, Option = never>({
	props,
	name,
	value,
	options,
	setValue,
	readOnly = false,
}: {
	readonly name: string
	readonly value: Value
	readonly props: OwnProps
	readonly options?: readonly Option[]
	setValue(value: Value): void
	readonly readOnly?: boolean
}): ControlProps<Value, OwnProps, unknown, Option> {
	return {
		blur: vi.fn(),
		props,
		context: {},
		disabled: false,
		input: {
			id: `${name}-id`,
			name,
			ref: vi.fn(),
		},
		meta: {
			dirty: false,
			displayErrors: [],
			errors: [],
			invalid: false,
			touched: false,
			validating: false,
		},
		...(options === undefined ? {} : { options }),
		path: name,
		readOnly,
		required: false,
		setValue,
		value,
	} as ControlProps<Value, OwnProps, unknown, Option>
}
