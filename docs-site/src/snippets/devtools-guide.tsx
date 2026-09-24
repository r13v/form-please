// [!region setup]
// @jsx: react-jsx
"use client"

import { FormPleaseDevtools } from "form-please/devtools"
import { nativeFormKit } from "form-please/preset-native"
import { z } from "zod"

const profileDefinition = nativeFormKit.defineForm(
	z.object({
		name: z.string().min(1, "Enter a name"),
		role: z.string(),
	}),
	(ui) => [
		ui.field("name", { control: "text", label: "Name" }),
		ui.field("role", { control: "text", label: "Role" }),
	],
)

export function ProfileForm() {
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: { name: "Ada Lovelace", role: "Programmer" },
	})

	return (
		<>
			<nativeFormKit.AutoForm form={form} />
			{process.env.NODE_ENV === "development" && (
				<FormPleaseDevtools form={form} name="Profile" />
			)}
		</>
	)
}
// [!endregion setup]
