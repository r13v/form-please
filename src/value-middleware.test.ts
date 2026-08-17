import type { Draft } from "immer"
import { describe, expect, it, vi } from "vitest"

import {
	attachFormDiagnosticSink,
	type FormDiagnosticEvent,
} from "./diagnostics.js"
import {
	attachValueCoordinatorCapability,
	type BeforeUpdateResult,
	createValueCoordinator,
	type FormMiddleware,
	getValueCoordinatorCapability,
	type ValueTransaction,
} from "./value-middleware.js"

type Values = {
	quantity: number
	total: number
	note?: string
	items: { name: string }[]
}

describe("value middleware coordinator", () => {
	it("publishes the managed pipeline without changing its asynchronous result", async () => {
		const release = deferred<void>()
		const events: FormDiagnosticEvent[] = []
		const harness = createHarness([
			() => (next) => async (transaction) => {
				const committed = next(transaction.patches)
				await release.promise
				return committed
			},
		])
		const capability = getValueCoordinatorCapability(harness.coordinator)
		const detach = attachFormDiagnosticSink(capability, {
			publish: (event) => events.push(event),
		})

		const result = harness.coordinator.update((draft) => {
			draft.quantity = 3
		})

		expect(result).toBeInstanceOf(Promise)
		expect(harness.getValues().quantity).toBe(3)
		expect(
			events
				.filter((event) => event.kind === "managed")
				.map(
					(event) =>
						`${event.phase}:${"outcome" in event ? event.outcome : ""}`,
				),
		).toEqual([
			"start:",
			"before-update:unchanged",
			"middleware-enter:",
			"commit:start",
			"commit:success",
			"middleware-exit:forwarded",
			"after-update:success",
			"end:committed",
		])

		release.resolve()
		await result
		await Promise.resolve()
		expect(events.at(-1)).toMatchObject({
			kind: "managed",
			outcome: "fulfilled",
			phase: "settled",
		})
		detach()
	})

	it("commits dependent patches before code after next observes values", () => {
		const order: string[] = []
		const middleware: readonly FormMiddleware<Values>[] = [
			() => (next) => (transaction) => {
				order.push("first:before")
				const result = next([
					...transaction.patches,
					{
						op: "replace",
						path: ["total"],
						value: transaction.nextValues.quantity * 2,
					},
				])
				order.push("first:after")
				return result
			},
			() => (next) => (transaction) => {
				order.push(`second:${transaction.nextValues.total}`)
				return next(transaction.patches)
			},
		]
		const harness = createHarness(middleware)

		const result = harness.coordinator.update((draft) => {
			draft.quantity = 3
		}) as ValueTransaction<Values>

		expect(order).toEqual(["first:before", "second:6", "first:after"])
		expect(harness.getValues()).toMatchObject({ quantity: 3, total: 6 })
		expect(result.nextValues).toMatchObject({ quantity: 3, total: 6 })
		expect(result.source).toEqual({ type: "update" })
	})

	it("lets middleware cancel a proposal without publishing partial values", () => {
		const afterUpdate = vi.fn()
		const harness = createHarness([() => () => () => "cancelled"], undefined, {
			afterUpdate,
		})

		expect(
			harness.coordinator.update((draft) => {
				draft.quantity = 9
			}),
		).toBe("cancelled")
		expect(harness.getValues().quantity).toBe(1)
		expect(harness.commit).not.toHaveBeenCalled()
		expect(afterUpdate).not.toHaveBeenCalled()
	})

	it("adjusts a proposal before middleware and observes the final commit", () => {
		const order: string[] = []
		const afterUpdate = vi.fn((transaction: ValueTransaction<Values>) => {
			order.push("afterUpdate")
			expect(transaction.nextValues).toMatchObject({
				note: "committed",
				quantity: 4,
				total: 8,
			})
		})
		const harness = createHarness(
			[
				() => (next) => (transaction) => {
					order.push("middleware:before")
					expect(transaction.nextValues.total).toBe(8)
					expect(
						transaction.patches.filter((patch) => patch.path[0] === "quantity"),
					).toEqual([{ op: "replace", path: ["quantity"], value: 4 }])
					const result = next([
						...transaction.patches,
						{ op: "add", path: ["note"], value: "committed" },
					])
					order.push("middleware:after")
					return result
				},
			],
			undefined,
			{
				afterUpdate,
				beforeUpdate(draft, transaction) {
					order.push("beforeUpdate")
					expect(transaction.nextValues).toMatchObject({
						quantity: 3,
						total: 2,
					})
					draft.quantity += 1
					draft.total = draft.quantity * 2
				},
			},
		)

		harness.coordinator.update((draft) => {
			draft.quantity = 3
		})

		expect(order).toEqual([
			"beforeUpdate",
			"middleware:before",
			"middleware:after",
			"afterUpdate",
		])
		expect(afterUpdate).toHaveBeenCalledOnce()
		expect(harness.getValues()).toMatchObject({
			note: "committed",
			quantity: 4,
			total: 8,
		})
	})

	it("cancels or erases a proposal before middleware", () => {
		const entered = vi.fn()
		const afterUpdate = vi.fn()
		let cancel = true
		const harness = createHarness(
			[
				() => (next) => (transaction) => {
					entered()
					return next(transaction.patches)
				},
			],
			undefined,
			{
				afterUpdate,
				beforeUpdate(draft, transaction) {
					if (cancel) return false
					draft.quantity = transaction.previousValues.quantity
				},
			},
		)

		expect(
			harness.coordinator.update((draft) => {
				draft.quantity = 3
			}),
		).toBeUndefined()
		cancel = false
		expect(
			harness.coordinator.update((draft) => {
				draft.quantity = 4
			}),
		).toBeUndefined()
		expect(
			harness.coordinator.update(() => ({
				items: harness.getValues().items,
				quantity: 5,
				total: 2,
			})),
		).toBeUndefined()

		expect(entered).not.toHaveBeenCalled()
		expect(afterUpdate).not.toHaveBeenCalled()
		expect(harness.commit).not.toHaveBeenCalled()
		expect(harness.getValues().quantity).toBe(1)
	})

	it("rejects nested updates from either definition hook", () => {
		const second = vi.fn()
		let coordinator: ReturnType<typeof createHarness>["coordinator"]
		const beforeUpdate = () => {
			second()
			expect(() => coordinator.update(() => undefined)).toThrow(
				"cannot start a nested value transaction",
			)
		}
		const afterUpdate = () => {
			second()
			expect(() => coordinator.update(() => undefined)).toThrow(
				"cannot start a nested value transaction",
			)
		}
		const harness = createHarness([], undefined, {
			afterUpdate,
			beforeUpdate,
		})
		coordinator = harness.coordinator

		harness.coordinator.update((draft) => {
			draft.quantity = 2
		})

		expect(second).toHaveBeenCalledTimes(2)
	})

	it("rejects asynchronous hooks at their synchronous boundaries", () => {
		const beforeHarness = createHarness([], undefined, {
			// @ts-expect-error Runtime rejects accidentally asynchronous hooks.
			beforeUpdate: async () => undefined,
		})
		expect(() =>
			beforeHarness.coordinator.update((draft) => {
				draft.quantity = 2
			}),
		).toThrow("beforeUpdate must be synchronous")
		expect(beforeHarness.commit).not.toHaveBeenCalled()

		const afterHarness = createHarness([], undefined, {
			// TypeScript permits async functions where callers ignore a void result.
			afterUpdate: async () => undefined,
		})
		expect(() =>
			afterHarness.coordinator.update((draft) => {
				draft.quantity = 2
			}),
		).toThrow("afterUpdate must be synchronous")
		expect(afterHarness.getValues().quantity).toBe(2)
	})

	it("aggregates middleware and afterUpdate failures after commit", () => {
		const middlewareError = new Error("middleware failed")
		const afterError = new Error("afterUpdate failed")
		const afterUpdate = vi.fn(() => {
			throw afterError
		})
		const harness = createHarness(
			[
				() => (next) => (transaction) => {
					next(transaction.patches)
					throw middlewareError
				},
			],
			undefined,
			{ afterUpdate },
		)

		let failure: unknown
		try {
			harness.coordinator.update((draft) => {
				draft.quantity = 2
			})
		} catch (error) {
			failure = error
		}

		expect(failure).toBeInstanceOf(AggregateError)
		expect((failure as AggregateError).errors).toEqual([
			middlewareError,
			afterError,
		])
		expect(afterUpdate).toHaveBeenCalledOnce()
		expect(harness.getValues().quantity).toBe(2)
	})

	it("aggregates asynchronous middleware and afterUpdate failures", async () => {
		const middlewareError = new Error("async middleware failed")
		const afterError = new Error("afterUpdate failed")
		const harness = createHarness(
			[
				() => (next) => async (transaction) => {
					next(transaction.patches)
					await Promise.resolve()
					throw middlewareError
				},
			],
			undefined,
			{
				afterUpdate() {
					throw afterError
				},
			},
		)

		let failure: unknown
		try {
			await harness.coordinator.update((draft) => {
				draft.quantity = 2
			})
		} catch (error) {
			failure = error
		}

		expect(failure).toBeInstanceOf(AggregateError)
		expect((failure as AggregateError).errors).toEqual([
			middlewareError,
			afterError,
		])
		expect(harness.getValues().quantity).toBe(2)
	})

	it("skips middleware entirely when a recipe changes nothing", () => {
		const entered = vi.fn()
		const harness = createHarness([
			() => (next) => (transaction) => {
				entered()
				return next(transaction.patches)
			},
		])

		expect(harness.coordinator.update(() => undefined)).toBeUndefined()
		expect(entered).not.toHaveBeenCalled()
		expect(harness.commit).not.toHaveBeenCalled()
	})

	it("rejects top-level deletion that RHF setValues cannot commit exactly", () => {
		const harness = createHarness([], {
			items: [],
			note: "keep the key",
			quantity: 1,
			total: 2,
		})

		expect(() =>
			harness.coordinator.update(() => ({
				items: [],
				quantity: 2,
				total: 4,
			})),
		).toThrow("assign undefined instead")
		expect(harness.getValues()).toHaveProperty("note", "keep the key")
		expect(harness.commit).not.toHaveBeenCalled()
	})

	it("rejects a middleware update issued while the pipeline initializes", () => {
		expect(() =>
			createHarness([
				(api) => {
					api.update((draft) => {
						draft.quantity = 99
					})
					return (next) => (transaction) => next(transaction.patches)
				},
			]),
		).toThrow("cannot update values while the pipeline initializes")
	})

	it("names the missing form binding for every non-binding capability host", () => {
		for (const host of [null, undefined, 1, "form", Symbol("form"), {}]) {
			expect(() =>
				getValueCoordinatorCapability(host as unknown as object),
			).toThrow("requires a current Form Please form binding")
		}
	})

	it("stays usable after middleware forwards an unresolvable patch path", () => {
		let fail = true
		const harness = createHarness([
			() => (next) => (transaction) => {
				if (!fail) return next(transaction.patches)
				fail = false
				return next([{ op: "replace", path: ["missing", "deep"], value: 1 }])
			},
		])

		expect(() =>
			harness.coordinator.update((draft) => {
				draft.quantity = 2
			}),
		).toThrow("path doesn't resolve")
		expect(harness.commit).not.toHaveBeenCalled()
		expect(harness.getValues()).toMatchObject({ quantity: 1 })

		harness.coordinator.update((draft) => {
			draft.quantity = 3
		})
		expect(harness.getValues()).toMatchObject({ quantity: 3 })
	})

	it("rejects middleware patches that drop a top-level key before committing", () => {
		const harness = createHarness(
			[() => (next) => () => next([{ op: "remove", path: ["note"] }])],
			{ items: [], note: "keep", quantity: 1, total: 2 },
		)

		expect(() =>
			harness.coordinator.update((draft) => {
				draft.quantity = 2
			}),
		).toThrow("assign undefined instead")
		expect(harness.commit).not.toHaveBeenCalled()
		expect(harness.getValues()).toHaveProperty("note", "keep")
	})

	it("commits an unchanged transaction when middleware erases every patch", () => {
		const afterUpdate = vi.fn()
		const harness = createHarness([() => (next) => () => next([])], undefined, {
			afterUpdate,
		})

		const result = harness.coordinator.update((draft) => {
			draft.quantity = 5
		}) as ValueTransaction<Values>

		expect(result.patches).toEqual([])
		expect(result.nextValues).toEqual(result.previousValues)
		expect(harness.getValues()).toMatchObject({ quantity: 1 })
		expect(harness.commit).toHaveBeenCalledOnce()
		expect(afterUpdate).toHaveBeenCalledOnce()
	})

	it("keeps the coordinator usable after a recipe throws", () => {
		const harness = createHarness([])
		const failure = new Error("recipe failed")

		expect(() =>
			harness.coordinator.update(() => {
				throw failure
			}),
		).toThrow(failure)
		expect(harness.commit).not.toHaveBeenCalled()

		harness.coordinator.update((draft) => {
			draft.quantity = 7
		})
		expect(harness.getValues()).toMatchObject({ quantity: 7 })
	})

	it("compacts an adjusted whole-value replacement into identity-changed keys", () => {
		const harness = createHarness(
			[],
			{ items: [], note: "kept", quantity: 1, total: 2 },
			{
				beforeUpdate(draft) {
					draft.total = 99
				},
			},
		)

		const result = harness.coordinator.update(() => ({
			items: [],
			note: "kept",
			quantity: 4,
			total: 8,
		})) as ValueTransaction<Values>

		// An unchanged primitive is dropped, while a replaced object identity is
		// still published because the coordinator compares keys with Object.is.
		expect(result.patches).toEqual([
			{ op: "replace", path: ["items"], value: [] },
			{ op: "replace", path: ["quantity"], value: 4 },
			{ op: "replace", path: ["total"], value: 99 },
		])
		expect(harness.getValues()).toEqual({
			items: [],
			note: "kept",
			quantity: 4,
			total: 99,
		})
	})

	it("restores complete history values through hooks and a distinct terminal", () => {
		const sources: ValueTransaction<Values>["source"][] = []
		const harness = createHarness(
			[
				() => (next) => (transaction) => {
					sources.push(transaction.source)
					return next(transaction.patches)
				},
			],
			{
				items: [],
				note: "remove this optional key",
				quantity: 1,
				total: 2,
			},
			{
				beforeUpdate(draft, transaction) {
					expect(transaction.source).toEqual({
						action: "undo",
						type: "history",
					})
					draft.total = draft.quantity * 3
				},
			},
		)
		const host = {}
		attachValueCoordinatorCapability(host, harness.coordinator)
		const capability = getValueCoordinatorCapability<Values>(host)

		const result = capability.restore(
			() => ({ items: [], quantity: 4, total: 0 }),
			{ action: "undo", type: "history" },
		) as ValueTransaction<Values>

		expect(result.source).toEqual({ action: "undo", type: "history" })
		expect(result.nextValues).toEqual({ items: [], quantity: 4, total: 12 })
		expect(sources).toEqual([{ action: "undo", type: "history" }])
		expect(harness.getValues()).toEqual({ items: [], quantity: 4, total: 12 })
		expect(harness.commit).not.toHaveBeenCalled()
		expect(harness.restore).toHaveBeenCalledOnce()
	})

	it("forbids nested updates and a second next without rolling back a commit", () => {
		const nestedError = vi.fn()
		const harness = createHarness([
			(api) => (next) => (transaction) => {
				try {
					api.update((draft) => {
						draft.total = 100
					})
				} catch (error) {
					nestedError(error)
				}
				next(transaction.patches)
				return next(transaction.patches)
			},
		])

		expect(() =>
			harness.coordinator.update((draft) => {
				draft.quantity = 4
			}),
		).toThrow("cannot call next more than once")
		expect(nestedError.mock.calls[0]?.[0]).toBeInstanceOf(TypeError)
		expect(harness.getValues().quantity).toBe(4)
		expect(harness.commit).toHaveBeenCalledTimes(1)
	})

	it("allows a new update after async post-commit work", async () => {
		const harness = createHarness([
			(api) => (next) => async (transaction) => {
				const result = next(transaction.patches)
				if (transaction.nextValues.quantity === 2) {
					await Promise.resolve()
					return api.update((draft) => {
						draft.total = 8
					})
				}
				return result
			},
		])

		await harness.coordinator.update((draft) => {
			draft.quantity = 2
		})

		expect(harness.getValues()).toMatchObject({ quantity: 2, total: 8 })
		expect(harness.commit).toHaveBeenCalledTimes(2)
	})

	it("rejects a deferred next before it can commit stale previous values", async () => {
		const harness = createHarness([
			() => (next) => async (transaction) => {
				await Promise.resolve()
				return next(transaction.patches)
			},
		])

		await expect(
			harness.coordinator.update((draft) => {
				draft.quantity = 3
			}),
		).rejects.toThrow("must call next synchronously")
		expect(harness.getValues().quantity).toBe(1)
		expect(harness.commit).not.toHaveBeenCalled()
	})

	it("keeps native array length and order changes owned by the source action", () => {
		const harness = createHarness(
			[
				() => (next) => (transaction) =>
					next([
						...transaction.patches,
						{ op: "add", path: ["items", 2], value: { name: "extra" } },
					]),
			],
			{
				items: [{ name: "Ada" }, { name: "Grace" }],
				quantity: 1,
				total: 2,
			},
		)

		expect(() =>
			harness.coordinator.dispatch(
				(draft) => {
					draft.items.splice(0, 1)
				},
				{ action: "remove", index: 0, path: "items", type: "array" },
				{ arrayPath: ["items"] },
			),
		).toThrow("cannot change length or order")
		expect(harness.getValues().items).toHaveLength(2)
		expect(harness.commit).not.toHaveBeenCalled()
	})

	it("applies the same structural array constraint to beforeUpdate", () => {
		const harness = createHarness(
			[],
			{
				items: [{ name: "Ada" }, { name: "Grace" }],
				quantity: 1,
				total: 2,
			},
			{
				beforeUpdate(draft) {
					draft.items.push({ name: "extra" })
				},
			},
		)

		expect(() =>
			harness.coordinator.dispatch(
				(draft) => {
					draft.items.splice(0, 1)
				},
				{ action: "remove", index: 0, path: "items", type: "array" },
				{ arrayPath: ["items"] },
			),
		).toThrow("cannot change length or order")
		expect(harness.commit).not.toHaveBeenCalled()
	})

	it("reports replacement of an active array parent precisely", () => {
		const harness = createHarness(
			[
				() => (next) => () =>
					next([
						{
							op: "replace",
							path: [],
							value: { items: [], quantity: 1, total: 2 },
						},
					]),
			],
			{ items: [{ name: "Ada" }], quantity: 1, total: 2 },
		)

		expect(() =>
			harness.coordinator.dispatch(
				(draft) => {
					draft.items.splice(0, 1)
				},
				{ action: "remove", index: 0, path: "items", type: "array" },
				{ arrayPath: ["items"] },
			),
		).toThrow("replace the active array or its parent")
	})
})

type HarnessHooks = {
	readonly beforeUpdate?: (
		draft: Draft<Values>,
		transaction: ValueTransaction<Values>,
	) => BeforeUpdateResult
	readonly afterUpdate?: (transaction: ValueTransaction<Values>) => void
}

function createHarness(
	middleware: readonly FormMiddleware<Values>[],
	initialValues: Values = { items: [], quantity: 1, total: 2 },
	hooks: HarnessHooks = {},
) {
	let values = initialValues
	const commit = vi.fn((transaction: ValueTransaction<Values>) => {
		values = transaction.nextValues as Values
	})
	const restore = vi.fn((transaction: ValueTransaction<Values>) => {
		values = transaction.nextValues as Values
	})
	const coordinator = createValueCoordinator({
		afterUpdate: hooks.afterUpdate,
		beforeUpdate: hooks.beforeUpdate,
		commit,
		getContext: () => undefined,
		getValues: () => values,
		middleware,
		restore,
	})
	return { commit, coordinator, getValues: () => values, restore }
}

function deferred<Value>() {
	let resolve!: (value: Value) => void
	return {
		promise: new Promise<Value>((next) => {
			resolve = next
		}),
		resolve,
	}
}
