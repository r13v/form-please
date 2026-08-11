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
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

import { type QueryResourceState, queryToResource } from "./query-to-resource"

const studioPolicySchema = z
	.object({
		access: z.object({
			earlyEnabled: z.boolean(),
			earlyFrom: z.string().optional(),
			earlyFee: z.number().min(0).optional(),
			lateEnabled: z.boolean(),
			lateUntil: z.string().optional(),
			lateFee: z.number().min(0).optional(),
		}),
		safeguard: z.object({
			depositRequired: z.boolean(),
			amount: z.number().min(0).optional(),
			currency: z.enum(["USD", "EUR", "GBP"]),
		}),
		youth: z.object({
			policy: z.enum(["all-ages", "sixteen-plus", "adults-only"]),
			guardianRequired: z.boolean(),
			quietHours: z.string().optional(),
		}),
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
		connectivity: z.object({
			mode: z.enum(["included", "request", "offline"]),
			minimumMbps: z.number().int().min(1).optional(),
		}),
		animals: z.object({
			policy: z.enum(["assistance-only", "approval", "not-allowed"]),
			notes: z.string().optional(),
		}),
	})
	.superRefine((value, context) => {
		if (value.access.earlyEnabled && value.access.earlyFrom === undefined) {
			context.addIssue({
				code: "custom",
				path: ["access", "earlyFrom"],
				message: "Set the earliest access time",
			})
		}
		if (value.access.lateEnabled && value.access.lateUntil === undefined) {
			context.addIssue({
				code: "custom",
				path: ["access", "lateUntil"],
				message: "Set the latest departure time",
			})
		}
		if (value.safeguard.depositRequired && (value.safeguard.amount ?? 0) < 50) {
			context.addIssue({
				code: "custom",
				path: ["safeguard", "amount"],
				message: "Deposits start at 50",
			})
		}
		if (value.youth.policy === "all-ages" && !value.youth.guardianRequired) {
			context.addIssue({
				code: "custom",
				path: ["youth", "guardianRequired"],
				message: "All-ages sessions require a guardian policy",
			})
		}
		if (
			value.connectivity.mode === "included" &&
			(value.connectivity.minimumMbps ?? 0) < 25
		) {
			context.addIssue({
				code: "custom",
				path: ["connectivity", "minimumMbps"],
				message: "Published connectivity must be at least 25 Mbps",
			})
		}
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
		earlyEnabled: true,
		earlyFrom: "08:00",
		earlyFee: 35,
		lateEnabled: false,
		lateUntil: undefined,
		lateFee: undefined,
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

const policyDefinition = contextualKit.defineForm(studioPolicySchema, {
	ui: [
		{
			kind: "section",
			id: "access",
			title: "Access windows",
			description: "Opening exceptions carry their own times and fees.",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "access.earlyEnabled",
					control: "checkbox",
					label: "Allow early access",
				},
				{
					kind: "field",
					path: "access.earlyFrom",
					control: "time",
					label: "Earliest arrival",
					visible: (values) => values.access.earlyEnabled,
					options: { step: 900 },
				},
				{
					kind: "field",
					path: "access.earlyFee",
					control: "number",
					label: "Early access fee",
					visible: (values) => values.access.earlyEnabled,
					options: { min: 0, step: 5 },
				},
				{
					kind: "field",
					path: "access.lateEnabled",
					control: "checkbox",
					label: "Allow late departure",
				},
				{
					kind: "field",
					path: "access.lateUntil",
					control: "time",
					label: "Latest departure",
					visible: (values) => values.access.lateEnabled,
					options: { step: 900 },
				},
				{
					kind: "field",
					path: "access.lateFee",
					control: "number",
					label: "Late departure fee",
					visible: (values) => values.access.lateEnabled,
					options: { min: 0, step: 5 },
				},
			],
		},
		{
			kind: "section",
			id: "safeguards",
			title: "Safeguards and age policy",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "safeguard.depositRequired",
					control: "checkbox",
					label: "Hold a refundable deposit",
				},
				{
					kind: "field",
					path: "safeguard.amount",
					control: "number",
					label: "Deposit amount",
					visible: (values) => values.safeguard.depositRequired,
					options: { min: 0, step: 25 },
				},
				{
					kind: "field",
					path: "safeguard.currency",
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
					path: "youth.policy",
					control: "select",
					label: "Age policy",
					options: {
						options: [
							{ value: "all-ages", label: "All ages" },
							{ value: "sixteen-plus", label: "16 and older" },
							{ value: "adults-only", label: "Adults only" },
						],
					},
				},
				{
					kind: "field",
					path: "youth.guardianRequired",
					control: "checkbox",
					label: "Require a guardian for minors",
					visible: (values) => values.youth.policy !== "adults-only",
				},
				{
					kind: "field",
					path: "youth.quietHours",
					control: "textarea",
					label: "Quiet-hours rule",
					span: "full",
					options: { rows: 3 },
				},
			],
		},
		{
			kind: "array",
			path: "equipment",
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
			children: [
				{
					kind: "field",
					path: "assetId",
					control: "select",
					label: "Equipment",
					options: fromResource((_values, { context }) => context.equipment, {
						pending: (_state, _values, { context }) => ({
							options: context.savedEquipmentOptions,
						}),
						success: ({ value }) => ({ options: value }),
						error: (_state, _values, { context }) => ({
							options: context.savedEquipmentOptions,
						}),
					}),
				},
				{
					kind: "field",
					path: "mandatoryBriefing",
					control: "checkbox",
					label: "Briefing required",
				},
				{
					kind: "field",
					path: "replacementValue",
					control: "number",
					label: "Replacement value",
					options: { min: 0, step: 50 },
				},
			],
		},
		{
			kind: "section",
			id: "shared-services",
			title: "Shared services",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "refreshments.allowed",
					control: "checkbox",
					label: "Allow catered refreshments",
				},
				{
					kind: "field",
					path: "refreshments.cateringNoticeHours",
					control: "number",
					label: "Catering notice in hours",
					visible: (values) => values.refreshments.allowed,
					options: { min: 0, step: 1 },
				},
				{
					kind: "field",
					path: "connectivity.mode",
					control: "select",
					label: "Connectivity",
					options: {
						options: [
							{ value: "included", label: "Included" },
							{ value: "request", label: "Available by request" },
							{ value: "offline", label: "Offline space" },
						],
					},
				},
				{
					kind: "field",
					path: "connectivity.minimumMbps",
					control: "number",
					label: "Published minimum Mbps",
					visible: (values) => values.connectivity.mode === "included",
					options: { min: 1, step: 5 },
				},
				{
					kind: "field",
					path: "animals.policy",
					control: "select",
					label: "Animal access",
					options: {
						options: [
							{ value: "assistance-only", label: "Assistance animals only" },
							{ value: "approval", label: "With prior approval" },
							{ value: "not-allowed", label: "Not allowed" },
						],
					},
				},
				{
					kind: "field",
					path: "animals.notes",
					control: "textarea",
					label: "Animal access notes",
					visible: (values) => values.animals.policy === "approval",
					options: { rows: 3 },
				},
			],
		},
	],
})

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
		Number(values.access.earlyEnabled) + Number(values.access.lateEnabled)
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
