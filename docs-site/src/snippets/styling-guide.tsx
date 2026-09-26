"use client"

import {
	createFormKit,
	type FieldSlotProps,
	type FormKitSlots,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import type { ReactNode } from "react"
import { z } from "zod"

const controls = createNativeControls()
const defaultSlots = createDefaultSlots()
const kit = createFormKit({ controls, slots: defaultSlots })

const accountSchema = z.object({
	accountType: z.enum(["personal", "company"]),
	email: z.email(),
})

// [!region node-classes]
const accountDefinition = kit.defineForm(accountSchema, (ui) => [
	ui.section("account", {
		title: "Account",
		columns: 2,
		className: ({ accountType }) => {
			if (accountType === "company") return "company-account"
			return "personal-account"
		},
		children: [
			ui.field("accountType", {
				control: "select",
				label: "Account type",
				options: [
					{ label: "Personal", value: "personal" },
					{ label: "Company", value: "company" },
				],
			}),
			ui.field("email", {
				control: "text",
				label: "Email",
				className: "account-email",
				span: "full",
			}),
		],
	}),
])
// [!endregion node-classes]

// [!region form-root]
export function AccountForm() {
	const form = kit.useForm(accountDefinition, {
		defaultValues: {
			accountType: "personal",
			email: "",
		},
	})

	return (
		<kit.AutoForm
			className="account-form"
			form={form}
			style={{
				"--fp-array-item-gap": "1.5rem",
				"--fp-column-gap": "1.25rem",
				"--fp-row-gap": "1rem",
				"--fp-stack-gap": "1rem",
			}}
		>
			<kit.Submit>Save account</kit.Submit>
		</kit.AutoForm>
	)
}
// [!endregion form-root]

type StylingContext = {
	readonly density: "comfortable" | "compact"
}

const contextualKit = kit.forContext<StylingContext>()

// [!region context-class]
const compactDefinition = contextualKit.defineForm(accountSchema, (ui) => [
	ui.field("email", {
		control: "text",
		label: "Email",
		className: (_values, { context }) => {
			if (context.density === "compact") return "field-compact"
			return "field-comfortable"
		},
	}),
])
// [!endregion context-class]

void compactDefinition

// [!region custom-field-slot]
function AppFieldSlot({
	rootProps,
	label,
	labelProps,
	description,
	descriptionProps,
	control,
	errors,
}: FieldSlotProps) {
	const className = ["app-field", rootProps.className].filter(Boolean).join(" ")
	let renderedLabel: ReactNode
	if (label !== undefined) {
		renderedLabel = (
			<label {...labelProps} htmlFor={labelProps.htmlFor}>
				{label}
			</label>
		)
	}
	let renderedDescription: ReactNode
	if (description !== undefined) {
		renderedDescription = <p {...descriptionProps}>{description}</p>
	}

	return (
		<div {...rootProps} className={className}>
			{renderedLabel}
			{renderedDescription}
			{control}
			{errors}
		</div>
	)
}

const appSlots = {
	...defaultSlots,
	Field: AppFieldSlot,
} satisfies FormKitSlots

export const appKit = createFormKit({ controls, slots: appSlots })
// [!endregion custom-field-slot]
