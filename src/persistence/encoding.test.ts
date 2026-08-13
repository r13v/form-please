import { describe, expect, it } from "vitest"

import { createDateCodec } from "./codecs.js"
import {
	decodePersistenceEnvelope,
	encodePersistenceEnvelope,
	normalizePersistenceCodecs,
	type PersistenceCodec,
} from "./encoding.js"

const dateCodec = createDateCodec()

describe("persistence encoding", () => {
	it("round-trips editable JSON shapes without losing undefined or dates", async () => {
		const input = {
			active: true,
			createdAt: new Date("2026-08-06T08:00:00.000Z"),
			items: [undefined, null, 3, -0, "form"],
			optional: undefined,
		}

		const envelope = await encodePersistenceEnvelope(input, {
			codecs: [dateCodec],
			version: 2,
		})
		const decoded = await decodePersistenceEnvelope(envelope, {
			codecs: [dateCodec],
			version: 2,
		})

		expect(decoded.migrated).toBe(false)
		expect(decoded.value).toEqual(input)
		expect(Object.is((decoded.value as typeof input).items[3], -0)).toBe(true)
		expect(Object.getPrototypeOf(decoded.value)).toBeNull()
	})

	it("migrates decoded old values and reports both application versions", async () => {
		const envelope = await encodePersistenceEnvelope(
			{ fullName: "Ada Lovelace" },
			{ codecs: [], version: 1 },
		)
		const migrationCalls: unknown[] = []

		const decoded = await decodePersistenceEnvelope(envelope, {
			codecs: [],
			migrate(value, fromVersion, toVersion) {
				migrationCalls.push([value, fromVersion, toVersion])
				return { name: (value as { fullName: string }).fullName }
			},
			version: 2,
		})

		expect(decoded).toEqual({
			migrated: true,
			value: { name: "Ada Lovelace" },
		})
		expect(migrationCalls).toEqual([[{ fullName: "Ada Lovelace" }, 1, 2]])
	})

	it("requires an explicit migration when the application version changes", async () => {
		const envelope = await encodePersistenceEnvelope(
			{ name: "Ada" },
			{ codecs: [], version: 1 },
		)

		await expect(
			decodePersistenceEnvelope(envelope, { codecs: [], version: 2 }),
		).rejects.toThrow("requires a migration to version 2")
	})

	it("rejects values that cannot cross the configured storage boundary", async () => {
		const cyclic: { self?: unknown } = {}
		cyclic.self = cyclic
		const symbolKey = Symbol("hidden")

		for (const [value, message] of [
			[{ nested: { amount: Number.NaN } }, '"nested.amount": non-finite'],
			[{ nested: 1n }, '"nested": bigint'],
			[{ nested: Symbol("value") }, '"nested": symbol'],
			[{ nested: () => undefined }, '"nested": function'],
			[{ nested: /form/ }, '"nested": RegExp'],
			[cyclic, '"self": cyclic value'],
			[{ [symbolKey]: "value" }, '"<root>": symbol key'],
		] as const) {
			await expect(
				encodePersistenceEnvelope(value, { codecs: [], version: 1 }),
			).rejects.toThrow(message)
		}
	})

	it("rejects unknown codecs and malformed envelopes before restoring data", async () => {
		const envelope = await encodePersistenceEnvelope(
			{ createdAt: new Date("2026-08-06T08:00:00.000Z") },
			{ codecs: [dateCodec], version: 1 },
		)

		await expect(
			decodePersistenceEnvelope(envelope, { codecs: [], version: 1 }),
		).rejects.toThrow('Unknown persistence codec tag "date"')
		await expect(
			decodePersistenceEnvelope(
				{ protocol: "other", protocolVersion: 1, version: 1, payload: {} },
				{ codecs: [], version: 1 },
			),
		).rejects.toThrow("Unsupported persistence protocol identifier")
	})

	it("validates codec registration and codec JSON output", async () => {
		const invalidCodec: PersistenceCodec<Date> = {
			canEncode: (value): value is Date => value instanceof Date,
			decode: () => new Date(),
			encode: () => undefined as never,
			tag: "invalid",
		}

		expect(() => normalizePersistenceCodecs([dateCodec, dateCodec])).toThrow(
			'Duplicate persistence codec tag "date"',
		)
		const applicationCodec = { ...dateCodec }
		normalizePersistenceCodecs([applicationCodec])
		expect(Object.isFrozen(applicationCodec)).toBe(false)
		await expect(
			encodePersistenceEnvelope(
				{ date: new Date() },
				{ codecs: [invalidCodec], version: 1 },
			),
		).rejects.toThrow('Persistence codec "invalid" output must be JSON')
	})

	it("rejects every envelope shape that cannot be trusted as protocol data", async () => {
		const valid = await encodePersistenceEnvelope(
			{ name: "Ada" },
			{ codecs: [], version: 1 },
		)

		for (const [input, message] of [
			[undefined, "must be JSON"],
			[new Date(), "must be JSON"],
			[{ ...(valid as object), version: 1.5 }, "non-negative integer"],
			[{ ...(valid as object), version: -1 }, "non-negative integer"],
			[{ ...(valid as object), version: "1" }, "non-negative integer"],
			[{ ...(valid as object), protocolVersion: 2 }, "protocol version 2"],
			[
				{ protocol: "form-please/persistence", protocolVersion: 1, version: 1 },
				"missing its payload",
			],
			[[valid], "must be an object"],
			[null, "must be an object"],
		] as const) {
			await expect(
				decodePersistenceEnvelope(input, { codecs: [], version: 1 }),
			).rejects.toThrow(message)
		}
	})

	it("rejects malformed encoded nodes instead of returning partial input", async () => {
		const envelope = (payload: unknown) => ({
			payload,
			protocol: "form-please/persistence",
			protocolVersion: 1,
			version: 1,
		})

		for (const [payload, message] of [
			[{ type: "unknown" }, '"<root>"'],
			[{ type: "string", value: 1 }, '"<root>"'],
			[{ type: "number", value: null }, '"<root>"'],
			[{ type: "number", value: "1" }, '"<root>"'],
			[{ type: "boolean", value: "true" }, '"<root>"'],
			[{ items: {}, type: "array" }, '"<root>"'],
			[{ entries: {}, type: "object" }, '"<root>"'],
			[{ entries: [["a"]], type: "object" }, '"<root>"'],
			[{ entries: [[1, { type: "null" }]], type: "object" }, '"<root>"'],
			[
				{
					entries: [
						["a", { type: "null" }],
						["a", { type: "null" }],
					],
					type: "object",
				},
				'"<root>"',
			],
			[{ items: [{ type: "string", value: 1 }], type: "array" }, '"0"'],
			[{ tag: 1, type: "codec", value: 1 }, '"<root>"'],
			[{ tag: "date", type: "codec" }, '"<root>"'],
		] as const) {
			await expect(
				decodePersistenceEnvelope(envelope(payload), {
					codecs: [dateCodec],
					version: 1,
				}),
			).rejects.toThrow("Malformed encoded persistence value at")
			expect(message).toBeTruthy()
		}
	})

	it("keeps dangerous decoded keys as own properties without polluting prototypes", async () => {
		const decoded = (await decodePersistenceEnvelope(
			{
				payload: {
					entries: [
						[
							"__proto__",
							{
								entries: [["polluted", { type: "boolean", value: true }]],
								type: "object",
							},
						],
						["constructor", { type: "string", value: "safe" }],
					],
					type: "object",
				},
				protocol: "form-please/persistence",
				protocolVersion: 1,
				version: 1,
			},
			{ codecs: [], version: 1 },
		)) as { value: Record<string, unknown> }

		expect(Object.getPrototypeOf(decoded.value)).toBeNull()
		expect(Object.hasOwn(decoded.value, "__proto__")).toBe(true)
		expect(decoded.value.constructor).toBe("safe")
		expect(({} as Record<string, unknown>).polluted).toBeUndefined()
		expect(Object.getPrototypeOf({})).toBe(Object.prototype)
	})

	it("rejects a prototype-bearing object literal before it reaches storage", async () => {
		await expect(
			encodePersistenceEnvelope(
				{ __proto__: { polluted: true } },
				{ codecs: [], version: 1 },
			),
			// The reported kind comes from the substituted prototype's constructor.
		).rejects.toThrow('Unsupported persistence value at "<root>": Object')
	})

	it("uses the first codec that claims a value and reports async codec failures", async () => {
		const firstWins: PersistenceCodec<Date> = {
			canEncode: (value): value is Date => value instanceof Date,
			decode: () => new Date(0),
			encode: () => "first",
			tag: "first",
		}
		const envelope = await encodePersistenceEnvelope(
			{ createdAt: new Date("2026-08-06T08:00:00.000Z") },
			{ codecs: [firstWins, dateCodec], version: 1 },
		)

		expect(envelope).toMatchObject({
			payload: {
				entries: [["createdAt", { tag: "first", type: "codec" }]],
			},
		})
		await expect(
			decodePersistenceEnvelope(envelope, {
				codecs: [
					{
						...firstWins,
						decode: () => Promise.reject(new Error("no decode")),
					},
				],
				version: 1,
			}),
		).rejects.toThrow("no decode")
	})

	it("surfaces a failing migration instead of restoring the decoded value", async () => {
		const envelope = await encodePersistenceEnvelope(
			{ name: "Ada" },
			{ codecs: [], version: 1 },
		)

		await expect(
			decodePersistenceEnvelope(envelope, {
				codecs: [],
				migrate: () => Promise.reject(new Error("migration failed")),
				version: 2,
			}),
		).rejects.toThrow("migration failed")
		await expect(
			decodePersistenceEnvelope(envelope, {
				codecs: [],
				migrate() {
					throw new Error("migration threw")
				},
				version: 2,
			}),
		).rejects.toThrow("migration threw")
	})

	it("round-trips deeply nested and empty editable structures", async () => {
		const input = {
			empty: {},
			list: [],
			nested: { level: [{ deeper: [{ leaf: "" }] }] },
			zero: 0,
		}
		const decoded = await decodePersistenceEnvelope(
			await encodePersistenceEnvelope(input, { codecs: [], version: 3 }),
			{ codecs: [], version: 3 },
		)

		expect(decoded.value).toEqual(input)
		expect(decoded.migrated).toBe(false)
	})

	it("allows shared objects when an asynchronous codec suspends encoding", async () => {
		const asyncDateCodec: PersistenceCodec<Date> = {
			...dateCodec,
			async encode(value) {
				await Promise.resolve()
				return value.toISOString()
			},
		}
		const shared = { createdAt: new Date("2026-08-06T08:00:00.000Z") }
		const envelope = await encodePersistenceEnvelope([shared, shared], {
			codecs: [asyncDateCodec],
			version: 1,
		})

		expect(
			(
				await decodePersistenceEnvelope(envelope, {
					codecs: [asyncDateCodec],
					version: 1,
				})
			).value,
		).toEqual([shared, shared])
	})
})
