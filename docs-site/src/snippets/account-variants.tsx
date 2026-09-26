// @jsx: react-jsx
"use client"

import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

// [!region schema]
const accountBase = z.object({
	email: z.email("Enter a valid email"),
})

const personalAccount = accountBase.extend({
	accountType: z.literal("personal"),
	firstName: z.string().min(1, "Enter your first name"),
	lastName: z.string().min(1, "Enter your last name"),
})

const companyAccount = accountBase.extend({
	accountType: z.literal("company"),
	companyName: z.string().min(1, "Enter the company name"),
	vatId: z.string().min(1, "Enter the VAT ID"),
})

const accountSchema = z.discriminatedUnion("accountType", [
	personalAccount,
	companyAccount,
])
// [!endregion schema]

// [!region definition]
const accountDefinition = kit.defineForm(
	accountSchema,
	(ui) => [
		ui.field("accountType", {
			control: "radio",
			label: "Account type",
			options: [
				{ value: "personal", label: "Personal" },
				{ value: "company", label: "Company" },
			],
		}),
		ui.section("personal-account", {
			title: "Personal details",
			columns: 2,
			visible: ({ accountType }) => accountType === "personal",
			children: [
				ui.field("firstName", {
					control: "text",
					label: "First name",
					required: true,
				}),
				ui.field("lastName", {
					control: "text",
					label: "Last name",
					required: true,
				}),
			],
		}),
		ui.section("company-account", {
			title: "Company details",
			columns: 2,
			visible: ({ accountType }) => accountType === "company",
			children: [
				ui.field("companyName", {
					control: "text",
					label: "Company name",
					required: true,
				}),
				ui.field("vatId", {
					control: "text",
					label: "VAT ID",
					required: true,
				}),
			],
		}),
		ui.field("email", {
			control: "text",
			label: "Email",
			required: true,
			props: { type: "email" },
		}),
	],
	{
		// Give the selected branch empty strings instead of `undefined`.
		beforeUpdate(draft) {
			if (draft.accountType === "personal") {
				draft.firstName ??= ""
				draft.lastName ??= ""
			} else {
				draft.companyName ??= ""
				draft.vatId ??= ""
			}
		},
	},
)
// [!endregion definition]

// [!region component]
export function AccountForm() {
	const [saved, setSaved] = useState<FormOutput<typeof accountSchema>>()
	const form = kit.useForm(accountDefinition, {
		defaultValues: {
			accountType: "personal",
			firstName: "",
			lastName: "",
			email: "",
		},
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit the form to see the schema output."
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Open account</kit.Submit>
			</kit.AutoForm>
			<pre>
				<output aria-live="polite">{output}</output>
			</pre>
		</>
	)
}
// [!endregion component]
