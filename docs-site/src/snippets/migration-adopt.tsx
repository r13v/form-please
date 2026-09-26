// @jsx: react-jsx
"use client"

import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { ticketSchema } from "./migration-schema"

// [!region in-progress]
// The definition contains only the fields that moved.
const ticketDefinition = kit.defineForm(ticketSchema, (ui) => [
	ui.field("name", { control: "text", label: "Name", required: true }),
	ui.field("email", {
		control: "text",
		label: "Email",
		required: true,
		props: { type: "email" },
	}),
])

export function TicketFormInProgress() {
	const [saved, setSaved] = useState<FormOutput<typeof ticketSchema>>()
	const form = kit.useForm(ticketDefinition, {
		defaultValues: { name: "", email: "", topic: "billing", message: "" },
		onSubmit: ({ value }) => setSaved(value),
	})
	// The markup that did not move keeps its React Hook Form code.
	const {
		formState: { errors },
		register,
	} = form.api

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.Form form={form}>
				<kit.Fields />

				<label htmlFor="ticket-topic">Topic</label>
				<select id="ticket-topic" {...register("topic")}>
					<option value="billing">Billing</option>
					<option value="bug">Bug report</option>
					<option value="other">Other</option>
				</select>

				<label htmlFor="ticket-message">Message</label>
				<textarea
					id="ticket-message"
					aria-describedby="ticket-message-issue"
					aria-invalid={errors.message !== undefined}
					{...register("message")}
				/>
				<p id="ticket-message-issue">{errors.message?.message}</p>

				<kit.Submit>Send ticket</kit.Submit>
			</kit.Form>
			<pre>{output}</pre>
		</>
	)
}
// [!endregion in-progress]
