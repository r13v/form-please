// @jsx: react-jsx
"use client"

import type {
	DeepReadonly,
	FieldPath,
	FormBinding,
	FormInput,
	StandardSchema,
} from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { type FieldValues, useWatch } from "react-hook-form"
import { z } from "zod"

export type WorkflowStep<
	Input extends FieldValues,
	Screen extends string,
> = Readonly<{
	/** Stable application screen identifier. */
	screen: Screen
	/** User-facing progress label. */
	label: string
	/** Schema input paths validated before this screen can be left. */
	paths: readonly FieldPath<Input>[]
	/** Includes the screen only while the current input satisfies this condition. */
	when?: (input: DeepReadonly<Input>) => boolean
}>

type WorkflowInput<Schema extends StandardSchema> = Extract<
	FormInput<Schema>,
	FieldValues
>

type UseFormWorkflowOptions<
	Schema extends StandardSchema,
	Context,
	Screen extends string,
> = Readonly<{
	form: FormBinding<Schema, Context>
	screen: Screen
	setScreen(screen: NoInfer<Screen>): void
	steps: readonly WorkflowStep<WorkflowInput<Schema>, Screen>[]
}>

/**
 * Application-owned workflow navigation over one Form Please binding.
 * The Standard Schema remains the only validation contract.
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
	type Input = WorkflowInput<Schema>
	type Path = FieldPath<Input>

	const input = useWatch({ control: form.api.control }) as Input
	const pendingFocus = useRef<Readonly<{
		path: Path
		screen: Screen
	}> | null>(null)
	const visibleSteps = steps.filter(
		(step) => step.when?.(input as DeepReadonly<Input>) ?? true,
	)
	const currentIndex = visibleSteps.findIndex((step) => step.screen === screen)
	const currentStep = visibleSteps[currentIndex]

	useEffect(() => {
		const pending = pendingFocus.current
		if (pending === null || pending.screen !== screen) return
		pendingFocus.current = null
		form.api.setFocus(pending.path)
	}, [form, screen])

	function focusInvalid(step: WorkflowStep<Input, Screen>, path: Path) {
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

	async function validateStep(
		step: WorkflowStep<Input, Screen>,
	): Promise<boolean> {
		if (step.paths.length === 0) return true
		touch(step.paths)
		const valid = await form.api.trigger([...step.paths])
		if (valid) return true

		const firstInvalid = step.paths.find(
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
		const paths = [...new Set(visibleSteps.flatMap((step) => step.paths))]
		if (paths.length === 0) return true
		touch(paths)
		const valid = await form.api.trigger(paths)
		if (valid) return true

		for (const step of visibleSteps) {
			const firstInvalid = step.paths.find(
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

const onboardingSchema = z
	.object({
		name: z.string().min(1, "Enter a name"),
		email: z.email("Enter a valid email"),
		organization: z.boolean(),
		organizationName: z.string(),
		department: z.string().min(1, "Enter a department"),
	})
	.superRefine((input, context) => {
		if (input.organization && input.organizationName.trim() === "") {
			context.addIssue({
				code: "custom",
				message: "Enter the organization name",
				path: ["organizationName"],
			})
		}
	})

type OnboardingInput = FormInput<typeof onboardingSchema>
type OnboardingScreen = "identity" | "organization" | "details" | "review"
type OnboardingContext = { readonly screen: OnboardingScreen }

const identityPaths = [
	"name",
	"email",
	"organization",
] as const satisfies readonly FieldPath<OnboardingInput>[]
const organizationPaths = [
	"organizationName",
] as const satisfies readonly FieldPath<OnboardingInput>[]
const detailPaths = [
	"department",
] as const satisfies readonly FieldPath<OnboardingInput>[]

const onboardingSteps = [
	{ screen: "identity", label: "Identity", paths: identityPaths },
	{
		screen: "organization",
		label: "Organization",
		paths: organizationPaths,
		when: (input) => input.organization,
	},
	{ screen: "details", label: "Details", paths: detailPaths },
	{ screen: "review", label: "Review", paths: [] },
] satisfies readonly WorkflowStep<OnboardingInput, OnboardingScreen>[]

const onboardingKit = nativeFormKit.forContext<OnboardingContext>()
const onboardingDefinition = onboardingKit.defineForm(onboardingSchema, {
	ui: [
		{
			kind: "field",
			path: "name",
			control: "text",
			label: "Name",
			visible: (_input, { context }) =>
				context.screen === "identity" || context.screen === "review",
		},
		{
			kind: "field",
			path: "email",
			control: "text",
			label: "Email",
			options: { type: "email" },
			visible: (_input, { context }) =>
				context.screen === "identity" || context.screen === "review",
		},
		{
			kind: "field",
			path: "organization",
			control: "checkbox",
			label: "I represent an organization",
			visible: (_input, { context }) =>
				context.screen === "identity" || context.screen === "review",
		},
		{
			kind: "field",
			path: "organizationName",
			control: "text",
			label: "Organization name",
			visible: (input, { context }) =>
				input.organization &&
				(context.screen === "organization" || context.screen === "review"),
		},
		{
			kind: "field",
			path: "department",
			control: "text",
			label: "Department",
			visible: (_input, { context }) =>
				context.screen === "details" || context.screen === "review",
		},
	],
})

export function ProductWorkflowRecipe() {
	const [screen, setScreen] = useState<OnboardingScreen>("identity")
	const [status, setStatus] = useState("Complete the current screen.")
	const context = useMemo(() => ({ screen }), [screen])
	const form = onboardingKit.useForm(onboardingDefinition, {
		context,
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
			<onboardingKit.Submit name="intent" value="publish">
				Publish
			</onboardingKit.Submit>
		)
	}

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
			<onboardingKit.AutoForm form={form}>
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
			</onboardingKit.AutoForm>
			<output aria-live="polite">{status}</output>
		</section>
	)
}
