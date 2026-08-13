import { describe, expect, it, vi } from "vitest"

import { createLocalStorageAdapter } from "./local-storage.js"

describe("localStorage persistence adapter", () => {
	it("accesses storage lazily so browser globals are not required at import time", async () => {
		const values = new Map<string, string>()
		const storage = {
			getItem: vi.fn((key: string) => values.get(key) ?? null),
			removeItem: vi.fn((key: string) => values.delete(key)),
			setItem: vi.fn((key: string, value: string) => values.set(key, value)),
		}
		const getStorage = vi.fn(() => storage)
		const adapter = createLocalStorageAdapter(getStorage)

		expect(getStorage).not.toHaveBeenCalled()
		expect(await adapter.load("profile")).toBeUndefined()
		await adapter.save("profile", { name: "Ada" })
		expect(await adapter.load("profile")).toEqual({ name: "Ada" })
		await adapter.remove("profile")
		expect(await adapter.load("profile")).toBeUndefined()
	})

	it("requires a storage getter instead of a captured storage object", () => {
		for (const getStorage of [undefined, null, {}, "localStorage"]) {
			expect(() =>
				createLocalStorageAdapter(getStorage as unknown as () => never),
			).toThrow("localStorage adapter requires a storage getter")
		}
	})

	it("propagates a rejected write so persistence can report it", async () => {
		const quotaExceeded = new Error("QuotaExceededError")
		const adapter = createLocalStorageAdapter(() => ({
			getItem: () => null,
			removeItem: () => undefined,
			setItem: () => {
				throw quotaExceeded
			},
		}))

		await expect(adapter.save("profile", { name: "Ada" })).rejects.toBe(
			quotaExceeded,
		)
	})

	it("distinguishes a missing key from a stored JSON null", async () => {
		const adapter = createLocalStorageAdapter(() => ({
			getItem: (key: string) => (key === "stored" ? "null" : null),
			removeItem: () => undefined,
			setItem: () => undefined,
		}))

		expect(await adapter.load("missing")).toBeUndefined()
		expect(await adapter.load("stored")).toBeNull()
	})

	it("surfaces malformed stored JSON as a load failure", async () => {
		const adapter = createLocalStorageAdapter(() => ({
			getItem: () => "not-json",
			removeItem: () => undefined,
			setItem: () => undefined,
		}))

		await expect(adapter.load("profile")).rejects.toBeInstanceOf(SyntaxError)
	})
})
