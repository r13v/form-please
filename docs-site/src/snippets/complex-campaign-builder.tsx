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

// Fields that only some templates have. Each template selects its own entries.
const templateFields = {
	newsletter: z.object({
		subject: z.string().min(1, "Write the email subject").prefault(""),
		preheader: z.string().min(1, "Write the preheader").prefault(""),
	}),
	productLaunch: z.object({
		productName: z.string().min(1, "Name the product").prefault(""),
		sku: z.string().min(1, "Enter the catalog code").prefault(""),
		initialStock: z.number({ error: "Set the opening stock" }).int().min(0),
		releaseKind: z.enum(["limited", "general", "preorder"]),
	}),
	eventInvite: z.object({
		eventName: z.string().min(1, "Name the event").prefault(""),
		venue: z.string().min(1, "Enter the venue").prefault(""),
		capacity: z.number({ error: "Set capacity" }).int().min(1),
		requiresRegistration: z.boolean(),
	}),
	fundraiser: z.object({
		cause: z.string().min(1, "Describe the cause").prefault(""),
		goalAmount: z.number({ error: "Set the funding goal" }).min(1),
		suggestedContribution: z.number().min(1).optional(),
	}),
	courseDrop: z.object({
		courseTitle: z.string().min(1, "Name the course").prefault(""),
		seatLimit: z.number({ error: "Set the seat limit" }).int().min(1),
		certificateIncluded: z.boolean(),
	}),
	communityUpdate: z.object({
		topic: z.string().min(1, "Describe the update topic").prefault(""),
		moderator: z.string().min(1, "Name the moderator").prefault(""),
		responseWindowDays: z
			.number({ error: "Set the response window" })
			.int()
			.min(1),
	}),
	feedbackPulse: z.object({
		question: z.string().min(1, "Write the feedback question").prefault(""),
		responseLimit: z.number({ error: "Set the response limit" }).int().min(1),
		anonymous: z.boolean(),
	}),
	payment: z.discriminatedUnion("mode", [
		z.object({ mode: z.literal("free") }),
		z.object({
			mode: z.literal(["fixed", "flexible"]),
			amount: z
				.number({ error: "Set an amount for this payment model" })
				.min(1),
			currency: z.enum(["USD", "EUR", "GBP"], { error: "Choose a currency" }),
		}),
		z.object({
			mode: z.literal("recurring"),
			amount: z
				.number({ error: "Set an amount for this payment model" })
				.min(1),
			currency: z.enum(["USD", "EUR", "GBP"], { error: "Choose a currency" }),
			interval: z.enum(["monthly", "annual"], { error: "Choose an interval" }),
		}),
	]),
}

const campaignBase = z.object({
	id: z.string().optional(),
	name: z.string().min(4, "Name this campaign"),
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
})

const campaignSchema = z
	.discriminatedUnion("template", [
		campaignBase.extend({
			template: z.literal("newsletter"),
			newsletter: templateFields.newsletter,
		}),
		campaignBase.extend({
			template: z.literal("product-launch"),
			productLaunch: templateFields.productLaunch,
			payment: templateFields.payment,
		}),
		campaignBase.extend({
			template: z.literal("event-invite"),
			eventInvite: templateFields.eventInvite,
		}),
		campaignBase.extend({
			template: z.literal("fundraiser"),
			fundraiser: templateFields.fundraiser,
			payment: templateFields.payment,
		}),
		campaignBase.extend({
			template: z.literal("course-drop"),
			courseDrop: templateFields.courseDrop,
			payment: templateFields.payment,
		}),
		campaignBase.extend({
			template: z.literal("community-update"),
			communityUpdate: templateFields.communityUpdate,
		}),
		campaignBase.extend({
			template: z.literal("feedback-pulse"),
			feedbackPulse: templateFields.feedbackPulse,
		}),
	])
	.refine((value) => Object.values(value.audience.channels).some(Boolean), {
		message: "Choose at least one delivery channel",
		path: ["audience", "channels"],
	})
	.refine(
		({ audience, schedule }) =>
			audience.deliveryMode === "immediate" ||
			schedule.endsOn === undefined ||
			schedule.endsOn >= schedule.startsOn,
		{
			message: "The end date must follow the start date",
			path: ["schedule", "endsOn"],
		},
	)
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

// A starting draft for every template. Selects and checkboxes need a value
// when their section appears. The schema output keeps only the selected
// template.
const templateDrafts = {
	newsletter: {},
	productLaunch: { releaseKind: "general" },
	eventInvite: { requiresRegistration: true },
	fundraiser: {},
	courseDrop: { certificateIncluded: true },
	communityUpdate: {},
	feedbackPulse: { anonymous: true },
	payment: { mode: "free" },
} satisfies {
	readonly [Key in keyof typeof templateFields]: Partial<
		z.input<(typeof templateFields)[Key]>
	>
}

const newCampaign = {
	...templateDrafts,
	id: undefined,
	name: "New community campaign",
	template: "newsletter",
	audience: {
		segmentId: "active-members",
		deliveryMode: "scheduled",
		channels: { email: true, push: false, web: true },
	},
	schedule: { startsOn: "2027-03-10", endsOn: "2027-03-21" },
	newsletter: {
		subject: "What we are making this month",
		preheader: "Three new ways to take part",
	},
} satisfies CampaignInput

const savedCampaign = {
	...newCampaign,
	id: "campaign-204",
	name: "Spring material fund",
	template: "fundraiser",
	fundraiser: {
		cause: "Fund free access to the shared material library",
		goalAmount: 18_000,
		suggestedContribution: 35,
	},
	payment: { mode: "flexible", amount: 10, currency: "USD" },
} satisfies CampaignInput

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const contextualKit = kit.forContext<CampaignContext>()

const campaignDefinition = contextualKit.defineForm(campaignSchema, (ui) => [
	ui.section("campaign", {
		title: "Campaign foundation",
		columns: 2,
		children: [
			ui.field("name", {
				control: "text",
				label: "Campaign name",
				span: "full",
			}),
			ui.field("template", {
				control: "select",
				label: "Campaign template",
				options: [
					{ value: "newsletter", label: "Newsletter" },
					{ value: "product-launch", label: "Product launch" },
					{ value: "event-invite", label: "Event invitation" },
					{ value: "fundraiser", label: "Fundraiser" },
					{ value: "course-drop", label: "Course release" },
					{ value: "community-update", label: "Community update" },
					{ value: "feedback-pulse", label: "Feedback pulse" },
				],
			}),
			ui.field("audience.segmentId", {
				control: "select",
				label: "Audience segment",
				options: ({ context }) => context.segments,
			}),
			ui.field("audience.deliveryMode", {
				control: "select",
				label: "Delivery model",
				options: [
					{ value: "immediate", label: "Immediate" },
					{ value: "scheduled", label: "Scheduled window" },
					{ value: "rolling", label: "Rolling audience entry" },
				],
			}),
			ui.field("audience.channels.email", {
				control: "checkbox",
				label: "Email",
			}),
			ui.field("audience.channels.push", {
				control: "checkbox",
				label: "Push",
			}),
			ui.field("audience.channels.web", {
				control: "checkbox",
				label: "Web inbox",
			}),
			ui.field("schedule.startsOn", {
				control: "date",
				label: "Starts on",
			}),
			ui.field("schedule.endsOn", {
				control: "date",
				label: "Ends on",
				visible: (values) => values.audience.deliveryMode !== "immediate",
			}),
		],
	}),
	ui.section("newsletter", {
		title: "Newsletter content",
		columns: 2,
		visible: ({ template }) => template === "newsletter",
		children: [
			ui.field("newsletter.subject", {
				control: "text",
				label: "Subject",
			}),
			ui.field("newsletter.preheader", {
				control: "text",
				label: "Preheader",
			}),
		],
	}),
	ui.section("product-launch", {
		title: "Product launch",
		columns: 2,
		visible: ({ template }) => template === "product-launch",
		children: [
			ui.field("productLaunch.productName", {
				control: "text",
				label: "Product name",
			}),
			ui.field("productLaunch.sku", {
				control: "text",
				label: "Catalog code",
			}),
			ui.field("productLaunch.initialStock", {
				control: "number",
				label: "Opening stock",
				props: { min: 0, step: 1 },
			}),
			ui.field("productLaunch.releaseKind", {
				control: "select",
				label: "Release kind",
				options: [
					{ value: "limited", label: "Limited edition" },
					{ value: "general", label: "General release" },
					{ value: "preorder", label: "Preorder" },
				],
			}),
		],
	}),
	ui.section("event-invite", {
		title: "Event invitation",
		columns: 2,
		visible: ({ template }) => template === "event-invite",
		children: [
			ui.field("eventInvite.eventName", {
				control: "text",
				label: "Event name",
			}),
			ui.field("eventInvite.venue", {
				control: "text",
				label: "Venue",
			}),
			ui.field("eventInvite.capacity", {
				control: "number",
				label: "Capacity",
				props: { min: 1, step: 1 },
			}),
			ui.field("eventInvite.requiresRegistration", {
				control: "checkbox",
				label: "Registration required",
			}),
		],
	}),
	ui.section("fundraiser", {
		title: "Fundraiser",
		columns: 2,
		visible: ({ template }) => template === "fundraiser",
		children: [
			ui.field("fundraiser.cause", {
				control: "textarea",
				label: "Cause",
				span: "full",
				props: { rows: 3 },
			}),
			ui.field("fundraiser.goalAmount", {
				control: "number",
				label: "Goal amount",
				props: { min: 1, step: 100 },
			}),
			ui.field("fundraiser.suggestedContribution", {
				control: "number",
				label: "Suggested contribution",
				props: { min: 1, step: 5 },
			}),
		],
	}),
	ui.section("course-drop", {
		title: "Course release",
		columns: 2,
		visible: ({ template }) => template === "course-drop",
		children: [
			ui.field("courseDrop.courseTitle", {
				control: "text",
				label: "Course title",
			}),
			ui.field("courseDrop.seatLimit", {
				control: "number",
				label: "Seat limit",
				props: { min: 1, step: 1 },
			}),
			ui.field("courseDrop.certificateIncluded", {
				control: "checkbox",
				label: "Include certificate",
			}),
		],
	}),
	ui.section("community-update", {
		title: "Community update",
		columns: 2,
		visible: ({ template }) => template === "community-update",
		children: [
			ui.field("communityUpdate.topic", {
				control: "textarea",
				label: "Update topic",
				span: "full",
				props: { rows: 3 },
			}),
			ui.field("communityUpdate.moderator", {
				control: "text",
				label: "Moderator",
			}),
			ui.field("communityUpdate.responseWindowDays", {
				control: "number",
				label: "Response window in days",
				props: { min: 1, step: 1 },
			}),
		],
	}),
	ui.section("feedback-pulse", {
		title: "Feedback pulse",
		columns: 2,
		visible: ({ template }) => template === "feedback-pulse",
		children: [
			ui.field("feedbackPulse.question", {
				control: "textarea",
				label: "Question",
				span: "full",
				props: { rows: 3 },
			}),
			ui.field("feedbackPulse.responseLimit", {
				control: "number",
				label: "Response limit",
				props: { min: 1, step: 1 },
			}),
			ui.field("feedbackPulse.anonymous", {
				control: "checkbox",
				label: "Allow anonymous responses",
			}),
		],
	}),
	ui.section("payment", {
		title: "Payment model",
		columns: 2,
		visible: ({ template }) => paymentApplies(template),
		children: [
			ui.field("payment.mode", {
				control: "select",
				label: "Payment mode",
				options: [
					{ value: "free", label: "Free" },
					{ value: "fixed", label: "Fixed" },
					{ value: "flexible", label: "Flexible contribution" },
					{ value: "recurring", label: "Recurring" },
				],
			}),
			ui.field("payment.amount", {
				control: "number",
				label: "Amount",
				visible: (values) => paymentMode(values) !== "free",
				props: { min: 1, step: 1 },
			}),
			ui.field("payment.currency", {
				control: "select",
				label: "Currency",
				visible: (values) => paymentMode(values) !== "free",
				props: { emptyOption: { label: "Choose a currency", disabled: true } },
				options: [
					{ value: "USD", label: "USD" },
					{ value: "EUR", label: "EUR" },
					{ value: "GBP", label: "GBP" },
				],
			}),
			ui.field("payment.interval", {
				control: "select",
				label: "Recurring interval",
				visible: (values) => paymentMode(values) === "recurring",
				props: { emptyOption: { label: "Choose an interval", disabled: true } },
				options: [
					{ value: "monthly", label: "Monthly" },
					{ value: "annual", label: "Annual" },
				],
			}),
		],
	}),
])

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

function paymentApplies(template: CampaignInput["template"]): boolean {
	return (
		template === "fundraiser" ||
		template === "course-drop" ||
		template === "product-launch"
	)
}

function paymentMode(values: CampaignInput) {
	if ("payment" in values) return values.payment.mode
	return "free"
}

function fakeRequest<Value>(value: Value, delay: number): Promise<Value> {
	return new Promise((resolve) =>
		window.setTimeout(() => resolve(value), delay),
	)
}
