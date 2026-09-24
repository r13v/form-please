// @jsx: react-jsx
"use client"

import type { FormInput, FormOutput } from "form-please"
import { useState } from "react"
import * as v from "valibot"

import { shadcnFormKit as kit } from "../components/ui/form-please/shadcn-form-kit"

const workshopSchema = v.object({
	title: v.pipe(v.string(), v.minLength(3, "Use at least three characters")),
	abstract: v.pipe(
		v.string(),
		v.minLength(20, "Explain the workshop in at least 20 characters"),
	),
	track: v.picklist(["design", "engineering", "leadership"]),
	capacity: v.pipe(v.number(), v.minValue(6), v.maxValue(80)),
	proposalDate: v.string(),
	startsAt: v.string(),
	accessibilityReview: v.boolean(),
	brief: v.optional(v.file()),
	format: v.picklist(["studio", "remote", "hybrid"]),
	recordingAllowed: v.boolean(),
	duration: v.pipe(v.number(), v.minValue(30), v.maxValue(180)),
	audienceRange: v.tuple([v.number(), v.number()]),
	agendaCheckpoints: v.array(v.number()),
	venue: v.string(),
	topics: v.array(v.string()),
	workshopDate: v.string(),
	availability: v.object({
		from: v.optional(v.string()),
		to: v.optional(v.string()),
	}),
	inviteCode: v.pipe(
		v.string(),
		v.regex(/^\d{6}$/, "Enter the six-digit invite code"),
	),
})

type WorkshopInput = FormInput<typeof workshopSchema>
type WorkshopOutput = FormOutput<typeof workshopSchema>

const choiceOptions = {
	track: [
		{ value: "design", label: "Design" },
		{ value: "engineering", label: "Engineering" },
		{ value: "leadership", label: "Leadership" },
	],
	format: [
		{
			value: "studio",
			label: "Studio",
			description: "A facilitated, in-person room.",
		},
		{
			value: "remote",
			label: "Remote",
			description: "A live online session.",
		},
		{
			value: "hybrid",
			label: "Hybrid",
			description: "One room with remote participants.",
		},
	],
	venue: [
		{ value: "north-studio", label: "North studio" },
		{ value: "library-lab", label: "Library lab" },
		{ value: "remote-room", label: "Remote room" },
	],
	topics: [
		{ value: "research", label: "Research" },
		{ value: "prototyping", label: "Prototyping" },
		{ value: "facilitation", label: "Facilitation" },
		{ value: "systems", label: "Systems thinking" },
	],
} as const

const workshopDefinition = kit.defineForm(workshopSchema, (ui) => [
	ui.section("proposal", {
		title: "Workshop proposal",
		description: "Native controls rendered with local shadcn primitives.",
		columns: 2,
		children: [
			ui.field("title", {
				control: "text",
				label: "Title",
				required: true,
				props: { placeholder: "Designing useful constraints" },
			}),
			ui.field("track", {
				control: "select",
				label: "Track",
				options: choiceOptions.track,
			}),
			ui.field("abstract", {
				control: "textarea",
				label: "Abstract",
				required: true,
				props: { rows: 4 },
			}),
			ui.field("capacity", {
				control: "number",
				label: "Capacity",
				props: { min: 6, max: 80, step: 1 },
			}),
			ui.field("proposalDate", {
				control: "date",
				label: "Proposal date",
			}),
			ui.field("startsAt", {
				control: "time",
				label: "Preferred start time",
				props: { step: 900 },
			}),
			ui.field("accessibilityReview", {
				control: "checkbox",
				label: "Request an accessibility review",
			}),
			ui.field("brief", {
				control: "file",
				label: "Optional brief",
				props: { accept: ".pdf,.md,text/markdown,application/pdf" },
			}),
		],
	}),
	ui.section("experience", {
		title: "Session experience",
		description: "Base UI option controls and each slider value shape.",
		columns: 2,
		children: [
			ui.field("format", {
				control: "radio",
				label: "Format",
				options: choiceOptions.format,
			}),
			ui.field("recordingAllowed", {
				control: "switch",
				label: "Allow a recording",
				props: { size: "sm" },
			}),
			ui.field("duration", {
				control: "slider",
				label: "Duration",
				description: "One numeric value, in minutes.",
				props: {
					min: 30,
					max: 180,
					step: 15,
					format: { style: "unit", unit: "minute" },
				},
			}),
			ui.field("audienceRange", {
				control: "rangeSlider",
				label: "Audience experience range",
				description: "A fixed two-number tuple.",
				props: { min: 0, max: 10, step: 1, minStepsBetweenValues: 2 },
			}),
			ui.field("agendaCheckpoints", {
				control: "multiSlider",
				label: "Agenda checkpoints",
				description: "An arbitrary array of numeric thumbs.",
				props: { min: 0, max: 100, step: 5 },
			}),
		],
	}),
	ui.section("schedule", {
		title: "Discovery and schedule",
		description: "Searchable options, calendar values, and OTP input.",
		columns: 2,
		children: [
			ui.field("venue", {
				control: "combobox",
				label: "Venue",
				options: choiceOptions.venue,
				props: {
					placeholder: "Search venues",
					showClear: true,
				},
			}),
			ui.field("topics", {
				control: "multiCombobox",
				label: "Topics",
				options: choiceOptions.topics,
				props: {
					placeholder: "Add topics",
				},
			}),
			ui.field("workshopDate", {
				control: "datePicker",
				label: "Workshop date",
				props: {
					placeholder: "Pick a date",
					captionLayout: "dropdown",
					presets: [
						{ value: "2027-04-09", label: "Spring lab" },
						{ value: "2027-09-17", label: "Autumn lab" },
					],
				},
			}),
			ui.field("availability", {
				control: "dateRangePicker",
				label: "Travel availability",
				props: { numberOfMonths: 2 },
			}),
			ui.field("inviteCode", {
				control: "inputOtp",
				label: "Invite code",
				required: true,
				props: {
					maxLength: 6,
					groups: [3, 3],
					separator: true,
					pattern: "^\\d*$",
					autoComplete: "one-time-code",
				},
			}),
		],
	}),
])

const defaultValues = {
	title: "Designing useful constraints",
	abstract:
		"A practical session for turning product constraints into focused experiments.",
	track: "design",
	capacity: 24,
	proposalDate: "2026-08-02",
	startsAt: "10:00",
	accessibilityReview: true,
	brief: undefined,
	format: "studio",
	recordingAllowed: false,
	duration: 90,
	audienceRange: [2, 7],
	agendaCheckpoints: [20, 50, 80],
	venue: "north-studio",
	topics: ["research", "prototyping"],
	workshopDate: "2027-04-09",
	availability: { from: "2027-04-07", to: "2027-04-11" },
	inviteCode: "104729",
} satisfies WorkshopInput

export function ShadcnValibotWorkshopExample() {
	const [saved, setSaved] = useState<WorkshopOutput>()
	const form = kit.useForm(workshopDefinition, {
		defaultValues,
		onSubmit({ value }) {
			setSaved(value)
		},
	})
	let status = "Submit the proposal to validate it with Valibot."
	if (saved !== undefined) {
		status = `${saved.title} is ready for ${saved.capacity} participants.`
	}

	return (
		<section
			aria-label="Shadcn with Valibot workshop example"
			className="grid gap-4"
		>
			<kit.AutoForm className="grid gap-4" form={form}>
				<kit.Submit>Submit proposal</kit.Submit>
			</kit.AutoForm>
			<output aria-live="polite" className="text-sm text-muted-foreground">
				{status}
			</output>
		</section>
	)
}
