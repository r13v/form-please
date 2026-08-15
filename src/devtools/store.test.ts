import { describe, expect, it, vi } from "vitest"

import type { FormBinding, FormDiagnosticsRuntime } from "../create-form-kit.js"
import {
	publishFormDiagnosticEvent,
	registerFormDiagnosticFeature,
} from "../diagnostics.js"
import { FormPleaseDevtoolsStore } from "./store.js"

describe("FormPleaseDevtoolsStore", () => {
	it("separates managed updates from direct RHF publications", () => {
		const harness = createStoreHarness()
		const release = harness.store.connect()
		const token = {}
		const transaction = {
			context: undefined,
			nextValues: { name: "Ada" },
			patches: [{ op: "replace", path: ["name"], value: "Ada" }],
			previousValues: { name: "" },
			source: { path: "name", type: "control" },
		}

		harness.publish({
			kind: "managed",
			phase: "start",
			time: 1,
			token,
			transaction,
		})
		harness.publish({
			kind: "managed",
			outcome: "unchanged",
			phase: "before-update",
			time: 2,
			token,
			transaction,
		})
		harness.publish({
			index: 0,
			kind: "managed",
			phase: "middleware-enter",
			time: 3,
			token,
			transaction,
		})
		harness.publish({
			forwardedPatches: transaction.patches,
			index: 0,
			kind: "managed",
			outcome: "forwarded",
			phase: "middleware-exit",
			time: 4,
			token,
		})
		harness.publish({
			kind: "managed",
			outcome: "start",
			phase: "commit",
			time: 5,
			token,
			transaction,
		})
		harness.publishValues({ name: "Ada" }, "name", "change")
		harness.publish({
			kind: "managed",
			outcome: "success",
			phase: "commit",
			time: 6,
			token,
			transaction,
		})
		harness.publish({
			kind: "managed",
			outcome: "success",
			phase: "after-update",
			time: 7,
			token,
			transaction,
		})
		harness.publish({
			duration: 7,
			kind: "managed",
			outcome: "committed",
			phase: "end",
			time: 8,
			token,
		})

		expect(harness.store.getSnapshot().updates).toHaveLength(1)
		expect(harness.store.getSnapshot().updates[0]).toMatchObject({
			kind: "managed",
			paths: ["name"],
			status: "committed",
		})
		expect(
			harness.store
				.getSnapshot()
				.updates[0]?.stages.map((stage) => stage.label),
		).toEqual([
			"Proposal",
			"beforeUpdate",
			"Middleware 1",
			"React Hook Form commit",
			"afterUpdate",
		])

		harness.publishValues({ name: "Grace" }, "name", "change")
		expect(harness.store.getSnapshot().updates[1]).toMatchObject({
			kind: "raw",
			name: "name",
			nextValues: { name: "Grace" },
			previousValues: { name: "Ada" },
		})

		harness.store.setRecording(false)
		harness.publishValues({ name: "Katherine" }, "name", "change")
		expect(harness.store.getSnapshot().updates).toHaveLength(2)
		harness.store.setRecording(true)
		harness.publishValues({ name: "Dorothy" }, "name", "change")
		expect(harness.store.getSnapshot().updates.at(-1)).toMatchObject({
			previousValues: { name: "Katherine" },
		})
		release()
	})

	it("keeps bounded journals and the latest options request", () => {
		const harness = createStoreHarness()
		harness.store.connect()
		for (let index = 1; index <= 105; index++) {
			harness.publishValues({ name: String(index) }, "name", "change")
		}
		expect(harness.store.getSnapshot().updates).toHaveLength(100)
		expect(harness.store.getSnapshot().updates[0]?.nextValues).toEqual({
			name: "6",
		})

		const first = {}
		const second = {}
		harness.publish({
			kind: "options",
			path: "city",
			request: first,
			status: "pending",
			time: 1,
		})
		harness.publish({
			dependencies: [{ path: ["country"], root: "values", value: "DE" }],
			duration: 4,
			kind: "options",
			optionCount: 2,
			path: "city",
			request: first,
			status: "fulfilled",
			time: 5,
		})
		harness.publish({
			kind: "options",
			path: "city",
			request: second,
			status: "pending",
			time: 6,
		})

		expect(harness.store.getSnapshot().options[0]).toMatchObject({
			current: { request: second, status: "pending" },
			path: "city",
			previous: {
				dependencies: [{ path: ["country"], root: "values", value: "DE" }],
				optionCount: 2,
				request: first,
				status: "fulfilled",
			},
		})
	})

	it("keeps shared form observers until the last mounted tool disconnects", () => {
		const harness = createStoreHarness()
		const releaseFirst = harness.store.connect()
		const releaseSecond = harness.store.connect()

		releaseFirst()
		harness.publishValues({ name: "still observed" })
		expect(harness.store.getSnapshot().updates).toHaveLength(1)

		releaseSecond()
		harness.publishValues({ name: "disconnected" })
		expect(harness.store.getSnapshot().updates).toHaveLength(1)
	})

	it("discovers configured features without requiring devtools middleware", () => {
		let snapshot = { canUndo: false }
		let listener: (() => void) | undefined
		const harness = createStoreHarness()
		registerFormDiagnosticFeature(harness.target, {
			getDetails: () => ({ limit: 100 }),
			getSnapshot: () => snapshot,
			kind: "history",
			subscribe: (next) => {
				listener = next
				return vi.fn()
			},
		})

		harness.store.connect()
		expect(harness.store.getSnapshot().features[0]).toMatchObject({
			details: { limit: 100 },
			kind: "history",
			snapshot: { canUndo: false },
		})

		snapshot = { canUndo: true }
		listener?.()
		expect(harness.store.getSnapshot().features[0]).toMatchObject({
			snapshot: { canUndo: true },
			transitions: [
				{ snapshot: { canUndo: false } },
				{ snapshot: { canUndo: true } },
			],
		})
	})
})

function createStoreHarness() {
	const target = {}
	let values = { name: "" }
	let observer:
		| ((details: {
				name?: string
				type?: string
				values: { name: string }
		  }) => void)
		| undefined
	const form = {
		api: {
			getValues: () => values,
			subscribe: ({ callback }: { callback: typeof observer }) => {
				observer = callback
				return () => {
					observer = undefined
				}
			},
		},
	} as unknown as FormBinding
	const runtime: FormDiagnosticsRuntime = {
		diagnosticTarget: target,
		disabled: false,
		formElement: null,
		inputRefs: new Map(),
		readOnly: false,
	}
	const store = new FormPleaseDevtoolsStore(form, runtime)
	return {
		publish: (event: Parameters<typeof publishFormDiagnosticEvent>[1]) =>
			publishFormDiagnosticEvent(target, event),
		publishValues(next: { name: string }, name?: string, type?: string) {
			values = next
			observer?.({ name, type, values: next })
		},
		store,
		target,
	}
}
