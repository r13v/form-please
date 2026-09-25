// @jsx: react-jsx
// @errors: 2345 2322
// Both errors below are intentional. TypeScript catches them
// before the form ever reaches a browser.
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const signupSchema = z.object({
	name: z.string().min(2, "Enter at least two characters"),
	email: z.string().email("Enter a valid email"),
	newsletter: z.boolean(),
})

const signupForm = kit.defineForm(signupSchema, (ui) => [
	ui.field("name", { control: "text", label: "Name", required: true }),
	ui.field("emial", { control: "text", label: "Email", required: true }),
	ui.field("newsletter", { control: "text", label: "Product news" }),
])

export function SignupForm() {
	const [saved, setSaved] = useState<FormOutput<typeof signupSchema>>()
	const form = kit.useForm(signupForm, {
		defaultValues: {
			name: "Ada Lovelace",
			email: "ada@example.com",
			newsletter: true,
		},
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
