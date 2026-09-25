// @jsx: react-jsx
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const teamSchema = z.object({
	team: z.string().min(1, "Name the team"),
	members: z
		.array(
			z.object({
				email: z.string().email("Enter a valid email"),
				role: z.enum(["owner", "editor", "viewer"]),
			}),
		)
		.min(1, "Invite at least one member"),
})

const teamForm = kit.defineForm(teamSchema, (ui) => [
	ui.field("team", { control: "text", label: "Team", required: true }),
	ui.array("members", {
		label: "Members",
		itemDefault: { email: "", role: "viewer" },
		children: (member) => [
			member.field("email", {
				control: "text",
				label: "Email",
				required: true,
				props: { type: "email" },
			}),
			member.field("role", {
				control: "select",
				label: "Role",
				options: [
					{ value: "owner", label: "Owner" },
					{ value: "editor", label: "Editor" },
					{ value: "viewer", label: "Viewer" },
				],
			}),
		],
	}),
])

export function TeamForm() {
	const [saved, setSaved] = useState<FormOutput<typeof teamSchema>>()
	const form = kit.useForm(teamForm, {
		defaultValues: {
			team: "Analytical Engine",
			members: [{ email: "ada@example.com", role: "owner" }],
		},
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Save team</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
