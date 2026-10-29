#!/usr/bin/env node

// Installs the lowest React Hook Form version that the peer range allows,
// so CI tests the minimum supported version without a second lockfile.
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"

const manifest = JSON.parse(readFileSync("package.json", "utf8"))
const range = manifest.peerDependencies["react-hook-form"]
const minimum = /^\^(\d+\.\d+\.\d+)$/.exec(range)?.[1]
if (minimum === undefined) {
	throw new Error(
		`Expected a caret peer range for react-hook-form, got "${range}"`,
	)
}
execFileSync("npm", ["install", "--no-save", `react-hook-form@${minimum}`], {
	stdio: "inherit",
})
