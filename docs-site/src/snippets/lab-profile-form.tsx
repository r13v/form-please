// @jsx: react-jsx
"use client"

import { createFormKit, type FormInput, type FormOutput } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

const profileSchema = z
	.object({
		name: z.string().min(1, "Name is required"),
		accountType: z.enum(["personal", "company"]),
		companyName: z.string().optional(),
		country: z.string().min(2, "Choose a country"),
		newsletter: z.boolean(),
		avatar: z
			.custom<File | undefined>(
				(value) =>
					value === undefined ||
					(typeof File !== "undefined" && value instanceof File),
				"Choose a browser File",
			)
			.optional(),
		contacts: z
			.array(
				z.object({
					email: z.string().email("Use a valid email"),
					label: z.string().optional(),
				}),
			)
			.min(1, "Add at least one contact"),
	})
	.superRefine((value, context) => {
		if (
			value.accountType === "company" &&
			(value.companyName ?? "").trim().length === 0
		) {
			context.addIssue({
				code: "custom",
				message: "Company name is required",
				path: ["companyName"],
			})
		}
	})
	.transform((value) => ({
		...value,
		companyName: value.companyName?.trim() || undefined,
		contactCount: value.contacts.length,
	}))

export type ProfileInput = FormInput<typeof profileSchema>
export type ProfileOutput = FormOutput<typeof profileSchema>

export const defaultValues = {
	name: "Ada Lovelace",
	accountType: "personal",
	country: "GB",
	newsletter: true,
	contacts: [{ email: "ada@example.com", label: "primary" }],
} satisfies ProfileInput

const countryOptions = [
	{ value: "GB", label: "United Kingdom" },
	{ value: "US", label: "United States" },
	{ value: "NL", label: "Netherlands" },
]

export const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots({
		i18n: {
			arrayAdd: "Add contact",
			arrayMoveDown: ({ position }) => `Move contact ${position} down`,
			arrayMoveUp: ({ position }) => `Move contact ${position} up`,
			arrayRemove: ({ position }) => `Remove contact ${position}`,
		},
	}),
})

export const profileDefinition = kit.defineForm(profileSchema, {
	ui: [
		{
			kind: "section",
			id: "account",
			title: "Profile",
			description: "Edit a personal or company profile.",
			// [!region tailwind-class-name]
			className: ({ accountType }) => {
				if (accountType === "company") {
					return "rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm transition-colors dark:border-amber-700 dark:bg-amber-950/30"
				}

				return "rounded-2xl border border-emerald-300 bg-emerald-50 p-5 shadow-sm transition-colors dark:border-emerald-700 dark:bg-emerald-950/30"
			},
			// [!endregion tailwind-class-name]
			columns: 2,
			children: [
				{
					kind: "field",
					path: "name",
					control: "text",
					label: "Name",
					required: true,
					props: {
						placeholder: "Enter your name",
						autoComplete: "name",
					},
				},
				{
					kind: "field",
					path: "accountType",
					control: "select",
					label: "Account type",
					required: true,
					options: [
						{ value: "personal", label: "Personal" },
						{ value: "company", label: "Company" },
					],
				},
				// [!region conditional-field]
				{
					kind: "field",
					path: "companyName",
					control: "text",
					label: "Company name",
					required: ({ accountType }) => accountType === "company",
					visible: ({ accountType }) => accountType === "company",
					props: {
						placeholder: "Compiler Labs",
						autoComplete: "organization",
					},
				},
				// [!endregion conditional-field]
				{
					kind: "field",
					path: "country",
					control: "select",
					label: "Country",
					required: true,
					options: countryOptions,
				},
				{
					kind: "field",
					path: "newsletter",
					control: "checkbox",
					label: "Receive product news",
				},
				{
					kind: "field",
					path: "avatar",
					control: "file",
					label: "Avatar",
					description:
						"Choose a PNG file. The File stays in the React Hook Form input.",
					props: {
						accept: "image/png",
					},
				},
			],
		},
		// [!region array-node]
		{
			kind: "array",
			path: "contacts",
			label: "Contacts",
			description:
				"Add or reorder contacts. React Hook Form updates the array by index.",
			itemDefault: {
				email: "",
				label: undefined,
			},
			children: [
				{
					kind: "field",
					path: "email",
					control: "text",
					label: "Email",
					required: true,
					props: {
						type: "email",
						placeholder: "ada@example.com",
						autoComplete: "email",
					},
				},
				{
					kind: "field",
					path: "label",
					control: "text",
					label: "Label",
					props: {
						placeholder: "primary",
					},
				},
			],
		},
		// [!endregion array-node]
	],
})

export function ProfileForm() {
	const [saved, setSaved] = useState<ProfileOutput>()
	const form = kit.useForm(profileDefinition, {
		defaultValues,
		onSubmit: ({ value }) => setSaved(value),
	})
	let output = "Submit the form to see typed output."
	if (saved !== undefined) output = JSON.stringify(saved, null, 2)

	return (
		<>
			<kit.AutoForm form={form}>
				<kit.Submit>Save profile</kit.Submit>
			</kit.AutoForm>
			<pre aria-live="polite">{output}</pre>
		</>
	)
}
