import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

import { packageEntries } from "../../scripts/package-entries.mjs"

const rootDirectory = fileURLToPath(new URL("../..", import.meta.url))
const entrypoints = packageEntries().map(({ name }) => name)

const clientEntrypoints = entrypoints.filter(
	(entrypoint) => entrypoint !== "testing",
)

describe("build output", () => {
	it("keeps the testing entry server-compatible", async () => {
		for (const extension of ["js", "cjs"]) {
			const source = await readFile(
				resolve(rootDirectory, `dist/testing.${extension}`),
				"utf8",
			)
			expect(source.trimStart().startsWith('"use client";')).toBe(false)
		}
		const graph = await readGraph("dist/testing.js")
		expect(graph).not.toContain('from "react"')
		expect(graph).not.toContain('from "react-dom"')
	})

	it("marks every React entry as a client module", async () => {
		for (const entrypoint of clientEntrypoints) {
			for (const extension of ["js", "cjs"]) {
				const source = await readFile(
					resolve(rootDirectory, `dist/${entrypoint}.${extension}`),
					"utf8",
				)
				expect(source.trimStart().startsWith('"use client";')).toBe(true)
			}
		}
	})

	it.each(["js", "cjs"])(
		"keeps Material UI isolated to its preset %s graph",
		async (extension) => {
			for (const entrypoint of entrypoints) {
				const graph = await readGraph(`dist/${entrypoint}.${extension}`)
				if (entrypoint === "preset-mui") {
					expect(graph).toContain("@mui/material")
				} else {
					expect(graph).not.toContain("@mui/material")
				}
			}
		},
	)

	it("uses React Hook Form and Immer in the main runtime graph", async () => {
		const graph = await readGraph("dist/index.js")
		expect(graph).toContain("immer")
		expect(graph).toContain("react-hook-form")
		expect(graph).not.toContain("layout.css")
	})

	it("keeps optional managed-value features free of a direct RHF import", async () => {
		const historyGraph = await readGraph("dist/history.js")
		const persistenceGraph = await readGraph("dist/persistence.js")

		expect(historyGraph).toContain('from "react"')
		expect(historyGraph).not.toContain('from "react-hook-form"')
		expect(persistenceGraph).toContain('from "react"')
		expect(persistenceGraph).not.toContain('from "react-hook-form"')
	})

	it.each(["js", "cjs"])(
		"keeps devtools and optional features outside the root %s graph",
		async (extension) => {
			const rootGraph = await readGraph(`dist/index.${extension}`)
			const devtoolsGraph = await readGraph(`dist/devtools.${extension}`)

			expect(rootGraph).not.toContain("createHistoryMiddleware")
			expect(rootGraph).not.toContain("createPersistenceMiddleware")

			expect(rootGraph).not.toContain("@hookform/devtools")
			expect(rootGraph).not.toContain("@uiw/react-json-view")
			expect(rootGraph).not.toContain("FormPleaseDevtools")
			expect(devtoolsGraph).toContain("@hookform/devtools")
			expect(devtoolsGraph).toContain("@uiw/react-json-view")
		},
	)
})

/** Reads one built module with every local module it imports or requires. */
async function readGraph(
	path: string,
	visited = new Set<string>(),
): Promise<string> {
	if (visited.has(path)) return ""
	visited.add(path)
	const source = await readFile(resolve(rootDirectory, path), "utf8")
	const specifiers = source.matchAll(
		/(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\(\s*)["'](\.{1,2}\/[^"']+?\.c?js)["']/g,
	)
	const children = await Promise.all(
		[...specifiers].map((match) =>
			readGraph(join(dirname(path), String(match[1])), visited),
		),
	)
	return [source, ...children].join("\n")
}
