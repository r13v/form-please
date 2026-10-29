#!/usr/bin/env node

// Installs the lowest or the highest React Hook Form version that the peer
// range allows, so CI tests both ends of the range without a second lockfile.
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const bound = process.argv[2]
if (bound !== "minimum" && bound !== "maximum") {
	throw new Error('Pass "minimum" or "maximum"')
}
const manifest = JSON.parse(readFileSync("package.json", "utf8"))
const range = manifest.peerDependencies["react-hook-form"]
const minimum = /^\^(\d+\.\d+\.\d+)$/.exec(range)?.[1]
if (minimum === undefined) {
	throw new Error(
		`Expected a caret peer range for react-hook-form, got "${range}"`,
	)
}
// npm installs the highest version that satisfies a range.
const version = bound === "minimum" ? minimum : range
execFileSync("npm", ["install", "--no-save", `react-hook-form@${version}`], {
	stdio: "inherit",
})
