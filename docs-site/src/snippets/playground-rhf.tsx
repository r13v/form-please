// @jsx: react-jsx
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { useFormState, useWatch } from "react-hook-form"
import { z } from "zod"

const inviteSchema = z.object({
	name: z.string().min(2, "Enter at least two characters"),
	message: z.string().max(80, "Use 80 characters or fewer"),
	referral: z.string(),
})

const inviteForm = kit.defineForm(inviteSchema, (ui) => [
	ui.field("name", { control: "text", label: "Name", required: true }),
	ui.field("message", { control: "textarea", label: "Message" }),
])

export function InviteForm() {
	const [saved, setSaved] = useState<FormOutput<typeof inviteSchema>>()
	const form = kit.useForm(inviteForm, {
		defaultValues: { name: "Ada Lovelace", message: "", referral: "" },
		onSubmit: ({ value }) => setSaved(value),
	})
	// React Hook Form hooks read the same state as the generated fields.
	const message = useWatch({ control: form.api.control, name: "message" })
	const { isDirty } = useFormState({ control: form.api.control })

	let changes = "No changes"
	if (isDirty) changes = "Unsaved changes"
	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<output>{message.length} of 80 characters</output>
				<label>
					Referral code
					<input {...form.api.register("referral")} />
				</label>
				<output>{changes}</output>
				<kit.Submit>Send invite</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
