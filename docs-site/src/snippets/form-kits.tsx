// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import {
	type ArraySlotProps,
	createFormKit,
	type FieldSlotProps,
	type FormKitSlots,
	type SubmitSlotProps,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import type { ReactNode } from "react"
import { z } from "zod"

import { uppercase } from "./form-kits-control.js"

// [!region register-control]
const controls = {
	...createNativeControls(),
	uppercase,
}

export const projectKit = createFormKit({
	controls,
	slots: createDefaultSlots(),
})
// [!endregion register-control]

const profileSchema = z.object({
	displayName: z.string(),
	age: z.number().optional(),
	role: z.enum(["admin", "member"]).optional(),
	active: z.boolean(),
	members: z.array(z.object({ name: z.string() })),
})

// [!region control-options]
const projectDefinition = projectKit.defineForm(profileSchema, {
	ui: [
		{
			kind: "field",
			path: "displayName",
			control: "uppercase",
			label: "Display name",
			props: { placeholder: "ADA LOVELACE" },
		},
		{
			kind: "field",
			path: "age",
			control: "number",
			label: "Age",
			props: { min: 18, max: 120, step: 1 },
		},
		{
			kind: "field",
			path: "role",
			control: "select",
			label: "Role",
			options: [
				{ value: "admin", label: "Administrator" },
				{ value: "member", label: "Member" },
			],
			props: {
				emptyOption: { label: "Select a role" },
			},
		},
		{
			kind: "field",
			path: "active",
			control: "checkbox",
			label: "Active account",
		},
	],
})
// [!endregion control-options]

// [!region project-form]
export function ProjectProfileForm() {
	const form = projectKit.useForm(projectDefinition, {
		defaultValues: {
			displayName: "",
			age: undefined,
			role: undefined,
			active: false,
			members: [],
		},
		onSubmit({ value }) {
			console.log(value)
		},
	})

	return (
		<projectKit.AutoForm form={form}>
			<projectKit.Submit>Save profile</projectKit.Submit>
		</projectKit.AutoForm>
	)
}
// [!endregion project-form]

type CardFieldOptions = {
	readonly tone?: "default" | "emphasis"
}

// [!region field-slot]
function CardFieldSlot({
	rootProps,
	label,
	labelProps,
	description,
	descriptionProps,
	slotOptions,
	control,
	errors,
	required,
}: FieldSlotProps<CardFieldOptions>) {
	let requiredMark: ReactNode = null
	if (required) {
		requiredMark = <span aria-hidden="true"> *</span>
	}

	let labelNode: ReactNode = null
	if (label !== undefined) {
		labelNode = (
			<label {...labelProps} htmlFor={labelProps.htmlFor}>
				{label}
				{requiredMark}
			</label>
		)
	}

	let descriptionNode: ReactNode = null
	if (description !== undefined) {
		descriptionNode = <p {...descriptionProps}>{description}</p>
	}

	return (
		<div {...rootProps} data-tone={slotOptions?.tone ?? "default"}>
			{labelNode}
			{descriptionNode}
			{control}
			{errors}
		</div>
	)
}
// [!endregion field-slot]

type ListSlotOptions = {
	readonly addLabel?: string
}

// [!region array-slot]
function ListArraySlot({
	rootProps,
	label,
	labelProps,
	description,
	descriptionProps,
	slotOptions,
	errors,
	canAdd,
	add,
	children,
}: ArraySlotProps<ListSlotOptions>) {
	let labelId: string | undefined
	let labelNode: ReactNode = null
	if (label !== undefined) {
		labelId = labelProps.id
		labelNode = <h2 {...labelProps}>{label}</h2>
	}

	let descriptionId: string | undefined
	let descriptionNode: ReactNode = null
	if (description !== undefined) {
		descriptionId = descriptionProps.id
		descriptionNode = <p {...descriptionProps}>{description}</p>
	}

	return (
		<section
			{...rootProps}
			aria-describedby={descriptionId}
			aria-labelledby={labelId}
		>
			{labelNode}
			{descriptionNode}
			{errors}
			{children}
			<button disabled={!canAdd} type="button" onClick={add}>
				{slotOptions?.addLabel ?? "Add item"}
			</button>
		</section>
	)
}
// [!endregion array-slot]

// [!region submit-slot]
function SaveSubmitSlot({ buttonProps, isSubmitting }: SubmitSlotProps) {
	const { children, ...props } = buttonProps
	let content = children
	if (isSubmitting) {
		content = "Saving…"
	}

	return <button {...props}>{content}</button>
}
// [!endregion submit-slot]

// [!region slot-registry]
const defaultSlots = createDefaultSlots()

const brandedSlots = {
	...defaultSlots,
	Field: CardFieldSlot,
	Array: ListArraySlot,
	Submit: SaveSubmitSlot,
} satisfies FormKitSlots<CardFieldOptions, never, ListSlotOptions>

const brandedKit = createFormKit({
	controls,
	slots: brandedSlots,
})
// [!endregion slot-registry]

// [!region slot-options]
const brandedDefinition = brandedKit.defineForm(profileSchema, {
	ui: [
		{
			kind: "field",
			path: "displayName",
			control: "uppercase",
			label: "Display name",
			slotOptions: { tone: "emphasis" },
		},
		{
			kind: "array",
			path: "members",
			label: "Team members",
			itemDefault: { name: "" },
			slotOptions: { addLabel: "Add team member" },
			children: [
				{
					kind: "field",
					path: "name",
					control: "text",
					label: "Name",
				},
			],
		},
	],
})
// [!endregion slot-options]
