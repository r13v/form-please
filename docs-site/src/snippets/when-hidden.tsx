// @jsx: react-jsx
// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const accountSchema = z
	.object({
		accountType: z.enum(["personal", "company"]),
		companyName: z.string(),
	})
	// [!region validate]
	.superRefine((value, context) => {
		if (value.accountType === "company" && !value.companyName.trim()) {
			context.addIssue({
				code: "custom",
				message: "Enter the company name",
				path: ["companyName"],
			})
		}
	})
	// [!endregion validate]
	// [!region transform]
	.transform(({ companyName, ...account }) => {
		if (account.accountType === "company") return { ...account, companyName }
		return account
	})
// [!endregion transform]

const accountTypes = [
	{ value: "personal", label: "Personal" },
	{ value: "company", label: "Company" },
] as const

// [!region definition]
const accountDefinition = kit.defineForm(accountSchema, (ui) => [
	ui.field("accountType", {
		control: "radio",
		label: "Account type",
		options: accountTypes,
	}),
	ui.field("companyName", {
		control: "text",
		label: "Company name",
		visible: (values) => values.accountType === "company",
		whenHidden: "reset",
	}),
])
// [!endregion definition]

const editorKit = kit.forContext<{ readonly mode: "create" | "edit" }>()

// [!region context-resolver]
const editorDefinition = editorKit.defineForm(accountSchema, (ui) => [
	ui.field("accountType", {
		control: "radio",
		label: "Account type",
		options: accountTypes,
	}),
	ui.field("companyName", {
		control: "text",
		label: "Company name",
		visible: (values) => values.accountType === "company",
		whenHidden: (_values, { context }) => {
			if (context.mode !== "create") return
			return "reset"
		},
	}),
])
// [!endregion context-resolver]

// [!region component]
export function CompanyNameForm() {
	const [saved, setSaved] = useState<FormOutput<typeof accountSchema>>()
	const form = kit.useForm(accountDefinition, {
		defaultValues: { accountType: "company", companyName: "" },
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit the form to see the schema output."
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Save account</kit.Submit>
			</kit.AutoForm>
			<pre>
				<output aria-live="polite">{output}</output>
			</pre>
		</>
	)
}
// [!endregion component]
