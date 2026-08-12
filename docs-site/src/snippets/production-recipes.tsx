// biome-ignore-all lint/correctness/noUnusedImports: Named regions are consumed independently by the documentation.
// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import {
	type ControlProps,
	createFormKit,
	defineControl,
	type FormInput,
	type FormOutput,
	fromResource,
	matchResource,
	type ResourceState,
	type UiResolver,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { nativeFormKit } from "form-please/preset-native"
import { useEffect, useMemo, useState } from "react"
import { useFormState, useWatch } from "react-hook-form"
import { z } from "zod"

const profileSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	email: z.email(),
	department: z.string().optional(),
})

type Profile = z.input<typeof profileSchema>

const profileDefinition = nativeFormKit.defineForm(profileSchema, {
	ui: [
		{ kind: "field", path: "name", control: "text", label: "Name" },
		{
			kind: "field",
			path: "email",
			control: "text",
			label: "Email",
			props: { type: "email" },
		},
		{
			kind: "field",
			path: "department",
			control: "text",
			label: "Department",
		},
	],
})

const emptyProfile = {
	id: "profile-1",
	name: "",
	email: "",
	department: undefined,
} satisfies Profile

// [!region composition]
function ProfileForm() {
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: emptyProfile,
	})
	const email = useWatch({ control: form.api.control, name: "email" })
	const state = useFormState({ control: form.api.control })
	let dirtyState = <output>No changes</output>
	if (state.isDirty) dirtyState = <output>Unsaved changes</output>

	return (
		<nativeFormKit.Form form={form}>
			<nativeFormKit.Fields />
			<output>Current email: {email}</output>
			<button
				type="button"
				onClick={() => form.api.setValue("department", "Research")}
			>
				Use Research department
			</button>
			{dirtyState}
			<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
		</nativeFormKit.Form>
	)
}
// [!endregion composition]

// [!region edit-baseline]
function ProfileScreen({ profile }: { readonly profile: Profile | undefined }) {
	if (profile === undefined) return <p>Loading…</p>
	return <ProfileEditor key={profile.id} profile={profile} />
}

function ProfileEditor({ profile }: { readonly profile: Profile }) {
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: profile,
	})
	return (
		<nativeFormKit.AutoForm form={form}>
			<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
// [!endregion edit-baseline]

async function updateProfile(profile: Profile): Promise<Profile> {
	return profile
}

function getRequestErrorMessage(error: unknown): string {
	if (error instanceof Error) return error.message
	return "The profile could not be saved"
}

// [!region async-submit]
function SavingProfile({ profile }: { readonly profile: Profile }) {
	const [requestError, setRequestError] = useState<string>()
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: profile,
		onSubmit: async ({ value, form }) => {
			setRequestError(undefined)
			try {
				const saved = await updateProfile(value)
				form.api.reset(saved)
			} catch (error) {
				setRequestError(getRequestErrorMessage(error))
			}
		},
	})
	const state = useFormState({ control: form.api.control })
	let submitState = <output aria-live="polite">Ready</output>
	if (state.isSubmitting) {
		submitState = <output aria-live="polite">Saving…</output>
	}

	return (
		<nativeFormKit.AutoForm form={form}>
			{requestError !== undefined && <p role="alert">{requestError}</p>}
			{submitState}
			<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
// [!endregion async-submit]

// [!region server-response]
const serverProfileResultSchema = z.discriminatedUnion("ok", [
	z.object({
		ok: z.literal(true),
		input: profileSchema,
	}),
	z.object({
		ok: z.literal(false),
		formError: z.string().optional(),
		fieldErrors: z.array(
			z.object({
				path: z.enum(["name", "email", "department"]),
				message: z.string(),
			}),
		),
	}),
])

type ServerProfileResult = z.output<typeof serverProfileResultSchema>

async function saveProfileWithValidation(
	profile: Profile,
): Promise<ServerProfileResult> {
	const response = await fetch(`/api/profiles/${profile.id}`, {
		method: "PUT",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(profile),
	})
	const body: unknown = await response.json()
	return serverProfileResultSchema.parse(body)
}
// [!endregion server-response]

// [!region server-field-errors]
function ProfileWithServerValidation({
	profile,
}: {
	readonly profile: Profile
}) {
	const [requestError, setRequestError] = useState<string>()
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: profile,
		onSubmit: async ({ value, form }) => {
			setRequestError(undefined)
			form.api.clearErrors(["name", "email", "department"])

			try {
				const result = await saveProfileWithValidation(value)
				if (result.ok) {
					form.api.reset(result.input)
					return
				}

				setRequestError(result.formError)
				for (const [index, issue] of result.fieldErrors.entries()) {
					form.api.setError(
						issue.path,
						{ type: "server", message: issue.message },
						{ shouldFocus: index === 0 },
					)
				}
			} catch {
				setRequestError("The profile could not be saved")
			}
		},
	})

	return (
		<nativeFormKit.AutoForm form={form}>
			{requestError !== undefined && <p role="alert">{requestError}</p>}
			<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
// [!endregion server-field-errors]

// [!region reset-baseline]
function ResettableProfile({ profile }: { readonly profile: Profile }) {
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: profile,
		onSubmit: async ({ value, form }) => {
			const saved = await updateProfile(value)
			form.api.reset(saved)
		},
	})
	const state = useFormState({ control: form.api.control })

	return (
		<nativeFormKit.AutoForm form={form}>
			<button disabled={!state.isDirty} type="reset">
				Discard changes
			</button>
			<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
// [!endregion reset-baseline]

const recipeProfile = {
	id: "profile-1",
	name: "Ada Lovelace",
	email: "ada@example.com",
	department: "Research",
} satisfies Profile

async function saveProfileSnapshot(_profile: Profile): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 700))
}

function useClientReady(): boolean {
	const [isReady, setIsReady] = useState(false)
	useEffect(() => setIsReady(true), [])
	return isReady
}

// [!region saved-baseline]
export function SavedBaselineRecipe() {
	const [savedName, setSavedName] = useState<string>()
	const isClientReady = useClientReady()
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: recipeProfile,
		onSubmit: async ({ input, value, form }) => {
			await saveProfileSnapshot(value)
			form.api.resetDefaultValues(input)
			setSavedName(value.name)
		},
	})
	const state = useFormState({ control: form.api.control })
	let status = "No unsaved changes"
	if (state.isDirty) status = "Unsaved changes"
	if (state.isSubmitting) status = "Saving. You can continue to edit."

	return (
		<section
			aria-label="Saved baseline recipe preview"
			className="form-please-complex"
			data-demo-client-ready={isClientReady}
		>
			<p className="form-please-complex__kicker">Live preview</p>
			<p className="form-please-complex__summary">
				Submit the form. Change the name before the save operation finishes.
			</p>
			<nativeFormKit.AutoForm form={form}>
				<div className="form-please-complex__actions">
					<nativeFormKit.Submit className="form-please-complex__primary">
						Save current values
					</nativeFormKit.Submit>
					<output aria-live="polite">{status}</output>
				</div>
			</nativeFormKit.AutoForm>
			{savedName !== undefined && (
				<output aria-live="polite">Saved baseline: {savedName}</output>
			)}
		</section>
	)
}
// [!endregion saved-baseline]

// [!region atomic-values]
export function AtomicValuesRecipe() {
	const isClientReady = useClientReady()
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: recipeProfile,
	})
	const [templateApplied, setTemplateApplied] = useState(false)
	let status = "No template applied"
	if (templateApplied) status = "Profile template applied."

	return (
		<section
			aria-label="Atomic values recipe preview"
			className="form-please-complex"
			data-demo-client-ready={isClientReady}
		>
			<p className="form-please-complex__kicker">Live preview</p>
			<p className="form-please-complex__summary">
				Apply one template to multiple fields.
			</p>
			<nativeFormKit.AutoForm form={form}>
				<div className="form-please-complex__actions">
					<button
						type="button"
						onClick={() => {
							form.api.setValues(
								{
									name: "Grace Hopper",
									email: "grace@example.com",
									department: "Compilers",
								},
								{ shouldDirty: true, shouldValidate: true },
							)
							setTemplateApplied(true)
						}}
					>
						Apply profile template
					</button>
					<output aria-live="polite">{status}</output>
				</div>
			</nativeFormKit.AutoForm>
		</section>
	)
}
// [!endregion atomic-values]

// [!region draft-subscription]
export function DraftSubscriptionRecipe() {
	const [savedDraft, setSavedDraft] = useState<Profile>()
	const isClientReady = useClientReady()
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: recipeProfile,
	})
	const api = form.api

	useEffect(() => {
		let saveTimer: ReturnType<typeof setTimeout> | undefined
		const unsubscribe = api.subscribe({
			formState: { values: true },
			callback: ({ values }) => {
				if (saveTimer !== undefined) clearTimeout(saveTimer)
				saveTimer = setTimeout(() => {
					// Replace this state update with your draft storage call.
					setSavedDraft(values)
				}, 400)
			},
		})

		return () => {
			if (saveTimer !== undefined) clearTimeout(saveTimer)
			unsubscribe()
		}
	}, [api])
	let status = "Edit a field to save a draft."
	if (savedDraft !== undefined) {
		let draftName = savedDraft.name
		if (draftName === "") draftName = "the unnamed profile"
		status = `Draft saved for ${draftName}.`
	}

	return (
		<section
			aria-label="Draft subscription recipe preview"
			className="form-please-complex"
			data-demo-client-ready={isClientReady}
		>
			<p className="form-please-complex__kicker">Live preview</p>
			<p className="form-please-complex__summary">
				Edit a field. The preview saves the draft after 400 ms.
			</p>
			<nativeFormKit.AutoForm form={form} />
			<output aria-live="polite">{status}</output>
		</section>
	)
}
// [!endregion draft-subscription]

type WizardStep = "identity" | "details"
type WizardContext = { readonly step: WizardStep }

const wizardSchema = z.object({
	name: z.string().min(1, "Enter a name"),
	email: z.email("Enter a valid email"),
	department: z.string().optional(),
})

const wizardKit = nativeFormKit.forContext<WizardContext>()
const wizardDefinition = wizardKit.defineForm(wizardSchema, {
	ui: [
		{
			kind: "field",
			path: "name",
			control: "text",
			label: "Name",
			visible: (_values, { context }) => context.step === "identity",
		},
		{
			kind: "field",
			path: "email",
			control: "text",
			label: "Email",
			props: { type: "email" },
			visible: (_values, { context }) => context.step === "identity",
		},
		{
			kind: "field",
			path: "department",
			control: "text",
			label: "Department",
			visible: (_values, { context }) => context.step === "details",
		},
	],
})

const identityFields = ["name", "email"] as const

// [!region step-validation]
export function StepValidationRecipe() {
	const [step, setStep] = useState<WizardStep>("identity")
	const [saved, setSaved] = useState(false)
	const isClientReady = useClientReady()
	const context = useMemo(() => ({ step }), [step])
	const form = wizardKit.useForm(wizardDefinition, {
		context,
		defaultValues: { name: "", email: "", department: "" },
		onSubmit: () => setSaved(true),
	})

	async function showDetails() {
		for (const path of identityFields) {
			form.api.setValue(path, form.api.getValues(path), { shouldTouch: true })
		}
		const valid = await form.api.trigger(identityFields)
		if (!valid) {
			const firstInvalid = identityFields.find(
				(path) => form.api.getFieldState(path).invalid,
			)
			if (firstInvalid !== undefined) form.api.setFocus(firstInvalid)
			return
		}
		setStep("details")
	}
	let stepLabel = "1 of 2: identity"
	let actions = (
		<button type="button" onClick={() => void showDetails()}>
			Continue
		</button>
	)
	if (step === "details") {
		stepLabel = "2 of 2: details"
		actions = (
			<>
				<button type="button" onClick={() => setStep("identity")}>
					Back
				</button>
				<wizardKit.Submit className="form-please-complex__primary">
					Save profile
				</wizardKit.Submit>
			</>
		)
	}
	let status = "Complete the current step."
	if (saved) status = "Profile saved."

	return (
		<section
			aria-label="Step validation recipe preview"
			className="form-please-complex"
			data-demo-client-ready={isClientReady}
		>
			<p className="form-please-complex__kicker">Live preview</p>
			<p className="form-please-complex__summary">Step {stepLabel}</p>
			<wizardKit.AutoForm form={form}>
				<div className="form-please-complex__actions">{actions}</div>
			</wizardKit.AutoForm>
			<output aria-live="polite">{status}</output>
		</section>
	)
}
// [!endregion step-validation]

const normalizedProfileSchema = z.object({
	id: z.string(),
	name: z.string().trim().min(1),
	email: z.email().transform((email) => email.toLowerCase()),
})

type NormalizedProfileInput = FormInput<typeof normalizedProfileSchema>
type NormalizedProfileOutput = FormOutput<typeof normalizedProfileSchema>

const normalizedProfileDefinition = nativeFormKit.defineForm(
	normalizedProfileSchema,
	{
		ui: [
			{ kind: "field", path: "name", control: "text", label: "Name" },
			{
				kind: "field",
				path: "email",
				control: "text",
				label: "Email",
				props: { type: "email" },
			},
		],
	},
)

async function saveNormalizedProfile(
	profile: NormalizedProfileOutput,
): Promise<NormalizedProfileInput> {
	return profile
}

// [!region parsed-output]
function NormalizedProfileEditor({
	profile,
}: {
	readonly profile: NormalizedProfileInput
}) {
	const form = nativeFormKit.useForm(normalizedProfileDefinition, {
		defaultValues: profile,
		onSubmit: async ({ value, form }) => {
			// value has trimmed names and lower-case email addresses.
			const savedInput = await saveNormalizedProfile(value)
			// reset requires schema input, not transformed schema output.
			form.api.reset(savedInput)
		},
	})

	return (
		<nativeFormKit.AutoForm form={form}>
			<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
// [!endregion parsed-output]

// [!region json-request]
async function postProfile(value: FormOutput<typeof profileSchema>) {
	const response = await fetch("/api/profiles", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(value),
	})

	if (!response.ok) {
		throw new Error("The profile could not be saved")
	}
}
// [!endregion json-request]

// [!region multipart-body]
const uploadSchema = z.object({
	title: z.string().trim().min(1),
	attachment: z.file().optional(),
})

function createUploadBody(value: FormOutput<typeof uploadSchema>): FormData {
	const body = new FormData()
	body.set("title", value.title)
	if (value.attachment !== undefined) {
		body.set("attachment", value.attachment)
	}
	return body
}
// [!endregion multipart-body]

type DepartmentOption = {
	readonly value: string
	readonly label: string
}
type DepartmentResource = ResourceState<readonly DepartmentOption[], Error>
type DirectoryContext = {
	readonly departments: DepartmentResource
}
type DirectoryInput = z.input<typeof profileSchema>

const selectDepartments: UiResolver<
	DepartmentResource,
	DirectoryInput,
	DirectoryContext
> = (_values, { context }) => context.departments

const departmentDescription = fromResource(selectDepartments, {
	pending: () => "Loading departments",
	success: ({ value }) => `${value.length} departments available`,
	error: ({ error }) => error.message,
})

const departmentProps = fromResource(selectDepartments, {
	pending: () => ({ emptyOption: { label: "Loading departments" } }),
	success: () => ({ emptyOption: { label: "Select a department" } }),
	error: () => ({ emptyOption: { label: "Departments unavailable" } }),
})

const departmentOptions = ({
	context,
}: {
	readonly context: DirectoryContext
}) =>
	matchResource(context.departments, {
		pending: () => [],
		success: ({ value }) => value,
		error: () => [],
	})

const directoryKit = nativeFormKit.forContext<DirectoryContext>()

// [!region context-resource]
const directoryDefinition = directoryKit.defineForm(profileSchema, {
	ui: [
		{ kind: "field", path: "name", control: "text", label: "Name" },
		{
			kind: "field",
			path: "department",
			control: "select",
			label: "Department",
			description: departmentDescription,
			props: departmentProps,
			options: departmentOptions,
			disabled: (_values, { context }) =>
				context.departments.status !== "success",
		},
	],
})

function DirectoryProfile({ context }: { readonly context: DirectoryContext }) {
	const form = directoryKit.useForm(directoryDefinition, {
		defaultValues: emptyProfile,
		context,
	})
	return <directoryKit.AutoForm form={form} />
}
// [!endregion context-resource]

type ProfileMode = "edit" | "read-only" | "disabled"

// [!region form-modes]
function ProfileByMode({
	profile,
	mode,
}: {
	readonly profile: Profile
	readonly mode: ProfileMode
}) {
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: profile,
		disabled: mode === "disabled",
		readOnly: mode === "read-only",
	})

	return (
		<nativeFormKit.AutoForm form={form}>
			{mode === "edit" && (
				<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
			)}
		</nativeFormKit.AutoForm>
	)
}
// [!endregion form-modes]

type CurrencyProps = {
	readonly currency: string
}

function CurrencyControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: currencyProps,
	disabled,
	readOnly,
	required,
}: ControlProps<number | undefined, CurrencyProps>) {
	return (
		<div>
			<span aria-hidden="true">{currencyProps.currency}</span>
			<input
				aria-describedby={input["aria-describedby"]}
				aria-invalid={meta.invalid || undefined}
				disabled={disabled}
				id={input.id}
				name={input.name}
				onBlur={blur}
				onChange={(event) => {
					if (event.currentTarget.value === "") {
						setValue(undefined)
						return
					}
					setValue(event.currentTarget.valueAsNumber)
				}}
				readOnly={readOnly}
				ref={input.ref}
				required={required}
				type="number"
				value={value ?? ""}
			/>
		</div>
	)
}

// [!region accessible-control]
const currency = defineControl<number | undefined, CurrencyProps>({
	component: CurrencyControl,
})

const billingKit = createFormKit({
	controls: { ...createNativeControls(), currency },
	slots: createDefaultSlots(),
})
// [!endregion accessible-control]
