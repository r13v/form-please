// @jsx: react-jsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import type { z } from "zod"
import { ticketSchema } from "./migration-schema"

export function TicketFormBefore() {
	const [saved, setSaved] = useState<z.output<typeof ticketSchema>>()
	const {
		formState: { errors, isSubmitting },
		handleSubmit,
		register,
	} = useForm<
		z.input<typeof ticketSchema>,
		unknown,
		z.output<typeof ticketSchema>
	>({
		resolver: zodResolver(ticketSchema),
		defaultValues: { name: "", email: "", topic: "billing", message: "" },
	})

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<form noValidate onSubmit={handleSubmit((value) => setSaved(value))}>
				<label htmlFor="ticket-name">Name</label>
				<input
					id="ticket-name"
					aria-describedby="ticket-name-issue"
					aria-invalid={errors.name !== undefined}
					{...register("name")}
				/>
				<p id="ticket-name-issue">{errors.name?.message}</p>

				<label htmlFor="ticket-email">Email</label>
				<input
					id="ticket-email"
					type="email"
					aria-describedby="ticket-email-issue"
					aria-invalid={errors.email !== undefined}
					{...register("email")}
				/>
				<p id="ticket-email-issue">{errors.email?.message}</p>

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

				<button type="submit" disabled={isSubmitting}>
					Send ticket
				</button>
			</form>
			<pre>{output}</pre>
		</>
	)
}
