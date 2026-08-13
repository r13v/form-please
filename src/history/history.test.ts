import type { StandardSchemaV1 } from "@standard-schema/spec"
import { describe, expect, it, vi } from "vitest"

import type { FormBinding } from "../create-form-kit.js"
import { cloneFormValue } from "../form-value.js"
import {
	attachValueCoordinatorCapability,
	createValueCoordinator,
	type FormMiddleware,
	type ValueTransaction,
} from "../value-middleware.js"
import {
	type CreateHistoryOptions,
	createHistoryMiddleware,
	type HistoryJournal,
} from "./history.js"

type Values = {
	name: string
	optional?: string
	items: { name: string }[]
	tags?: Set<string>
}

describe("managed value history", () => {
	it("owns one stable handle per feature and form", () => {
		const feature = createHistoryMiddleware()
		const first = createHarness({ feature })
		const second = createHarness({ feature })

		expect(feature.handle(first.form)).toBe(first.history)
		expect(feature.handle(second.form)).toBe(second.history)
		expect(() => createHistoryMiddleware().handle(first.form)).toThrow(
			"not configured for the supplied form",
		)
		expect(() => createHarness({ middleware: [feature], feature })).toThrow(
			"only one history feature",
		)
	})

	it("groups control edits, navigates, truncates redo, and enforces retention", async () => {
		vi.useFakeTimers()
		vi.setSystemTime(1_000)
		try {
			const harness = createHarness({
				historyOptions: { groupWindow: 750, limit: 2 },
			})
			const listener = vi.fn()
			const unsubscribe = harness.history.subscribe(listener)

			harness.control("name", "A")
			vi.setSystemTime(1_500)
			harness.control("name", "Ada")
			expect(harness.history.getSnapshot()).toEqual({
				canRedo: false,
				canUndo: true,
				index: 1,
				length: 1,
			})

			vi.setSystemTime(2_500)
			harness.control("name", "Grace")
			harness.update((draft) => {
				draft.items.push({ name: "compiler" })
			})
			expect(harness.history.getSnapshot().length).toBe(2)
			expect(harness.getValues()).toEqual({
				items: [{ name: "compiler" }],
				name: "Grace",
			})

			expect(await harness.history.undo()).toBe("applied")
			expect(harness.getValues()).toEqual({ items: [], name: "Grace" })
			expect(await harness.history.undo()).toBe("applied")
			expect(harness.getValues()).toEqual({ items: [], name: "Ada" })
			expect(await harness.history.undo()).toBe("unavailable")
			expect(await harness.history.redo()).toBe("applied")

			harness.update((draft) => {
				draft.name = "Katherine"
			})
			expect(harness.history.getSnapshot().canRedo).toBe(false)
			expect(await harness.history.redo()).toBe("unavailable")
			expect(listener).toHaveBeenCalled()
			unsubscribe()
		} finally {
			vi.useRealTimers()
		}
	})

	it("uses zero grouping and zero retention as explicit opt-outs", async () => {
		const ungrouped = createHarness({ historyOptions: { groupWindow: 0 } })
		ungrouped.control("name", "A")
		ungrouped.control("name", "Ada")
		expect(ungrouped.history.getSnapshot().length).toBe(2)
		expect(await ungrouped.history.undo()).toBe("applied")
		expect(ungrouped.getValues().name).toBe("A")

		const unretained = createHarness({ historyOptions: { limit: 0 } })
		unretained.control("name", "Ada")
		expect(unretained.history.getSnapshot()).toEqual({
			canRedo: false,
			canUndo: false,
			index: 0,
			length: 0,
		})
		expect(await unretained.history.undo()).toBe("unavailable")
	})

	it("seeks retained positions and clears navigation at current values", async () => {
		const seekSources: ValueTransaction<Values>["source"][] = []
		const harness = createHarness({
			historyOptions: { groupWindow: 0 },
			middleware: [
				() => (next) => (transaction) => {
					if (
						transaction.source.type === "history" &&
						transaction.source.action === "seek"
					) {
						seekSources.push(transaction.source)
					}
					return next(transaction.patches)
				},
			],
		})
		harness.control("name", "Ada")
		harness.control("name", "Grace")

		expect(await harness.history.seek(0)).toBe("applied")
		expect(harness.getValues().name).toBe("")
		expect(await harness.history.seek(0)).toBe("applied")
		expect(seekSources).toEqual([
			{ action: "seek", type: "history" },
			{ action: "seek", type: "history" },
		])
		expect(await harness.history.seek(3)).toBe("unavailable")
		await expect(harness.history.seek(0.5)).rejects.toThrow(
			"must be an integer",
		)

		harness.history.clear()
		expect(harness.history.getSnapshot()).toEqual({
			canRedo: false,
			canUndo: false,
			index: 0,
			length: 0,
		})
		expect(harness.getValues().name).toBe("")
	})

	it("turns raw value divergence into a non-undoable boundary", async () => {
		const harness = createHarness()
		harness.control("name", "Ada")
		harness.setRawValues({ items: [], name: "Raw reset" })

		expect(await harness.history.undo()).toBe("unavailable")
		expect(harness.history.getSnapshot().length).toBe(0)
		expect(harness.getValues().name).toBe("Raw reset")

		harness.control("name", "Managed again")
		expect(await harness.history.undo()).toBe("applied")
		expect(harness.getValues().name).toBe("Raw reset")
	})

	it("reports cancelled and transformed restores without corrupting navigation", async () => {
		let restorePolicy: "cancel" | "pass" | "transform" = "pass"
		const policy: FormMiddleware<Values> = () => (next) => (transaction) => {
			if (transaction.source.type !== "history") {
				return next(transaction.patches)
			}
			if (restorePolicy === "cancel") return "cancelled"
			if (restorePolicy === "transform") {
				return next([
					...transaction.patches,
					{ op: "replace", path: ["name"], value: "Transformed" },
				])
			}
			return next(transaction.patches)
		}
		const harness = createHarness({ middleware: [policy] })
		harness.control("name", "Ada")

		restorePolicy = "cancel"
		expect(await harness.history.undo()).toBe("cancelled")
		expect(harness.getValues().name).toBe("Ada")
		expect(harness.history.getSnapshot().index).toBe(1)

		restorePolicy = "transform"
		expect(await harness.history.undo()).toBe("transformed")
		expect(harness.getValues().name).toBe("Transformed")
		expect(harness.history.getSnapshot()).toMatchObject({ index: 2, length: 2 })

		restorePolicy = "pass"
		expect(await harness.history.undo()).toBe("applied")
		expect(harness.getValues().name).toBe("Ada")
	})

	it("keeps a committed navigation when asynchronous middleware fails", async () => {
		const failure = new Error("post-commit history failure")
		const policy: FormMiddleware<Values> =
			() => (next) => async (transaction) => {
				const result = next(transaction.patches)
				if (transaction.source.type === "history") {
					await Promise.resolve()
					throw failure
				}
				return result
			}
		const harness = createHarness({ middleware: [policy] })
		harness.control("name", "Ada")

		await expect(harness.history.undo()).rejects.toBe(failure)
		expect(harness.getValues().name).toBe("")
		expect(harness.history.getSnapshot()).toMatchObject({ index: 0, length: 1 })
	})

	it("exports independent snapshots and installs a validated journal", async () => {
		const source = createHarness({ historyOptions: { groupWindow: 0 } })
		source.control("name", "Ada")
		source.control("name", "Grace")
		await source.history.undo()
		const journal = source.history.export()

		expect(journal).toEqual({
			entries: [
				{ items: [], name: "" },
				{ items: [], name: "Ada" },
				{ items: [], name: "Grace" },
			],
			index: 1,
			version: 1,
		})
		;(journal.entries[1] as Values).name = "mutated export"
		expect(source.history.export().entries[1]?.name).toBe("Ada")

		const target = createHarness({ historyOptions: { groupWindow: 0 } })
		expect(await target.history.import(journal)).toBe("applied")
		expect(target.getValues().name).toBe("mutated export")
		expect(target.history.getSnapshot()).toMatchObject({ index: 1, length: 2 })
		expect(await target.history.redo()).toBe("applied")
		expect(target.getValues().name).toBe("Grace")
	})

	it("installs journal branches when its current entry equals live values", async () => {
		const harness = createHarness({ historyOptions: { groupWindow: 0 } })
		const journal: HistoryJournal<Values> = {
			entries: [
				{ items: [], name: "" },
				{ items: [], name: "Ada" },
			],
			index: 0,
			version: 1,
		}

		expect(await harness.history.import(journal)).toBe("applied")
		expect(harness.history.getSnapshot()).toEqual({
			canRedo: true,
			canUndo: false,
			index: 0,
			length: 1,
		})
		expect(await harness.history.redo()).toBe("applied")
		expect(harness.getValues().name).toBe("Ada")
	})

	it("rejects malformed and oversized journals but permits invalid editable input", async () => {
		const harness = createHarness({ historyOptions: { limit: 1 } })
		for (const journal of [
			null,
			{},
			{ entries: [], index: 0, version: 1 },
			{ entries: [{ items: [], name: "" }], index: 1, version: 1 },
			{ entries: ["not an object"], index: 0, version: 1 },
			{ entries: [new Date()], index: 0, version: 1 },
			{
				entries: [
					{ items: [], name: "" },
					{ items: [], name: "A" },
					{ items: [], name: "B" },
				],
				index: 2,
				version: 1,
			},
		]) {
			await expect(harness.history.import(journal)).rejects.toBeInstanceOf(
				TypeError,
			)
		}

		const invalidEditableInput = {
			entries: [{ items: [], name: 42 }],
			index: 0,
			version: 1,
		}
		expect(await harness.history.import(invalidEditableInput)).toBe("applied")
		expect(harness.getValues().name).toBe(42)
	})

	it("retains structured values independently of later live mutation", () => {
		const harness = createHarness({ historyOptions: { groupWindow: 0 } })
		harness.update((draft) => {
			draft.tags = new Set(["draft"])
		})
		harness.update((draft) => {
			draft.tags?.add("review")
		})

		const exported = harness.history.export()
		harness.setRawValues({ items: [], name: "", tags: new Set(["mutated"]) })

		expect([...(exported.entries[1]?.tags ?? [])]).toEqual(["draft"])
		expect([...(exported.entries[2]?.tags ?? [])]).toEqual(["draft", "review"])
	})

	it("rejects operations that cannot address a retained position", async () => {
		const harness = createHarness()

		for (const index of [Number.NaN, Number.POSITIVE_INFINITY]) {
			await expect(harness.history.seek(index)).rejects.toThrow(
				"History seek index must be an integer",
			)
		}
		expect(await harness.history.seek(-1)).toBe("unavailable")
		expect(await harness.history.undo()).toBe("unavailable")
		expect(await harness.history.redo()).toBe("unavailable")
		expect(() => harness.history.subscribe(undefined as never)).toThrow(
			"History listener must be a function",
		)
	})

	it("notifies subscribers once per snapshot change and stops after release", async () => {
		const harness = createHarness({ historyOptions: { groupWindow: 0 } })
		const listener = vi.fn()
		const release = harness.history.subscribe(listener)

		harness.control("name", "A")
		expect(listener).toHaveBeenCalledTimes(1)

		harness.update((draft) => {
			draft.name = "A"
		})
		expect(listener).toHaveBeenCalledTimes(1)

		expect(await harness.history.undo()).toBe("applied")
		expect(listener).toHaveBeenCalledTimes(2)

		release()
		release()
		expect(await harness.history.redo()).toBe("applied")
		expect(listener).toHaveBeenCalledTimes(2)
	})

	it("keeps retention and navigation consistent for an unbounded journal", async () => {
		const harness = createHarness({
			historyOptions: { groupWindow: 0, limit: Number.POSITIVE_INFINITY },
		})
		for (let step = 0; step < 150; step += 1) {
			harness.control("name", `name-${step}`)
		}

		expect(harness.history.getSnapshot()).toEqual({
			canRedo: false,
			canUndo: true,
			index: 150,
			length: 150,
		})
		expect(await harness.history.seek(0)).toBe("applied")
		expect(harness.getValues().name).toBe("")
		expect(
			await harness.history.import({
				entries: [{ items: [], name: "imported" }],
				index: 0,
				version: 1,
			}),
		).toBe("applied")
	})

	it("rejects invalid retention and grouping options", () => {
		for (const limit of [-1, 1.5, Number.NaN]) {
			expect(() => createHistoryMiddleware({ limit })).toThrow(
				"History limit must be a non-negative integer or Infinity",
			)
		}
		for (const groupWindow of [-1, Number.POSITIVE_INFINITY, Number.NaN]) {
			expect(() => createHistoryMiddleware({ groupWindow })).toThrow(
				"History groupWindow must be a finite non-negative number",
			)
		}
	})
})

type HarnessOptions = {
	readonly feature?: ReturnType<typeof createHistoryMiddleware>
	readonly historyOptions?: CreateHistoryOptions
	readonly middleware?: readonly FormMiddleware<Values>[]
}

function createHarness(options: HarnessOptions = {}) {
	let values: Values = { items: [], name: "" }
	const feature =
		options.feature ?? createHistoryMiddleware(options.historyOptions)
	const commit = (transaction: ValueTransaction<Values>): void => {
		values = cloneFormValue(transaction.nextValues as Values)
	}
	const coordinator = createValueCoordinator({
		commit,
		getContext: () => undefined,
		getValues: () => values,
		middleware: [feature, ...(options.middleware ?? [])],
		restore: commit,
	})
	const form = {
		api: {},
		context: undefined,
		definition: {},
		update: coordinator.update,
	} as unknown as FormBinding<StandardSchemaV1<Values>>
	attachValueCoordinatorCapability(form, coordinator)
	const history = feature.handle(form)

	return {
		control(path: "name", value: string) {
			return coordinator.dispatch(
				(draft) => {
					draft[path] = value
				},
				{ path, type: "control" },
			)
		},
		feature,
		form,
		getValues: () => values,
		history,
		setRawValues(nextValues: Values) {
			values = nextValues
		},
		update: coordinator.update,
	}
}

const typedJournal: HistoryJournal<Values> = {
	entries: [{ items: [], name: "" }],
	index: 0,
	version: 1,
}
void typedJournal
