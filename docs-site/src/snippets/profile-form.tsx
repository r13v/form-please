// @jsx: react-jsx
"use client"

// [!region schema]
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const profileSchema = z
	.object({
		name: z.string().min(2, "Enter at least two characters"),
		email: z.string().email("Enter a valid email"),
	})
	.transform((input) => ({
		...input,
		slug: input.name.trim().toLowerCase().replaceAll(" ", "-"),
	}))
// [!endregion schema]

// [!region definition]
const profileDefinition = kit.defineForm(profileSchema, (ui) => [
	ui.field("name", {
		control: "text",
		label: "Name",
		required: true,
	}),
	ui.field("email", {
		control: "text",
		label: "Email",
		props: { type: "email", autoComplete: "email" },
		required: true,
	}),
])
// [!endregion definition]

// [!region component]
export function ProfileForm() {
	const [saved, setSaved] = useState<FormOutput<typeof profileSchema>>()
	const form = kit.useForm(profileDefinition, {
		defaultValues: { name: "", email: "" },
		// `value` includes the transformed `slug`.
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit the form to see the schema output."
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Save profile</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
// [!endregion component]
