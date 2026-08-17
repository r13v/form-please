// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import type { DeepReadonly, FormMiddleware } from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { useState } from "react"
import { useWatch } from "react-hook-form"
import { z } from "zod"

const complexEditingSchema = z.object({
	contact: z.object({
		email: z.string(),
		firstName: z.string(),
		lastName: z.string(),
		phone: z.string(),
		role: z.string(),
		timeZone: z.string(),
	}),
	organization: z.object({
		city: z.string(),
		country: z.string(),
		legalName: z.string(),
		name: z.string(),
		teamSize: z.string(),
		website: z.string(),
	}),
	project: z.object({
		audience: z.string(),
		code: z.string(),
		launchDate: z.string(),
		owner: z.string(),
		successMeasure: z.string(),
		title: z.string(),
	}),
})

type ComplexEditingInput = z.input<typeof complexEditingSchema>

const passThroughEditing: FormMiddleware<ComplexEditingInput> =
	() => (next) => (transaction) =>
		next(transaction.patches)

const complexEditingDefinition = nativeFormKit.defineForm(
	complexEditingSchema,
	{
		ui: [
			{
				kind: "section",
				id: "contact",
				title: "Contact",
				columns: 2,
				children: [
					{
						kind: "field",
						path: "contact.firstName",
						control: "text",
						label: "First name",
					},
					{
						kind: "field",
						path: "contact.lastName",
						control: "text",
						label: "Last name",
					},
					{
						kind: "field",
						path: "contact.role",
						control: "text",
						label: "Role",
					},
					{
						kind: "field",
						path: "contact.email",
						control: "text",
						label: "Email",
					},
					{
						kind: "field",
						path: "contact.phone",
						control: "text",
						label: "Phone",
					},
					{
						kind: "field",
						path: "contact.timeZone",
						control: "text",
						label: "Time zone",
					},
				],
			},
			{
				kind: "section",
				id: "organization",
				title: "Organization",
				columns: 2,
				children: [
					{
						kind: "field",
						path: "organization.name",
						control: "text",
						label: "Organization name",
					},
					{
						kind: "field",
						path: "organization.legalName",
						control: "text",
						label: "Legal name",
					},
					{
						kind: "field",
						path: "organization.website",
						control: "text",
						label: "Website",
					},
					{
						kind: "field",
						path: "organization.teamSize",
						control: "text",
						label: "Team size",
					},
					{
						kind: "field",
						path: "organization.city",
						control: "text",
						label: "City",
					},
					{
						kind: "field",
						path: "organization.country",
						control: "text",
						label: "Country",
					},
				],
			},
			{
				kind: "section",
				id: "project",
				title: "Project",
				columns: 2,
				children: [
					{
						kind: "field",
						path: "project.title",
						control: "text",
						label: "Project title",
					},
					{
						kind: "field",
						path: "project.code",
						control: "text",
						label: "Project code",
					},
					{
						kind: "field",
						path: "project.owner",
						control: "text",
						label: "Project owner",
					},
					{
						kind: "field",
						path: "project.audience",
						control: "text",
						label: "Audience",
					},
					{
						kind: "field",
						path: "project.launchDate",
						control: "text",
						label: "Launch date",
					},
					{
						kind: "field",
						path: "project.successMeasure",
						control: "text",
						label: "Success measure",
					},
				],
			},
		],
	},
	{ middleware: [passThroughEditing] },
)

const initialComplexEditingValues = {
	contact: {
		email: "alex@example.com",
		firstName: "Alex",
		lastName: "Morgan",
		phone: "+1 555 0100",
		role: "Program manager",
		timeZone: "UTC-5",
	},
	organization: {
		city: "Montreal",
		country: "Canada",
		legalName: "Northstar Cooperative",
		name: "Northstar",
		teamSize: "24",
		website: "https://example.com",
	},
	project: {
		audience: "Community partners",
		code: "NORTH-26",
		launchDate: "2026-10-01",
		owner: "Alex Morgan",
		successMeasure: "50 active partners",
		title: "Partner workspace",
	},
} satisfies ComplexEditingInput

export function ComplexMiddlewareEditingPreview() {
	const form = nativeFormKit.useForm(complexEditingDefinition, {
		defaultValues: initialComplexEditingValues,
	})

	return (
		<section
			aria-label="Complex middleware editing preview"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Editing check</p>
			<p className="form-please-complex__summary">
				Type in any field. One pass-through middleware handles each generated
				change.
			</p>
			<nativeFormKit.Form className="form-please-complex__form" form={form}>
				<nativeFormKit.Fields />
			</nativeFormKit.Form>
		</section>
	)
}

const orderSchema = z.object({
	quantity: z.number().min(1),
	unitPrice: z.number().min(0),
	total: z.number().min(0),
})

type OrderInput = z.input<typeof orderSchema>

// [!region derived-value]
const keepOrderTotalCurrent: FormMiddleware<OrderInput> =
	() => (next) => (transaction) => {
		const total =
			Math.round(
				transaction.nextValues.quantity *
					transaction.nextValues.unitPrice *
					100,
			) / 100

		return next([
			...transaction.patches,
			{ op: "replace", path: ["total"], value: total },
		])
	}
// [!endregion derived-value]

const orderDefinition = nativeFormKit.defineForm(
	orderSchema,
	{
		ui: [
			{
				kind: "field",
				path: "quantity",
				control: "number",
				label: "Quantity",
				props: { min: 1, step: 1 },
			},
			{
				kind: "field",
				path: "unitPrice",
				control: "number",
				label: "Unit price",
				props: { min: 0, step: 0.01 },
			},
			{
				kind: "field",
				path: "total",
				control: "number",
				label: "Total",
				readOnly: true,
				props: { min: 0, step: 0.01 },
			},
		],
	},
	{ middleware: [keepOrderTotalCurrent] },
)

const initialOrder = {
	quantity: 2,
	total: 30,
	unitPrice: 15,
} satisfies OrderInput

// [!region derived-value-form]
export function DerivedTotalMiddlewarePreview() {
	const form = nativeFormKit.useForm(orderDefinition, {
		defaultValues: initialOrder,
	})
	const total = useWatch({ control: form.api.control, name: "total" })

	return (
		<section
			aria-label="Derived total middleware preview"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Live preview</p>
			<p className="form-please-complex__summary">
				Change a source field. The read-only total changes in the same managed
				commit.
			</p>
			<nativeFormKit.Form className="form-please-complex__form" form={form}>
				<nativeFormKit.Fields />
				<div className="form-please-complex__actions">
					<button
						onClick={() =>
							form.update((draft) => {
								draft.quantity = 10
								draft.unitPrice = 9
							})
						}
						type="button"
					>
						Apply bulk order
					</button>
					<output aria-live="polite">
						Committed total: ${total.toFixed(2)}
					</output>
				</div>
			</nativeFormKit.Form>
		</section>
	)
}
// [!endregion derived-value-form]

const discountSchema = z.object({
	discount: z.number().min(0).max(100),
})

type DiscountInput = z.input<typeof discountSchema>

type DiscountContext = {
	readonly maximum: number
	readonly report: (message: string) => void
}

const discountKit = nativeFormKit.forContext<DiscountContext>()
const guardDiscount: FormMiddleware<DiscountInput, DiscountContext> =
	() => (next) => (transaction) => {
		const discount = transaction.nextValues.discount
		if (discount > transaction.context.maximum) {
			transaction.context.report(`Cancelled ${discount}% discount.`)
			return
		}

		const result = next(transaction.patches)
		transaction.context.report(`Committed ${discount}% discount.`)
		return result
	}
const discountDefinition = discountKit.defineForm(
	discountSchema,
	{
		ui: [
			{
				kind: "field",
				path: "discount",
				control: "number",
				label: "Discount percentage",
				props: { min: 0, max: 100, step: 1 },
			},
		],
	},
	{ middleware: [guardDiscount] },
)

// [!region cancellation]
export function CancellationMiddlewarePreview() {
	const [decision, setDecision] = useState("No managed change yet.")
	const form = discountKit.useForm(discountDefinition, {
		context: { maximum: 30, report: setDecision },
		defaultValues: { discount: 10 },
	})
	const discount = useWatch({
		control: form.api.control,
		name: "discount",
	})

	return (
		<section
			aria-label="Cancellation middleware preview"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Live preview</p>
			<p className="form-please-complex__summary">
				Managed changes above 30% are cancelled. A raw RHF update bypasses the
				guard.
			</p>
			<discountKit.Form className="form-please-complex__form" form={form}>
				<discountKit.Fields />
				<div className="form-please-complex__actions">
					<button
						onClick={() =>
							form.update((draft) => {
								draft.discount = 40
							})
						}
						type="button"
					>
						Try 40% as a managed change
					</button>
					<button
						onClick={() => {
							form.api.setValue("discount", 40, { shouldDirty: true })
							setDecision("Raw form.api.setValue bypassed middleware.")
						}}
						type="button"
					>
						Set 40% through raw RHF
					</button>
				</div>
				<output aria-live="polite">
					Current value: {discount}%. {decision}
				</output>
			</discountKit.Form>
		</section>
	)
}
// [!endregion cancellation]

async function saveOrderAudit(
	_values: DeepReadonly<OrderInput>,
): Promise<void> {}

// [!region async-after-next]
const auditCommittedOrder: FormMiddleware<OrderInput> =
	() => (next) => async (transaction) => {
		const result = next(transaction.patches)
		await saveOrderAudit(transaction.nextValues)
		return result
	}

const orderMiddleware = [keepOrderTotalCurrent, auditCommittedOrder] as const
// [!endregion async-after-next]
