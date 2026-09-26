// @jsx: react-jsx
"use client"

import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { ticketSchema } from "./migration-schema"

const ticketDefinition = kit.defineForm(ticketSchema, (ui) => [
	ui.field("name", { control: "text", label: "Name", required: true }),
	ui.field("email", {
		control: "text",
		label: "Email",
		required: true,
		props: { type: "email" },
	}),
	ui.field("topic", {
		control: "select",
		label: "Topic",
		options: [
			{ value: "billing", label: "Billing" },
			{ value: "bug", label: "Bug report" },
			{ value: "other", label: "Other" },
		],
	}),
	ui.field("message", {
		control: "textarea",
		label: "Message",
		required: true,
	}),
])

export function TicketFormAfter() {
	const [saved, setSaved] = useState<FormOutput<typeof ticketSchema>>()
	const form = kit.useForm(ticketDefinition, {
		defaultValues: { name: "", email: "", topic: "billing", message: "" },
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Send ticket</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
