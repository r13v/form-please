"use client"

import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import { kit } from "./test-fixtures.js"

describe("whenHidden in a mounted form", () => {
	it("resets a hidden field in the managed update that hides it", () => {
		const accountSchema = z.object({
			accountType: z.string(),
			companyName: z.string(),
		})
		const transactions: string[] = []
		const definition = kit.defineForm(
			accountSchema,
			(ui) => [
				ui.field("accountType", { control: "text", label: "Account type" }),
				ui.field("companyName", {
					control: "text",
					label: "Company name",
					visible: (values) => values.accountType === "company",
					whenHidden: "reset",
				}),
			],
			{
				middleware: [
					() => (next) => (transaction) => {
						transactions.push(JSON.stringify(transaction.nextValues))
						return next(transaction.patches)
					},
				],
			},
		)

		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { accountType: "company", companyName: "" },
			})
			return <kit.AutoForm form={form} />
		}

		render(<View />)
		fireEvent.change(screen.getByLabelText("Company name"), {
			target: { value: "Acme" },
		})
		transactions.length = 0
		fireEvent.change(screen.getByLabelText("Account type"), {
			target: { value: "personal" },
		})

		expect(screen.queryByLabelText("Company name")).toBeNull()
		expect(transactions).toEqual([
			JSON.stringify({ accountType: "personal", companyName: "" }),
		])

		fireEvent.change(screen.getByLabelText("Account type"), {
			target: { value: "company" },
		})
		expect(
			(screen.getByLabelText("Company name") as HTMLInputElement).value,
		).toBe("")
	})
})
