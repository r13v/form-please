// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import { nativeFormKit } from "form-please/preset-native"
import { z } from "zod"

const deliverySchema = z.object({
	delivery: z.enum(["pickup", "shipping"]),
	address: z.string().optional(),
	locked: z.boolean(),
})

const deliveryDefinition = nativeFormKit.defineForm(deliverySchema, {
	ui: [
		{
			kind: "field",
			path: "delivery",
			control: "select",
			label: "Delivery method",
			options: [
				{ value: "pickup", label: "Pick up" },
				{ value: "shipping", label: "Ship" },
			],
		},
		// [!region derived-field]
		{
			kind: "field",
			path: "address",
			control: "text",
			label: ({ delivery }) => {
				if (delivery === "shipping") return "Shipping address"
				return "Address"
			},
			description: ({ locked }) => {
				if (locked) return "Unlock the order to edit this address."
				return "Enter the complete shipping address."
			},
			visible: ({ delivery }) => delivery === "shipping",
			readOnly: ({ locked }) => locked,
			required: ({ delivery }) => delivery === "shipping",
			props: ({ delivery }) => {
				if (delivery === "shipping") {
					return { placeholder: "12 Analytical Engine Way" }
				}
				return {}
			},
		},
		// [!endregion derived-field]
	],
})

const projectSchema = z.object({
	archived: z.boolean(),
	details: z.object({
		name: z.string(),
		summary: z.string(),
	}),
})

// [!region conditional-section]
const projectDefinition = nativeFormKit.defineForm(projectSchema, {
	ui: [
		{
			kind: "section",
			id: "project-details",
			title: "Project details",
			readOnly: ({ archived }) => archived,
			children: [
				{
					kind: "field",
					path: "details.name",
					control: "text",
					label: "Name",
				},
				{
					kind: "field",
					path: "details.summary",
					control: "text",
					label: "Summary",
				},
			],
		},
	],
})
// [!endregion conditional-section]

type EditorContext = {
	readonly canEdit: boolean
	readonly countries: readonly {
		readonly value: string
		readonly label: string
	}[]
}

const editorKit = nativeFormKit.forContext<EditorContext>()
const editorSchema = z.object({ country: z.string() })

// [!region runtime-context]
const editorDefinition = editorKit.defineForm(editorSchema, {
	ui: [
		{
			kind: "field",
			path: "country",
			control: "select",
			label: "Country",
			disabled: (_values, { context }) => !context.canEdit,
			options: ({ context }) => context.countries,
		},
	],
})

function Editor({ context }: { readonly context: EditorContext }) {
	const form = editorKit.useForm(editorDefinition, {
		defaultValues: { country: "" },
		context,
	})

	return <editorKit.AutoForm form={form} />
}
// [!endregion runtime-context]

const contactsSchema = z.object({
	contacts: z.array(z.object({ email: z.email() })),
})

// [!region array-resolver]
const contactsDefinition = nativeFormKit.defineForm(contactsSchema, {
	ui: [
		{
			kind: "array",
			path: "contacts",
			label: ({ contacts }) => `Contacts (${contacts.length})`,
			itemDefault: { email: "" },
			children: [
				{
					kind: "field",
					path: "email",
					control: "text",
					label: "Email",
					props: { type: "email" },
				},
			],
		},
	],
})
// [!endregion array-resolver]

// [!region conditional-schema]
const accountSchema = z
	.object({
		accountType: z.enum(["personal", "company"]),
		companyName: z.string().optional(),
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
	.transform(({ companyName, ...account }) => {
		if (account.accountType === "personal") return account
		return { ...account, companyName: companyName?.trim() }
	})
// [!endregion conditional-schema]
