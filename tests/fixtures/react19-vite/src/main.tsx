import "form-please/layout.css"

import type { StandardSchema } from "form-please"
import { useHistory } from "form-please/history"
import { usePersistence } from "form-please/persistence"
import { createMuiFormKit } from "form-please/preset-mui"
import { nativeFormKit as kit } from "form-please/preset-native"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

type AddressInput = { readonly street?: string }
const addressSchema: StandardSchema<AddressInput> = {
	"~standard": {
		version: 1,
		vendor: "form-please-smoke",
		validate(value) {
			return { value: value as AddressInput }
		},
	},
}
const addressFragment = kit.defineFragment(addressSchema, {
	ui: [{ kind: "field", path: "street", control: "text", label: "Street" }],
})

type Input = {
	readonly address: AddressInput
	readonly name?: string
}
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
	ui: [
		{ kind: "field", path: "name", control: "text", label: "Name" },
		addressFragment.fields({ at: "address" }),
	],
})
const muiKit = createMuiFormKit()
if (
	!muiKit.controls.slider ||
	muiKit.grid.at(-1) !== 12 ||
	typeof useHistory !== "function" ||
	typeof usePersistence !== "function"
) {
	throw new Error("React package entries did not initialize")
}

function App() {
	const form = kit.useForm(definition, {
		defaultValues: {
			address: { street: "Analytical Engine Way" },
			name: "Ada",
		},
	})
	return (
		<kit.AutoForm form={form}>
			<kit.Submit>Save</kit.Submit>
		</kit.AutoForm>
	)
}

createRoot(document.getElementById("root") ?? document.body).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
