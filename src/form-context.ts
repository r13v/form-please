"use client"

import { createContext, useContext } from "react"
import { errorMessage } from "./error-codes.js"
import type { FormRuntime } from "./form-runtime.js"

/** Provides private form runtime data to generated components. */
export const FormContext = createContext<FormRuntime | null>(null)
/** Provides the current native form ID to generated components. */
export const FormIdContext = createContext<string | null>(null)
/** Provides the values that `kit.Form` watches once for all its `kit.Fields`. */
export const FormValuesContext = createContext<unknown>(undefined)

/** Reads the native form ID from the current generated form context. */
export function useFormId(): string {
	const id = useContext(FormIdContext)
	if (id === null) {
		throw new Error(
			errorMessage("FP012", "React Hook Form id context is missing"),
		)
	}
	return id
}
