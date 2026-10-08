"use client"

import { createFormKit } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useWatch } from "react-hook-form"
import { z } from "zod"

// [!region reconcile-example]
const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const definition = kit.defineForm(
	z.object({
		delegates: z.array(z.object({ id: z.string(), expiry: z.string() })),
	}),
	(ui) => [
		ui.array("delegates", {
			label: "Delegates",
			itemDefault: () => ({ id: crypto.randomUUID(), expiry: "" }),
			children: (row) => [
				row.field("expiry", { control: "text", label: "Access expiry" }),
			],
		}),
	],
)

export function DelegatesForm() {
	const form = kit.useForm(definition, {
		defaultValues: { delegates: [{ id: "alex", expiry: "2026-12-01" }] },
	})
	const rows = useWatch({ control: form.api.control, name: "delegates" })
	return (
		<kit.Form form={form}>
			<fieldset>
				<legend>Choose delegates</legend>
				{["alex", "sam", "maria"].map((id) => (
					<label key={id}>
						<input
							type="checkbox"
							checked={rows.some((row) => row.id === id)}
							onChange={(event) => {
								let keys = rows
									.filter((row) => row.id !== id)
									.map((row) => row.id)
								if (event.target.checked)
									keys = [...rows.map((row) => row.id), id]
								form.array("delegates").reconcile(keys, {
									key: (row) => row.id,
									create: (key) => ({ id: key, expiry: "" }),
								})
							}}
						/>
						{id}
					</label>
				))}
			</fieldset>
			<kit.Fields />
		</kit.Form>
	)
}
// [!endregion reconcile-example]
