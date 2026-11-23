import { errorMessage } from "./error-codes.js"

/**
 * Marks the end of an exhaustive branch over a closed union. TypeScript reports
 * a missed member at the call site; the error covers untyped runtime input.
 */
export function assertNever(value: never, message: string): never {
	throw new TypeError(
		errorMessage("FP015", message.replace("%s", String(value))),
	)
}
