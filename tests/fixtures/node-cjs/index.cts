import {
	createFormKit,
	type FormDefinition,
	fromResource,
	type StandardSchema,
} from "form-please"
import type { DefaultSlotsI18n } from "form-please/default-slots"
import { createDefaultSlots } from "form-please/default-slots"
import type {
	NativeSelectOption,
	NativeSelectProps,
} from "form-please/native-controls"
import { createNativeControls } from "form-please/native-controls"
import { nativeFormKit } from "form-please/preset-native"

type Input = {
	readonly name?: string
	readonly organization: {
		readonly status: "pending" | "success"
		readonly value?: string
	}
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
const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const definition: FormDefinition<typeof schema> = kit.defineForm(
	schema,
	(ui) => [ui.field("name", { control: "text" })],
)
const selectProps = {
	emptyOption: { label: "Choose" },
} satisfies NativeSelectProps
const selectOptions = [
	{ label: "Draft", value: "draft" },
] satisfies readonly NativeSelectOption[]
const i18n = { arrayAdd: "Add" } satisfies Partial<DefaultSlotsI18n>
const label = fromResource(
	(values: Readonly<Input>) =>
		values.organization.status === "success"
			? ({ status: "success", value: values.organization.value ?? "" } as const)
			: ({ status: "pending" } as const),
	{
		pending: () => "Loading",
		success: ({ value }) => value,
		error: ({ error }) => String(error),
	},
)

void definition
void selectProps
void selectOptions
void i18n
void label
void nativeFormKit
