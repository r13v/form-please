"use client"

import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { kit } from "./test-fixtures.js"
import type { StandardSchema } from "./types.js"

describe("form focus and error summary", () => {
	it("focuses the error summary when no generated control owns the issue", async () => {
		const formSchema: StandardSchema<{ readonly name: string }> = {
			"~standard": {
				version: 1,
				vendor: "summary-test",
				validate() {
					return { issues: [{ message: "Form is unavailable" }] }
				},
			},
		}
		const summaryDefinition = kit.defineForm(formSchema, { ui: [] })

		function View() {
			const form = kit.useForm(summaryDefinition, {
				defaultValues: { name: "Ada" },
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit>Submit unavailable form</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		fireEvent.click(
			screen.getByRole("button", { name: "Submit unavailable form" }),
		)
		const summary = await screen.findByText("Form is unavailable")
		await waitFor(() => expect(document.activeElement).toBe(summary))
		expect(summary.getAttribute("tabindex")).toBe("-1")
		expect(summary.getAttribute("data-fp-path")).toBeNull()
	})

	it("summarizes hidden fields whose paths overlap RHF error metadata", async () => {
		const metadataSchema = z.object({
			message: z.string().min(1, "Enter the hidden message"),
			group: z.object({ root: z.string().min(1, "Enter the nested root") }),
		})
		const metadataDefinition = kit.defineForm(metadataSchema, {
			ui: [
				{
					kind: "field",
					path: "message",
					control: "text",
					visible: false,
				},
				{
					kind: "field",
					path: "group.root",
					control: "text",
					visible: false,
				},
			],
		})

		function View() {
			const form = kit.useForm(metadataDefinition, {
				defaultValues: { message: "", group: { root: "" } },
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit>Submit hidden metadata fields</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		fireEvent.click(
			screen.getByRole("button", { name: "Submit hidden metadata fields" }),
		)

		const message = await screen.findByText("Enter the hidden message")
		const root = await screen.findByText("Enter the nested root")
		expect(message.getAttribute("data-fp-path")).toBe("message")
		expect(root.getAttribute("data-fp-path")).toBe("group.root")
	})

	it("does not lose schema errors for a top-level root field", async () => {
		const rootSchema = z.object({
			root: z.object({ name: z.string().min(1, "Enter the root name") }),
		})
		const rootDefinition = kit.defineForm(rootSchema, {
			ui: [
				{
					kind: "field",
					path: "root.name",
					control: "text",
					label: "Root name",
				},
			],
		})
		const onSubmit = vi.fn()

		function View() {
			const form = kit.useForm(rootDefinition, {
				defaultValues: { root: { name: "" } },
				onSubmit,
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit>Submit root field</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		fireEvent.click(screen.getByRole("button", { name: "Submit root field" }))
		const summary = await screen.findByText("Enter the root name", {
			selector: '[data-fp-node="error-message"][tabindex="-1"]',
		})
		expect(summary.getAttribute("data-fp-path")).toBe("root.name")
		expect(onSubmit).not.toHaveBeenCalled()
	})

	it("leaves invalid focus order to RHF registration order", async () => {
		const conditionalSchema = z.object({
			first: z.string().min(1, "Enter first"),
			mode: z.enum(["hide", "show"]),
			second: z.string().min(1, "Enter second"),
		})
		const conditionalDefinition = kit.defineForm(conditionalSchema, {
			ui: [
				{
					kind: "field",
					path: "first",
					control: "text",
					label: "First conditional field",
					visible: (values) => values.mode === "show",
				},
				{
					kind: "field",
					path: "mode",
					control: "select",
					label: "Conditional mode",
					options: ["hide", "show"],
				},
				{
					kind: "field",
					path: "second",
					control: "text",
					label: "Second conditional field",
				},
			],
		})

		function View() {
			const form = kit.useForm(conditionalDefinition, {
				defaultValues: { first: "", mode: "hide", second: "" },
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit>Submit conditional form</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		expect(screen.queryByLabelText("First conditional field")).toBeNull()
		fireEvent.change(screen.getByLabelText("Conditional mode"), {
			target: { value: "show" },
		})
		await screen.findByLabelText("First conditional field")
		fireEvent.click(
			screen.getByRole("button", { name: "Submit conditional form" }),
		)
		const second = screen.getByLabelText("Second conditional field")
		await waitFor(() => expect(document.activeElement).toBe(second))
	})

	it("falls back to the summary when RHF cannot focus its first error", async () => {
		const disabledSchema = z.object({
			first: z.string().min(1, "Enter first"),
			second: z.string().min(1, "Enter second"),
		})
		const disabledDefinition = kit.defineForm(disabledSchema, {
			ui: [
				{
					kind: "field",
					path: "first",
					control: "text",
					label: "Disabled invalid field",
					disabled: true,
				},
				{
					kind: "field",
					path: "second",
					control: "text",
					label: "Focusable invalid field",
				},
			],
		})

		function View() {
			const form = kit.useForm(disabledDefinition, {
				defaultValues: { first: "", second: "" },
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit>Submit disabled form</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		fireEvent.click(
			screen.getByRole("button", { name: "Submit disabled form" }),
		)
		const summary = await screen.findByText("Enter first", {
			selector: '[data-fp-node="error-message"][tabindex="-1"]',
		})
		await waitFor(() => expect(document.activeElement).toBe(summary))

		const focusable = screen.getByLabelText("Focusable invalid field")
		fireEvent.change(focusable, { target: { value: "Valid" } })
		await waitFor(() => {
			expect(screen.queryByText("Enter second")).toBeNull()
		})
		fireEvent.click(
			screen.getByRole("button", { name: "Submit disabled form" }),
		)
		const remainingSummary = document.querySelector(
			'[data-fp-node="error-message"][tabindex="-1"]',
		)
		expect(remainingSummary).toBeInstanceOf(HTMLElement)
		await waitFor(() => expect(document.activeElement).toBe(remainingSummary))
	})
})
