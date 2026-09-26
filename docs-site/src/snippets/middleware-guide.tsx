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
	(ui) => [
		ui.section("contact", {
			title: "Contact",
			columns: 2,
			children: [
				ui.field("contact.firstName", {
					control: "text",
					label: "First name",
				}),
				ui.field("contact.lastName", {
					control: "text",
					label: "Last name",
				}),
				ui.field("contact.role", {
					control: "text",
					label: "Role",
				}),
				ui.field("contact.email", {
					control: "text",
					label: "Email",
				}),
				ui.field("contact.phone", {
					control: "text",
					label: "Phone",
				}),
				ui.field("contact.timeZone", {
					control: "text",
					label: "Time zone",
				}),
			],
		}),
		ui.section("organization", {
			title: "Organization",
			columns: 2,
			children: [
				ui.field("organization.name", {
					control: "text",
					label: "Organization name",
				}),
				ui.field("organization.legalName", {
					control: "text",
					label: "Legal name",
				}),
				ui.field("organization.website", {
					control: "text",
					label: "Website",
				}),
				ui.field("organization.teamSize", {
					control: "text",
					label: "Team size",
				}),
				ui.field("organization.city", {
					control: "text",
					label: "City",
				}),
				ui.field("organization.country", {
					control: "text",
					label: "Country",
				}),
			],
		}),
		ui.section("project", {
			title: "Project",
			columns: 2,
			children: [
				ui.field("project.title", {
					control: "text",
					label: "Project title",
				}),
				ui.field("project.code", {
					control: "text",
					label: "Project code",
				}),
				ui.field("project.owner", {
					control: "text",
					label: "Project owner",
				}),
				ui.field("project.audience", {
					control: "text",
					label: "Audience",
				}),
				ui.field("project.launchDate", {
					control: "text",
					label: "Launch date",
				}),
				ui.field("project.successMeasure", {
					control: "text",
					label: "Success measure",
				}),
			],
		}),
	],
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
	(ui) => [
		ui.field("quantity", {
			control: "number",
			label: "Quantity",
			props: { min: 1, step: 1 },
		}),
		ui.field("unitPrice", {
			control: "number",
			label: "Unit price",
			props: { min: 0, step: 0.01 },
		}),
		ui.field("total", {
			control: "number",
			label: "Total",
			readOnly: true,
			props: { min: 0, step: 0.01 },
		}),
	],
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
	(ui) => [
		ui.field("discount", {
			control: "number",
			label: "Discount percentage",
			props: { min: 0, max: 100, step: 1 },
		}),
	],
	{ middleware: [guardDiscount] },
)

// [!region cancellation]
export function CancellationMiddlewarePreview() {
	const [decision, setDecision] = useState("No managed update yet.")
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
				Managed updates above 30% are cancelled. A raw RHF update bypasses the
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
						Try 40% as a managed update
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
