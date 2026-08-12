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
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useState } from "react"
import { z } from "zod"

const grantSchema = z
	.object({
		applicantKind: z.enum(["person", "collective"]),
		contact: z.object({
			name: z.string().min(2, "Enter the lead applicant's name"),
			email: z.string().email("Enter a valid email"),
		}),
		jurisdiction: z.enum(["local", "international"]),
		organization: z.object({
			path: z.enum(["registered", "forming"]).optional(),
			registryId: z.string().optional(),
			name: z.string().optional(),
			registrationCountry: z.string().optional(),
		}),
		project: z.object({
			stream: z.enum(["research", "public-program", "education"]),
			title: z.string().min(5, "Use a descriptive project title"),
			abstract: z.string().min(80, "Write at least 80 characters"),
			requestedFunds: z.number().min(1_000).max(250_000),
			durationMonths: z.number().int().min(1).max(36),
		}),
		payout: z.object({
			method: z.enum(["bank", "digital-wallet"]),
			bankAccount: z.string().optional(),
			walletHandle: z.string().optional(),
		}),
		reporting: z.object({
			status: z.enum(["registered", "exempt", "pending"]),
			reference: z.string().optional(),
		}),
		confirmAccuracy: z.boolean(),
	})
	.superRefine((value, context) => {
		if (value.applicantKind === "collective") {
			if (value.organization.path === undefined) {
				context.addIssue({
					code: "custom",
					path: ["organization", "path"],
					message: "Choose how the collective is represented",
				})
			}
			if (
				value.organization.path === "registered" &&
				value.organization.registryId === undefined
			) {
				context.addIssue({
					code: "custom",
					path: ["organization", "registryId"],
					message: "Select a registry record",
				})
			}
			if (
				value.organization.path === "forming" &&
				(value.organization.name ?? "").trim().length < 2
			) {
				context.addIssue({
					code: "custom",
					path: ["organization", "name"],
					message: "Enter the collective's working name",
				})
			}
		}

		if (
			value.payout.method === "bank" &&
			(value.payout.bankAccount ?? "").trim().length < 8
		) {
			context.addIssue({
				code: "custom",
				path: ["payout", "bankAccount"],
				message: "Enter a valid settlement account",
			})
		}
		if (
			value.payout.method === "digital-wallet" &&
			(value.payout.walletHandle ?? "").trim().length < 3
		) {
			context.addIssue({
				code: "custom",
				path: ["payout", "walletHandle"],
				message: "Enter a wallet handle",
			})
		}
		if (
			value.reporting.status === "registered" &&
			(value.reporting.reference ?? "").trim().length < 4
		) {
			context.addIssue({
				code: "custom",
				path: ["reporting", "reference"],
				message: "Enter the reporting reference",
			})
		}
		if (!value.confirmAccuracy) {
			context.addIssue({
				code: "custom",
				path: ["confirmAccuracy"],
				message: "Confirm the application before sending it",
			})
		}
	})
	.transform((value) => ({
		...value,
		project: {
			...value.project,
			abstract: value.project.abstract.trim(),
		},
		reviewKey: `${value.project.stream}:${value.project.durationMonths}`,
	}))

type GrantInput = FormInput<typeof grantSchema>
type GrantOutput = FormOutput<typeof grantSchema>

type RegistryRecord = {
	readonly id: string
	readonly name: string
	readonly country: string
}

const registry: readonly RegistryRecord[] = [
	{ id: "arc-104", name: "Open Field Assembly", country: "CA" },
	{ id: "arc-208", name: "Night School Cooperative", country: "DE" },
	{ id: "arc-319", name: "Public Signal Workshop", country: "NZ" },
]

const defaultValues = {
	applicantKind: "person",
	contact: { name: "Mina Park", email: "mina@example.test" },
	jurisdiction: "local",
	organization: {
		path: undefined,
		registryId: undefined,
		name: undefined,
		registrationCountry: undefined,
	},
	project: {
		stream: "research",
		title: "A public atlas of overlooked urban sounds",
		abstract:
			"We will record, annotate, and publish an accessible field archive with neighborhood listening sessions and an open teaching kit.",
		requestedFunds: 42_000,
		durationMonths: 9,
	},
	payout: {
		method: "bank",
		bankAccount: "SETTLE-482910",
		walletHandle: undefined,
	},
	reporting: { status: "pending", reference: undefined },
	confirmAccuracy: false,
} satisfies GrantInput

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
type GrantForm = FormBinding<typeof grantSchema>

function OrganizationFinder({
	form,
	selectedId,
}: {
	readonly form: GrantForm
	readonly selectedId: string | undefined
}) {
	const [search, setSearch] = useState("")
	const records = useQuery({
		queryKey: ["grant-registry", search],
		queryFn: () =>
			fakeRequest(
				registry.filter((record) =>
					record.name.toLowerCase().includes(search.trim().toLowerCase()),
				),
			),
		staleTime: 30_000,
	})
	return (
		<section
			className="form-please-complex__embedded"
			aria-label="Registry search"
		>
			<label>
				Search the independent registry
				<input
					onChange={(event) => setSearch(event.currentTarget.value)}
					placeholder="Try Open or School"
					type="search"
					value={search}
				/>
			</label>
			<div className="form-please-complex__choice-list">
				{records.isPending && <span>Checking records…</span>}
				{records.data?.map((record) => (
					<button
						aria-pressed={selectedId === record.id}
						key={record.id}
						onClick={() => {
							form.api.setValue("organization.registryId", record.id)
							form.api.setValue("organization.name", record.name)
							form.api.setValue(
								"organization.registrationCountry",
								record.country,
							)
						}}
						type="button"
					>
						{record.name} · {record.country}
					</button>
				))}
			</div>
		</section>
	)
}

const grantDefinition = kit.defineForm(grantSchema, {
	ui: [
		{
			kind: "section",
			id: "applicant",
			title: "Applicant",
			description: "Choose the legal path before entering dependent details.",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "applicantKind",
					control: "select",
					label: "Applying as",
					options: [
						{ value: "person", label: "An individual" },
						{ value: "collective", label: "A collective" },
					],
				},
				{
					kind: "field",
					path: "jurisdiction",
					control: "select",
					label: "Administrative scope",
					options: [
						{ value: "local", label: "Domestic" },
						{ value: "international", label: "Cross-border" },
					],
				},
				{
					kind: "field",
					path: "contact.name",
					control: "text",
					label: "Lead applicant",
					required: true,
				},
				{
					kind: "field",
					path: "contact.email",
					control: "text",
					label: "Contact email",
					props: { type: "email" },
					required: true,
				},
			],
		},
		{
			kind: "section",
			id: "collective",
			title: "Collective identity",
			visible: ({ applicantKind }) => applicantKind === "collective",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "organization.path",
					control: "select",
					label: "Representation",
					options: [
						{ value: "registered", label: "Registered collective" },
						{ value: "forming", label: "Collective in formation" },
					],
					props: {
						emptyOption: { label: "Choose a path", disabled: true },
					},
				},
				{
					kind: "field",
					path: "organization.registryId",
					control: "text",
					label: "Registry record ID",
					visible: (values) => values.organization.path === "registered",
					readOnly: true,
				},
				{
					kind: "field",
					path: "organization.name",
					control: "text",
					label: (values) => {
						if (values.organization.path === "registered")
							return "Registered name"
						return "Working name"
					},
					visible: (values) => values.organization.path !== undefined,
					readOnly: (values) => values.organization.path === "registered",
				},
				{
					kind: "field",
					path: "organization.registrationCountry",
					control: "text",
					label: "Registration country",
					visible: (values) => values.organization.path !== undefined,
					readOnly: (values) => values.organization.path === "registered",
				},
			],
		},
		{
			kind: "section",
			id: "project",
			title: "Proposed work",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "project.stream",
					control: "select",
					label: "Funding stream",
					options: [
						{ value: "research", label: "Independent research" },
						{ value: "public-program", label: "Public program" },
						{ value: "education", label: "Open education" },
					],
				},
				{
					kind: "field",
					path: "project.title",
					control: "text",
					label: "Project title",
					required: true,
				},
				{
					kind: "field",
					path: "project.abstract",
					control: "textarea",
					label: "Abstract",
					description:
						"At least 80 characters; this becomes the public summary.",
					span: "full",
					required: true,
					props: { rows: 5 },
				},
				{
					kind: "field",
					path: "project.requestedFunds",
					control: "number",
					label: "Requested funds",
					props: { min: 1_000, max: 250_000, step: 500 },
				},
				{
					kind: "field",
					path: "project.durationMonths",
					control: "number",
					label: "Duration in months",
					props: { min: 1, max: 36, step: 1 },
				},
			],
		},
		{
			kind: "section",
			id: "settlement",
			title: "Settlement and reporting",
			columns: 2,
			children: [
				{
					kind: "field",
					path: "payout.method",
					control: "select",
					label: "Disbursement route",
					options: [
						{ value: "bank", label: "Settlement account" },
						{ value: "digital-wallet", label: "Digital wallet" },
					],
				},
				{
					kind: "field",
					path: "payout.bankAccount",
					control: "text",
					label: "Settlement account",
					visible: (values) => values.payout.method === "bank",
				},
				{
					kind: "field",
					path: "payout.walletHandle",
					control: "text",
					label: "Wallet handle",
					visible: (values) => values.payout.method === "digital-wallet",
				},
				{
					kind: "field",
					path: "reporting.status",
					control: "select",
					label: "Reporting status",
					options: [
						{ value: "registered", label: "Registered" },
						{ value: "exempt", label: "Exempt" },
						{ value: "pending", label: "Pending" },
					],
				},
				{
					kind: "field",
					path: "reporting.reference",
					control: "text",
					label: "Reporting reference",
					visible: (values) => values.reporting.status === "registered",
				},
				{
					kind: "field",
					path: "confirmAccuracy",
					control: "checkbox",
					label: "I confirm that the application is accurate",
					span: "full",
				},
			],
		},
	],
})

export function ResearchGrantExample() {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { retry: false } },
			}),
	)

	return (
		<QueryClientProvider client={queryClient}>
			<ResearchGrantForm />
		</QueryClientProvider>
	)
}

function ResearchGrantForm() {
	const [receipt, setReceipt] = useState("No application sent yet.")
	const preview = useMutation({
		mutationFn: (value: GrantOutput) =>
			fakeRequest({ revision: value.reviewKey, accepted: true }, 420),
	})
	const send = useMutation({
		mutationFn: (value: GrantOutput) =>
			fakeRequest({ id: `grant-${value.project.durationMonths}-2048` }, 520),
	})
	const form = kit.useForm(grantDefinition, {
		defaultValues,
		async onSubmit({ value }) {
			try {
				await preview.mutateAsync(value)
				const result = await send.mutateAsync(value)
				setReceipt(`Application ${result.id} passed preview and was sent.`)
			} catch {
				setReceipt("The review service is unavailable. Your values are intact.")
			}
		},
	})
	let status = receipt
	if (send.isPending) status = "Sending application…"
	if (preview.isPending) status = "Building preview…"
	const values = form.api.watch()
	let finder = null
	if (values.organization.path === "registered") {
		finder = (
			<OrganizationFinder
				form={form}
				selectedId={values.organization.registryId}
			/>
		)
	}
	let applicantLabel = "Individual"
	if (values.applicantKind === "collective") applicantLabel = "Collective"

	return (
		<section
			aria-label="Research grant application example"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Branching application</p>
			<p className="form-please-complex__summary">
				Applicant identity, registry lookup, settlement route, reporting rules,
				and a two-request submission all share one typed form state.
			</p>
			<kit.AutoForm className="form-please-complex__form" form={form}>
				{finder}
				<aside
					aria-label="Application preview"
					className="form-please-complex__preview"
				>
					<strong>{values.project.title || "Untitled application"}</strong>
					<span>
						{applicantLabel}
						{" · "}${values.project.requestedFunds.toLocaleString()} ·{" "}
						{values.project.durationMonths} months
					</span>
				</aside>
				<div className="form-please-complex__actions">
					<kit.Submit className="form-please-complex__primary">
						Preview and send
					</kit.Submit>
					<span aria-live="polite">{status}</span>
				</div>
			</kit.AutoForm>
		</section>
	)
}

function fakeRequest<Value>(value: Value, delay = 280): Promise<Value> {
	return new Promise((resolve) =>
		window.setTimeout(() => resolve(value), delay),
	)
}
