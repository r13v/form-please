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
	fromResource,
	matchResource,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

import { type QueryResourceState, queryToResource } from "./query-to-resource"

const currency = z.enum(["USD", "EUR", "GBP"])

const studioPolicySchema = z
	.object({
		access: z.object({
			early: z.discriminatedUnion("enabled", [
				z.object({ enabled: z.literal(false) }),
				z.object({
					enabled: z.literal(true),
					from: z.string().min(1, "Set the earliest access time").prefault(""),
					fee: z.number().min(0).optional(),
				}),
			]),
			late: z.discriminatedUnion("enabled", [
				z.object({ enabled: z.literal(false) }),
				z.object({
					enabled: z.literal(true),
					until: z
						.string()
						.min(1, "Set the latest departure time")
						.prefault(""),
					fee: z.number().min(0).optional(),
				}),
			]),
		}),
		safeguard: z.discriminatedUnion("depositRequired", [
			z.object({ depositRequired: z.literal(false), currency }),
			z.object({
				depositRequired: z.literal(true),
				amount: z.number().min(50, "Deposits start at 50").prefault(0),
				currency,
			}),
		]),
		youth: z.discriminatedUnion("policy", [
			z.object({
				policy: z.literal("all-ages"),
				guardianRequired: z.literal(
					true,
					"All-ages sessions require a guardian policy",
				),
				quietHours: z.string().optional(),
			}),
			z.object({
				policy: z.enum(["sixteen-plus", "adults-only"]),
				guardianRequired: z.boolean(),
				quietHours: z.string().optional(),
			}),
		]),
		equipment: z
			.array(
				z.object({
					assetId: z.string().min(1, "Choose equipment"),
					mandatoryBriefing: z.boolean(),
					replacementValue: z.number().min(0),
				}),
			)
			.min(1, "Add at least one equipment rule"),
		refreshments: z.object({
			allowed: z.boolean(),
			cateringNoticeHours: z.number().int().min(0).optional(),
		}),
		connectivity: z.discriminatedUnion("mode", [
			z.object({
				mode: z.literal("included"),
				minimumMbps: z
					.number()
					.int()
					.min(25, "Published connectivity must be at least 25 Mbps")
					.prefault(0),
			}),
			z.object({ mode: z.enum(["request", "offline"]) }),
		]),
		animals: z.object({
			policy: z.enum(["assistance-only", "approval", "not-allowed"]),
			notes: z.string().optional(),
		}),
	})
	.transform((value) => ({
		...value,
		equipmentReplacementTotal: value.equipment.reduce(
			(total, item) => total + item.replacementValue,
			0,
		),
	}))

type StudioPolicyInput = FormInput<typeof studioPolicySchema>
type StudioPolicyOutput = FormOutput<typeof studioPolicySchema>

type EquipmentOption = { readonly value: string; readonly label: string }
type PolicyContext = {
	readonly equipment: QueryResourceState<readonly EquipmentOption[], Error>
	readonly savedEquipmentOptions: readonly EquipmentOption[]
}

const baseline = {
	access: {
		early: { enabled: true, from: "08:00", fee: 35 },
		late: { enabled: false },
	},
	safeguard: { depositRequired: true, amount: 300, currency: "USD" },
	youth: {
		policy: "sixteen-plus",
		guardianRequired: false,
		quietHours: "After 20:00, amplified audio must remain below 75 dB.",
	},
	equipment: [
		{
			assetId: "lighting-grid",
			mandatoryBriefing: true,
			replacementValue: 900,
		},
	],
	refreshments: { allowed: true, cateringNoticeHours: 48 },
	connectivity: { mode: "included", minimumMbps: 200 },
	animals: { policy: "assistance-only", notes: undefined },
} satisfies StudioPolicyInput

const savedEquipmentOptions: readonly EquipmentOption[] = [
	{ value: "lighting-grid", label: "Lighting grid" },
]

const equipmentCatalog: readonly EquipmentOption[] = [
	...savedEquipmentOptions,
	{ value: "ceramic-kiln", label: "Ceramic kiln" },
	{ value: "audio-console", label: "Audio console" },
	{ value: "laser-cutter", label: "Laser cutter" },
]

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const contextualKit = kit.forContext<PolicyContext>()

const policyDefinition = contextualKit.defineForm(studioPolicySchema, (ui) => [
	ui.section("access", {
		title: "Access windows",
		description: "Opening exceptions carry their own times and fees.",
		columns: 2,
		children: [
			ui.field("access.early.enabled", {
				control: "checkbox",
				label: "Allow early access",
			}),
			ui.field("access.early.from", {
				control: "time",
				label: "Earliest arrival",
				visible: (values) => values.access.early.enabled,
				props: { step: 900 },
			}),
			ui.field("access.early.fee", {
				control: "number",
				label: "Early access fee",
				visible: (values) => values.access.early.enabled,
				props: { min: 0, step: 5 },
			}),
			ui.field("access.late.enabled", {
				control: "checkbox",
				label: "Allow late departure",
			}),
			ui.field("access.late.until", {
				control: "time",
				label: "Latest departure",
				visible: (values) => values.access.late.enabled,
				props: { step: 900 },
			}),
			ui.field("access.late.fee", {
				control: "number",
				label: "Late departure fee",
				visible: (values) => values.access.late.enabled,
				props: { min: 0, step: 5 },
			}),
		],
	}),
	ui.section("safeguards", {
		title: "Safeguards and age policy",
		columns: 2,
		children: [
			ui.field("safeguard.depositRequired", {
				control: "checkbox",
				label: "Hold a refundable deposit",
			}),
			ui.field("safeguard.amount", {
				control: "number",
				label: "Deposit amount",
				visible: (values) => values.safeguard.depositRequired,
				props: { min: 0, step: 25 },
			}),
			ui.field("safeguard.currency", {
				control: "select",
				label: "Currency",
				options: [
					{ value: "USD", label: "USD" },
					{ value: "EUR", label: "EUR" },
					{ value: "GBP", label: "GBP" },
				],
			}),
			ui.field("youth.policy", {
				control: "select",
				label: "Age policy",
				options: [
					{ value: "all-ages", label: "All ages" },
					{ value: "sixteen-plus", label: "16 and older" },
					{ value: "adults-only", label: "Adults only" },
				],
			}),
			ui.field("youth.guardianRequired", {
				control: "checkbox",
				label: "Require a guardian for minors",
				visible: (values) => values.youth.policy !== "adults-only",
			}),
			ui.field("youth.quietHours", {
				control: "textarea",
				label: "Quiet-hours rule",
				span: "full",
				props: { rows: 3 },
			}),
		],
	}),
	ui.array("equipment", {
		label: "Equipment rules",
		description: fromResource((_values, { context }) => context.equipment, {
			pending: () => "Loading the equipment catalog…",
			success: ({ refresh }) => {
				switch (refresh.status) {
					case "pending":
						return "Refreshing the catalog; saved options remain available."
					case "paused":
						return "Catalog refresh paused; saved options remain available."
					case "error":
						return "Catalog refresh failed; saved options remain available."
					case "idle":
						return "RHF keeps stable row keys while indexed paths move."
				}
			},
			error: () =>
				"The equipment catalog is unavailable; existing rules are preserved.",
		}),
		disabled: fromResource((_values, { context }) => context.equipment, {
			pending: () => true,
			success: () => false,
			error: () => true,
		}),
		itemDefault: {
			assetId: "",
			mandatoryBriefing: false,
			replacementValue: 0,
		},
		children: (equipment) => [
			equipment.field("assetId", {
				control: "select",
				label: "Equipment",
				options: ({ context }) =>
					matchResource(context.equipment, {
						pending: () => context.savedEquipmentOptions,
						success: ({ value }) => value,
						error: () => context.savedEquipmentOptions,
					}),
			}),
			equipment.field("mandatoryBriefing", {
				control: "checkbox",
				label: "Briefing required",
			}),
			equipment.field("replacementValue", {
				control: "number",
				label: "Replacement value",
				props: { min: 0, step: 50 },
			}),
		],
	}),
	ui.section("shared-services", {
		title: "Shared services",
		columns: 2,
		children: [
			ui.field("refreshments.allowed", {
				control: "checkbox",
				label: "Allow catered refreshments",
			}),
			ui.field("refreshments.cateringNoticeHours", {
				control: "number",
				label: "Catering notice in hours",
				visible: (values) => values.refreshments.allowed,
				props: { min: 0, step: 1 },
			}),
			ui.field("connectivity.mode", {
				control: "select",
				label: "Connectivity",
				options: [
					{ value: "included", label: "Included" },
					{ value: "request", label: "Available by request" },
					{ value: "offline", label: "Offline space" },
				],
			}),
			ui.field("connectivity.minimumMbps", {
				control: "number",
				label: "Published minimum Mbps",
				visible: (values) => values.connectivity.mode === "included",
				props: { min: 1, step: 5 },
			}),
			ui.field("animals.policy", {
				control: "select",
				label: "Animal access",
				options: [
					{ value: "assistance-only", label: "Assistance animals only" },
					{ value: "approval", label: "With prior approval" },
					{ value: "not-allowed", label: "Not allowed" },
				],
			}),
			ui.field("animals.notes", {
				control: "textarea",
				label: "Animal access notes",
				visible: (values) => values.animals.policy === "approval",
				props: { rows: 3 },
			}),
		],
	}),
])

export function StudioPoliciesExample() {
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	)

	return (
		<QueryClientProvider client={queryClient}>
			<StudioPoliciesForm />
		</QueryClientProvider>
	)
}

function StudioPoliciesForm() {
	const policies = useQuery({
		queryKey: ["studio-policy-baseline"],
		queryFn: () => fakeRequest(baseline, 360),
	})
	const equipment = useQuery({
		queryKey: ["studio-equipment-catalog"],
		queryFn: () => fakeRequest(equipmentCatalog, 510),
	})
	const equipmentResource = queryToResource(equipment)
	const saveRules = useMutation({
		mutationFn: (value: StudioPolicyOutput) =>
			fakeRequest({ revision: value.equipmentReplacementTotal + 17 }, 430),
	})
	const publishSummary = useMutation({
		mutationFn: (value: StudioPolicyOutput) =>
			fakeRequest({ equipmentCount: value.equipment.length }, 330),
	})
	const [notice, setNotice] = useState("No changes published yet.")
	const form = contextualKit.useForm(policyDefinition, {
		defaultValues: baseline,
		context: { equipment: equipmentResource, savedEquipmentOptions },
		async onSubmit({ value }) {
			try {
				const saved = await saveRules.mutateAsync(value)
				const published = await publishSummary.mutateAsync(value)
				setNotice(
					`Revision ${saved.revision} published with ${published.equipmentCount} equipment rule(s).`,
				)
			} catch {
				setNotice("Publishing failed; the draft is still editable.")
			}
		},
	})

	if (policies.isPending) {
		return (
			<section className="form-please-complex" aria-live="polite">
				Loading policy baseline…
			</section>
		)
	}
	if (policies.isError) {
		return (
			<section className="form-please-complex">
				Could not load the policy editor.
			</section>
		)
	}
	let status = notice
	if (saveRules.isPending || publishSummary.isPending) {
		status = "Publishing two resources…"
	}
	const values = form.api.watch()
	const accessOptions =
		Number(values.access.early.enabled) + Number(values.access.late.enabled)
	const restrictedEquipment = values.equipment.filter(
		(item) => item.mandatoryBriefing,
	).length
	let deposit = 0
	if (
		values.safeguard.depositRequired &&
		values.safeguard.amount !== undefined
	) {
		deposit = values.safeguard.amount
	}

	return (
		<section
			aria-label="Creative studio policies example"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Composite policy editor</p>
			<p className="form-please-complex__summary">
				A loaded baseline and an independent catalog feed one definition;
				conditional policy groups and a reorderable equipment matrix are
				published to two endpoints.
			</p>
			<contextualKit.AutoForm className="form-please-complex__form" form={form}>
				<aside
					aria-label="Policy balance"
					className="form-please-complex__preview"
				>
					<strong>Live policy balance</strong>
					<span>
						{accessOptions} access exception(s) · {restrictedEquipment} briefing
						rule(s) · {deposit} held as safeguard
					</span>
				</aside>
				<div className="form-please-complex__actions">
					<contextualKit.Submit className="form-please-complex__primary">
						Publish policies
					</contextualKit.Submit>
					<span aria-live="polite">{status}</span>
				</div>
			</contextualKit.AutoForm>
		</section>
	)
}

function fakeRequest<Value>(value: Value, delay: number): Promise<Value> {
	return new Promise((resolve) =>
		window.setTimeout(() => resolve(value), delay),
	)
}
