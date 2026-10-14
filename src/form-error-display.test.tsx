"use client"

import { fireEvent, render, screen, within } from "@testing-library/react"
import type { ReactElement } from "react"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { createFormKit } from "./create-form-kit.js"
import { kit } from "./test-fixtures.js"
import type { ArraySlotProps } from "./types.js"

describe("errorDisplay", () => {
	const accountSchema = z.object({
		password: z
			.string()
			.min(8, "Use at least 8 characters")
			.regex(/\d/, "Use a digit"),
		code: z.string().min(4, "Use 4 characters").regex(/^\d+$/, "Use digits"),
		speakers: z
			.array(z.object({ name: z.string() }))
			.min(1, "Add a speaker")
			.min(2, "Add two speakers"),
	})
	const defaultValues = { password: "", code: "", speakers: [] }
	const slots = {
		...kit.slots,
		Array: ({ rootProps, label, errors, children }: ArraySlotProps) => (
			<section {...rootProps}>
				<h2>{label}</h2>
				{errors}
				{children}
			</section>
		),
	}
	const allKit = createFormKit({ controls: kit.controls, slots })
	const firstKit = createFormKit({
		controls: kit.controls,
		slots,
		errorDisplay: "first",
	})

	async function submitForm(ui: ReactElement) {
		const view = render(ui)
		fireEvent.submit(view.container.querySelector("form") as HTMLFormElement)
		await screen.findByText("Use at least 8 characters")
		return view
	}

	it("shows all field and array issues by default", async () => {
		const definition = allKit.defineForm(accountSchema, (ui) => [
			ui.field("password", { control: "text", label: "Password" }),
			ui.array("speakers", {
				label: "Speakers",
				itemDefault: { name: "" },
				children: () => [],
			}),
		])
		function View() {
			const form = allKit.useForm(definition, { defaultValues })
			return <allKit.AutoForm form={form} />
		}

		await submitForm(<View />)

		expect(screen.getByText("Use a digit")).toBeTruthy()
		const speakers = screen
			.getByRole("heading", { name: "Speakers" })
			.closest("section") as HTMLElement
		expect(within(speakers).getByText("Add two speakers")).toBeTruthy()
	})

	it("shows the first issue when the kit selects first", async () => {
		const definition = firstKit.defineForm(accountSchema, (ui) => [
			ui.field("password", { control: "text", label: "Password" }),
			ui.array("speakers", {
				label: "Speakers",
				itemDefault: { name: "" },
				children: () => [],
			}),
		])
		function View() {
			const form = firstKit.useForm(definition, { defaultValues })
			return <firstKit.AutoForm form={form} />
		}

		await submitForm(<View />)

		expect(screen.queryByText("Use a digit")).toBeNull()
		const speakers = screen
			.getByRole("heading", { name: "Speakers" })
			.closest("section") as HTMLElement
		expect(within(speakers).getByText("Add a speaker")).toBeTruthy()
		expect(within(speakers).queryByText("Add two speakers")).toBeNull()
		const describedBy = screen
			.getByLabelText("Password")
			.getAttribute("aria-describedby")
		expect(describedBy?.split(" ")).toHaveLength(1)
		expect(document.getElementById(describedBy as string)?.textContent).toBe(
			"Use at least 8 characters",
		)
	})

	it("lets the form override the kit and the node override the form", async () => {
		const definition = firstKit.defineForm(accountSchema, (ui) => [
			ui.field("password", { control: "text", label: "Password" }),
			ui.field("code", {
				control: "text",
				label: "Code",
				errorDisplay: (values) => (values.password === "" ? "first" : "all"),
			}),
		])
		function View() {
			const form = firstKit.useForm(definition, {
				defaultValues,
				errorDisplay: "all",
			})
			return <firstKit.AutoForm form={form} />
		}

		await submitForm(<View />)

		expect(screen.getByText("Use a digit")).toBeTruthy()
		expect(screen.getByText("Use 4 characters")).toBeTruthy()
		expect(screen.queryByText("Use digits")).toBeNull()
	})

	it("rejects an unknown error display", () => {
		expect(() =>
			createFormKit({
				controls: kit.controls,
				slots: kit.slots,
				errorDisplay: "none" as "all",
			}),
		).toThrow('createFormKit errorDisplay must be "all" or "first"')
		expect(() =>
			kit.defineForm(accountSchema, (ui) => [
				ui.field("password", {
					control: "text",
					errorDisplay: "none" as "all",
				}),
			]),
		).toThrow('Field "password" errorDisplay must be "all" or "first"')
	})
})
