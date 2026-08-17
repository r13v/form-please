import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import { describe, expect, it } from "vitest"

const execFileAsync = promisify(execFile)
const rootDirectory = fileURLToPath(new URL("../..", import.meta.url))
const packageJson = JSON.parse(
	await readFile(new URL("../../package.json", import.meta.url), "utf8"),
)
const packageLock = JSON.parse(
	await readFile(new URL("../../package-lock.json", import.meta.url), "utf8"),
)
const layoutCss = await readFile(
	new URL("../../src/layout.css", import.meta.url),
	"utf8",
)

const javaScriptEntrypoints = {
	".": "index",
	"./default-slots": "default-slots",
	"./devtools": "devtools",
	"./history": "history",
	"./native-controls": "native-controls",
	"./persistence": "persistence",
	"./preset-native": "preset-native",
	"./preset-mui": "preset-mui",
	"./testing": "testing",
} as const

describe("package metadata", () => {
	it("publishes only the supported package surface", () => {
		expect(packageJson).toMatchObject({
			dependencies: {
				"@hookform/devtools": "4.4.0",
				immer: "11.1.15",
			},
			engines: { node: ">=24" },
			files: ["dist"],
			license: "MIT",
			name: "form-please",
			peerDependencies: {
				react: "^18.0.0 || ^19.0.0",
				"react-dom": "^18.0.0 || ^19.0.0",
				"react-hook-form": "^7.76.1",
			},
			sideEffects: ["**/*.css"],
			type: "module",
		})
		expect(packageJson.exports).toEqual(expectedExports())
		expect(Object.keys(packageJson.exports)).toEqual([
			".",
			"./default-slots",
			"./devtools",
			"./history",
			"./native-controls",
			"./persistence",
			"./preset-native",
			"./preset-mui",
			"./testing",
			"./layout.css",
			"./package.json",
		])
		expect(packageLock.version).toBe(packageJson.version)
		expect(packageLock.packages[""].version).toBe(packageJson.version)
	})

	it("keeps React Hook Form required and Material UI peers optional", () => {
		expect(packageJson.peerDependenciesMeta).toEqual({
			"@emotion/react": { optional: true },
			"@emotion/styled": { optional: true },
			"@mui/material": { optional: true },
		})
		expect(packageJson.peerDependenciesMeta).not.toHaveProperty(
			"react-hook-form",
		)
	})

	it("lets release automation own the package version", () => {
		expect(packageJson.scripts["package:check"]).toBe(
			"npm run build && publint --strict && attw --pack . --profile node16 --entrypoints . ./default-slots ./devtools ./history ./native-controls ./persistence ./preset-native ./preset-mui ./testing",
		)
		expect(packageJson.scripts).not.toHaveProperty("version")
	})

	it("keeps the structural stylesheet explicit", async () => {
		expect(layoutCss).toContain("@layer fp")
		expect(layoutCss).not.toMatch(/@media\b/)
		expect(new Set(layoutCss.match(/--fp-[a-z-]+/g) ?? [])).toEqual(
			new Set([
				"--fp-array-item-gap",
				"--fp-column-gap",
				"--fp-row-gap",
				"--fp-stack-gap",
			]),
		)
		expect(packageJson.exports["./layout.css"]).toBe("./dist/layout.css")

		const { stdout } = await execFileAsync(
			"npm",
			["pack", "--dry-run", "--json"],
			{ cwd: rootDirectory },
		)
		const [packResult] = JSON.parse(stdout) as [
			{ readonly files: readonly { readonly path: string }[] },
		]
		expect(packResult.files.map((file) => file.path)).toContain(
			"dist/layout.css",
		)
	})
})

function expectedExports() {
	return {
		...Object.fromEntries(
			Object.entries(javaScriptEntrypoints).map(([entrypoint, distName]) => [
				entrypoint,
				{
					default: `./dist/${distName}.js`,
					import: {
						default: `./dist/${distName}.js`,
						types: `./dist/${distName}.d.ts`,
					},
					require: {
						default: `./dist/${distName}.cjs`,
						types: `./dist/${distName}.d.cts`,
					},
				},
			]),
		),
		"./layout.css": "./dist/layout.css",
		"./package.json": "./package.json",
	}
}
