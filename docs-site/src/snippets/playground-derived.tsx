// @jsx: react-jsx
import type { FormOutput } from "form-please"
import { nativeFormKit as kit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const orderSchema = z.object({
	quantity: z.number().min(1, "Order at least one"),
	unitPrice: z.number().min(0),
	total: z.number(),
})

const orderForm = kit.defineForm(
	orderSchema,
	(ui) => [
		ui.field("quantity", { control: "number", label: "Quantity" }),
		ui.field("unitPrice", { control: "number", label: "Unit price" }),
		ui.field("total", { control: "number", label: "Total", readOnly: true }),
	],
	{
		beforeUpdate(draft) {
			if (draft.quantity > 50) return false
			draft.total = Math.round(draft.quantity * draft.unitPrice * 100) / 100
		},
	},
)

export function OrderForm() {
	const [saved, setSaved] = useState<FormOutput<typeof orderSchema>>()
	const form = kit.useForm(orderForm, {
		defaultValues: { quantity: 2, unitPrice: 15, total: 30 },
		onSubmit: ({ value }) => setSaved(value),
	})

	let output = "Submit to see output"
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Place order</kit.Submit>
			</kit.AutoForm>
			<pre>{output}</pre>
		</>
	)
}
