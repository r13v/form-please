// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
// [!region schema]
"use client"

import type { FormInput, FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const bookingSchema = z
	.object({
		title: z.string().trim().min(3, "Enter at least three characters"),
		capacity: z
			.string()
			.regex(/^\d+$/, "Enter a whole number")
			.transform(Number),
		reservedSeats: z
			.string()
			.regex(/^\d+$/, "Enter a whole number")
			.transform(Number),
	})
	.superRefine(({ capacity, reservedSeats }, context) => {
		if (reservedSeats > capacity) {
			context.addIssue({
				code: "custom",
				message: "Reserved seats cannot exceed the capacity",
				path: ["reservedSeats"],
			})
		}
	})
// [!endregion schema]

// [!region definition]
const bookingDefinition = kit.defineForm(bookingSchema, {
	ui: [
		{
			kind: "field",
			path: "title",
			control: "text",
			label: "Event title",
			required: true,
		},
		{
			kind: "field",
			path: "capacity",
			control: "text",
			label: "Capacity",
			required: true,
		},
		{
			kind: "field",
			path: "reservedSeats",
			control: "text",
			label: "Reserved seats",
			required: true,
		},
	],
})
// [!endregion definition]

// [!region submission]
type SaveResult =
	| { readonly ok: true }
	| { readonly ok: false; readonly message: string }

async function saveBooking(
	value: FormOutput<typeof bookingSchema>,
	intent: string,
): Promise<SaveResult> {
	const response = await fetch("/api/bookings", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ booking: value, intent }),
	})

	if (!response.ok) {
		return { ok: false, message: "The booking could not be saved" }
	}

	return { ok: true }
}
const bookingDefaults = {
	title: "",
	capacity: "",
	reservedSeats: "",
} satisfies FormInput<typeof bookingSchema>

export function BookingForm() {
	const [submitError, setSubmitError] = useState<string>()
	const form = kit.useForm(bookingDefinition, {
		defaultValues: bookingDefaults,
		onSubmit: async ({ value, input, form: binding, submitter }) => {
			setSubmitError(undefined)
			const result = await saveBooking(value, submitter?.value ?? "save")
			if (!result.ok) {
				setSubmitError(result.message)
				return
			}

			binding.api.reset(input)
		},
	})

	return (
		<kit.AutoForm form={form}>
			{submitError !== undefined && <p role="alert">{submitError}</p>}
			<kit.Submit name="intent" value="save">
				Save booking
			</kit.Submit>
		</kit.AutoForm>
	)
}
// [!endregion submission]

// [!region form-issue]
const invitationSchema = z
	.object({ invitationCode: z.string() })
	.superRefine(({ invitationCode }, context) => {
		if (invitationCode === "EXPIRED") {
			context.addIssue({
				code: "custom",
				message: "This invitation has expired",
			})
		}
	})
// [!endregion form-issue]
