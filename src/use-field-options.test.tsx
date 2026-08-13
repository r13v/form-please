"use client"

import { act, render, screen, waitFor } from "@testing-library/react"
import { Component, type ReactNode } from "react"
import { describe, expect, it } from "vitest"

import type { FieldOptionsResolver } from "./types.js"
import { useFieldOptions } from "./use-field-options.js"

describe("useFieldOptions", () => {
	it("returns static options without waiting for an effect", () => {
		render(<Harness context={{}} source={["DE", "FR"]} values={{}} />)
		expect(screen.getByTestId("options").textContent).toBe('["DE","FR"]')
	})

	it("tracks accessed values and context and ignores stale results", async () => {
		const requests: Array<{
			readonly key: string
			readonly signal: AbortSignal
			readonly result: Deferred<readonly string[]>
		}> = []
		const source: FieldOptionsResolver<
			string,
			{ readonly country: string; readonly unrelated: number },
			{ readonly locale: string }
		> = ({ values, context, signal }) => {
			const result = deferred<readonly string[]>()
			requests.push({
				key: `${values.country}:${context.locale}`,
				result,
				signal,
			})
			return result.promise
		}

		const view = render(
			<Harness
				context={{ locale: "en" }}
				source={source}
				values={{ country: "DE", unrelated: 0 }}
			/>,
		)
		await waitFor(() => expect(requests).toHaveLength(1))
		expect(requests[0]?.key).toBe("DE:en")

		view.rerender(
			<Harness
				context={{ locale: "en" }}
				source={source}
				values={{ country: "DE", unrelated: 1 }}
			/>,
		)
		expect(requests).toHaveLength(1)

		view.rerender(
			<Harness
				context={{ locale: "en" }}
				source={source}
				values={{ country: "FR", unrelated: 1 }}
			/>,
		)
		await waitFor(() => expect(requests).toHaveLength(2))
		expect(requests[0]?.signal.aborted).toBe(true)
		expect(screen.getByTestId("options").textContent).toBe("[]")

		await act(() => {
			requests[0]?.result.resolve(["stale"])
			return Promise.resolve()
		})
		expect(screen.getByTestId("options").textContent).toBe("[]")

		await act(() => {
			requests[1]?.result.resolve(["Paris"])
			return Promise.resolve()
		})
		await waitFor(() =>
			expect(screen.getByTestId("options").textContent).toBe('["Paris"]'),
		)

		view.rerender(
			<Harness
				context={{ locale: "fr" }}
				source={source}
				values={{ country: "FR", unrelated: 2 }}
			/>,
		)
		await waitFor(() => expect(requests).toHaveLength(3))
		expect(requests[2]?.key).toBe("FR:fr")
	})

	it("restarts when a dependency changes before it is read after await", async () => {
		const firstRead = deferred<void>()
		const calls: string[] = []
		const source: FieldOptionsResolver<
			string,
			{ readonly country: string }
		> = async ({ values }) => {
			if (calls.length === 0) await firstRead.promise
			calls.push(values.country)
			return [values.country]
		}
		const view = render(
			<Harness context={{}} source={source} values={{ country: "DE" }} />,
		)
		view.rerender(
			<Harness context={{}} source={source} values={{ country: "FR" }} />,
		)
		firstRead.resolve()

		await waitFor(() => expect(calls).toEqual(["DE", "FR"]))
		expect(screen.getByTestId("options").textContent).toBe('["FR"]')
	})

	it("falls back to an empty list when a resolver rejects", async () => {
		const source: FieldOptionsResolver<
			string,
			unknown,
			{ readonly fail: boolean }
		> = async ({ context }) => {
			if (context.fail) throw new Error("Unavailable")
			return ["available"]
		}
		const view = render(
			<Harness context={{ fail: false }} source={source} values={{}} />,
		)
		await waitFor(() =>
			expect(screen.getByTestId("options").textContent).toBe('["available"]'),
		)

		view.rerender(
			<Harness context={{ fail: true }} source={source} values={{}} />,
		)
		await waitFor(() =>
			expect(screen.getByTestId("options").textContent).toBe("[]"),
		)
	})

	it("restarts when a non-proxyable context value changes", async () => {
		const calls: string[] = []
		const source: FieldOptionsResolver<string, unknown, string> = ({
			context,
		}) => {
			calls.push(context)
			return [context]
		}
		const view = render(<Harness context="en" source={source} values={{}} />)

		await waitFor(() =>
			expect(screen.getByTestId("options").textContent).toBe('["en"]'),
		)
		view.rerender(<Harness context="fr" source={source} values={{}} />)

		await waitFor(() => expect(calls).toEqual(["en", "fr"]))
		expect(screen.getByTestId("options").textContent).toBe('["fr"]')
	})

	it("throws a contract error for every resolver result that is not an array", async () => {
		for (const result of [undefined, null, "DE", { 0: "DE", length: 1 }]) {
			const view = render(
				<TestErrorBoundary>
					<Harness context={{}} source={() => result} values={{}} />
				</TestErrorBoundary>,
			)
			expect((await screen.findByTestId("contract-error")).textContent).toBe(
				"Field options resolvers must return an array",
			)
			view.unmount()
		}
	})

	it("aborts the pending request when the field unmounts", async () => {
		let captured: AbortSignal | undefined
		const pending = deferred<readonly string[]>()
		const view = render(
			<Harness
				context={{}}
				source={({ signal }: { readonly signal: AbortSignal }) => {
					captured = signal
					return pending.promise
				}}
				values={{}}
			/>,
		)

		await waitFor(() => expect(captured).toBeDefined())
		expect(captured?.aborted).toBe(false)
		view.unmount()
		expect(captured?.aborted).toBe(true)

		await act(async () => {
			pending.resolve(["late"])
			await pending.promise
		})
	})

	it("unwraps tracked proxies from the resolved collection", async () => {
		const option = { code: "DE" }
		const values = { available: [option] }
		const source = ({ values: tracked }: { readonly values: typeof values }) =>
			Promise.resolve(tracked.available)

		function IdentityHarness() {
			const options = useFieldOptions(source, values, {})
			if (options.length === 0) return <output data-testid="identity" />
			return (
				<output data-testid="identity">
					{[
						options === values.available ? "same-array" : "copied-array",
						options[0] === option ? "raw-option" : "proxied-option",
					].join(",")}
				</output>
			)
		}

		render(<IdentityHarness />)
		await waitFor(() =>
			expect(screen.getByTestId("identity").textContent).toBe(
				"same-array,raw-option",
			),
		)
	})

	it("clears resolved options when the resolver changes", async () => {
		const next = deferred<readonly string[]>()
		const first: FieldOptionsResolver<string, unknown> = () => ["first"]
		const second: FieldOptionsResolver<string, unknown> = () => next.promise
		const view = render(<Harness context={{}} source={first} values={{}} />)

		await waitFor(() =>
			expect(screen.getByTestId("options").textContent).toBe('["first"]'),
		)
		view.rerender(<Harness context={{}} source={second} values={{}} />)
		await waitFor(() =>
			expect(screen.getByTestId("options").textContent).toBe("[]"),
		)
	})
})

function Harness({
	source,
	values,
	context,
}: {
	readonly source: unknown
	readonly values: unknown
	readonly context: unknown
}) {
	const options = useFieldOptions(source, values, context)
	return <output data-testid="options">{JSON.stringify(options)}</output>
}

class TestErrorBoundary extends Component<
	Readonly<{ children: ReactNode }>,
	Readonly<{ error?: Error }>
> {
	state: Readonly<{ error?: Error }> = {}

	static getDerivedStateFromError(error: Error): Readonly<{ error: Error }> {
		return { error }
	}

	render(): ReactNode {
		return this.state.error === undefined ? (
			this.props.children
		) : (
			<output data-testid="contract-error">{this.state.error.message}</output>
		)
	}
}

type Deferred<Value> = {
	readonly promise: Promise<Value>
	resolve(value: Value): void
}

function deferred<Value>(): Deferred<Value> {
	let resolve!: (value: Value) => void
	return {
		promise: new Promise<Value>((next) => {
			resolve = next
		}),
		resolve,
	}
}
