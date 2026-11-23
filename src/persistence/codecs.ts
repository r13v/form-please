import { errorMessage } from "../error-codes.js"
import type { JsonValue, PersistenceCodec } from "./encoding.js"

/** Creates an opt-in ISO-8601 codec for `Date` values. */
export function createDateCodec(tag = "date"): PersistenceCodec<Date> {
	return Object.freeze({
		canEncode: (value: unknown): value is Date => value instanceof Date,
		decode: (value: JsonValue) => {
			if (typeof value !== "string") {
				throw new TypeError(
					errorMessage("FP518", "Date persistence payload must be a string"),
				)
			}
			const date = new Date(value)
			if (Number.isNaN(date.getTime())) {
				throw new TypeError(
					errorMessage(
						"FP519",
						"Date persistence payload must be a valid ISO date",
					),
				)
			}
			return date
		},
		encode: (value) => {
			if (Number.isNaN(value.getTime())) {
				throw new TypeError(
					errorMessage("FP520", "Date persistence value must be valid"),
				)
			}
			return value.toISOString()
		},
		tag,
	})
}
