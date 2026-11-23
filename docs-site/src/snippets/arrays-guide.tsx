// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import { createFormKit, defineControl, type FormInput } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useFieldArray } from "react-hook-form"
import { z } from "zod"

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})

// [!region define-array]
const contactsSchema = z.object({
	contacts: z
		.array(
			z.object({
				id: z.string(),
				email: z.email("Enter a valid email"),
				label: z.string().optional(),
			}),
		)
		.min(1, "Add at least one contact"),
})

const contactDefaultValues = {
	contacts: [{ id: "contact-1", email: "ada@example.com", label: "Primary" }],
} satisfies FormInput<typeof contactsSchema>

const contactsDefinition = kit.defineForm(contactsSchema, (ui) => [
	ui.array("contacts", {
		label: "Contacts",
		description: "Add, reorder, or remove contacts.",
		itemDefault: () => ({
			id: crypto.randomUUID(),
			email: "",
			label: undefined,
		}),
		children: (contact) => [
			contact.field("email", {
				control: "text",
				label: "Email",
				required: true,
			}),
			contact.field("label", {
				control: "text",
				label: "Label",
			}),
		],
	}),
])
// [!endregion define-array]

// [!region nested-array]
const conferenceSchema = z.object({
	speakers: z.array(
		z.object({
			name: z.string(),
			sessions: z.array(z.object({ title: z.string() })),
		}),
	),
})

const conferenceDefinition = kit.defineForm(conferenceSchema, (ui) => [
	ui.array("speakers", {
		label: "Speakers",
		itemDefault: { name: "", sessions: [] },
		children: (speaker) => [
			speaker.field("name", { control: "text", label: "Name" }),
			speaker.array("sessions", {
				label: "Sessions",
				itemDefault: { title: "" },
				children: (session) => [
					session.field("title", {
						control: "text",
						label: "Title",
					}),
				],
			}),
		],
	}),
])
// [!endregion nested-array]

// [!region array-validation]
const uniqueContactsSchema = z
	.object({
		contacts: z
			.array(z.object({ email: z.email("Enter a valid email") }))
			.min(1, "Add at least one contact"),
	})
	.superRefine(({ contacts }, context) => {
		const seen = new Set<string>()

		for (const [index, contact] of contacts.entries()) {
			const email = contact.email.toLowerCase()
			if (seen.has(email)) {
				context.addIssue({
					code: "custom",
					message: "Use a unique email",
					path: ["contacts", index, "email"],
				})
			}
			seen.add(email)
		}
	})
// [!endregion array-validation]

function createContact() {
	return {
		id: crypto.randomUUID(),
		email: "",
		label: undefined,
	}
}

// [!region custom-operations]
export function ContactsForm() {
	const form = kit.useForm(contactsDefinition, {
		defaultValues: contactDefaultValues,
	})
	const { fields, insert, move, replace } = useFieldArray({
		control: form.api.control,
		name: "contacts",
	})

	return (
		<kit.Form form={form}>
			<kit.Fields />

			<fieldset>
				<legend>Contact actions</legend>
				<button type="button" onClick={() => insert(0, createContact())}>
					Add primary contact
				</button>
				<button
					disabled={fields.length < 2}
					type="button"
					onClick={() => move(fields.length - 1, 0)}
				>
					Move last contact first
				</button>
				<button
					disabled={fields.length === 0}
					type="button"
					onClick={() => replace([])}
				>
					Remove all contacts
				</button>
			</fieldset>

			<kit.Submit>Save contacts</kit.Submit>
		</kit.Form>
	)
}
// [!endregion custom-operations]

// [!region primitive-list]
const lineListControl = defineControl<string[]>({
	component: ({ blur, input, meta, setValue, value }) => (
		<textarea
			{...input}
			aria-invalid={meta.invalid || undefined}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value.split("\n"))}
			value={value.join("\n")}
		/>
	),
})

const tagKit = createFormKit({
	controls: { ...createNativeControls(), lineList: lineListControl },
	slots: createDefaultSlots(),
})

const articleSchema = z.object({
	tags: z.array(z.string().min(1, "Remove the empty line")).max(5),
})

const articleDefinition = tagKit.defineForm(articleSchema, (ui) => [
	ui.field("tags", {
		control: "lineList",
		label: "Tags",
		description: "Enter one tag on each line.",
	}),
])
// [!endregion primitive-list]
