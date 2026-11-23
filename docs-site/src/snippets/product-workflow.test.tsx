// @vitest-environment jsdom
// @jsx: react-jsx
import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test } from "vitest"
import { ProductWorkflowRecipe } from "./product-workflow"

afterEach(cleanup)

test("derives each screen from its definition node", async () => {
	const user = userEvent.setup()
	render(<ProductWorkflowRecipe />)

	expect(screen.getByText(/Identity\. Step 1 of 4\./)).toBeTruthy()
	expect(screen.queryByLabelText("Department")).toBeNull()
	await user.type(screen.getByLabelText("Name"), "Ada Lovelace")
	await user.type(screen.getByLabelText("Email"), "ada@example.com")
	await user.click(screen.getByLabelText("I represent an organization"))
	await user.click(screen.getByRole("button", { name: "Continue" }))
	expect(await screen.findByText(/Details\. Step 2 of 3\./)).toBeTruthy()

	await user.click(screen.getByRole("button", { name: "Clear identity name" }))
	await user.click(screen.getByRole("button", { name: "Review" }))
	await waitFor(() =>
		expect(document.activeElement).toBe(screen.getByLabelText("Name")),
	)

	await user.type(screen.getByLabelText("Name"), "Ada Lovelace")
	await user.click(screen.getByRole("button", { name: "Continue" }))
	await user.type(await screen.findByLabelText("Department"), "Research")
	await user.click(screen.getByRole("button", { name: "Review" }))
	expect(await screen.findByText(/Review\. Step 3 of 3\./)).toBeTruthy()
	await user.click(screen.getByRole("button", { name: "Publish" }))
	expect(await screen.findByText("Published Ada Lovelace.")).toBeTruthy()
})
