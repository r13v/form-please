// @jsx: react-jsx
"use client"

import { createFormKit, type FormInput } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { z } from "zod"

const profileBase = z.object({
	name: z.string().min(1, "Name is required"),
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

const profileSchema = z
	.discriminatedUnion("accountType", [
		profileBase.extend({ accountType: z.literal("personal") }),
		profileBase.extend({
			accountType: z.literal("company"),
			companyName: z
				.string()
				.trim()
				.min(1, "Company name is required")
				.prefault(""),
		}),
	])
	.transform((value) => ({
		...value,
		contactCount: value.contacts.length,
	}))

type ProfileInput = FormInput<typeof profileSchema>

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

export const profileDefinition = kit.defineForm(profileSchema, (ui) => [
	ui.section("account", {
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
			ui.field("name", {
				control: "text",
				label: "Name",
				required: true,
				props: {
					placeholder: "Enter your name",
					autoComplete: "name",
				},
			}),
			ui.field("accountType", {
				control: "select",
				label: "Account type",
				required: true,
				options: [
					{ value: "personal", label: "Personal" },
					{ value: "company", label: "Company" },
				],
			}),
			// [!region conditional-field]
			ui.field("companyName", {
				control: "text",
				label: "Company name",
				required: true,
				visible: ({ accountType }) => accountType === "company",
				props: {
					placeholder: "Compiler Labs",
					autoComplete: "organization",
				},
			}),
			// [!endregion conditional-field]
			ui.field("country", {
				control: "select",
				label: "Country",
				required: true,
				options: countryOptions,
			}),
			ui.field("newsletter", {
				control: "checkbox",
				label: "Receive product news",
			}),
			ui.field("avatar", {
				control: "file",
				label: "Avatar",
				description:
					"Choose a PNG file. The File stays in the React Hook Form input.",
				props: {
					accept: "image/png",
				},
			}),
		],
	}),
	// [!region array-node]
	ui.array("contacts", {
		label: "Contacts",
		description:
			"Add or reorder contacts. React Hook Form updates the array by index.",
		itemDefault: {
			email: "",
			label: undefined,
		},
		children: (contact) => [
			contact.field("email", {
				control: "text",
				label: "Email",
				required: true,
				props: {
					type: "email",
					placeholder: "ada@example.com",
					autoComplete: "email",
				},
			}),
			contact.field("label", {
				control: "text",
				label: "Label",
				props: {
					placeholder: "primary",
				},
			}),
		],
	}),
	// [!endregion array-node]
])
