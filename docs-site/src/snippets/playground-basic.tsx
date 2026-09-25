// @jsx: react-jsx
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const signupSchema = z.object({
	name: z.string().min(2, "Enter at least two characters"),
	email: z.string().email("Enter a valid email"),
})

const signupForm = kit.defineForm(signupSchema, (ui) => [
	ui.field("name", { control: "text", label: "Name", required: true }),
	ui.field("email", {
		control: "text",
		label: "Email",
		required: true,
		props: { type: "email" },
	}),
])

export function SignupForm() {
	const [saved, setSaved] = useState<FormOutput<typeof signupSchema>>()
	const form = kit.useForm(signupForm, {
		defaultValues: { name: "Ada Lovelace", email: "ada@example.com" },
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Create account</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
