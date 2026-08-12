"use client"

import type { StandardSchemaV1 } from "@standard-schema/spec"
import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import type { ControlProps } from "../types.js"
import { createMuiFormKit } from "./index.js"
import type {
	MuiFileProps,
	MuiRadioOption,
	MuiRadioProps,
	MuiRangeSliderProps,
	MuiSelectOption,
	MuiSelectProps,
	MuiSliderProps,
	MuiTextFieldProps,
} from "./types.js"

const controlNames = [
	"text",
	"textarea",
	"password",
	"email",
	"url",
	"tel",
	"search",
	"number",
	"date",
	"time",
	"datetime-local",
	"select",
	"select-multiple",
	"radio",
	"checkbox",
	"switch",
	"autocomplete",
	"autocomplete-multiple",
	"file",
	"files",
	"slider",
	"range-slider",
] as const

describe("createMuiFormKit", () => {
	it("creates a fresh frozen kit with the official controls and 12-column grid", () => {
		const first = createMuiFormKit()
		const second = createMuiFormKit()

		expect(first).not.toBe(second)
		expect(Object.isFrozen(first)).toBe(true)
		expect(Object.isFrozen(first.controls)).toBe(true)
		expect(Object.isFrozen(first.slots)).toBe(true)
		expect(Object.keys(first.controls)).toEqual(controlNames)
		expect(first.grid).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
		expect(first.slots).toMatchObject({
			Array: expect.any(Function),
			ArrayItem: expect.any(Function),
			ErrorMessage: expect.any(Function),
			Field: expect.any(Function),
			Section: expect.any(Function),
			Submit: expect.any(Function),
		})
	})

	it("keeps Form Please props authoritative and calls user handlers second", () => {
		const kit = createMuiFormKit()
		const TextControl = kit.controls.text.component
		const calls: string[] = []
		const props = createControlProps<string | undefined, MuiTextFieldProps>({
			props: {
				onBlur: () => calls.push("user-blur"),
				onChange: () => calls.push("user-change"),
				slotProps: {
					htmlInput: {
						"aria-describedby": "user-description",
						"aria-invalid": false,
						defaultValue: "User default",
						name: "user-name",
						value: "User value",
					},
				},
			},
			value: undefined,
			setValue: () => calls.push("form-change"),
			blur: () => calls.push("form-blur"),
		})

		render(<TextControl {...props} />)
		const input = screen.getByRole("textbox")
		expect(input.getAttribute("id")).toBe("field-id")
		expect(input.getAttribute("name")).toBe("field")
		expect(input.getAttribute("aria-describedby")).toBe("field-description")
		expect(input.getAttribute("value")).toBe("")

		fireEvent.change(input, { target: { value: "Ada" } })
		fireEvent.blur(input)
		expect(calls).toEqual([
			"form-change",
			"user-change",
			"form-blur",
			"user-blur",
		])
	})

	it("keeps the owned select ID unique when nested input props provide one", () => {
		const kit = createMuiFormKit()
		const SelectControl = kit.controls.select.component

		render(
			<SelectControl
				{...createControlProps<
					string | undefined,
					MuiSelectProps,
					MuiSelectOption
				>({
					props: { inputProps: { id: "user-id", value: "user-value" } },
					options: [{ label: "Forms", value: "forms" }],
					value: "forms",
				})}
			/>,
		)

		expect(screen.getByRole("combobox").getAttribute("id")).toBe("field-id")
		expect(document.querySelectorAll("#field-id")).toHaveLength(1)
		expect(document.getElementById("user-id")).toBeNull()
		expect(document.querySelector("input")?.getAttribute("value")).toBe("forms")
	})

	it("keeps Slider thumb values authoritative over nested slot props", () => {
		const kit = createMuiFormKit()
		const SliderControl = kit.controls.slider.component

		render(
			<SliderControl
				{...createControlProps<number, MuiSliderProps>({
					props: {
						max: 5,
						min: 1,
						slotProps: {
							input: {
								"aria-valuenow": 99,
								defaultValue: 99,
								value: 99,
							},
						},
					},
					value: 3,
				})}
			/>,
		)

		const slider = screen.getByRole("slider")
		expect(slider.getAttribute("aria-valuenow")).toBe("3")
		expect(slider.getAttribute("value")).toBe("3")
	})

	it("keeps the range slider Form ID unique across both thumbs", () => {
		const kit = createMuiFormKit()
		const RangeSliderControl = kit.controls["range-slider"].component

		render(
			<RangeSliderControl
				{...createControlProps<readonly number[], MuiRangeSliderProps>({
					props: {
						slotProps: { input: { id: "user-id" } },
					},
					value: [2, 8],
				})}
			/>,
		)

		const sliders = screen.getAllByRole("slider")
		expect(sliders).toHaveLength(2)
		expect(document.querySelectorAll("#field-id")).toHaveLength(1)
		expect(document.getElementById("field-id")?.getAttribute("role")).not.toBe(
			"slider",
		)
		expect(document.getElementById("user-id")).toBeNull()
		for (const slider of sliders) {
			expect(slider.getAttribute("aria-labelledby")).toBe("field-id-label")
		}
	})

	it("commits typed radio options to Form Please state", () => {
		const kit = createMuiFormKit()
		const RadioControl = kit.controls.radio.component
		const setValue = vi.fn()

		render(
			<RadioControl
				{...createControlProps<
					string | undefined,
					MuiRadioProps,
					MuiRadioOption
				>({
					props: {},
					options: [
						{ label: "Talk", value: "talk" },
						{ label: "Workshop", value: "workshop" },
					],
					setValue,
					value: "talk",
				})}
			/>,
		)

		fireEvent.click(screen.getByRole("radio", { name: "Workshop" }))
		expect(setValue).toHaveBeenCalledWith("workshop")
	})

	it("renders accessible Material UI slots on the 12-column grid", () => {
		type Values = { readonly name?: string; readonly accepted: boolean }
		const schema: StandardSchemaV1<Values> = {
			"~standard": {
				version: 1,
				vendor: "mui-preset-test",
				validate: (value) => ({ value: value as Values }),
			},
		}
		const kit = createMuiFormKit()
		const definition = kit.defineForm(schema, {
			ui: [
				{
					kind: "section",
					id: "details",
					title: "Details",
					columns: 12,
					children: [
						{
							kind: "field",
							path: "name",
							control: "text",
							label: "Name",
							span: 7,
						},
						{
							kind: "field",
							path: "accepted",
							control: "checkbox",
							label: "Accept terms",
							span: 5,
						},
					],
				},
			],
		})

		function Form() {
			const form = kit.useForm(definition, {
				defaultValues: { accepted: false, name: "Ada" },
			})
			return <kit.AutoForm form={form} />
		}

		render(<Form />)
		expect(screen.getByLabelText("Name").getAttribute("value")).toBe("Ada")
		const checkbox = screen.getByLabelText("Accept terms")
		expect(checkbox).toBeInstanceOf(HTMLInputElement)
		expect(
			getComputedStyle(checkbox.parentElement as HTMLElement).alignSelf,
		).toBe("flex-start")
		const layout = document.querySelector('[data-fp-layout="grid"]')
		expect(layout?.className).toContain("MuiGrid-container")
		expect(layout?.getAttribute("data-fp-columns")).toBe("12")
		expect(
			screen
				.getByLabelText("Name")
				.closest('[data-fp-node="field"]')
				?.getAttribute("data-fp-span"),
		).toBe("7")
	})

	it("submits selected files through the native input", async () => {
		const user = userEvent.setup()
		const kit = createMuiFormKit({ i18n: { chooseFile: "Attach files" } })
		const FilesControl = kit.controls.files.component

		function Harness() {
			const [value, setValue] = useState<readonly File[]>([])
			return (
				<form aria-label="upload">
					<FilesControl
						{...createControlProps<readonly File[], MuiFileProps>({
							props: { inputProps: { accept: ".pdf" } },
							setValue,
							value,
						})}
					/>
				</form>
			)
		}

		render(<Harness />)
		const input = document.querySelector('input[type="file"]')
		expect(input).toBeInstanceOf(HTMLInputElement)
		expect(input?.parentElement?.getAttribute("role")).toBeNull()
		expect(input?.parentElement?.getAttribute("tabindex")).toBe("-1")
		const brief = new File(["brief"], "brief.pdf", {
			type: "application/pdf",
		})
		const notes = new File(["notes"], "notes.pdf", {
			type: "application/pdf",
		})
		await user.upload(input as HTMLInputElement, [brief, notes])

		const form = screen.getByRole("form", {
			name: "upload",
		}) as HTMLFormElement
		const formData = new FormData(form)
		expect((input as HTMLInputElement).files).toHaveLength(2)
		expect(formData.get("field")).toBeInstanceOf(File)
		expect(screen.getByText("brief.pdf, notes.pdf")).not.toBeNull()
	})
})

function createControlProps<Value, OwnProps, Option = never>({
	props,
	value,
	options,
	setValue = vi.fn(),
	blur = vi.fn(),
}: {
	readonly value: Value
	readonly props: OwnProps
	readonly options?: readonly Option[]
	setValue?(value: Value): void
	blur?(): void
}): ControlProps<Value, OwnProps, unknown, Option> {
	return {
		blur,
		props,
		context: {},
		disabled: false,
		input: {
			"aria-describedby": "field-description",
			id: "field-id",
			name: "field",
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
		path: "field",
		readOnly: false,
		required: false,
		setValue,
		value,
	} as ControlProps<Value, OwnProps, unknown, Option>
}
