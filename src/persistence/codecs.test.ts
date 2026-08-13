import { describe, expect, it } from "vitest"

import { createDateCodec } from "./codecs.js"
import {
	decodePersistenceEnvelope,
	encodePersistenceEnvelope,
} from "./encoding.js"

describe("date persistence codec", () => {
	it("claims only Date values and round-trips them through ISO strings", async () => {
		const codec = createDateCodec()
		const createdAt = new Date("2026-08-06T08:00:00.000Z")

		expect(codec.canEncode(createdAt)).toBe(true)
		for (const value of [
			createdAt.toISOString(),
			createdAt.getTime(),
			null,
			{},
			[],
		]) {
			expect(codec.canEncode(value)).toBe(false)
		}
		expect(codec.encode(createdAt)).toBe("2026-08-06T08:00:00.000Z")
		expect(codec.decode("2026-08-06T08:00:00.000Z")).toEqual(createdAt)
	})

	it("rejects a stored payload that cannot become a valid Date", () => {
		const codec = createDateCodec()

		for (const payload of [1, null, true, {}, []]) {
			expect(() => codec.decode(payload as never)).toThrow(
				"Date persistence payload must be a string",
			)
		}
		for (const payload of ["", "not-a-date", "2026-13-40"]) {
			expect(() => codec.decode(payload)).toThrow(
				"Date persistence payload must be a valid ISO date",
			)
		}
	})

	it("cannot encode an invalid Date held by the live form", async () => {
		const codec = createDateCodec()

		expect(() => codec.encode(new Date(Number.NaN))).toThrow(RangeError)
		await expect(
			encodePersistenceEnvelope(
				{ createdAt: new Date(Number.NaN) },
				{ codecs: [codec], version: 1 },
			),
		).rejects.toThrow(RangeError)
	})

	it("supports several independently tagged date codecs in one envelope", async () => {
		const created = createDateCodec("created")
		const envelope = await encodePersistenceEnvelope(
			{ at: new Date("2026-08-06T08:00:00.000Z") },
			{ codecs: [created], version: 1 },
		)

		expect(envelope).toMatchObject({
			payload: { entries: [["at", { tag: "created" }]] },
		})
		await expect(
			decodePersistenceEnvelope(envelope, {
				codecs: [createDateCodec()],
				version: 1,
			}),
		).rejects.toThrow('Unknown persistence codec tag "created"')
	})
})
