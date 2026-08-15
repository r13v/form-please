"use client"

import { DevTool } from "@hookform/devtools"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { nativeFormKit } from "../preset-native/index.js"
import { FormPleaseDevtools } from "./devtools.js"

const conditionalDefinition = nativeFormKit.defineForm(
	z.object({
		mode: z.enum(["single", "team"]),
		role: z.enum(["member", "lead"]),
		team: z.string(),
	}),
	{
		ui: [
			{
				control: "select",
				kind: "field",
				label: "Mode",
				options: [
					{ label: "Single", value: "single" },
					{ label: "Team", value: "team" },
				],
				path: "mode",
			},
			{
				control: "select",
				kind: "field",
				label: "Role",
				options: ({ values }) => {
					if (values.mode === "team") {
						return [
							{ label: "Member", value: "member" },
							{ label: "Lead", value: "lead" },
						]
					}
					return [{ label: "Member", value: "member" }]
				},
				path: "role",
			},
			{
				control: "text",
				kind: "field",
				label: "Team",
				path: "team",
				visible: ({ mode }) => mode === "team",
			},
		],
	},
)

describe("devtools conditional-field integration", () => {
	it("keeps the third-party RHF inspector as a render-safe baseline", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

		function View() {
			const form = nativeFormKit.useForm(conditionalDefinition, {
				defaultValues: { mode: "single", role: "member", team: "" },
			})
			return (
				<>
					<nativeFormKit.AutoForm form={form} />
					<DevTool control={form.api.control} />
				</>
			)
		}

		try {
			render(<View />)
			fireEvent.change(screen.getByLabelText("Mode"), {
				target: { value: "team" },
			})
			await waitFor(() => expect(screen.getByLabelText("Team")).toBeDefined())

			expect(consoleError.mock.calls).toEqual([])
		} finally {
			consoleError.mockRestore()
		}
	})

	it("keeps dynamic resolution render-safe through the combined component", async () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

		function View() {
			const form = nativeFormKit.useForm(conditionalDefinition, {
				defaultValues: { mode: "single", role: "member", team: "" },
			})
			return (
				<>
					<nativeFormKit.AutoForm form={form} />
					<FormPleaseDevtools form={form} />
				</>
			)
		}

		try {
			render(<View />)
			fireEvent.change(screen.getByLabelText("Mode"), {
				target: { value: "team" },
			})
			await waitFor(() => expect(screen.getByLabelText("Team")).toBeDefined())

			expect(consoleError.mock.calls).toEqual([])
		} finally {
			consoleError.mockRestore()
		}
	})
})
