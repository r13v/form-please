// @jsx: react-jsx
"use client"

// [!region schema]
import { nativeFormKit as kit } from "form-please/preset-native"
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
const profileDefinition = kit.defineForm(profileSchema, {
	ui: [
		{
			kind: "field",
			path: "name",
			control: "text",
			label: "Name",
			required: true,
		},
		{
			kind: "field",
			path: "email",
			control: "text",
			label: "Email",
			options: { type: "email", autoComplete: "email" },
			required: true,
		},
	],
})
// [!endregion definition]

// [!region component]
export function ProfileForm() {
	const form = kit.useForm(profileDefinition, {
		defaultValues: { name: "", email: "" },
		onSubmit({ value }) {
			// `value` includes the transformed `slug`.
			console.log(value)
		},
	})

	return (
		<kit.AutoForm form={form}>
			<kit.Submit>Save profile</kit.Submit>
		</kit.AutoForm>
	)
}
// [!endregion component]
