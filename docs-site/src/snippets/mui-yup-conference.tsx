// @jsx: react-jsx
"use client"

import type { PaletteMode } from "@mui/material"
import {
	Box,
	createTheme,
	Paper,
	ThemeProvider,
	Typography,
} from "@mui/material"
import type { FormInput, FormOutput } from "form-please"
import { createMuiFormKit } from "form-please/preset-mui"
import { useEffect, useMemo, useState } from "react"
import * as yup from "yup"

const kit = createMuiFormKit()

const topicLabels = {
	accessibility: "Accessibility",
	architecture: "Architecture",
	forms: "Forms",
	performance: "Performance",
} as const

type TopicId = keyof typeof topicLabels

const conferenceSchema = yup
	.object({
		title: yup
			.string()
			.transform((value) => value.trim())
			.min(8, "Use at least 8 characters")
			.required("Enter a proposal title"),
		email: yup
			.string()
			.email("Enter a valid email address")
			.required("Enter a contact email"),
		format: yup
			.mixed<"talk" | "workshop">()
			.oneOf(["talk", "workshop"])
			.defined(),
		topics: yup
			.array(
				yup
					.mixed<TopicId>()
					.oneOf(Object.keys(topicLabels) as TopicId[])
					.defined(),
			)
			.min(1, "Choose at least one topic")
			.defined(),
		experience: yup.number().integer().min(1).max(5).defined(),
		remote: yup.boolean().defined(),
		date: yup
			.string()
			.matches(/^\d{4}-\d{2}-\d{2}$/, "Choose a date")
			.required("Choose a date"),
		time: yup
			.string()
			.matches(/^\d{2}:\d{2}$/, "Choose a start time")
			.required("Choose a start time"),
		abstract: yup
			.string()
			.transform((value) => value.trim())
			.min(40, "Use at least 40 characters")
			.required("Enter an abstract"),
		slides: yup.mixed<File>().optional(),
		agreement: yup
			.boolean()
			.oneOf([true], "Confirm that you can attend")
			.defined(),
	})
	.test(
		"workshop-experience",
		"Workshops need at least three years of speaker experience",
		function validateWorkshopExperience(value) {
			if (value.format === "workshop" && value.experience < 3) {
				return this.createError({
					message: "Workshops need at least three years of experience",
					path: "experience",
				})
			}
			return true
		},
	)

type ConferenceInput = FormInput<typeof conferenceSchema>
type ConferenceOutput = FormOutput<typeof conferenceSchema>

const conferenceDefinition = kit.defineForm(conferenceSchema, {
	ui: [
		{
			kind: "section",
			id: "proposal",
			title: "Conference proposal",
			description:
				"Describe the session, schedule it, and confirm the speaker details.",
			columns: 12,
			slotOptions: {
				sx: { width: "100%" },
				layoutSx: { alignItems: "start" },
			},
			children: [
				{
					kind: "field",
					path: "title",
					control: "text",
					label: "Proposal title",
					required: true,
					span: 7,
					options: {
						placeholder: "Designing forms people can finish",
						sx: { bgcolor: "background.paper" },
					},
				},
				{
					kind: "field",
					path: "email",
					control: "email",
					label: "Contact email",
					required: true,
					span: 5,
					options: {
						autoComplete: "email",
						placeholder: "speaker@example.com",
						sx: { bgcolor: "background.paper" },
					},
				},
				{
					kind: "field",
					path: "format",
					control: "radio",
					label: "Session format",
					required: true,
					span: 6,
					options: {
						row: true,
						choices: [
							{ value: "talk", label: "Talk" },
							{ value: "workshop", label: "Workshop" },
						],
						sx: { minHeight: 56 },
					},
				},
				{
					kind: "field",
					path: "topics",
					control: "autocomplete-multiple",
					label: "Topics",
					required: true,
					span: 6,
					options: {
						options: Object.keys(topicLabels) as TopicId[],
						getOptionLabel: (option) => topicLabels[option as TopicId],
						textFieldProps: { placeholder: "Search topics" },
						sx: { bgcolor: "background.paper" },
					},
				},
				{
					kind: "field",
					path: "experience",
					control: "slider",
					label: "Speaker experience",
					description: "Years presenting to professional audiences.",
					span: 6,
					options: {
						marks: true,
						max: 5,
						min: 1,
						step: 1,
						sx: { boxSizing: "border-box", mt: 1, px: 1 },
						valueLabelDisplay: "auto",
					},
				},
				{
					kind: "field",
					path: "remote",
					control: "switch",
					label: "Remote session",
					description:
						"Enable this when the speaker will not attend in person.",
					span: 6,
					options: { color: "secondary" },
				},
				{
					kind: "field",
					path: "date",
					control: "date",
					label: "Preferred date",
					required: true,
					span: 3,
					options: { sx: { bgcolor: "background.paper" } },
				},
				{
					kind: "field",
					path: "time",
					control: "time",
					label: "Start time",
					required: true,
					span: 3,
					options: { sx: { bgcolor: "background.paper" } },
				},
				{
					kind: "field",
					path: "slides",
					control: "file",
					label: "Draft slides",
					description: "Optional PDF, up to the application's upload limit.",
					span: 6,
					options: {
						buttonProps: { color: "secondary" },
						inputProps: { accept: "application/pdf,.pdf" },
						sx: { justifyContent: "flex-start" },
					},
				},
				{
					kind: "field",
					path: "abstract",
					control: "textarea",
					label: "Abstract",
					required: true,
					span: "full",
					options: {
						minRows: 4,
						placeholder: "Explain what attendees will learn.",
						sx: { bgcolor: "background.paper" },
					},
				},
				{
					kind: "field",
					path: "agreement",
					control: "checkbox",
					label: "I can attend at the selected date and time",
					required: true,
					span: "full",
					options: { color: "secondary", sx: { p: 0.5 } },
				},
			],
		},
	],
})

const defaultValues = {
	title: "Designing forms people can finish",
	email: "speaker@example.com",
	format: "talk",
	topics: ["forms"],
	experience: 4,
	remote: false,
	date: "2027-09-17",
	time: "10:30",
	abstract:
		"A practical session about form architecture, clear validation, and accessible interaction patterns.",
	slides: undefined,
	agreement: true,
} satisfies ConferenceInput

export function MuiYupConferenceExample() {
	const mode = useVocsPaletteMode()
	const [isClientReady, setIsClientReady] = useState(false)
	const theme = useMemo(
		() =>
			createTheme({
				palette: { mode, secondary: { main: "#7c3aed" } },
				shape: { borderRadius: 12 },
			}),
		[mode],
	)
	const [saved, setSaved] = useState<ConferenceOutput>()
	const form = kit.useForm(conferenceDefinition, {
		defaultValues,
		onSubmit({ value }) {
			setSaved(value)
		},
	})
	useEffect(() => setIsClientReady(true), [])
	let status = "Submit the proposal to validate it with Yup."
	if (saved !== undefined) {
		const topics = saved.topics.map((topic) => topicLabels[topic]).join(", ")
		status = `${saved.title} is ready for review. Topics: ${topics}.`
	}

	return (
		<ThemeProvider theme={theme}>
			<Paper
				aria-label="Material UI with Yup conference example"
				component="section"
				data-demo-client-ready={isClientReady}
				sx={{ my: 3, p: { xs: 2, sm: 3 } }}
				variant="outlined"
			>
				<kit.AutoForm form={form}>
					<kit.Submit>Submit proposal</kit.Submit>
				</kit.AutoForm>
				<Box sx={{ mt: 2 }}>
					<Typography aria-live="polite" component="output" variant="body2">
						{status}
					</Typography>
				</Box>
			</Paper>
		</ThemeProvider>
	)
}

function useVocsPaletteMode(): PaletteMode {
	const [mode, setMode] = useState<PaletteMode>("light")

	useEffect(() => {
		const root = document.documentElement
		const update = () => {
			if (root.dataset.vocsTheme === "dark") {
				setMode("dark")
				return
			}
			setMode("light")
		}
		update()
		const observer = new MutationObserver(update)
		observer.observe(root, {
			attributeFilter: ["data-vocs-theme"],
			attributes: true,
		})
		return () => observer.disconnect()
	}, [])

	return mode
}
