"use client"

import type { StandardSchema } from "form-please"
import { FormPleaseDevtools } from "form-please/devtools"
import { useHistory } from "form-please/history"
import { usePersistence } from "form-please/persistence"
import { nativeFormKit as kit } from "form-please/preset-native"

if (typeof useHistory !== "function" || typeof usePersistence !== "function") {
	throw new Error("Optional React feature hooks did not initialize")
}

type Input = { readonly name?: string }
const schema: StandardSchema<Input> = {
	"~standard": {
		version: 1,
		vendor: "form-please-smoke",
		validate(value) {
			return { value: value as Input }
		},
	},
}
const definition = kit.defineForm(schema, {
	ui: [{ kind: "field", path: "name", control: "text", label: "Name" }],
})

export function ClientForm() {
	const form = kit.useForm(definition, { defaultValues: { name: "Ada" } })
	return (
		<kit.AutoForm form={form}>
			<kit.Submit>Save</kit.Submit>
			<FormPleaseDevtools form={form} name="Profile" />
		</kit.AutoForm>
	)
}
