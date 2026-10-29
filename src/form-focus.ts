import type { FieldErrors, FieldValues } from "react-hook-form"
import {
	formDiagnosticNow,
	hasFormDiagnosticSink,
	publishFormDiagnosticEvent,
} from "./diagnostics.js"
import type { RuntimeForm } from "./form-kit-types.js"
import { hasFieldError } from "./standard-schema-resolver.js"

/** Focuses the summary when React Hook Form did not focus an invalid input. */
export function focusErrorSummaryFallback(
	errors: FieldErrors<FieldValues>,
	formElement: HTMLFormElement,
	form: RuntimeForm,
): void {
	const activeElement = formElement.ownerDocument.activeElement
	if (activeElement instanceof HTMLElement) {
		for (const [path, input] of form.inputRefs) {
			if (
				(activeElement === input || input.contains(activeElement)) &&
				hasFieldError(errors, path)
			) {
				publishFocusDiagnostic(form, "field", path)
				return
			}
		}
		const fieldName = activeElement.getAttribute("name")
		if (fieldName !== null && hasFieldError(errors, fieldName)) {
			publishFocusDiagnostic(form, "field", fieldName)
			return
		}
		if (activeElement === form.errorSummaryRef.current) {
			publishFocusDiagnostic(form, "summary")
			return
		}
	}
	const summary = form.errorSummaryRef.current
	if (summary === null) {
		publishFocusDiagnostic(form, "unavailable")
		return
	}
	summary.focus()
	publishFocusDiagnostic(form, "summary")
}

/** Publishes the observed invalid-submit focus destination when requested. */
function publishFocusDiagnostic(
	form: RuntimeForm,
	target: "field" | "summary" | "unavailable",
	path?: string,
): void {
	if (!hasFormDiagnosticSink(form.diagnosticTarget)) return
	publishFormDiagnosticEvent(form.diagnosticTarget, {
		kind: "focus",
		...(path === undefined ? {} : { path }),
		target,
		time: formDiagnosticNow(),
	})
}

/** Focuses an issue field after render, or the error summary when it is unavailable. */
export function focusIssue(form: RuntimeForm, target: string | true): void {
	setTimeout(() => {
		const errors = form.api.formState.errors
		const paths =
			target === true
				? [...form.api.control._names.mount].filter((path) =>
						hasFieldError(errors, path),
					)
				: [target]
		for (const path of paths) {
			if (focusField(form, path)) return
		}
		form.errorSummaryRef.current?.focus()
	}, 0)
}

/** Focuses one registered field when it is enabled and visible. */
function focusField(form: RuntimeForm, path: string): boolean {
	const input = form.inputRefs.get(path)
	if (input?.matches(":disabled")) return false
	const document = form.formElement?.ownerDocument ?? globalThis.document
	const before = document.activeElement
	form.api.setFocus(path)
	const active = document.activeElement
	if (active === null || active === document.body) return false
	if (input !== undefined) return input === active || input.contains(active)
	return active !== before || active.getAttribute("name") === path
}
