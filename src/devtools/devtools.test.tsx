"use client"

import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

const { renderRhfDevtools } = vi.hoisted(() => ({
	renderRhfDevtools: vi.fn(),
}))

vi.mock("@hookform/devtools", () => ({
	DevTool: (props: unknown) => {
		renderRhfDevtools(props)
		return <div data-testid="rhf-devtools" />
	},
}))

import { nativeFormKit } from "../preset-native/index.js"
import { FormPleaseDevtools } from "./devtools.js"

const definition = nativeFormKit.defineForm(
	z.object({ name: z.string().min(1) }),
	{
		ui: [{ control: "text", kind: "field", label: "Name", path: "name" }],
	},
)

describe("FormPleaseDevtools", () => {
	it("binds both tools to the supplied form without a separate ID", async () => {
		function View() {
			const form = nativeFormKit.useForm(definition, {
				defaultValues: { name: "Ada" },
			})
			return (
				<nativeFormKit.AutoForm form={form}>
					<FormPleaseDevtools form={form} name="Profile" />
				</nativeFormKit.AutoForm>
			)
		}

		render(<View />)

		expect(await screen.findByTestId("rhf-devtools")).toBeDefined()
		expect(renderRhfDevtools).toHaveBeenCalled()
		expect(renderRhfDevtools.mock.calls.at(-1)?.[0]).toMatchObject({
			placement: "top-right",
		})
		expect(renderRhfDevtools.mock.calls.at(-1)?.[0]).not.toHaveProperty("id")

		fireEvent.click(
			screen.getByRole("button", {
				name: "Open Profile Form Please Devtools",
			}),
		)
		const drawer = screen.getByRole("complementary", {
			name: "Profile Form Please Devtools",
		})
		expect(within(drawer).getByText("1 nodes")).toBeDefined()
		expect(within(drawer).getAllByText("name").length).toBeGreaterThan(0)

		for (const [tab, emptyState] of [
			["Updates", "No recorded value updates."],
			["Options", "No selectable fields are resolved."],
			["Features", "This form does not configure the history feature."],
		] as const) {
			fireEvent.click(within(drawer).getByRole("tab", { name: tab }))
			expect(within(drawer).getByText(emptyState)).toBeDefined()
		}
	})
})
