// @vitest-environment jsdom
// @jsx: react-jsx
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test } from "vitest"
import { AccountForm } from "./account-variants"

afterEach(cleanup)

test("submits only the selected account variant", async () => {
	const user = userEvent.setup()
	render(<AccountForm />)

	await user.type(screen.getByLabelText(/First name/), "Ada")
	await user.click(screen.getByRole("radio", { name: "Company" }))

	expect(screen.queryByLabelText(/First name/)).toBeNull()
	await user.click(screen.getByRole("button", { name: "Open account" }))
	expect(await screen.findByText("Enter the company name")).toBeTruthy()
	expect(screen.queryByText("Enter your last name")).toBeNull()

	await user.type(screen.getByLabelText(/Company name/), "Compiler Labs")
	await user.type(screen.getByLabelText(/VAT ID/), "GB123")
	await user.type(screen.getByLabelText(/Email/), "ada@example.com")
	await user.click(screen.getByRole("button", { name: "Open account" }))

	const output = await screen.findByText(/Compiler Labs/)
	expect(JSON.parse(output.textContent ?? "")).toEqual({
		accountType: "company",
		companyName: "Compiler Labs",
		vatId: "GB123",
		email: "ada@example.com",
	})
})
