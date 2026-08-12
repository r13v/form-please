"use client"

import type { FormInput, FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const profileSchema = z.object({
	name: z.string().min(1, "Name is required"),
	email: z.string().email("Enter a valid email"),
	newsletter: z.boolean(),
})

const defaultValues = {
	name: "Ada Lovelace",
	email: "ada@example.com",
	newsletter: true,
} satisfies FormInput<typeof profileSchema>

const profileDefinition = kit.defineForm(profileSchema, {
	ui: [
		{
			kind: "field",
			path: "name",
			control: "text",
			label: "Name",
			required: true,
			props: {
				placeholder: "Ada Lovelace",
				autoComplete: "name",
			},
		},
		{
			kind: "field",
			path: "email",
			control: "text",
			label: "Email",
			required: true,
			props: {
				type: "email",
				placeholder: "ada@example.com",
				autoComplete: "email",
			},
		},
		{
			kind: "field",
			path: "newsletter",
			control: "checkbox",
			label: "Send me product news",
		},
	],
})

export function OverviewDemoClient() {
	const [saved, setSaved] = useState<FormOutput<typeof profileSchema>>()
	const form = kit.useForm(profileDefinition, {
		defaultValues,
		onSubmit: ({ value }) => setSaved(value),
	})
	let output = "Submit the form to see typed output."
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<section
			aria-label="Live 'Form, Please' profile form"
			className="form-please-complex form-please-lab form-please-overview-demo"
			data-testid="overview-demo"
		>
			<p className="form-please-lab__kicker">Live demo</p>
			<p className="form-please-lab__summary">
				Edit the profile. Submit it to see the schema-validated output.
			</p>
			<kit.AutoForm className="form-please-overview-demo__form" form={form}>
				<kit.Submit className="form-please-lab__primary">
					Save profile
				</kit.Submit>
			</kit.AutoForm>
			<div
				aria-atomic="true"
				aria-live="polite"
				className="form-please-overview-demo__result"
			>
				<span>Validated output</span>
				<pre data-testid="overview-output">
					<code>{output}</code>
				</pre>
			</div>
		</section>
	)
}
