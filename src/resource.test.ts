import { describe, expect, it } from "vitest"

import { fromResource, matchResource } from "./resource.js"

describe("resource helpers", () => {
	it("matches every resource branch", () => {
		const cases = {
			pending: () => "loading",
			success: ({ value }: { readonly value: number }) => value * 2,
			error: ({ error }: { readonly error: Error }) => error.message,
		}

		expect(matchResource({ status: "pending" }, cases)).toBe("loading")
		expect(matchResource({ status: "success", value: 21 }, cases)).toBe(42)
		expect(
			matchResource({ status: "error", error: new Error("failed") }, cases),
		).toBe("failed")
	})

	it("names an unsupported status instead of silently choosing a branch", () => {
		const cases = {
			pending: () => "loading",
			success: () => "ready",
			error: () => "failed",
		}

		for (const status of ["loaded", "", undefined, null, 1]) {
			expect(() => matchResource({ status } as never, cases as never)).toThrow(
				`Unsupported resource status "${String(status)}"`,
			)
		}
	})

	it("passes full values and context through fromResource", () => {
		const resolve = fromResource(
			(
				_values: Readonly<{ readonly organizationId: string }>,
				{ context }: { readonly context: { readonly ready: boolean } },
			) =>
				context.ready
					? ({ status: "success", value: "Forms" } as const)
					: ({ status: "pending" } as const),
			{
				pending: (_state, values) => `Loading ${values.organizationId}`,
				success: ({ value }, values, { context }) =>
					`${value}:${values.organizationId}:${String(context.ready)}`,
				error: ({ error }) => String(error),
			},
		)

		expect(
			resolve({ organizationId: "org-1" }, { context: { ready: false } }),
		).toBe("Loading org-1")
		expect(
			resolve({ organizationId: "org-1" }, { context: { ready: true } }),
		).toBe("Forms:org-1:true")
	})
})
