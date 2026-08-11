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
	type FormBinding,
	type FormInput,
	type FormOutput,
	type UiNode,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

const benefitSchema = z.object({
	label: z.string().min(2, "Describe the benefit"),
	monthlyLimit: z.number().int().min(0),
})

const tierSchema = z.object({
	discountPercent: z.number().min(0).max(80),
	benefits: z.array(benefitSchema).min(1, "Add at least one benefit"),
})

const membershipSchema = z
	.object({
		programName: z.string().min(4, "Name the membership program"),
		billingCycle: z.enum(["monthly", "quarterly", "annual"]),
		workspaceId: z.string().min(1, "Choose a workspace"),
		connection: z.object({
			enabled: z.boolean(),
			syncExistingMembers: z.boolean(),
		}),
		tiers: z.object({
			seed: tierSchema,
			sprout: tierSchema,
			canopy: tierSchema,
			founder: tierSchema,
		}),
		pauseWindows: z.array(
			z.object({
				startsOn: z.string().min(1, "Choose a start date"),
				endsOn: z.string().min(1, "Choose an end date"),
				reason: z.string().min(3, "Explain the pause"),
			}),
		),
	})
	.superRefine((value, context) => {
		const ladder = [
			value.tiers.seed.discountPercent,
			value.tiers.sprout.discountPercent,
			value.tiers.canopy.discountPercent,
			value.tiers.founder.discountPercent,
		]
		for (let index = 1; index < ladder.length; index += 1) {
			if ((ladder[index] ?? 0) < (ladder[index - 1] ?? 0)) {
				context.addIssue({
					code: "custom",
					path: ["tiers"],
					message: "Higher tiers cannot offer a smaller reduction",
				})
				break
			}
		}
		for (const [index, window] of value.pauseWindows.entries()) {
			if (window.endsOn < window.startsOn) {
				context.addIssue({
					code: "custom",
					path: ["pauseWindows", index, "endsOn"],
					message: "The pause must end after it starts",
				})
			}
		}
	})
	.transform((value) => ({
		...value,
		benefitCount: Object.values(value.tiers).reduce(
			(total, tier) => total + tier.benefits.length,
			0,
		),
	}))

type MembershipInput = FormInput<typeof membershipSchema>
type MembershipOutput = FormOutput<typeof membershipSchema>
type MembershipContext = {
	readonly workspaces: readonly {
		readonly value: string
		readonly label: string
	}[]
}

const membershipDraft = {
	programName: "Common Ground Membership",
	billingCycle: "monthly",
	workspaceId: "commons-hub",
	connection: { enabled: false, syncExistingMembers: true },
	tiers: {
		seed: {
			discountPercent: 0,
			benefits: [{ label: "Monthly community digest", monthlyLimit: 1 }],
		},
		sprout: {
			discountPercent: 8,
			benefits: [{ label: "Open desk sessions", monthlyLimit: 2 }],
		},
		canopy: {
			discountPercent: 15,
			benefits: [{ label: "Project consultations", monthlyLimit: 1 }],
		},
		founder: {
			discountPercent: 22,
			benefits: [{ label: "Private program previews", monthlyLimit: 4 }],
		},
	},
	pauseWindows: [
		{
			startsOn: "2027-08-01",
			endsOn: "2027-08-14",
			reason: "Annual maintenance",
		},
	],
} satisfies MembershipInput

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const contextualKit = kit.forContext<MembershipContext>()
type MembershipForm = FormBinding<typeof membershipSchema, MembershipContext>

function PauseCalendar({
	form,
	count,
}: {
	readonly form: MembershipForm
	readonly count: number
}) {
	const addPause = (pause: MembershipInput["pauseWindows"][number]) => {
		form.api.setValue(
			"pauseWindows",
			[...form.api.getValues("pauseWindows"), pause],
			{ shouldDirty: true },
		)
	}
	return (
		<section
			className="form-please-complex__embedded"
			aria-label="Pause calendar shortcuts"
		>
			<strong>Calendar shortcuts</strong>
			<div className="form-please-complex__choice-list">
				<button
					onClick={() =>
						addPause({
							startsOn: "2027-12-24",
							endsOn: "2027-12-31",
							reason: "Winter closure",
						})
					}
					type="button"
				>
					Add winter closure
				</button>
				<button
					onClick={() =>
						addPause({
							startsOn: "2028-04-10",
							endsOn: "2028-04-12",
							reason: "System migration",
						})
					}
					type="button"
				>
					Add migration window
				</button>
				<span>{count} pause window(s) scheduled</span>
			</div>
		</section>
	)
}

function WorkspaceConnection({
	form,
	workspaceId,
	connected,
}: {
	readonly form: MembershipForm
	readonly workspaceId: string
	readonly connected: boolean
}) {
	const mutation = useMutation({
		mutationFn: (nextConnected: boolean) =>
			fakeRequest({ workspaceId, connected: nextConnected }, 360),
	})
	let connectionStatus = "Workspace disconnected"
	let actionLabel = "Connect"
	if (connected) {
		connectionStatus = "Workspace connected"
		actionLabel = "Disconnect"
	}
	if (mutation.isPending) actionLabel = "Updating connection…"

	return (
		<section
			className="form-please-complex__embedded"
			aria-label="Workspace connection"
		>
			<strong>{connectionStatus}</strong>
			<button
				disabled={mutation.isPending}
				onClick={async () => {
					const result = await mutation.mutateAsync(!connected)
					form.api.setValue("connection.enabled", result.connected)
				}}
				type="button"
			>
				{actionLabel}
			</button>
		</section>
	)
}

const membershipDefinition = contextualKit.defineForm(membershipSchema, {
	ui: [
		{
			kind: "section",
			id: "program",
			title: "Membership program",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "programName",
					control: "text",
					label: "Program name",
				},
				{
					kind: "field",
					path: "billingCycle",
					control: "select",
					label: "Billing cycle",
					options: {
						options: [
							{ value: "monthly", label: "Monthly" },
							{ value: "quarterly", label: "Quarterly" },
							{ value: "annual", label: "Annual" },
						],
					},
				},
				{
					kind: "field",
					path: "workspaceId",
					control: "select",
					label: "Member workspace",
					options: (_values, { context }) => ({
						options: context.workspaces,
					}),
				},
				{
					kind: "field",
					path: "connection.syncExistingMembers",
					control: "checkbox",
					label: "Sync existing members",
				},
			],
		},
		...tierSections(),
		{
			kind: "array",
			path: "pauseWindows",
			label: "Pause windows",
			description:
				"Dates can be entered directly or added from calendar shortcuts.",
			itemDefault: { startsOn: "", endsOn: "", reason: "" },
			children: [
				{ kind: "field", path: "startsOn", control: "date", label: "Starts" },
				{ kind: "field", path: "endsOn", control: "date", label: "Ends" },
				{ kind: "field", path: "reason", control: "text", label: "Reason" },
			],
		},
	],
})

function tierSections() {
	return [
		{
			kind: "section",
			id: "tier-seed",
			title: "Seed tier",
			children: [
				{
					kind: "field",
					path: "tiers.seed.discountPercent",
					control: "number",
					label: "Reduction percent",
					options: { min: 0, max: 80, step: 1 },
				},
				{
					kind: "array",
					path: "tiers.seed.benefits",
					label: "Benefits",
					itemDefault: { label: "", monthlyLimit: 0 },
					children: [
						{
							kind: "field",
							path: "label",
							control: "text",
							label: "Benefit",
						},
						{
							kind: "field",
							path: "monthlyLimit",
							control: "number",
							label: "Monthly limit",
							options: { min: 0, step: 1 },
						},
					],
				},
			],
		},
		{
			kind: "section",
			id: "tier-sprout",
			title: "Sprout tier",
			children: [
				{
					kind: "field",
					path: "tiers.sprout.discountPercent",
					control: "number",
					label: "Reduction percent",
					options: { min: 0, max: 80, step: 1 },
				},
				{
					kind: "array",
					path: "tiers.sprout.benefits",
					label: "Benefits",
					itemDefault: { label: "", monthlyLimit: 0 },
					children: [
						{ kind: "field", path: "label", control: "text", label: "Benefit" },
						{
							kind: "field",
							path: "monthlyLimit",
							control: "number",
							label: "Monthly limit",
							options: { min: 0, step: 1 },
						},
					],
				},
			],
		},
		{
			kind: "section",
			id: "tier-canopy",
			title: "Canopy tier",
			children: [
				{
					kind: "field",
					path: "tiers.canopy.discountPercent",
					control: "number",
					label: "Reduction percent",
					options: { min: 0, max: 80, step: 1 },
				},
				{
					kind: "array",
					path: "tiers.canopy.benefits",
					label: "Benefits",
					itemDefault: { label: "", monthlyLimit: 0 },
					children: [
						{ kind: "field", path: "label", control: "text", label: "Benefit" },
						{
							kind: "field",
							path: "monthlyLimit",
							control: "number",
							label: "Monthly limit",
							options: { min: 0, step: 1 },
						},
					],
				},
			],
		},
		{
			kind: "section",
			id: "tier-founder",
			title: "Founder tier",
			children: [
				{
					kind: "field",
					path: "tiers.founder.discountPercent",
					control: "number",
					label: "Reduction percent",
					options: { min: 0, max: 80, step: 1 },
				},
				{
					kind: "array",
					path: "tiers.founder.benefits",
					label: "Benefits",
					itemDefault: { label: "", monthlyLimit: 0 },
					children: [
						{ kind: "field", path: "label", control: "text", label: "Benefit" },
						{
							kind: "field",
							path: "monthlyLimit",
							control: "number",
							label: "Monthly limit",
							options: { min: 0, step: 1 },
						},
					],
				},
			],
		},
	] satisfies readonly UiNode<
		MembershipInput,
		typeof contextualKit.controls,
		MembershipContext
	>[]
}

export function MembershipLadderExample() {
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	)
	return (
		<QueryClientProvider client={queryClient}>
			<MembershipLadderForm />
		</QueryClientProvider>
	)
}

function MembershipLadderForm() {
	const loadedDraft = useQuery({
		queryKey: ["membership-draft"],
		queryFn: () => fakeRequest(membershipDraft, 380),
	})
	const workspaces = useQuery({
		queryKey: ["member-workspaces"],
		queryFn: () =>
			fakeRequest(
				[
					{ value: "commons-hub", label: "Commons Hub" },
					{ value: "field-notes", label: "Field Notes Circle" },
					{ value: "makers-union", label: "Makers Union" },
				],
				460,
			),
	})
	const save = useMutation({
		mutationFn: (value: MembershipOutput) =>
			fakeRequest({ revision: value.benefitCount + 500 }, 440),
	})
	const [notice, setNotice] = useState("Membership draft loaded.")
	const form = contextualKit.useForm(membershipDefinition, {
		defaultValues: membershipDraft,
		context: { workspaces: workspaces.data ?? [] },
		async onSubmit({ value }) {
			try {
				const result = await save.mutateAsync(value)
				setNotice(`Membership revision ${result.revision} saved.`)
			} catch {
				setNotice(
					"The membership service did not respond. Your edits remain local.",
				)
			}
		},
	})

	if (loadedDraft.isPending || workspaces.isPending)
		return (
			<section className="form-please-complex">
				Loading membership ladder…
			</section>
		)
	if (loadedDraft.isError || workspaces.isError)
		return (
			<section className="form-please-complex">
				Could not load the membership editor.
			</section>
		)
	let status = notice
	if (save.isPending) status = "Saving ladder…"
	const values = form.api.watch()

	return (
		<section
			aria-label="Membership ladder example"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Cascading four-tier editor</p>
			<p className="form-please-complex__summary">
				Four nested benefit arrays, monotonic reductions, a remote workspace
				connection, and calendar-assisted pause windows stay synchronized.
			</p>
			<contextualKit.AutoForm className="form-please-complex__form" form={form}>
				<WorkspaceConnection
					connected={values.connection.enabled}
					form={form}
					workspaceId={values.workspaceId}
				/>
				<aside
					aria-label="Membership ladder preview"
					className="form-please-complex__preview"
				>
					<strong>Reduction ladder</strong>
					<span>
						Seed {values.tiers.seed.discountPercent}% → Sprout{" "}
						{values.tiers.sprout.discountPercent}% → Canopy{" "}
						{values.tiers.canopy.discountPercent}% → Founder{" "}
						{values.tiers.founder.discountPercent}%
					</span>
				</aside>
				<PauseCalendar count={values.pauseWindows.length} form={form} />
				<div className="form-please-complex__actions">
					<contextualKit.Submit className="form-please-complex__primary">
						Save membership ladder
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
