"use client"

import { createContext, useContext } from "react"
import type { RuntimeForm } from "./form-kit-types.js"

/** Provides private form runtime data to generated components. */
export const FormContext = createContext<RuntimeForm | null>(null)
/** Provides the current native form ID to generated components. */
export const FormIdContext = createContext<string | null>(null)

/** Reads private form data from the current generated form context. */
export function useRuntimeForm(): RuntimeForm {
	const form = useContext(FormContext)
	if (form === null) {
		throw new Error("React Hook Form context is missing")
	}
	return form
}

/** Reads the native form ID from the current generated form context. */
export function useFormId(): string {
	const id = useContext(FormIdContext)
	if (id === null) {
		throw new Error("React Hook Form id context is missing")
	}
	return id
}
