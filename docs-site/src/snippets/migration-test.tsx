// @vitest-environment jsdom
// @jsx: react-jsx
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, expect, test } from "vitest"
import { TicketFormInProgress } from "./migration-adopt"
import { TicketFormAfter } from "./migration-after"
import { TicketFormBefore } from "./migration-before"

afterEach(cleanup)

// [!region contract]
// Write this test for the React Hook Form version first. Run it without
// changes after each migration step.
const versions = [
	["React Hook Form", TicketFormBefore],
	["in progress", TicketFormInProgress],
	["Form, Please", TicketFormAfter],
] as const

test.each(versions)("%s shows schema issues", async (_name, TicketForm) => {
	const user = userEvent.setup()
	render(<TicketForm />)

	await user.click(screen.getByRole("button", { name: "Send ticket" }))

	expect(
		(await screen.findAllByText("Enter at least two characters")).length,
	).toBeGreaterThan(0)
	expect(
		screen.getAllByText("Enter at least 10 characters").length,
	).toBeGreaterThan(0)
})

test.each(versions)(
	"%s submits the schema output",
	async (_name, TicketForm) => {
		const user = userEvent.setup()
		render(<TicketForm />)

		await user.type(screen.getByLabelText(/^Name/), "Ada Lovelace")
		await user.type(screen.getByLabelText(/^Email/), "ada@example.com")
		await user.selectOptions(screen.getByLabelText(/^Topic/), "bug")
		await user.type(
			screen.getByLabelText(/^Message/),
			"The export button fails.",
		)
		await user.click(screen.getByRole("button", { name: "Send ticket" }))

		expect(await screen.findByText(/"topic": "bug"/)).toBeTruthy()
		expect(screen.getByText(/"name": "Ada Lovelace"/)).toBeTruthy()
	},
)
// [!endregion contract]
