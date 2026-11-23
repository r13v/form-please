import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

import { errorCodes, errorMessage } from "./error-codes.js"

const sourceRoot = import.meta.dirname
const isLibrarySource = (file: string) =>
	/\.tsx?$/.test(file) && !/\.(test|bench)\.tsx?$|test-fixtures/.test(file)
const librarySources = readdirSync(sourceRoot, { recursive: true })
	.map(String)
	.filter(isLibrarySource)
	.map((file) => ({ file, text: readFileSync(join(sourceRoot, file), "utf8") }))

// The message argument of each error construction, after the errors array of an AggregateError.
const errorConstruction =
	/new (\w*Error)\(\s*(?:\[[^\]]*\],\s*)?(?:errorMessage\(\s*"(FP\d{3})")?/g

describe("error codes", () => {
	it("registers unique codes and identifiers", () => {
		const codes = Object.keys(errorCodes)
		const identifiers = Object.values(errorCodes)

		for (const code of codes) expect(code).toMatch(/^FP\d{3}$/)
		for (const identifier of identifiers) {
			expect(identifier).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
		}
		expect(new Set(identifiers).size).toBe(identifiers.length)
	})

	it("prefixes the message with the code", () => {
		expect(errorMessage("FP101", "Unknown UI node id")).toBe(
			"[FP101] Unknown UI node id",
		)
	})

	it("builds every thrown error message in src with a registered code", () => {
		const unregistered: string[] = []
		const used = new Set<string>()
		for (const { file, text } of librarySources) {
			for (const match of text.matchAll(errorConstruction)) {
				const [, errorClass, code] = match
				if (code === undefined) {
					unregistered.push(`${file}: new ${errorClass}(`)
					continue
				}
				used.add(code)
			}
		}

		expect(unregistered).toEqual([])
		expect([...used].sort()).toEqual(Object.keys(errorCodes).sort())
	})
})
