import "form-please/layout.css"

import {
	fromResource,
	type ResourceState,
	type StandardSchema,
} from "form-please"
import { FormPleaseDevtools } from "form-please/devtools"
import { useHistory } from "form-please/history"
import { usePersistence } from "form-please/persistence"
import { createMuiFormKit } from "form-please/preset-mui"
import { nativeFormKit } from "form-please/preset-native"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { useFormContext, useWatch } from "react-hook-form"

type Input = {
	readonly name?: string
	readonly country?: string
	readonly speakers: readonly { readonly name?: string }[]
}
type Output = Input & { readonly slug: string }
type Context = {
	readonly countries: ResourceState<readonly string[], Error>
}

const schema: StandardSchema<Input, Output> = {
	"~standard": {
		version: 1,
		vendor: "form-please-smoke",
		validate(value) {
			const input = value as Input
			if ((input.name ?? "").trim() === "") {
				return { issues: [{ message: "Name is required", path: ["name"] }] }
			}
			return {
				value: {
					...input,
					slug: (input.name ?? "").toLowerCase().replaceAll(" ", "-"),
				},
			}
		},
	},
}

const kit = nativeFormKit.forContext<Context>()
const countryDescription = fromResource(
	(_values: Readonly<Input>, { context }: { readonly context: Context }) =>
		context.countries,
	{
		pending: () => "Loading countries",
		success: ({ value }) => `${value.length} countries available`,
		error: ({ error }) => error.message,
	},
)
const definition = kit.defineForm(schema, {
	ui: [
		{
			kind: "section",
			id: "profile",
			title: "Profile",
			children: [
				{
					kind: "field",
					path: "name",
					control: "text",
					label: "Name",
					required: true,
				},
				{
					kind: "field",
					path: "country",
					control: "text",
					label: (values) => `Country for ${values.name ?? "guest"}`,
					description: countryDescription,
				},
			],
		},
		{
			kind: "array",
			path: "speakers",
			label: "Speakers",
			itemDefault: { name: "" },
			children: [
				{ kind: "field", path: "name", control: "text", label: "Speaker" },
			],
		},
	],
})

const muiKit = createMuiFormKit()
if (
	!muiKit.controls.autocomplete ||
	muiKit.grid.at(-1) !== 12 ||
	typeof useHistory !== "function" ||
	typeof usePersistence !== "function"
) {
	throw new Error("React package entries did not initialize")
}

function App() {
	const form = kit.useForm(definition, {
		context: {
			countries: { status: "success", value: ["DE", "FR"] },
		},
		defaultValues: {
			name: "Ada Lovelace",
			country: "GB",
			speakers: [{ name: "Ada" }],
		},
		onSubmit({ value }) {
			void value.slug
		},
	})
	return (
		<kit.Form form={form} id="profile-form">
			<kit.Fields />
			<SpeakerCount />
			<kit.Submit>Save</kit.Submit>
			<FormPleaseDevtools form={form} name="Profile" />
		</kit.Form>
	)
}

function SpeakerCount() {
	const form = useFormContext<Input>()
	const speakers = useWatch({ control: form.control, name: "speakers" })
	return <output>{speakers.length} speakers</output>
}

createRoot(document.getElementById("root") ?? document.body).render(
	<StrictMode>
		<App />
	</StrictMode>,
)
