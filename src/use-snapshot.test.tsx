import { act, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { useSnapshot } from "./use-snapshot.js"

describe("useSnapshot", () => {
	it("updates React consumers when an external store publishes a snapshot", () => {
		let snapshot: Readonly<{ count: number }> = Object.freeze({ count: 0 })
		const listeners = new Set<() => void>()
		const store = {
			getSnapshot: () => snapshot,
			subscribe(listener: () => void) {
				listeners.add(listener)
				return () => listeners.delete(listener)
			},
		}

		function View() {
			const current = useSnapshot(store)
			return <output>{current.count}</output>
		}

		render(<View />)
		expect(screen.getByText("0")).toBeDefined()

		act(() => {
			snapshot = Object.freeze({ count: 1 })
			for (const listener of listeners) listener()
		})

		expect(screen.queryByText("0")).toBeNull()
		expect(screen.getByText("1")).toBeDefined()
	})

	it("releases its store subscription when the consumer unmounts", () => {
		let snapshot: Readonly<{ count: number }> = Object.freeze({ count: 0 })
		const listeners = new Set<() => void>()
		let renders = 0
		const store = {
			getSnapshot: () => snapshot,
			subscribe(listener: () => void) {
				listeners.add(listener)
				return () => listeners.delete(listener)
			},
		}

		function View() {
			renders += 1
			return <output>{useSnapshot(store).count}</output>
		}

		const view = render(<View />)
		expect(listeners.size).toBe(1)

		const rendered = renders
		act(() => {
			for (const listener of listeners) listener()
		})
		expect(renders).toBe(rendered)

		view.unmount()
		expect(listeners.size).toBe(0)
		snapshot = Object.freeze({ count: 2 })
		expect(() => {
			for (const listener of listeners) listener()
		}).not.toThrow()
	})
})
