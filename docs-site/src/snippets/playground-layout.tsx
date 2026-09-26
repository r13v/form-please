// @jsx: react-jsx
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const deliverySchema = z.object({
	name: z.string().min(2, "Enter at least two characters"),
	email: z.string().email("Enter a valid email"),
	address: z.object({
		street: z.string().min(1, "Enter a street"),
		city: z.string().min(1, "Enter a city"),
		postcode: z.string().min(1, "Enter a postcode"),
	}),
})

const deliveryForm = kit.defineForm(deliverySchema, (ui) => [
	ui.section("contact", {
		title: "Contact",
		columns: 2,
		children: [
			ui.field("name", { control: "text", label: "Name", required: true }),
			ui.field("email", {
				control: "text",
				label: "Email",
				required: true,
				props: { type: "email" },
			}),
		],
	}),
	ui.section("address", {
		title: "Delivery address",
		columns: 2,
		children: [
			ui.field("address.street", {
				control: "text",
				label: "Street",
				required: true,
				span: "full",
			}),
			ui.field("address.city", {
				control: "text",
				label: "City",
				required: true,
			}),
			ui.field("address.postcode", {
				control: "text",
				label: "Postcode",
				required: true,
			}),
		],
	}),
])

export function DeliveryForm() {
	const [saved, setSaved] = useState<FormOutput<typeof deliverySchema>>()
	const form = kit.useForm(deliveryForm, {
		defaultValues: {
			name: "Ada Lovelace",
			email: "ada@example.com",
			address: {
				street: "12 St James's Square",
				city: "London",
				postcode: "SW1Y 4LE",
			},
		},
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Ship order</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
