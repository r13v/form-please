import type {
	PlaygroundDiagnostic,
	TypecheckRequest,
	TypecheckResponse,
} from "./playground-typecheck-protocol"

type Pending =
	| Readonly<{
			kind: "diagnostics"
			resolve: (value: readonly PlaygroundDiagnostic[]) => void
	  }>
	| Readonly<{ kind: "quick-info"; resolve: (value: string | null) => void }>

export class TypecheckClient {
	readonly ready: Promise<void>
	readonly #pending = new Map<number, Pending>()
	readonly #worker: Worker
	#nextId = 1

	constructor() {
		this.#worker = new Worker(
			new URL("./playground-typecheck.worker.ts", import.meta.url),
			{ type: "module" },
		)
		this.ready = new Promise((resolve, reject) => {
			this.#worker.addEventListener("error", (event) => {
				reject(new Error(event.message || "The type checker failed to start."))
			})
			this.#worker.addEventListener(
				"message",
				(event: MessageEvent<TypecheckResponse>) => {
					if (event.data.type === "ready") resolve()
				},
				{ once: true },
			)
		})
		this.#worker.addEventListener(
			"message",
			(event: MessageEvent<TypecheckResponse>) => {
				const response = event.data
				if (response.type === "ready") return
				const pending = this.#pending.get(response.requestId)
				if (pending === undefined) return
				this.#pending.delete(response.requestId)
				if (response.type === "diagnostics" && pending.kind === "diagnostics") {
					pending.resolve(response.diagnostics)
				}
				if (response.type === "quick-info" && pending.kind === "quick-info") {
					pending.resolve(response.text)
				}
			},
		)
	}

	check(source: string): Promise<readonly PlaygroundDiagnostic[]> {
		return new Promise((resolve) => {
			const requestId = this.#nextId++
			this.#pending.set(requestId, { kind: "diagnostics", resolve })
			this.#send({ type: "check", requestId, source })
		})
	}

	quickInfo(position: number): Promise<string | null> {
		return new Promise((resolve) => {
			const requestId = this.#nextId++
			this.#pending.set(requestId, { kind: "quick-info", resolve })
			this.#send({ type: "quick-info", requestId, position })
		})
	}

	terminate(): void {
		this.#worker.terminate()
		this.#pending.clear()
	}

	#send(request: TypecheckRequest): void {
		this.#worker.postMessage(request)
	}
}
