import { act, fireEvent, render, screen } from "@testing-library/react"
import type { Mode } from "react-hook-form"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { FormBinding } from "./create-form-kit.js"
import { kit } from "./test-fixtures.js"

const schema = z.object({
	generated: z.string().min(3, "Too short"),
	native: z.string().min(3, "Too short"),
})
const definition = kit.defineForm(schema, {
	ui: [
		{ kind: "field", path: "generated", control: "text", label: "Generated" },
	],
})

const modes: Mode[] = ["onSubmit", "onBlur", "onChange", "onTouched", "all"]
const reValidateModes = ["onSubmit", "onBlur", "onChange"] as const

const cases = modes.flatMap((mode) =>
	reValidateModes.flatMap((reValidateMode) =>
		[false, true].map((submitted) => ({ mode, reValidateMode, submitted })),
	),
)

/** A natively registered RHF input is the oracle for managed change validation. */
describe("managed change validation matches native RHF inputs", () => {
	it.each(cases)(
		"mode $mode, reValidateMode $reValidateMode, submitted $submitted",
		async ({ mode, reValidateMode, submitted }) => {
			const initial = submitted ? "" : "valid"
			let form!: FormBinding<typeof schema>
			function View() {
				form = kit.useForm(definition, {
					defaultValues: { generated: initial, native: initial },
					mode,
					reValidateMode,
					onSubmit: () => {},
				})
				return (
					<kit.Form form={form}>
						<kit.Fields />
						<input aria-label="Native" {...form.api.register("native")} />
						<button type="submit">Submit</button>
					</kit.Form>
				)
			}
			render(<View />)
			if (submitted) {
				fireEvent.click(screen.getByRole("button", { name: "Submit" }))
				await settle()
				expect(form.api.formState.isSubmitted).toBe(true)
			}

			const next = submitted ? "valid" : "x"
			fireEvent.change(screen.getByLabelText("Native"), {
				target: { value: next },
			})
			fireEvent.change(screen.getByLabelText("Generated"), {
				target: { value: next },
			})
			await settle()

			expect(form.api.getFieldState("generated").invalid).toBe(
				form.api.getFieldState("native").invalid,
			)
		},
	)
})

async function settle(): Promise<void> {
	await act(async () => {
		await new Promise((resolve) => setTimeout(resolve, 10))
	})
}
