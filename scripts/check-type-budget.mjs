#!/usr/bin/env node

// Fails when the type checker work grows past the budget. Deep path and
// node-scope types can grow slowly with each change, so a fixed budget makes
// that growth a reviewed decision. Raise the budget only on purpose.
import { execFileSync } from "node:child_process"

const budget = 1_060_000

const output = execFileSync(
	"npx",
	["tsc", "--project", "tsconfig.json", "--extendedDiagnostics"],
	{ encoding: "utf8" },
)
const instantiations = Number(/^Instantiations:\s+(\d+)$/m.exec(output)?.[1])
if (!Number.isSafeInteger(instantiations)) {
	throw new Error("tsc --extendedDiagnostics did not report Instantiations")
}
console.log(`Type instantiations: ${instantiations} (budget ${budget})`)
if (instantiations > budget) {
	console.error("Type instantiations exceed the budget.")
	process.exitCode = 1
}
