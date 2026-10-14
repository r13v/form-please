import type { KeyboardEvent } from "react"
import type { FieldErrors, FieldValues, UseFormReturn } from "react-hook-form"
import type {
	FormAction,
	FormActionConfig,
	FormBinding,
	FormSubmission,
	FormSubmissionSnapshot,
	FormSubmitDetails,
	UseFormOptions,
} from "./create-form-kit.js"
import type { FormIssueStore } from "./form-issues.js"
import { cloneFormValue } from "./form-value.js"
import type { FormIssue, StandardSchema } from "./types.js"

/** A schema shape used when a concrete form schema is unknown. */
type AnyFormSchema = StandardSchema<FieldValues, unknown>

/** The runtime form capabilities that one submission or `setIssues` call uses. */
type SubmissionForm = {
	readonly api: Pick<
		UseFormReturn<FieldValues, unknown, unknown>,
		"getValues" | "handleSubmit"
	>
	/** Focuses an issue field after render, or the error summary. */
	readonly focusIssue: (target: string | true) => void
	/** Focuses the summary when React Hook Form did not focus an invalid input. */
	readonly focusErrorSummaryFallback: (
		errors: FieldErrors<FieldValues>,
		formElement: HTMLFormElement,
	) => void
}

/**
 * Carries an action `onSubmit` rejection through RHF `handleSubmit`. RHF tests
 * the rethrown value by truthiness, so the marker object keeps falsy rejections.
 */
class SubmitHandlerRejection {
	readonly value: unknown
	constructor(value: unknown) {
		this.value = value
	}
}

/** Private submission state shared by one binding and its runtime form. */
export type FormSubmissionRuntime = {
	readonly actions: Readonly<Record<string, FormAction>>
	readonly defaultAction: string | undefined
	readonly implicitAction: string | undefined
	readonly issues: FormIssueStore
	readonly store: FormSubmission
	readonly setIssues: FormBinding["setIssues"]
	readonly submitAction: (
		name: string,
		submitter: FormSubmitDetails<AnyFormSchema>["submitter"],
		formElement: HTMLFormElement,
	) => Promise<void>
}

/** Fixes action names and creates the submission entry point of one form. */
export function createFormSubmissionRuntime({
	getBinding,
	getForm,
	getOptions,
	issues,
	options,
}: {
	readonly getBinding: () => FormBinding
	readonly getForm: () => SubmissionForm
	readonly getOptions: () => UseFormOptions<AnyFormSchema>
	readonly issues: FormIssueStore
	readonly options: UseFormOptions<AnyFormSchema>
}): FormSubmissionRuntime {
	if (options.actions !== undefined && options.onSubmit !== undefined) {
		throw new TypeError("useForm accepts onSubmit or actions, not both")
	}
	const configured = options.actions
	const names = configured === undefined ? ["submit"] : Object.keys(configured)
	const implicitNames =
		configured === undefined
			? ["submit"]
			: names.filter((name) => configured[name]?.implicit === true)
	if (implicitNames.length > 1) {
		throw new TypeError("useForm accepts at most one implicit action")
	}
	const actions = Object.freeze(
		Object.fromEntries(
			names.map((name) => [
				name,
				Object.freeze({
					name,
					get form() {
						return getBinding()
					},
				}),
			]),
		),
	)

	let snapshot: FormSubmissionSnapshot = Object.freeze({
		action: null,
		error: null,
	})
	const listeners = new Set<() => void>()
	const publish = (next: Partial<FormSubmissionSnapshot>): void => {
		snapshot = Object.freeze({ ...snapshot, ...next })
		for (const listener of listeners) listener()
	}
	const store: FormSubmission = {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
	}

	const readAction = (
		name: string,
	): Partial<FormActionConfig<AnyFormSchema>> => {
		const current = getOptions()
		if (current.actions === undefined) return { onSubmit: current.onSubmit }
		const action = current.actions[name]
		if (action === undefined) {
			throw new Error(`Form action "${name}" is no longer configured`)
		}
		return action
	}

	return {
		actions,
		defaultAction: configured === undefined ? "submit" : undefined,
		implicitAction: implicitNames[0],
		issues,
		store,
		setIssues(nextIssues, setOptions) {
			issues.replace("external", nextIssues as readonly FormIssue[])
			if (snapshot.error !== null) publish({ error: null })
			if (setOptions?.focus !== undefined) {
				getForm().focusIssue(setOptions.focus)
			}
		},
		async submitAction(name, submitter, formElement) {
			if (snapshot.action !== null) return
			publish({ action: name, error: null })
			let error: FormSubmissionSnapshot["error"] = null
			try {
				const form = getForm()
				const action = readAction(name)
				const input = cloneFormValue(form.api.getValues())
				issues.replace("action", [])
				issues.replace("external", [])
				await form.api.handleSubmit(
					async (value) => {
						const actionIssues =
							(await action.validate?.({ input, value })) ?? []
						if (actionIssues.length > 0) {
							issues.replace("action", actionIssues as readonly FormIssue[])
							form.focusIssue(true)
							return
						}
						try {
							await action.onSubmit?.({
								form: getBinding(),
								input,
								submitter,
								value,
							})
						} catch (rejection) {
							throw new SubmitHandlerRejection(rejection)
						}
					},
					(errors) => {
						setTimeout(() => {
							form.focusErrorSummaryFallback(errors, formElement)
						}, 0)
					},
				)()
			} catch (thrown) {
				if (!(thrown instanceof SubmitHandlerRejection)) throw thrown
				error = { value: thrown.value }
			} finally {
				publish({ action: null, error })
			}
		},
	}
}

/** Input types where Enter requests implicit submission in HTML. */
const implicitSubmitInputTypes = new Set([
	"date",
	"datetime-local",
	"email",
	"month",
	"number",
	"password",
	"search",
	"tel",
	"text",
	"time",
	"url",
	"week",
])

/** Tests whether a key event requests implicit submission from a single-line field. */
export function isImplicitSubmitKey(
	event: KeyboardEvent<HTMLFormElement>,
): boolean {
	const target = event.target
	return (
		event.key === "Enter" &&
		!event.defaultPrevented &&
		!event.nativeEvent.isComposing &&
		target instanceof HTMLElement &&
		target.tagName === "INPUT" &&
		implicitSubmitInputTypes.has((target as HTMLInputElement).type)
	)
}

/** Reads the action of the `kit.Submit` button that submitted the form. */
export function submitterAction(event: Event): string | undefined {
	if (!("submitter" in event)) return undefined
	const { submitter } = event
	if (!(submitter instanceof HTMLElement)) return undefined
	return submitter.getAttribute("data-fp-action") ?? undefined
}

/** Captures the name and value of the native submit control. */
export function snapshotSubmitter(
	event: Event,
): FormSubmitDetails<AnyFormSchema>["submitter"] {
	if (!("submitter" in event)) return null
	const { submitter } = event
	if (
		typeof submitter !== "object" ||
		submitter === null ||
		!("name" in submitter) ||
		typeof submitter.name !== "string" ||
		!("value" in submitter) ||
		typeof submitter.value !== "string"
	) {
		return null
	}
	return Object.freeze({ name: submitter.name, value: submitter.value })
}
