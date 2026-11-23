// @jsx: react-jsx
"use client"

import type { FormBinding, StandardSchema } from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { useEffect, useRef, useState } from "react"
import { useWatch } from "react-hook-form"
import { z } from "zod"

export type WorkflowStep<Screen extends string> = Readonly<{
	/** Stable application screen identifier. */
	screen: Screen
	/** User-facing progress label. */
	label: string
	/** The definition node that the screen renders; review screens have none. */
	node?: string
}>

type UseFormWorkflowOptions<
	Schema extends StandardSchema,
	Context,
	Screen extends string,
> = Readonly<{
	form: FormBinding<Schema, Context>
	screen: Screen
	setScreen(screen: NoInfer<Screen>): void
	steps: readonly WorkflowStep<Screen>[]
}>

/**
 * Application-owned workflow navigation over one Form, Please binding.
 * The definition owns the paths and the visibility of each screen, and the
 * Standard Schema remains the only validation contract.
 */
export function useFormWorkflow<
	Schema extends StandardSchema,
	Context,
	Screen extends string,
>({
	form,
	screen,
	setScreen,
	steps,
}: UseFormWorkflowOptions<Schema, Context, Screen>) {
	type Path = ReturnType<typeof form.fieldPaths>[number]

	// Render again after each value change, so the visible steps stay current.
	useWatch({ control: form.api.control })
	const pendingFocus = useRef<Readonly<{
		path: Path
		screen: Screen
	}> | null>(null)
	function stepPaths(step: WorkflowStep<Screen>): Path[] {
		if (step.node === undefined) return []
		return form.fieldPaths(step.node)
	}
	// A step with a node is visible while its node shows at least one field.
	const visibleSteps = steps.filter(
		(step) => step.node === undefined || stepPaths(step).length > 0,
	)
	const currentIndex = visibleSteps.findIndex((step) => step.screen === screen)
	const currentStep = visibleSteps[currentIndex]

	useEffect(() => {
		const pending = pendingFocus.current
		if (pending === null || pending.screen !== screen) return
		pendingFocus.current = null
		form.api.setFocus(pending.path)
	}, [form, screen])

	function focusInvalid(step: WorkflowStep<Screen>, path: Path) {
		if (step.screen === screen) {
			form.api.setFocus(path)
			return
		}
		pendingFocus.current = { path, screen: step.screen }
		setScreen(step.screen)
	}

	function touch(paths: readonly Path[]) {
		for (const path of paths) {
			form.api.setValue(path, form.api.getValues(path), { shouldTouch: true })
		}
	}

	async function validateStep(step: WorkflowStep<Screen>): Promise<boolean> {
		const paths = stepPaths(step)
		if (paths.length === 0) return true
		touch(paths)
		const valid = await form.api.trigger(paths)
		if (valid) return true

		const firstInvalid = paths.find(
			(path) => form.api.getFieldState(path).invalid,
		)
		if (firstInvalid !== undefined) focusInvalid(step, firstInvalid)
		return false
	}

	async function validateCurrent(): Promise<boolean> {
		if (currentStep === undefined) return false
		return validateStep(currentStep)
	}

	async function next(): Promise<boolean> {
		if (currentStep === undefined || !(await validateStep(currentStep))) {
			return false
		}
		const nextStep = visibleSteps[currentIndex + 1]
		if (nextStep === undefined) return false
		setScreen(nextStep.screen)
		return true
	}

	function back(): boolean {
		const previousStep = visibleSteps[currentIndex - 1]
		if (previousStep === undefined) return false
		setScreen(previousStep.screen)
		return true
	}

	async function validateAllAndFocusFirstInvalid(): Promise<boolean> {
		const paths = visibleSteps.flatMap(stepPaths)
		if (paths.length === 0) return true
		touch(paths)
		const valid = await form.api.trigger(paths)
		if (valid) return true

		for (const step of visibleSteps) {
			const firstInvalid = stepPaths(step).find(
				(path) => form.api.getFieldState(path).invalid,
			)
			if (firstInvalid !== undefined) {
				focusInvalid(step, firstInvalid)
				break
			}
		}
		return false
	}

	const total = visibleSteps.length
	let current = 0
	if (currentIndex >= 0) current = currentIndex + 1
	let percent = 0
	if (total > 0) percent = Math.round((current / total) * 100)

	return {
		back,
		currentStep,
		next,
		progress: {
			current,
			percent,
			total,
		},
		validateAllAndFocusFirstInvalid,
		validateCurrent,
		visibleSteps,
	} as const
}

const onboardingBase = z.object({
	name: z.string().min(1, "Enter a name"),
	email: z.email("Enter a valid email"),
	department: z.string().min(1, "Enter a department"),
})

const onboardingSchema = z.discriminatedUnion("organization", [
	onboardingBase.extend({ organization: z.literal(false) }),
	onboardingBase.extend({
		organization: z.literal(true),
		organizationName: z
			.string()
			.trim()
			.min(1, "Enter the organization name")
			.prefault(""),
	}),
])

type OnboardingScreen = "identity" | "organization" | "details" | "review"

const onboardingSteps = [
	{ screen: "identity", label: "Identity", node: "identity" },
	{ screen: "organization", label: "Organization", node: "organization" },
	{ screen: "details", label: "Details", node: "details" },
	{ screen: "review", label: "Review" },
] satisfies readonly WorkflowStep<OnboardingScreen>[]

const onboardingDefinition = nativeFormKit.defineForm(
	onboardingSchema,
	(ui) => [
		ui.section("identity", {
			children: [
				ui.field("name", { control: "text", label: "Name" }),
				ui.field("email", {
					control: "text",
					label: "Email",
					props: { type: "email" },
				}),
				ui.field("organization", {
					control: "checkbox",
					label: "I represent an organization",
				}),
			],
		}),
		ui.section("organization", {
			visible: (input) => input.organization,
			children: [
				ui.field("organizationName", {
					control: "text",
					label: "Organization name",
				}),
			],
		}),
		ui.section("details", {
			children: [
				ui.field("department", { control: "text", label: "Department" }),
			],
		}),
	],
)

export function ProductWorkflowRecipe() {
	const [screen, setScreen] = useState<OnboardingScreen>("identity")
	const [status, setStatus] = useState("Complete the current screen.")
	const form = nativeFormKit.useForm(onboardingDefinition, {
		defaultValues: {
			name: "",
			email: "",
			organization: true,
			organizationName: "",
			department: "",
		},
		readOnly: screen === "review",
		onSubmit: ({ value }) => {
			setStatus(`Published ${value.name}.`)
		},
	})
	const workflow = useFormWorkflow({
		form,
		screen,
		setScreen,
		steps: onboardingSteps,
	})

	let actions = (
		<button type="button" onClick={() => void workflow.next()}>
			Continue
		</button>
	)
	if (screen === "details") {
		actions = (
			<>
				<button type="button" onClick={() => form.api.setValue("name", "")}>
					Clear identity name
				</button>
				<button
					type="button"
					onClick={async () => {
						if (await workflow.validateAllAndFocusFirstInvalid()) {
							setScreen("review")
						}
					}}
				>
					Review
				</button>
			</>
		)
	}
	if (screen === "review") {
		actions = (
			<button
				type="button"
				onClick={async () => {
					const result = await form.submit()
					if (!result.accepted && result.reason === "invalid") {
						await workflow.validateAllAndFocusFirstInvalid()
					}
				}}
			>
				Publish
			</button>
		)
	}

	// A review screen renders every field; other screens render their node.
	const node = workflow.currentStep?.node
	let fields = <nativeFormKit.Fields />
	if (node !== undefined) fields = <nativeFormKit.Fields node={node} />

	return (
		<section
			aria-label="Product workflow recipe preview"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Product workflow</p>
			<p className="form-please-complex__summary">
				{workflow.currentStep?.label ?? "Unavailable screen"}. Step{" "}
				{workflow.progress.current} of {workflow.progress.total}.
			</p>
			<progress
				aria-label="Workflow progress"
				max={100}
				value={workflow.progress.percent}
			/>
			<nativeFormKit.Form form={form}>
				<nativeFormKit.ErrorSummary />
				{fields}
				<div className="form-please-complex__actions">
					<button
						disabled={workflow.progress.current <= 1}
						type="button"
						onClick={() => workflow.back()}
					>
						Back
					</button>
					{actions}
				</div>
			</nativeFormKit.Form>
			<output aria-live="polite">{status}</output>
		</section>
	)
}
