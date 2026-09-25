export type PlaygroundDiagnostic = Readonly<{
	code: number
	from: number
	message: string
	severity: "error" | "warning"
	to: number
}>

export type TypecheckRequest =
	| Readonly<{ type: "check"; requestId: number; source: string }>
	| Readonly<{ type: "quick-info"; requestId: number; position: number }>

export type TypecheckResponse =
	| Readonly<{ type: "ready" }>
	| Readonly<{
			type: "diagnostics"
			requestId: number
			diagnostics: readonly PlaygroundDiagnostic[]
	  }>
	| Readonly<{ type: "quick-info"; requestId: number; text: string | null }>
