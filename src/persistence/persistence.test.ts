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
	decodePersistenceEnvelope,
	encodePersistenceEnvelope,
	type JsonValue,
} from "./encoding.js"
import {
	type CreatePersistenceOptions,
	createPersistenceMiddleware,
	type FormPersistenceAdapter,
} from "./persistence.js"

type Values = {
	items: { name: string }[]
	name: string
	optional?: string
}

describe("form persistence middleware", () => {
	it("owns one stable handle for the exact configured form", () => {
		const storage = createMemoryStorage()
		const feature = createPersistenceMiddleware({
			adapter: storage.adapter,
			key: "profile",
			version: 1,
		})
		const first = createHarness({ feature })
		const second = createHarness({ feature })

		expect(feature.handle(first.form)).toBe(first.persistence)
		expect(feature.handle(second.form)).toBe(second.persistence)
		expect(() =>
			createPersistenceMiddleware({
				adapter: storage.adapter,
				key: "other",
				version: 1,
			}).handle(first.form),
		).toThrow("not configured for the supplied form")
		expect(() => createHarness({ feature, middleware: [feature] })).toThrow(
			"only one persistence feature",
		)
	})

	it("restores once through the managed pipeline without an initial write", async () => {
		const storage = createMemoryStorage()
		storage.value = await encoded({ items: [], name: "Persisted" })
		const sources: ValueTransaction<Values>["source"][] = []
		const harness = createHarness({
			middleware: [
				() => (next) => (transaction) => {
					if (transaction.source.type === "persistence") {
						sources.push(transaction.source)
					}
					return next(transaction.patches)
				},
			],
			storage,
		})
		const listener = vi.fn()
		const unsubscribe = harness.persistence.subscribe(listener)

		expect(await harness.persistence.restore()).toBe("applied")
		expect(harness.getValues()).toEqual({ items: [], name: "Persisted" })
		expect(harness.persistence.getSnapshot()).toEqual({
			phase: "active",
			save: { status: "idle" },
		})
		expect(await harness.persistence.restore()).toBe("applied")
		expect(storage.load).toHaveBeenCalledOnce()
		expect(storage.save).not.toHaveBeenCalled()
		expect(sources).toEqual([{ action: "restore", type: "persistence" }])
		expect(listener).toHaveBeenCalled()
		unsubscribe()
	})

	it("reports cancellation and rewrites values transformed by middleware", async () => {
		const cancelledStorage = createMemoryStorage()
		cancelledStorage.value = await encoded({ items: [], name: "Persisted" })
		const cancelled = createHarness({
			middleware: [
				() => () => (transaction) =>
					transaction.source.type === "persistence" ? "cancelled" : undefined,
			],
			storage: cancelledStorage,
		})
		expect(await cancelled.persistence.restore()).toBe("cancelled")
		expect(cancelled.getValues().name).toBe("")
		expect(cancelled.persistence.getSnapshot().phase).toBe("idle")

		const transformedStorage = createMemoryStorage()
		transformedStorage.value = await encoded({ items: [], name: "Persisted" })
		const transformed = createHarness({
			middleware: [
				() => (next) => (transaction) =>
					transaction.source.type === "persistence"
						? next([
								...transaction.patches,
								{
									op: "replace",
									path: ["name"],
									value: "Normalized",
								},
							])
						: next(transaction.patches),
			],
			saveDelay: 10_000,
			storage: transformedStorage,
		})

		expect(await transformed.persistence.restore()).toBe("transformed")
		expect(transformed.getValues().name).toBe("Normalized")
		await transformed.persistence.flush()
		expect(await readStored(transformedStorage)).toEqual({
			items: [],
			name: "Normalized",
		})
	})

	it("keeps local input when it changes during an asynchronous load", async () => {
		let resolveLoad!: (value: JsonValue) => void
		const storage = createMemoryStorage()
		storage.load.mockImplementation(
			() =>
				new Promise((resolve) => {
					resolveLoad = resolve
				}),
		)
		const harness = createHarness({ storage })
		const restore = harness.persistence.restore()
		expect(harness.persistence.restore()).toBe(restore)
		harness.setRawValues({ items: [], name: "Typed while loading" })
		resolveLoad(await encoded({ items: [], name: "Persisted" }))

		expect(await restore).toBe("conflict")
		expect(harness.getValues().name).toBe("Typed while loading")
		expect(harness.persistence.getSnapshot().phase).toBe("conflict")
		expect(await harness.persistence.restore()).toBe("conflict")
		harness.persistence.start()
		await harness.persistence.flush()
		expect(await readStored(storage)).toEqual({
			items: [],
			name: "Typed while loading",
		})
	})

	it("reports a restore failure and allows the application to retry", async () => {
		const failure = new Error("load unavailable")
		const onError = vi.fn()
		const storage = createMemoryStorage()
		storage.load.mockRejectedValueOnce(failure)
		const harness = createHarness({ onError, storage })

		await expect(harness.persistence.restore()).rejects.toBe(failure)
		expect(harness.persistence.getSnapshot()).toEqual({
			error: failure,
			phase: "failed",
			save: { status: "idle" },
		})
		expect(onError).toHaveBeenCalledWith(failure, { operation: "restore" })

		storage.value = await encoded({ items: [], name: "Retry succeeds" })
		expect(await harness.persistence.restore()).toBe("applied")
		expect(harness.getValues().name).toBe("Retry succeeds")
	})

	it("observes raw and managed edits, then coalesces them into the latest save", async () => {
		vi.useFakeTimers()
		try {
			const storage = createMemoryStorage()
			const harness = createHarness({ saveDelay: 50, storage })
			harness.persistence.start()
			expect(storage.save).not.toHaveBeenCalled()

			harness.setRawValues({ items: [], name: "Raw RHF edit" })
			harness.update((draft) => {
				draft.optional = "latest"
			})
			expect(harness.persistence.getSnapshot().save.status).toBe("scheduled")

			await vi.advanceTimersByTimeAsync(50)
			expect(storage.save).toHaveBeenCalledOnce()
			expect(await readStored(storage)).toEqual({
				items: [],
				name: "Raw RHF edit",
				optional: "latest",
			})
			expect(harness.persistence.getSnapshot().save.status).toBe("idle")
		} finally {
			vi.useRealTimers()
		}
	})

	it("serializes in-flight writes and saves a newer edit afterward", async () => {
		let releaseFirst!: () => void
		let markFirstStarted!: () => void
		const firstStarted = new Promise<void>((resolve) => {
			markFirstStarted = resolve
		})
		let activeSaves = 0
		let maximumActiveSaves = 0
		const storage = createMemoryStorage()
		storage.save.mockImplementation(async (_key, value) => {
			activeSaves++
			maximumActiveSaves = Math.max(maximumActiveSaves, activeSaves)
			if (storage.save.mock.calls.length === 1) {
				markFirstStarted()
				await new Promise<void>((resolve) => {
					releaseFirst = resolve
				})
			}
			storage.value = value
			activeSaves--
		})
		const harness = createHarness({ saveDelay: 0, storage })
		harness.persistence.start()
		harness.setRawValues({ items: [], name: "First" })
		const firstFlush = harness.persistence.flush()
		await firstStarted
		harness.setRawValues({ items: [], name: "Second" })
		const secondFlush = harness.persistence.flush()
		releaseFirst()

		await Promise.all([firstFlush, secondFlush])
		expect(maximumActiveSaves).toBe(1)
		expect(storage.save).toHaveBeenCalledTimes(2)
		expect(await readStored(storage)).toEqual({ items: [], name: "Second" })
	})

	it("clears storage without changing input and recreates it after the next edit", async () => {
		const storage = createMemoryStorage()
		const harness = createHarness({ saveDelay: 10_000, storage })
		harness.persistence.start()
		harness.setRawValues({ items: [], name: "Keep live" })
		await harness.persistence.flush()

		await harness.persistence.clear()
		expect(storage.remove).toHaveBeenCalledWith("profile")
		expect(storage.value).toBeUndefined()
		expect(harness.getValues().name).toBe("Keep live")

		harness.setRawValues({ items: [], name: "Recreate" })
		await harness.persistence.flush()
		expect(await readStored(storage)).toEqual({ items: [], name: "Recreate" })
	})

	it("surfaces failures without rolling back input and retries on demand", async () => {
		const failure = new Error("storage unavailable")
		const onError = vi.fn()
		const storage = createMemoryStorage()
		storage.save.mockRejectedValueOnce(failure)
		const harness = createHarness({ onError, storage })
		harness.persistence.start()
		harness.setRawValues({ items: [], name: "Unsaved" })

		await expect(harness.persistence.flush()).rejects.toBe(failure)
		expect(harness.getValues().name).toBe("Unsaved")
		expect(harness.persistence.getSnapshot()).toMatchObject({
			phase: "active",
			save: { error: failure, operation: "save", status: "failed" },
		})
		expect(onError).toHaveBeenCalledWith(failure, { operation: "save" })

		await harness.persistence.flush()
		expect(await readStored(storage)).toEqual({ items: [], name: "Unsaved" })
	})

	it("rejects every configuration a persisted form cannot rely on", () => {
		const adapter = createMemoryStorage().adapter
		const base = { adapter, key: "profile", version: 1 } as const

		for (const [options, message] of [
			[undefined, "options must be an object"],
			[{ ...base, adapter: {} }, "must define load, save, and remove"],
			[{ ...base, adapter: null }, "must define load, save, and remove"],
			[{ ...base, key: "" }, "must be a non-empty string"],
			[{ ...base, key: 1 }, "must be a non-empty string"],
			[{ ...base, version: -1 }, "must be a non-negative integer"],
			[{ ...base, version: 1.5 }, "must be a non-negative integer"],
			[{ ...base, saveDelay: -1 }, "finite non-negative number"],
			[{ ...base, saveDelay: Number.POSITIVE_INFINITY }, "finite non-negative"],
			[{ ...base, migrate: 1 }, "migrate must be a function"],
			[{ ...base, onError: 1 }, "onError must be a function"],
			[{ ...base, codecs: {} }, "codecs must be an array"],
			[{ ...base, codecs: [{ tag: "" }] }, "non-empty strings"],
			[{ ...base, codecs: [null] }, "index 0 must be an object"],
			[
				{ ...base, codecs: [{ tag: "date" }] },
				"must define canEncode, encode, and decode",
			],
		] as const) {
			expect(() =>
				createPersistenceMiddleware(
					options as unknown as CreatePersistenceOptions,
				),
			).toThrow(message)
		}
	})

	it("refuses operations that contradict the current persistence phase", async () => {
		const storage = createMemoryStorage()
		let releaseLoad = (): void => undefined
		storage.load.mockImplementationOnce(
			async () =>
				new Promise((resolve) => {
					releaseLoad = () => resolve(undefined)
				}),
		)
		const harness = createHarness({ saveDelay: 10_000, storage })

		await expect(harness.persistence.flush()).rejects.toThrow(
			"flush requires active persistence",
		)

		const restoring = harness.persistence.restore()
		expect(harness.persistence.getSnapshot().phase).toBe("restoring")
		expect(harness.persistence.restore()).toBe(restoring)
		expect(() => harness.persistence.start()).toThrow(
			"cannot start while restore is running",
		)
		await expect(harness.persistence.clear()).rejects.toThrow(
			"clear cannot run while restore is running",
		)

		releaseLoad()
		expect(await restoring).toBe("empty")
		expect(await harness.persistence.restore()).toBe("empty")

		harness.persistence.start()
		expect(harness.persistence.getSnapshot().phase).toBe("active")
	})

	it("rejects a restore requested after an unrestored form started saving", async () => {
		const harness = createHarness({ saveDelay: 10_000 })
		harness.persistence.start()

		await expect(harness.persistence.restore()).rejects.toThrow(
			"restore cannot run after start",
		)
		expect(harness.persistence.getSnapshot().phase).toBe("active")
	})

	it("requires an attached form handle before observing values", () => {
		const feature = createPersistenceMiddleware({
			adapter: createMemoryStorage().adapter,
			key: "profile",
			version: 1,
		})
		let values: Values = { items: [], name: "" }
		const coordinator = createValueCoordinator({
			commit: (transaction) => {
				values = transaction.nextValues as Values
			},
			getContext: () => undefined,
			getValues: () => values,
			middleware: [feature],
			restore: (transaction) => {
				values = transaction.nextValues as Values
			},
		})
		const detached = { api: undefined, update: coordinator.update }
		attachValueCoordinatorCapability(detached, coordinator)
		const handle = feature.handle(
			detached as unknown as FormBinding<StandardSchemaV1<Values>>,
		)

		expect(() => handle.start()).toThrow(
			"require a current Form Please form handle",
		)
		expect(handle.getSnapshot()).toEqual({
			phase: "idle",
			save: { status: "idle" },
		})
	})

	it("keeps a conflicting restore result stable and only recovers through start", async () => {
		const storage = createMemoryStorage()
		storage.value = await encoded({ items: [], name: "Stored" })
		let releaseLoad = (): void => undefined
		storage.load.mockImplementationOnce(
			async () =>
				new Promise((resolve) => {
					releaseLoad = () => resolve(storage.value)
				}),
		)
		const harness = createHarness({ saveDelay: 0, storage })

		const restoring = harness.persistence.restore()
		harness.setRawValues({ items: [], name: "Live edit" })
		releaseLoad()

		expect(await restoring).toBe("conflict")
		expect(harness.getValues().name).toBe("Live edit")
		expect(await harness.persistence.restore()).toBe("conflict")

		harness.persistence.start()
		await vi.waitFor(async () =>
			expect(await readStored(storage)).toEqual({
				items: [],
				name: "Live edit",
			}),
		)
	})

	it("stops publishing snapshots after a listener releases its subscription", async () => {
		const harness = createHarness({ saveDelay: 0 })
		const listener = vi.fn()
		const release = harness.persistence.subscribe(listener)

		expect(() => harness.persistence.subscribe(undefined as never)).toThrow(
			"listener must be a function",
		)
		harness.persistence.start()
		expect(listener).toHaveBeenCalled()

		const seen = listener.mock.calls.length
		release()
		release()
		harness.setRawValues({ items: [], name: "After release" })
		await harness.persistence.flush()
		expect(listener).toHaveBeenCalledTimes(seen)
	})

	it("migrates decoded values and immediately rewrites the current envelope", async () => {
		const storage = createMemoryStorage()
		storage.value = await encodePersistenceEnvelope(
			{ items: [], oldName: "Ada" },
			{ codecs: [], version: 1 },
		)
		const harness = createHarness({
			migrate(value) {
				return {
					items: [],
					name: (value as { oldName: string }).oldName,
				}
			},
			saveDelay: 10_000,
			storage,
			version: 2,
		})

		expect(await harness.persistence.restore()).toBe("applied")
		await harness.persistence.flush()
		expect(await readStored(storage, 2)).toEqual({ items: [], name: "Ada" })
	})
})

type MemoryStorage = ReturnType<typeof createMemoryStorage>

type HarnessOptions = Partial<
	Pick<
		CreatePersistenceOptions,
		"migrate" | "onError" | "saveDelay" | "version"
	>
> & {
	readonly feature?: ReturnType<typeof createPersistenceMiddleware>
	readonly middleware?: readonly FormMiddleware<Values>[]
	readonly storage?: MemoryStorage
}

function createHarness(options: HarnessOptions = {}) {
	let values: Values = { items: [], name: "" }
	const subscribers = new Set<(details: { values: Values }) => void>()
	const storage = options.storage ?? createMemoryStorage()
	const feature =
		options.feature ??
		createPersistenceMiddleware({
			adapter: storage.adapter,
			key: "profile",
			migrate: options.migrate,
			onError: options.onError,
			saveDelay: options.saveDelay,
			version: options.version ?? 1,
		})
	const publish = (): void => {
		for (const callback of subscribers) {
			callback({ values: cloneFormValue(values) })
		}
	}
	const commit = (transaction: ValueTransaction<Values>): void => {
		values = cloneFormValue(transaction.nextValues as Values)
		publish()
	}
	const coordinator = createValueCoordinator({
		commit,
		getContext: () => undefined,
		getValues: () => values,
		middleware: [feature, ...(options.middleware ?? [])],
		restore: commit,
	})
	const form = {
		api: {
			subscribe({
				callback,
			}: {
				callback: (details: { values: Values }) => void
			}) {
				subscribers.add(callback)
				return () => subscribers.delete(callback)
			},
		},
		context: undefined,
		definition: {},
		update: coordinator.update,
	} as unknown as FormBinding<StandardSchemaV1<Values>>
	attachValueCoordinatorCapability(form, coordinator)
	const persistence = feature.handle(form)

	return {
		feature,
		form,
		getValues: () => values,
		persistence,
		setRawValues(nextValues: Values) {
			values = cloneFormValue(nextValues)
			publish()
		},
		storage,
		update: coordinator.update,
	}
}

function createMemoryStorage() {
	const storage: {
		value: JsonValue | undefined
		adapter: FormPersistenceAdapter
		load: ReturnType<typeof vi.fn<FormPersistenceAdapter["load"]>>
		remove: ReturnType<typeof vi.fn<FormPersistenceAdapter["remove"]>>
		save: ReturnType<typeof vi.fn<FormPersistenceAdapter["save"]>>
	} = {
		value: undefined,
		adapter: undefined as never,
		load: vi.fn(async () => storage.value),
		remove: vi.fn(async () => {
			storage.value = undefined
		}),
		save: vi.fn(async (_key, value) => {
			storage.value = value
		}),
	}
	storage.adapter = {
		load: storage.load,
		remove: storage.remove,
		save: storage.save,
	}
	return storage
}

async function encoded(values: Values): Promise<JsonValue> {
	return encodePersistenceEnvelope(values, { codecs: [], version: 1 })
}

async function readStored(
	storage: MemoryStorage,
	version = 1,
): Promise<unknown> {
	if (storage.value === undefined) return undefined
	return (
		await decodePersistenceEnvelope(storage.value, { codecs: [], version })
	).value
}
