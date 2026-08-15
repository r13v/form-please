import { readFile, stat } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const rootDirectory = fileURLToPath(new URL("../..", import.meta.url))
const entrypoints = [
	"index",
	"default-slots",
	"devtools",
	"history",
	"native-controls",
	"persistence",
	"preset-native",
	"preset-mui",
] as const

describe("build output", () => {
	it("emits both module formats and their declarations", async () => {
		for (const entrypoint of entrypoints) {
			for (const extension of ["js", "cjs", "d.ts", "d.cts"]) {
				await expect(
					stat(resolve(rootDirectory, `dist/${entrypoint}.${extension}`)),
				).resolves.toBeDefined()
			}
		}
	})

	it("marks every React entry as a client module", async () => {
		for (const entrypoint of entrypoints) {
			for (const extension of ["js", "cjs"]) {
				const source = await readFile(
					resolve(rootDirectory, `dist/${entrypoint}.${extension}`),
					"utf8",
				)
				expect(source.trimStart().startsWith('"use client";')).toBe(true)
			}
		}
	})

	it("removes every retired JavaScript entry", async () => {
		for (const entrypoint of ["core", "react19", "server", "tanstack"]) {
			await expect(
				stat(resolve(rootDirectory, `dist/${entrypoint}.js`)),
			).rejects.toMatchObject({ code: "ENOENT" })
		}
	})

	it("keeps Material UI isolated to its preset graph", async () => {
		for (const entrypoint of entrypoints) {
			const graph = await readEsmGraph(`dist/${entrypoint}.js`)
			if (entrypoint === "preset-mui") {
				expect(graph).toContain("@mui/material")
			} else {
				expect(graph).not.toContain("@mui/material")
			}
		}
	})

	it("uses React Hook Form and Immer in the main runtime graph", async () => {
		const graph = await readEsmGraph("dist/index.js")
		expect(graph).toContain("immer")
		expect(graph).toContain("react-hook-form")
		expect(graph).not.toContain("@tanstack/react-form")
		expect(graph).not.toContain("layout.css")
	})

	it("keeps optional managed-value features outside the root runtime graph", async () => {
		const rootGraph = await readEsmGraph("dist/index.js")
		const historyGraph = await readEsmGraph("dist/history.js")
		const persistenceGraph = await readEsmGraph("dist/persistence.js")

		expect(rootGraph).not.toContain("createHistoryMiddleware")
		expect(rootGraph).not.toContain("createPersistenceMiddleware")
		expect(historyGraph).toContain("createHistoryMiddleware")
		expect(historyGraph).toContain("useHistory")
		expect(historyGraph).toContain('from "react"')
		expect(historyGraph).not.toContain('from "react-hook-form"')
		expect(persistenceGraph).toContain("createPersistenceMiddleware")
		expect(persistenceGraph).toContain("usePersistence")
		expect(persistenceGraph).toContain('from "react"')
		expect(persistenceGraph).not.toContain('from "react-hook-form"')
	})

	it("keeps devtools outside the root runtime graph", async () => {
		const rootGraph = await readEsmGraph("dist/index.js")
		const devtoolsGraph = await readEsmGraph("dist/devtools.js")

		expect(rootGraph).not.toContain("@hookform/devtools")
		expect(rootGraph).not.toContain("FormPleaseDevtools")
		expect(devtoolsGraph).toContain("@hookform/devtools")
		expect(devtoolsGraph).toContain("FormPleaseDevtools")
	})
})

async function readEsmGraph(
	path: string,
	visited = new Set<string>(),
): Promise<string> {
	if (visited.has(path)) return ""
	visited.add(path)
	const source = await readFile(resolve(rootDirectory, path), "utf8")
	const localImports = [...source.matchAll(/from\s+["'](\.\/.+?\.js)["']/g)]
	const children = await Promise.all(
		localImports.map((match) =>
			readEsmGraph(`dist/${String(match[1]).replace(/^\.\//, "")}`, visited),
		),
	)
	return [source, ...children].join("\n")
}
