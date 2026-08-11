// @jsx: react-jsx
"use client"

import {
	QueryClient,
	QueryClientProvider,
	useMutation,
	useQuery,
} from "@tanstack/react-query"
import { createFormKit, type FormInput, type FormOutput } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

const templateNames = [
	"newsletter",
	"product-launch",
	"event-invite",
	"fundraiser",
	"course-drop",
	"community-update",
	"feedback-pulse",
] as const

const campaignSchema = z
	.object({
		id: z.string().optional(),
		name: z.string().min(4, "Name this campaign"),
		template: z.enum(templateNames),
		audience: z.object({
			segmentId: z.string().min(1, "Choose an audience"),
			deliveryMode: z.enum(["immediate", "scheduled", "rolling"]),
			channels: z.object({
				email: z.boolean(),
				push: z.boolean(),
				web: z.boolean(),
			}),
		}),
		schedule: z.object({
			startsOn: z.string().min(1, "Choose a start date"),
			endsOn: z.string().optional(),
		}),
		newsletter: z.object({
			subject: z.string().optional(),
			preheader: z.string().optional(),
		}),
		productLaunch: z.object({
			productName: z.string().optional(),
			sku: z.string().optional(),
			initialStock: z.number().int().min(0).optional(),
			releaseKind: z.enum(["limited", "general", "preorder"]),
		}),
		eventInvite: z.object({
			eventName: z.string().optional(),
			venue: z.string().optional(),
			capacity: z.number().int().min(1).optional(),
			requiresRegistration: z.boolean(),
		}),
		fundraiser: z.object({
			cause: z.string().optional(),
			goalAmount: z.number().min(1).optional(),
			suggestedContribution: z.number().min(1).optional(),
		}),
		courseDrop: z.object({
			courseTitle: z.string().optional(),
			seatLimit: z.number().int().min(1).optional(),
			certificateIncluded: z.boolean(),
		}),
		communityUpdate: z.object({
			topic: z.string().optional(),
			moderator: z.string().optional(),
			responseWindowDays: z.number().int().min(1).optional(),
		}),
		feedbackPulse: z.object({
			question: z.string().optional(),
			responseLimit: z.number().int().min(1).optional(),
			anonymous: z.boolean(),
		}),
		payment: z.object({
			mode: z.enum(["free", "fixed", "flexible", "recurring"]),
			amount: z.number().min(1).optional(),
			currency: z.enum(["USD", "EUR", "GBP"]),
			interval: z.enum(["monthly", "annual"]),
		}),
	})
	.superRefine((value, context) => {
		if (!Object.values(value.audience.channels).some(Boolean)) {
			context.addIssue({
				code: "custom",
				path: ["audience", "channels"],
				message: "Choose at least one delivery channel",
			})
		}
		if (
			value.audience.deliveryMode !== "immediate" &&
			value.schedule.endsOn !== undefined &&
			value.schedule.endsOn < value.schedule.startsOn
		) {
			context.addIssue({
				code: "custom",
				path: ["schedule", "endsOn"],
				message: "The end date must follow the start date",
			})
		}

		const required: Array<readonly [unknown, (string | number)[], string]> = []
		switch (value.template) {
			case "newsletter":
				required.push(
					[
						value.newsletter.subject,
						["newsletter", "subject"],
						"Write the email subject",
					],
					[
						value.newsletter.preheader,
						["newsletter", "preheader"],
						"Write the preheader",
					],
				)
				break
			case "product-launch":
				required.push(
					[
						value.productLaunch.productName,
						["productLaunch", "productName"],
						"Name the product",
					],
					[
						value.productLaunch.sku,
						["productLaunch", "sku"],
						"Enter the catalog code",
					],
					[
						value.productLaunch.initialStock,
						["productLaunch", "initialStock"],
						"Set the opening stock",
					],
				)
				break
			case "event-invite":
				required.push(
					[
						value.eventInvite.eventName,
						["eventInvite", "eventName"],
						"Name the event",
					],
					[
						value.eventInvite.venue,
						["eventInvite", "venue"],
						"Enter the venue",
					],
					[
						value.eventInvite.capacity,
						["eventInvite", "capacity"],
						"Set capacity",
					],
				)
				break
			case "fundraiser":
				required.push(
					[
						value.fundraiser.cause,
						["fundraiser", "cause"],
						"Describe the cause",
					],
					[
						value.fundraiser.goalAmount,
						["fundraiser", "goalAmount"],
						"Set the funding goal",
					],
				)
				break
			case "course-drop":
				required.push(
					[
						value.courseDrop.courseTitle,
						["courseDrop", "courseTitle"],
						"Name the course",
					],
					[
						value.courseDrop.seatLimit,
						["courseDrop", "seatLimit"],
						"Set the seat limit",
					],
				)
				break
			case "community-update":
				required.push(
					[
						value.communityUpdate.topic,
						["communityUpdate", "topic"],
						"Describe the update topic",
					],
					[
						value.communityUpdate.moderator,
						["communityUpdate", "moderator"],
						"Name the moderator",
					],
					[
						value.communityUpdate.responseWindowDays,
						["communityUpdate", "responseWindowDays"],
						"Set the response window",
					],
				)
				break
			case "feedback-pulse":
				required.push(
					[
						value.feedbackPulse.question,
						["feedbackPulse", "question"],
						"Write the feedback question",
					],
					[
						value.feedbackPulse.responseLimit,
						["feedbackPulse", "responseLimit"],
						"Set the response limit",
					],
				)
				break
		}
		for (const [fieldValue, path, message] of required) {
			if (fieldValue === undefined || fieldValue === "") {
				context.addIssue({ code: "custom", path, message })
			}
		}

		if (
			paymentApplies(value.template) &&
			value.payment.mode !== "free" &&
			value.payment.amount === undefined
		) {
			context.addIssue({
				code: "custom",
				path: ["payment", "amount"],
				message: "Set an amount for this payment model",
			})
		}
	})
	.transform((value) => ({
		...value,
		selectedChannels: Object.entries(value.audience.channels)
			.filter(([, selected]) => selected)
			.map(([channel]) => channel),
	}))

type CampaignInput = FormInput<typeof campaignSchema>
type CampaignOutput = FormOutput<typeof campaignSchema>
type CampaignContext = {
	readonly segments: readonly {
		readonly value: string
		readonly label: string
	}[]
}

const emptyVariants = {
	newsletter: { subject: undefined, preheader: undefined },
	productLaunch: {
		productName: undefined,
		sku: undefined,
		initialStock: undefined,
		releaseKind: "general",
	},
	eventInvite: {
		eventName: undefined,
		venue: undefined,
		capacity: undefined,
		requiresRegistration: true,
	},
	fundraiser: {
		cause: undefined,
		goalAmount: undefined,
		suggestedContribution: undefined,
	},
	courseDrop: {
		courseTitle: undefined,
		seatLimit: undefined,
		certificateIncluded: true,
	},
	communityUpdate: {
		topic: undefined,
		moderator: undefined,
		responseWindowDays: undefined,
	},
	feedbackPulse: {
		question: undefined,
		responseLimit: undefined,
		anonymous: true,
	},
} as const

const newCampaign = {
	id: undefined,
	name: "New community campaign",
	template: "newsletter",
	audience: {
		segmentId: "active-members",
		deliveryMode: "scheduled",
		channels: { email: true, push: false, web: true },
	},
	schedule: { startsOn: "2027-03-10", endsOn: "2027-03-21" },
	...emptyVariants,
	newsletter: {
		subject: "What we are making this month",
		preheader: "Three new ways to take part",
	},
	payment: {
		mode: "free",
		amount: undefined,
		currency: "USD",
		interval: "monthly",
	},
} satisfies CampaignInput

const savedCampaign = {
	...newCampaign,
	id: "campaign-204",
	name: "Spring material fund",
	template: "fundraiser",
	newsletter: { subject: undefined, preheader: undefined },
	fundraiser: {
		cause: "Fund free access to the shared material library",
		goalAmount: 18_000,
		suggestedContribution: 35,
	},
	payment: {
		mode: "flexible",
		amount: 10,
		currency: "USD",
		interval: "monthly",
	},
} satisfies CampaignInput

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const contextualKit = kit.forContext<CampaignContext>()

const campaignDefinition = contextualKit.defineForm(campaignSchema, {
	ui: [
		{
			kind: "section",
			id: "campaign",
			title: "Campaign foundation",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "name",
					control: "text",
					label: "Campaign name",
					span: "full",
				},
				{
					kind: "field",
					path: "template",
					control: "select",
					label: "Campaign template",
					options: {
						options: [
							{ value: "newsletter", label: "Newsletter" },
							{ value: "product-launch", label: "Product launch" },
							{ value: "event-invite", label: "Event invitation" },
							{ value: "fundraiser", label: "Fundraiser" },
							{ value: "course-drop", label: "Course release" },
							{ value: "community-update", label: "Community update" },
							{ value: "feedback-pulse", label: "Feedback pulse" },
						],
					},
				},
				{
					kind: "field",
					path: "audience.segmentId",
					control: "select",
					label: "Audience segment",
					options: (_values, { context }) => ({ options: context.segments }),
				},
				{
					kind: "field",
					path: "audience.deliveryMode",
					control: "select",
					label: "Delivery model",
					options: {
						options: [
							{ value: "immediate", label: "Immediate" },
							{ value: "scheduled", label: "Scheduled window" },
							{ value: "rolling", label: "Rolling audience entry" },
						],
					},
				},
				{
					kind: "field",
					path: "audience.channels.email",
					control: "checkbox",
					label: "Email",
				},
				{
					kind: "field",
					path: "audience.channels.push",
					control: "checkbox",
					label: "Push",
				},
				{
					kind: "field",
					path: "audience.channels.web",
					control: "checkbox",
					label: "Web inbox",
				},
				{
					kind: "field",
					path: "schedule.startsOn",
					control: "date",
					label: "Starts on",
				},
				{
					kind: "field",
					path: "schedule.endsOn",
					control: "date",
					label: "Ends on",
					visible: (values) => values.audience.deliveryMode !== "immediate",
				},
			],
		},
		{
			kind: "section",
			id: "newsletter",
			title: "Newsletter content",
			columns: 2,
			visible: ({ template }) => template === "newsletter",
			children: [
				{
					kind: "field",
					path: "newsletter.subject",
					control: "text",
					label: "Subject",
				},
				{
					kind: "field",
					path: "newsletter.preheader",
					control: "text",
					label: "Preheader",
				},
			],
		},
		{
			kind: "section",
			id: "product-launch",
			title: "Product launch",
			columns: 2,
			visible: ({ template }) => template === "product-launch",
			children: [
				{
					kind: "field",
					path: "productLaunch.productName",
					control: "text",
					label: "Product name",
				},
				{
					kind: "field",
					path: "productLaunch.sku",
					control: "text",
					label: "Catalog code",
				},
				{
					kind: "field",
					path: "productLaunch.initialStock",
					control: "number",
					label: "Opening stock",
					options: { min: 0, step: 1 },
				},
				{
					kind: "field",
					path: "productLaunch.releaseKind",
					control: "select",
					label: "Release kind",
					options: {
						options: [
							{ value: "limited", label: "Limited edition" },
							{ value: "general", label: "General release" },
							{ value: "preorder", label: "Preorder" },
						],
					},
				},
			],
		},
		{
			kind: "section",
			id: "event-invite",
			title: "Event invitation",
			columns: 2,
			visible: ({ template }) => template === "event-invite",
			children: [
				{
					kind: "field",
					path: "eventInvite.eventName",
					control: "text",
					label: "Event name",
				},
				{
					kind: "field",
					path: "eventInvite.venue",
					control: "text",
					label: "Venue",
				},
				{
					kind: "field",
					path: "eventInvite.capacity",
					control: "number",
					label: "Capacity",
					options: { min: 1, step: 1 },
				},
				{
					kind: "field",
					path: "eventInvite.requiresRegistration",
					control: "checkbox",
					label: "Registration required",
				},
			],
		},
		{
			kind: "section",
			id: "fundraiser",
			title: "Fundraiser",
			columns: 2,
			visible: ({ template }) => template === "fundraiser",
			children: [
				{
					kind: "field",
					path: "fundraiser.cause",
					control: "textarea",
					label: "Cause",
					span: "full",
					options: { rows: 3 },
				},
				{
					kind: "field",
					path: "fundraiser.goalAmount",
					control: "number",
					label: "Goal amount",
					options: { min: 1, step: 100 },
				},
				{
					kind: "field",
					path: "fundraiser.suggestedContribution",
					control: "number",
					label: "Suggested contribution",
					options: { min: 1, step: 5 },
				},
			],
		},
		{
			kind: "section",
			id: "course-drop",
			title: "Course release",
			columns: 2,
			visible: ({ template }) => template === "course-drop",
			children: [
				{
					kind: "field",
					path: "courseDrop.courseTitle",
					control: "text",
					label: "Course title",
				},
				{
					kind: "field",
					path: "courseDrop.seatLimit",
					control: "number",
					label: "Seat limit",
					options: { min: 1, step: 1 },
				},
				{
					kind: "field",
					path: "courseDrop.certificateIncluded",
					control: "checkbox",
					label: "Include certificate",
				},
			],
		},
		{
			kind: "section",
			id: "community-update",
			title: "Community update",
			columns: 2,
			visible: ({ template }) => template === "community-update",
			children: [
				{
					kind: "field",
					path: "communityUpdate.topic",
					control: "textarea",
					label: "Update topic",
					span: "full",
					options: { rows: 3 },
				},
				{
					kind: "field",
					path: "communityUpdate.moderator",
					control: "text",
					label: "Moderator",
				},
				{
					kind: "field",
					path: "communityUpdate.responseWindowDays",
					control: "number",
					label: "Response window in days",
					options: { min: 1, step: 1 },
				},
			],
		},
		{
			kind: "section",
			id: "feedback-pulse",
			title: "Feedback pulse",
			columns: 2,
			visible: ({ template }) => template === "feedback-pulse",
			children: [
				{
					kind: "field",
					path: "feedbackPulse.question",
					control: "textarea",
					label: "Question",
					span: "full",
					options: { rows: 3 },
				},
				{
					kind: "field",
					path: "feedbackPulse.responseLimit",
					control: "number",
					label: "Response limit",
					options: { min: 1, step: 1 },
				},
				{
					kind: "field",
					path: "feedbackPulse.anonymous",
					control: "checkbox",
					label: "Allow anonymous responses",
				},
			],
		},
		{
			kind: "section",
			id: "payment",
			title: "Payment model",
			columns: 2,
			visible: ({ template }) => paymentApplies(template),
			children: [
				{
					kind: "field",
					path: "payment.mode",
					control: "select",
					label: "Payment mode",
					options: {
						options: [
							{ value: "free", label: "Free" },
							{ value: "fixed", label: "Fixed" },
							{ value: "flexible", label: "Flexible contribution" },
							{ value: "recurring", label: "Recurring" },
						],
					},
				},
				{
					kind: "field",
					path: "payment.amount",
					control: "number",
					label: "Amount",
					visible: (values) => values.payment.mode !== "free",
					options: { min: 1, step: 1 },
				},
				{
					kind: "field",
					path: "payment.currency",
					control: "select",
					label: "Currency",
					options: {
						options: [
							{ value: "USD", label: "USD" },
							{ value: "EUR", label: "EUR" },
							{ value: "GBP", label: "GBP" },
						],
					},
				},
				{
					kind: "field",
					path: "payment.interval",
					control: "select",
					label: "Recurring interval",
					visible: (values) => values.payment.mode === "recurring",
					options: {
						options: [
							{ value: "monthly", label: "Monthly" },
							{ value: "annual", label: "Annual" },
						],
					},
				},
			],
		},
	],
})

export function CampaignBuilderExample() {
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	)
	return (
		<QueryClientProvider client={queryClient}>
			<CampaignBuilderForm />
		</QueryClientProvider>
	)
}

function CampaignBuilderForm() {
	const [mode, setMode] = useState<"create" | "edit">("edit")
	const draft = useQuery({
		queryKey: ["campaign-draft", "campaign-204"],
		queryFn: () => fakeRequest(savedCampaign, 390),
	})
	const segments = useQuery({
		queryKey: ["campaign-segments"],
		queryFn: () =>
			fakeRequest(
				[
					{ value: "active-members", label: "Active members" },
					{ value: "new-readers", label: "New readers" },
					{ value: "past-participants", label: "Past participants" },
				],
				470,
			),
	})
	const createCampaign = useMutation({
		mutationFn: (value: CampaignOutput) =>
			fakeRequest({ id: `campaign-${value.name.length + 700}` }, 430),
	})
	const updateCampaign = useMutation({
		mutationFn: (value: CampaignOutput) =>
			fakeRequest({ id: value.id ?? "campaign-missing" }, 360),
	})
	const [notice, setNotice] = useState("Loaded an editable campaign draft.")
	async function saveCampaign(
		value: CampaignOutput,
		target: "create" | "edit",
	) {
		try {
			if (target === "edit") {
				const result = await updateCampaign.mutateAsync(value)
				setNotice(
					`Updated ${result.id} with ${value.selectedChannels.length} channel(s).`,
				)
				return
			}

			const result = await createCampaign.mutateAsync(value)
			setNotice(
				`Created ${result.id} with ${value.selectedChannels.length} channel(s).`,
			)
		} catch {
			setNotice(
				"The campaign API did not respond. The editor remains available.",
			)
		}
	}
	const context: CampaignContext = { segments: segments.data ?? [] }
	const createForm = contextualKit.useForm(campaignDefinition, {
		defaultValues: newCampaign,
		context,
		onSubmit: ({ value }) => saveCampaign(value, "create"),
	})
	const editForm = contextualKit.useForm(campaignDefinition, {
		defaultValues: savedCampaign,
		context,
		onSubmit: ({ value }) => saveCampaign(value, "edit"),
	})

	if (draft.isPending || segments.isPending)
		return (
			<section className="form-please-complex">
				Loading campaign builder…
			</section>
		)
	if (draft.isError || segments.isError)
		return (
			<section className="form-please-complex">
				Could not load campaign resources.
			</section>
		)
	let form = createForm
	let submitLabel = "Create campaign"
	if (mode === "edit") {
		form = editForm
		submitLabel = "Update campaign"
	}
	let status = notice
	if (createCampaign.isPending || updateCampaign.isPending) {
		status = "Saving campaign…"
	}
	const values = form.api.watch()
	const channels = Object.entries(values.audience.channels)
		.filter(([, selected]) => selected)
		.map(([channel]) => channel)

	return (
		<section
			aria-label="Campaign builder example"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">
				Seven-template campaign builder
			</p>
			<p className="form-please-complex__summary">
				One shared audience and schedule model drives seven distinct payload
				branches, conditional quantities, payment variants, and create/edit
				mutations.
			</p>
			<fieldset className="form-please-complex__mode">
				<legend>Editor mode</legend>
				<button
					aria-pressed={mode === "edit"}
					onClick={() => setMode("edit")}
					type="button"
				>
					Edit loaded draft
				</button>
				<button
					aria-pressed={mode === "create"}
					onClick={() => setMode("create")}
					type="button"
				>
					Start new campaign
				</button>
			</fieldset>
			<contextualKit.AutoForm
				className="form-please-complex__form"
				form={form}
				key={mode}
			>
				<div className="form-please-complex__actions">
					<contextualKit.Submit className="form-please-complex__primary">
						{submitLabel}
					</contextualKit.Submit>
					<span aria-live="polite">{status}</span>
				</div>
			</contextualKit.AutoForm>
			<aside
				aria-label="Campaign preview"
				className="form-please-complex__preview"
			>
				<strong>{values.name}</strong>
				<span>
					{values.template} · {channels.join(", ") || "no channels"}
				</span>
			</aside>
		</section>
	)
}

function paymentApplies(template: (typeof templateNames)[number]): boolean {
	return (
		template === "fundraiser" ||
		template === "course-drop" ||
		template === "product-launch"
	)
}

function fakeRequest<Value>(value: Value, delay: number): Promise<Value> {
	return new Promise((resolve) =>
		window.setTimeout(() => resolve(value), delay),
	)
}
