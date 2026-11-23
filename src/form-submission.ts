import type { KeyboardEvent } from "react"
import type { FieldErrors, FieldValues, UseFormReturn } from "react-hook-form"
import type {
	FormAction,
	FormActionConfig,
	FormBinding,
	FormSubmission,
	FormSubmissionSnapshot,
	FormSubmitDetails,
	FormSubmitResult,
	UseFormOptions,
} from "./create-form-kit.js"
import { errorMessage } from "./error-codes.js"
import type { FormIssueStore } from "./form-issues.js"
import { cloneFormValue } from "./form-value.js"
import { fieldErrorsToIssues } from "./standard-schema-resolver.js"
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
	readonly focusErrorSummaryFallback: (errors: FieldErrors<FieldValues>) => void
	/** Reads whether the form option `disabled` is set. */
	readonly isDisabled: () => boolean
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

/** Private submission state of one form runtime. */
export type FormSubmissionRuntime = {
	readonly actions: Readonly<Record<string, FormAction>>
	readonly defaultAction: string | undefined
	readonly implicitAction: string | undefined
	readonly issues: FormIssueStore
	readonly store: FormSubmission
	readonly setIssues: FormBinding["setIssues"]
	/** Forgets stored issues and the last submission error after a form reset. */
	readonly reset: () => void
	/** Runs one action; native submit, `kit.Submit` and `form.submit` share it. */
	readonly submitAction: (
		name: string,
		submitter: FormSubmitDetails<AnyFormSchema>["submitter"],
	) => Promise<FormSubmitResult>
	readonly submit: FormBinding["submit"]
}

/** Fixes action names and creates the submission entry point of one form. */
export function createFormSubmissionRuntime({
	binding,
	form,
	getOptions,
	issues,
	options,
}: {
	readonly binding: FormBinding
	readonly form: SubmissionForm
	readonly getOptions: () => UseFormOptions<AnyFormSchema>
	readonly issues: FormIssueStore
	readonly options: UseFormOptions<AnyFormSchema>
}): FormSubmissionRuntime {
	if (options.actions !== undefined && options.onSubmit !== undefined) {
		throw new TypeError(
			errorMessage("FP201", "useForm accepts onSubmit or actions, not both"),
		)
	}
	const configured = options.actions
	const names = configured === undefined ? ["submit"] : Object.keys(configured)
	const implicitNames =
		configured === undefined
			? ["submit"]
			: names.filter((name) => configured[name]?.implicit === true)
	if (implicitNames.length > 1) {
		throw new TypeError(
			errorMessage("FP202", "useForm accepts at most one implicit action"),
		)
	}
	const actions = Object.freeze(
		Object.fromEntries(
			names.map((name) => [name, Object.freeze({ name, form: binding })]),
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
			throw new Error(
				errorMessage("FP203", `Form action "${name}" is no longer configured`),
			)
		}
		return action
	}

	const defaultAction = configured === undefined ? "submit" : undefined

	const submitAction = async (
		name: string,
		submitter: FormSubmitDetails<AnyFormSchema>["submitter"],
	): Promise<FormSubmitResult> => {
		if (form.isDisabled()) {
			return Object.freeze({
				accepted: false,
				action: name,
				reason: "disabled",
			})
		}
		if (snapshot.action !== null) {
			return Object.freeze({ accepted: false, action: name, reason: "pending" })
		}
		publish({ action: name, error: null })
		let result: FormSubmitResult = Object.freeze({
			accepted: true,
			action: name,
		})
		let error: FormSubmissionSnapshot["error"] = null
		const reject = (rejected: readonly FormIssue[]): void => {
			result = Object.freeze({
				accepted: false,
				action: name,
				reason: "invalid",
				issues: rejected,
			})
		}
		try {
			const action = readAction(name)
			const input = cloneFormValue(form.api.getValues())
			issues.replace("action", [])
			issues.replace("external", [])
			await form.api.handleSubmit(
				async (value) => {
					const actionIssues = ((await action.validate?.({ input, value })) ??
						[]) as readonly FormIssue[]
					if (actionIssues.length > 0) {
						issues.replace("action", actionIssues)
						form.focusIssue(true)
						reject(actionIssues)
						return
					}
					try {
						await action.onSubmit?.({
							form: binding,
							input,
							submitter,
							value,
						})
					} catch (rejection) {
						throw new SubmitHandlerRejection(rejection)
					}
				},
				(errors) => {
					reject(fieldErrorsToIssues(errors))
					setTimeout(() => {
						form.focusErrorSummaryFallback(errors)
					}, 0)
				},
			)()
		} catch (thrown) {
			if (!(thrown instanceof SubmitHandlerRejection)) throw thrown
			error = { value: thrown.value }
			result = Object.freeze({
				accepted: false,
				action: name,
				reason: "failed" as const,
				error: thrown.value,
			})
		} finally {
			publish({ action: null, error })
		}

		return result
	}

	return {
		actions,
		defaultAction,
		implicitAction: implicitNames[0],
		issues,
		store,
		reset() {
			issues.forget()
			if (snapshot.error !== null) publish({ error: null })
		},
		setIssues(nextIssues, setOptions) {
			issues.replace("external", nextIssues as readonly FormIssue[])
			if (snapshot.error !== null) publish({ error: null })
			if (setOptions?.focus !== undefined) {
				form.focusIssue(setOptions.focus)
			}
		},
		submitAction,
		submit: (async (action?: FormAction) => {
			if (action === undefined) {
				if (defaultAction === undefined) {
					throw new TypeError(
						errorMessage(
							"FP204",
							"form.submit requires an action when useForm configures actions",
						),
					)
				}
				return submitAction(defaultAction, null)
			}
			if (actions[action.name] !== action) {
				throw new TypeError(
					errorMessage("FP205", "form.submit requires an action of this form"),
				)
			}
			return submitAction(action.name, null)
		}) as FormBinding["submit"],
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
