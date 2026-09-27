// @jsx: react-jsx
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const accountBase = z.object({
	email: z.email("Enter a valid email"),
})

const accountSchema = z.discriminatedUnion("accountType", [
	accountBase.extend({ accountType: z.literal("personal") }),
	accountBase.extend({
		accountType: z.literal("company"),
		companyName: z
			.string()
			.trim()
			.min(1, "Enter the company name")
			.prefault(""),
	}),
])

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
		required: true,
		visible: ({ accountType }) => accountType === "company",
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
