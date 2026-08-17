// biome-ignore-all lint/correctness/noUnusedImports: Named regions are consumed independently by the documentation.
// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import {
	type ControlProps,
	createFormKit,
	type DeepReadonly,
	type DefineFormOptions,
	defineControl,
	type FormInput,
	type FormMiddleware,
	type FormOutput,
	fromResource,
	matchResource,
	type RenderNode,
	type RenderNodeProps,
	type ResourceState,
	type UiResolver,
	useSnapshot,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { createMuiFormKit } from "form-please/preset-mui"
import { nativeFormKit } from "form-please/preset-native"
import { useId } from "react"
import { useController, useFormState, useWatch } from "react-hook-form"
import { z } from "zod"

// [!region use-snapshot]
const storeSnapshot = { status: "ready" as const }
const store = {
	getSnapshot: () => storeSnapshot,
	subscribe: (_listener: () => void) => () => undefined,
}

function ExternalStoreStatus() {
	const snapshot = useSnapshot(store)
	return <output>{snapshot.status}</output>
}
// [!endregion use-snapshot]

// [!region define-control]
type UppercaseProps = {
	readonly placeholder?: string
}

function UppercaseControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: inputProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, UppercaseProps>) {
	return (
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) =>
				setValue(event.currentTarget.value.toUpperCase() || undefined)
			}
			placeholder={inputProps.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			value={value ?? ""}
		/>
	)
}

const uppercase = defineControl<string | undefined, UppercaseProps>({
	component: UppercaseControl,
})
// [!endregion define-control]

// [!region create-form-kit]
const kit = createFormKit({
	controls: {
		...createNativeControls(),
		uppercase,
	},
	slots: createDefaultSlots(),
	grid: [1, 2, 4],
})
// [!endregion create-form-kit]

// [!region form-fragment]
type AddressContext = {
	readonly locale: string
}

const addressSchema = z.object({
	city: z.string(),
	street: z.string(),
})

const addressFragment = nativeFormKit
	.forContext<AddressContext>()
	.defineFragment(addressSchema, (ui) => [
		ui.field("street", {
			control: "text",
			label: (_address, { context }) => `${context.locale}: Street`,
		}),
		ui.field("city", { control: "text", label: "City" }),
	])

const checkoutSchema = z.object({
	billingAddress: addressFragment.schema,
	recipients: z.array(z.object({ address: addressFragment.schema })),
	shippingAddress: addressFragment.schema,
})

const checkoutKit = nativeFormKit.forContext<AddressContext>()
const checkoutDefinition = checkoutKit.defineForm(checkoutSchema, (ui) => [
	addressFragment.fields({ at: "shippingAddress" }),
	addressFragment.fields({ at: "billingAddress" }),
	ui.array("recipients", {
		itemDefault: { address: { city: "", street: "" } },
		children: () => [addressFragment.fields({ at: "address" })],
	}),
])
// [!endregion form-fragment]

// [!region native-factories]
const nativeControls = createNativeControls()
const localizedDefaultSlots = createDefaultSlots({
	i18n: {
		arrayAdd: "Add another item",
		arrayRemove: ({ position }) => `Remove item ${position}`,
	},
})
const localizedNativeKit = createFormKit({
	controls: nativeControls,
	slots: localizedDefaultSlots,
})
// [!endregion native-factories]

// [!region default-slot-i18n]
const fullyLocalizedSlots = createDefaultSlots({
	i18n: {
		arrayAdd: ({ label }) => {
			if (typeof label === "string") return `Add ${label}`
			return "Add item"
		},
		arrayRemove: ({ position }) => `Remove item ${position}`,
		arrayMoveUp: ({ position }) => `Move item ${position} up`,
		arrayMoveDown: ({ position }) => `Move item ${position} down`,
	},
})
// [!endregion default-slot-i18n]

// [!region native-preset]
const readyNativeKit = nativeFormKit
// [!endregion native-preset]

// [!region native-control-options]
const preferencesSchema = z.object({
	email: z.string().optional(),
	plan: z.enum(["solo", "team"]).optional(),
	seats: z.number().optional(),
	newsletter: z.boolean(),
})

const preferencesDefinition = nativeFormKit.defineForm(preferencesSchema, {
	ui: [
		{
			kind: "field",
			path: "email",
			control: "text",
			label: "Email",
			props: { type: "email", autoComplete: "email" },
		},
		{
			kind: "field",
			path: "plan",
			control: "select",
			label: "Plan",
			options: [
				{ value: "solo", label: "Solo" },
				{ value: "team", label: "Team" },
			],
			props: {
				emptyOption: { label: "Select a plan" },
			},
		},
		{
			kind: "field",
			path: "seats",
			control: "number",
			label: "Seats",
			props: { min: 1, max: 100, step: 1 },
		},
		{
			kind: "field",
			path: "newsletter",
			control: "checkbox",
			label: "Send product news",
		},
	],
})
// [!endregion native-control-options]

// [!region mui-preset]
const muiKit = createMuiFormKit({
	i18n: {
		addItem: "Add item",
		removeItem: (position) => `Remove item ${position}`,
		moveItemUp: (position) => `Move item ${position} up`,
		moveItemDown: (position) => `Move item ${position} down`,
		chooseFile: "Choose file",
	},
})
// [!endregion mui-preset]

// [!region mui-fields]
const muiSettingsSchema = z.object({
	role: z.string().optional(),
	topics: z.array(z.string()),
	notifications: z.boolean(),
	priority: z.number(),
})

const muiSettingsDefinition = muiKit.defineForm(muiSettingsSchema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			label: "Role",
			options: [
				{ value: "developer", label: "Developer" },
				{ value: "designer", label: "Designer" },
			],
			props: {
				displayEmpty: true,
			},
		},
		{
			kind: "field",
			path: "topics",
			control: "autocomplete-multiple",
			label: "Topics",
			options: ["React", "TypeScript", "Accessibility"],
		},
		{
			kind: "field",
			path: "notifications",
			control: "switch",
			label: "Notifications",
		},
		{
			kind: "field",
			path: "priority",
			control: "slider",
			label: "Priority",
			props: { min: 0, max: 10, step: 1 },
		},
	],
})
// [!endregion mui-fields]

const profileSchema = z.object({
	name: z.string().trim().min(1),
	yearsOfExperience: z
		.string()
		.regex(/^\d+$/)
		.transform((value) => Number(value)),
	plan: z.enum(["solo", "team"]),
	teamName: z.string().optional(),
	country: z.string().optional(),
	billingReference: z.string().optional(),
	speakers: z.array(z.object({ name: z.string() })),
})

type CountryResource = ResourceState<readonly string[], Error>
type ProfileContext = {
	readonly countries: CountryResource
	readonly canEditPlan: boolean
}
type ProfileInput = FormInput<typeof profileSchema>

// [!region render-node]
function TeamHint({ disabled, readOnly }: RenderNodeProps) {
	return (
		<p
			data-disabled={disabled || undefined}
			data-readonly={readOnly || undefined}
		>
			Team accounts can invite additional collaborators.
		</p>
	)
}

const teamHint = {
	kind: "render",
	id: "team-hint",
	component: TeamHint,
	visible: (values) => values.plan === "team",
} satisfies RenderNode<ProfileInput, ProfileContext>
// [!endregion render-node]

// [!region resource-resolver]
const selectCountries: UiResolver<
	CountryResource,
	ProfileInput,
	ProfileContext
> = (_values, { context }) => context.countries

const countryDescription = fromResource(selectCountries, {
	pending: () => "Loading countries",
	success: ({ value }, values) =>
		`${value.length} countries available for the ${values.plan} plan`,
	error: ({ error }) => error.message,
})
// [!endregion resource-resolver]

// [!region value-middleware]
function recordManagedValues(_values: DeepReadonly<ProfileInput>) {}

const keepPlanValuesConsistent: FormMiddleware<ProfileInput, ProfileContext> =
	(api) => (next) => (transaction) => {
		let patches = transaction.patches
		if (
			transaction.nextValues.plan === "solo" &&
			transaction.nextValues.teamName !== undefined
		) {
			patches = [
				...transaction.patches,
				{ op: "replace", path: ["teamName"], value: undefined },
			]
		}
		const result = next(patches)
		// `next` commits synchronously, so this reads the complete final value.
		recordManagedValues(api.getValues())
		return result
	}
// [!endregion value-middleware]

// [!region update-hooks]
const profileUpdatePolicy = {
	beforeUpdate(draft, transaction) {
		if (
			!transaction.context.canEditPlan &&
			transaction.source.type === "control" &&
			transaction.source.path === "plan"
		) {
			return false
		}
		if (draft.plan === "solo") draft.teamName = undefined
	},
	afterUpdate(transaction) {
		recordManagedValues(transaction.nextValues)
	},
	middleware: [keepPlanValuesConsistent],
} satisfies DefineFormOptions<typeof profileSchema, ProfileContext>
// [!endregion update-hooks]

// [!region context-kit]
const profileKit = kit.forContext<ProfileContext>()
// [!endregion context-kit]

// [!region define-form]
const profileDefinition = profileKit.defineForm(
	profileSchema,
	(ui) => [
		ui.section("identity", {
			title: "Profile",
			columns: 2,
			children: [
				ui.field("name", {
					control: "uppercase",
					label: "Display name",
					props: { placeholder: "ADA" },
					required: true,
				}),
				ui.field("yearsOfExperience", {
					control: "text",
					label: "Years of experience",
				}),
				ui.field("plan", {
					control: "select",
					label: "Plan",
					readOnly: (_values, { context }) => !context.canEditPlan,
					options: [
						{ value: "solo", label: "Solo" },
						{ value: "team", label: "Team" },
					],
				}),
				ui.field("teamName", {
					control: "text",
					label: "Team name",
					visible: (values) => values.plan === "team",
				}),
				teamHint,
				ui.field("country", {
					control: "text",
					label: "Country",
					description: countryDescription,
				}),
			],
		}),
		ui.array("speakers", {
			label: "Speakers",
			itemDefault: { name: "" },
			children: (speaker) => [
				speaker.field("name", { control: "text", label: "Name" }),
			],
		}),
	],
	profileUpdatePolicy,
)
// [!endregion define-form]

const defaultValues = {
	name: "",
	yearsOfExperience: "0",
	plan: "solo",
	teamName: undefined,
	country: undefined,
	billingReference: undefined,
	speakers: [],
} satisfies ProfileInput

async function saveProfile(_value: FormOutput<typeof profileSchema>) {}

// [!region use-form]
function ProfileEditor({ context }: { readonly context: ProfileContext }) {
	const form = profileKit.useForm(profileDefinition, {
		defaultValues,
		context,
		onSubmit: async ({ value, input, form }) => {
			// `input.yearsOfExperience` is a string from React Hook Form.
			// `value.yearsOfExperience` is the transformed number.
			await saveProfile(value)
			form.api.reset(input)
		},
	})

	return (
		<profileKit.AutoForm form={form}>
			<button
				onClick={() =>
					form.update((draft) => {
						draft.plan = "solo"
						draft.teamName = undefined
					})
				}
				type="button"
			>
				Use individual plan
			</button>
			<profileKit.Submit>Save profile</profileKit.Submit>
		</profileKit.AutoForm>
	)
}
// [!endregion use-form]

// [!region form-wide-state]
function ProfileReview({ context }: { readonly context: ProfileContext }) {
	const form = profileKit.useForm(profileDefinition, {
		defaultValues,
		context,
		readOnly: true,
	})

	return (
		<profileKit.Form form={form} aria-label="Profile review">
			<profileKit.Fields />
			<button type="reset">Restore initial values</button>
			<profileKit.Submit disabled>Save profile</profileKit.Submit>
		</profileKit.Form>
	)
}
// [!endregion form-wide-state]

// [!region manual-composition]
function BillingReferenceField() {
	const id = useId()
	const { field, fieldState } = useController<ProfileInput, "billingReference">(
		{
			name: "billingReference",
		},
	)
	let errorId: string | undefined
	if (fieldState.error !== undefined) errorId = `${id}-error`

	return (
		<div>
			<label htmlFor={id}>Billing reference</label>
			<input
				{...field}
				aria-describedby={errorId}
				aria-invalid={fieldState.invalid || undefined}
				id={id}
				value={field.value ?? ""}
			/>
			{fieldState.error !== undefined && (
				<p id={errorId} role="alert">
					{fieldState.error.message}
				</p>
			)}
		</div>
	)
}

function ProfileWithCustomSummary({
	context,
}: {
	readonly context: ProfileContext
}) {
	const form = profileKit.useForm(profileDefinition, {
		defaultValues,
		context,
	})
	const plan = useWatch({ control: form.api.control, name: "plan" })
	const speakers = useWatch({ control: form.api.control, name: "speakers" })
	const state = useFormState({ control: form.api.control })
	let dirtyState = <output>Saved</output>
	if (state.isDirty) dirtyState = <output>Unsaved changes</output>

	return (
		<profileKit.Form form={form}>
			<profileKit.Fields />
			<BillingReferenceField />
			<output>Selected plan: {plan}</output>
			<output>{speakers.length} speakers</output>
			{dirtyState}
			<profileKit.Submit>Save profile</profileKit.Submit>
		</profileKit.Form>
	)
}
// [!endregion manual-composition]

// [!region resources]
function describeCountries(countries: CountryResource) {
	return matchResource(countries, {
		pending: () => "Loading",
		success: ({ value }) => `${value.length} loaded`,
		error: ({ error }) => error.message,
	})
}
// [!endregion resources]

// [!region resource-states]
const pendingCountries: CountryResource = { status: "pending" }
const loadedCountries: CountryResource = {
	status: "success",
	value: ["Canada", "Japan"],
}
const failedCountries: CountryResource = {
	status: "error",
	error: new Error("Country list is unavailable"),
}
// [!endregion resource-states]
