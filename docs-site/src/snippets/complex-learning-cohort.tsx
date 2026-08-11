// @jsx: react-jsx
"use client"

import {
	QueryClient,
	QueryClientProvider,
	useMutation,
	useQuery,
} from "@tanstack/react-query"
import {
	createFormKit,
	type FormInput,
	type FormOutput,
	matchResource,
	type UiNode,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

import { queryToResource } from "./query-to-resource"

const cohortSchema = z
	.object({
		identity: z.object({
			title: z.string().min(5, "Use a specific cohort title"),
			discipline: z.enum(["writing", "data", "craft", "leadership"]),
			level: z.enum(["foundation", "intermediate", "advanced"]),
			durationWeeks: z.number().int().min(1).max(52),
		}),
		sessionFormats: z
			.array(
				z.object({
					format: z.enum(["seminar", "studio", "clinic", "critique"]),
					cohortSize: z.number().int().min(2).max(120),
					mentorCount: z.number().int().min(1).max(20),
				}),
			)
			.min(1, "Add at least one session format"),
		priceBands: z
			.array(
				z.object({
					minimumSeats: z.number().int().min(1),
					maximumSeats: z.number().int().min(1),
					pricePerLearner: z.number().min(0),
				}),
			)
			.min(1, "Add at least one price band"),
		media: z.object({
			cover: z
				.custom<File | undefined>(
					(value) =>
						value === undefined ||
						(typeof File !== "undefined" && value instanceof File),
					"Choose an image file",
				)
				.optional(),
			resources: z.array(
				z.object({
					url: z.string().url("Enter a valid resource URL"),
					caption: z.string().min(2, "Add a caption"),
				}),
			),
		}),
		offers: z.object({
			earlyBird: z.object({
				enabled: z.boolean(),
				percent: z.number().min(1).max(80).optional(),
				deadline: z.string().optional(),
			}),
			team: z.object({
				enabled: z.boolean(),
				minimumSeats: z.number().int().min(2).optional(),
				percent: z.number().min(1).max(80).optional(),
			}),
			scholarship: z.object({
				enabled: z.boolean(),
				reservedSeats: z.number().int().min(1).optional(),
			}),
			alumni: z.object({
				enabled: z.boolean(),
				percent: z.number().min(1).max(80).optional(),
			}),
		}),
	})
	.superRefine((value, context) => {
		for (const [index, band] of value.priceBands.entries()) {
			if (band.maximumSeats < band.minimumSeats) {
				context.addIssue({
					code: "custom",
					path: ["priceBands", index, "maximumSeats"],
					message: "Maximum seats must be at least the minimum",
				})
			}
		}
		const sorted = [...value.priceBands].sort(
			(left, right) => left.minimumSeats - right.minimumSeats,
		)
		for (let index = 1; index < sorted.length; index += 1) {
			const previous = sorted[index - 1]
			const current = sorted[index]
			if (
				previous !== undefined &&
				current !== undefined &&
				current.minimumSeats <= previous.maximumSeats
			) {
				context.addIssue({
					code: "custom",
					path: ["priceBands"],
					message: "Price bands cannot overlap",
				})
				break
			}
		}

		const requiredOfferValues: readonly [
			boolean,
			unknown,
			string,
			(string | number)[],
		][] = [
			[
				value.offers.earlyBird.enabled,
				value.offers.earlyBird.percent,
				"Set the early-bird reduction",
				["offers", "earlyBird", "percent"],
			],
			[
				value.offers.earlyBird.enabled,
				value.offers.earlyBird.deadline,
				"Set the early-bird deadline",
				["offers", "earlyBird", "deadline"],
			],
			[
				value.offers.team.enabled,
				value.offers.team.minimumSeats,
				"Set the team threshold",
				["offers", "team", "minimumSeats"],
			],
			[
				value.offers.team.enabled,
				value.offers.team.percent,
				"Set the team reduction",
				["offers", "team", "percent"],
			],
			[
				value.offers.scholarship.enabled,
				value.offers.scholarship.reservedSeats,
				"Set reserved scholarship seats",
				["offers", "scholarship", "reservedSeats"],
			],
			[
				value.offers.alumni.enabled,
				value.offers.alumni.percent,
				"Set the alumni reduction",
				["offers", "alumni", "percent"],
			],
		]
		for (const [enabled, requiredValue, message, path] of requiredOfferValues) {
			if (enabled && requiredValue === undefined) {
				context.addIssue({ code: "custom", path, message })
			}
		}
	})
	.transform((value) => ({
		...value,
		totalCapacity: value.sessionFormats.reduce(
			(total, format) => total + format.cohortSize,
			0,
		),
	}))

type CohortInput = FormInput<typeof cohortSchema>
type CohortOutput = FormOutput<typeof cohortSchema>

const draft = {
	identity: {
		title: "Field Notes for Better Decisions",
		discipline: "leadership",
		level: "intermediate",
		durationWeeks: 8,
	},
	sessionFormats: [
		{ format: "seminar", cohortSize: 18, mentorCount: 2 },
		{ format: "clinic", cohortSize: 6, mentorCount: 2 },
	],
	priceBands: [
		{ minimumSeats: 1, maximumSeats: 9, pricePerLearner: 480 },
		{ minimumSeats: 10, maximumSeats: 24, pricePerLearner: 420 },
	],
	media: {
		cover: undefined,
		resources: [
			{
				url: "https://example.test/resources/field-notes",
				caption: "Sample workbook",
			},
		],
	},
	offers: {
		earlyBird: { enabled: true, percent: 12, deadline: "2027-02-15" },
		team: { enabled: true, minimumSeats: 6, percent: 10 },
		scholarship: { enabled: true, reservedSeats: 3 },
		alumni: { enabled: false, percent: undefined },
	},
} satisfies CohortInput

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})

function TitleSuggestions({
	title,
	onSelect,
}: {
	readonly title: string
	readonly onSelect: (title: string) => void
}) {
	const suggestions = useQuery({
		queryKey: ["cohort-title-suggestions", title],
		queryFn: () =>
			fakeRequest(
				[
					`${title}: Practice Lab`,
					`${title}: Guided Studio`,
					`${title}: Working Sessions`,
				],
				300,
			),
		enabled: title.trim().length >= 5,
		staleTime: 20_000,
	})
	const suggestionsResource = queryToResource(suggestions)

	return (
		<section
			className="form-please-complex__embedded"
			aria-label="Title suggestions"
		>
			<strong>Remote title suggestions</strong>
			<div className="form-please-complex__choice-list">
				{matchResource(suggestionsResource, {
					pending: ({ fetchStatus }) => {
						let message = "Generating suggestions…"
						if (fetchStatus === "idle") {
							message = "Enter at least five characters."
						}
						return <span>{message}</span>
					},
					success: ({ value, refresh }) => (
						<>
							{refresh.status === "pending" && (
								<span>Refreshing suggestions…</span>
							)}
							{refresh.status === "paused" && (
								<span>Refresh paused; showing saved suggestions.</span>
							)}
							{refresh.status === "error" && (
								<span>Refresh failed; showing saved suggestions.</span>
							)}
							{value.map((suggestion) => (
								<button
									key={suggestion}
									onClick={() => onSelect(suggestion)}
									type="button"
								>
									{suggestion}
								</button>
							))}
						</>
					),
					error: () => <span>Could not load title suggestions.</span>,
				})}
			</div>
		</section>
	)
}

const cohortDefinition = kit.defineForm(cohortSchema, {
	ui: [
		{
			kind: "section",
			id: "identity",
			title: "Learning cohort",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "identity.title",
					control: "text",
					label: "Cohort title",
					span: "full",
				},
				{
					kind: "field",
					path: "identity.discipline",
					control: "select",
					label: "Discipline",
					options: {
						options: [
							{ value: "writing", label: "Writing" },
							{ value: "data", label: "Data practice" },
							{ value: "craft", label: "Material craft" },
							{ value: "leadership", label: "Leadership" },
						],
					},
				},
				{
					kind: "field",
					path: "identity.level",
					control: "select",
					label: "Level",
					options: {
						options: [
							{ value: "foundation", label: "Foundation" },
							{ value: "intermediate", label: "Intermediate" },
							{ value: "advanced", label: "Advanced" },
						],
					},
				},
				{
					kind: "field",
					path: "identity.durationWeeks",
					control: "number",
					label: "Duration in weeks",
					options: { min: 1, max: 52, step: 1 },
				},
			],
		},
		{
			kind: "array",
			path: "sessionFormats",
			label: "Session formats",
			description: "Model different seating and mentor configurations.",
			itemDefault: { format: "seminar", cohortSize: 8, mentorCount: 1 },
			children: [
				{
					kind: "field",
					path: "format",
					control: "select",
					label: "Format",
					options: {
						options: [
							{ value: "seminar", label: "Seminar" },
							{ value: "studio", label: "Studio" },
							{ value: "clinic", label: "Clinic" },
							{ value: "critique", label: "Critique" },
						],
					},
				},
				{
					kind: "field",
					path: "cohortSize",
					control: "number",
					label: "Learners",
					options: { min: 2, max: 120, step: 1 },
				},
				{
					kind: "field",
					path: "mentorCount",
					control: "number",
					label: "Mentors",
					options: { min: 1, max: 20, step: 1 },
				},
			],
		},
		{
			kind: "array",
			path: "priceBands",
			label: "Per-capacity pricing",
			itemDefault: { minimumSeats: 1, maximumSeats: 1, pricePerLearner: 0 },
			children: [
				{
					kind: "field",
					path: "minimumSeats",
					control: "number",
					label: "Minimum seats",
					options: { min: 1, step: 1 },
				},
				{
					kind: "field",
					path: "maximumSeats",
					control: "number",
					label: "Maximum seats",
					options: { min: 1, step: 1 },
				},
				{
					kind: "field",
					path: "pricePerLearner",
					control: "number",
					label: "Price per learner",
					options: { min: 0, step: 10 },
				},
			],
		},
		{
			kind: "section",
			id: "media",
			title: "Media",
			children: [
				{
					kind: "field",
					path: "media.cover",
					control: "file",
					label: "Cover image",
					options: { accept: "image/*" },
				},
				{
					kind: "array",
					path: "media.resources",
					label: "Resource gallery",
					itemDefault: { url: "", caption: "" },
					children: [
						{
							kind: "field",
							path: "url",
							control: "text",
							label: "Resource URL",
						},
						{
							kind: "field",
							path: "caption",
							control: "text",
							label: "Caption",
						},
					],
				},
			],
		},
		...offerSections(),
	],
})

function offerSections() {
	return [
		{
			kind: "section",
			id: "offer-early",
			title: "Early-bird offer",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "offers.earlyBird.enabled",
					control: "checkbox",
					label: "Enabled",
				},
				{
					kind: "field",
					path: "offers.earlyBird.percent",
					control: "number",
					label: "Reduction percent",
					visible: (values) => values.offers.earlyBird.enabled,
					options: { min: 1, max: 80, step: 1 },
				},
				{
					kind: "field",
					path: "offers.earlyBird.deadline",
					control: "date",
					label: "Deadline",
					visible: (values) => values.offers.earlyBird.enabled,
				},
			],
		},
		{
			kind: "section",
			id: "offer-team",
			title: "Team offer",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "offers.team.enabled",
					control: "checkbox",
					label: "Enabled",
				},
				{
					kind: "field",
					path: "offers.team.minimumSeats",
					control: "number",
					label: "Minimum seats",
					visible: (values) => values.offers.team.enabled,
					options: { min: 2, step: 1 },
				},
				{
					kind: "field",
					path: "offers.team.percent",
					control: "number",
					label: "Reduction percent",
					visible: (values) => values.offers.team.enabled,
					options: { min: 1, max: 80, step: 1 },
				},
			],
		},
		{
			kind: "section",
			id: "offer-scholarship",
			title: "Scholarship offer",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "offers.scholarship.enabled",
					control: "checkbox",
					label: "Enabled",
				},
				{
					kind: "field",
					path: "offers.scholarship.reservedSeats",
					control: "number",
					label: "Reserved seats",
					visible: (values) => values.offers.scholarship.enabled,
					options: { min: 1, step: 1 },
				},
			],
		},
		{
			kind: "section",
			id: "offer-alumni",
			title: "Returning learner offer",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "offers.alumni.enabled",
					control: "checkbox",
					label: "Enabled",
				},
				{
					kind: "field",
					path: "offers.alumni.percent",
					control: "number",
					label: "Reduction percent",
					visible: (values) => values.offers.alumni.enabled,
					options: { min: 1, max: 80, step: 1 },
				},
			],
		},
	] satisfies readonly UiNode<CohortInput, typeof kit.controls>[]
}

export function LearningCohortExample() {
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	)
	return (
		<QueryClientProvider client={queryClient}>
			<LearningCohortForm />
		</QueryClientProvider>
	)
}

function LearningCohortForm() {
	const loadedDraft = useQuery({
		queryKey: ["learning-cohort-draft", "cohort-41"],
		queryFn: () => fakeRequest(draft, 410),
	})
	const saveCore = useMutation({
		mutationFn: async (value: CohortOutput) => {
			await fakeRequest(undefined, 380)
			if (value.identity.title.toLowerCase() === "reserved cohort")
				throw new CohortConflictError()
			return { revision: value.totalCapacity + 100 }
		},
	})
	const saveMedia = useMutation({
		mutationFn: (value: CohortOutput) =>
			fakeRequest({ resources: value.media.resources.length }, 290),
	})
	const syncOffers = useMutation({
		mutationFn: (value: CohortOutput) =>
			fakeRequest(
				{
					active: Object.values(value.offers).filter((offer) => offer.enabled)
						.length,
				},
				340,
			),
	})
	const [notice, setNotice] = useState("Draft loaded from the fake API.")
	const form = kit.useForm(cohortDefinition, {
		defaultValues: draft,
		async onSubmit({ value }) {
			try {
				const core = await saveCore.mutateAsync(value)
				const media = await saveMedia.mutateAsync(value)
				const offers = await syncOffers.mutateAsync(value)
				setNotice(
					`Revision ${core.revision} saved with ${media.resources} resource(s) and ${offers.active} active offer(s).`,
				)
			} catch (error) {
				if (error instanceof CohortConflictError) {
					setNotice(
						"That title is already reserved. Choose a suggestion or edit it.",
					)
					return
				}

				setNotice("The cohort could not be saved. Your draft is intact.")
			}
		},
	})

	if (loadedDraft.isPending)
		return (
			<section className="form-please-complex">Loading cohort draft…</section>
		)
	if (loadedDraft.isError)
		return (
			<section className="form-please-complex">
				Could not load the cohort draft.
			</section>
		)
	let status = notice
	if (saveCore.isPending || saveMedia.isPending || syncOffers.isPending) {
		status = "Synchronizing three resources…"
	}
	const values = form.api.watch()
	const capacity = values.sessionFormats.reduce(
		(total, item) => total + item.cohortSize,
		0,
	)

	return (
		<section
			aria-label="Learning cohort editor example"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Async cohort editor</p>
			<p className="form-please-complex__summary">
				Remote title suggestions, movable configuration rows, band validation,
				media, four offer subforms, and conflict recovery remain typed end to
				end.
			</p>
			<kit.AutoForm className="form-please-complex__form" form={form}>
				<TitleSuggestions
					title={values.identity.title}
					onSelect={(suggestion) =>
						form.api.setValue("identity.title", suggestion)
					}
				/>
				<div className="form-please-complex__actions">
					<kit.Submit className="form-please-complex__primary">
						Save cohort
					</kit.Submit>
					<span aria-live="polite">{status}</span>
				</div>
			</kit.AutoForm>
			<aside
				aria-label="Cohort preview"
				className="form-please-complex__preview"
			>
				<strong>{values.identity.title}</strong>
				<span>
					{values.sessionFormats.length} formats · {capacity} aggregate seats
				</span>
			</aside>
		</section>
	)
}

class CohortConflictError extends Error {}

function fakeRequest<Value>(value: Value, delay: number): Promise<Value> {
	return new Promise((resolve) =>
		window.setTimeout(() => resolve(value), delay),
	)
}
