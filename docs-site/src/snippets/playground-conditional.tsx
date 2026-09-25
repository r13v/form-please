// @jsx: react-jsx
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const accountSchema = z.object({
	accountType: z.enum(["personal", "company"]),
	companyName: z.string().optional(),
	email: z.string().email("Enter a valid email"),
})

const accountForm = kit.defineForm(accountSchema, (ui) => [
	ui.field("accountType", {
		control: "select",
		label: "Account type",
		options: [
			{ value: "personal", label: "Personal" },
			{ value: "company", label: "Company" },
		],
	}),
	ui.field("companyName", {
		control: "text",
		label: "Company name",
		visible: ({ accountType }) => accountType === "company",
		required: ({ accountType }) => accountType === "company",
	}),
	ui.field("email", {
		control: "text",
		label: "Email",
		required: true,
		props: { type: "email" },
	}),
])

export function AccountForm() {
	const [saved, setSaved] = useState<FormOutput<typeof accountSchema>>()
	const form = kit.useForm(accountForm, {
		defaultValues: {
			accountType: "personal",
			companyName: "",
			email: "ada@example.com",
		},
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Open account</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
