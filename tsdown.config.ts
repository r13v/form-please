import { defineConfig } from "tsdown"

import { packageEntries } from "./scripts/package-entries.mjs"

export default defineConfig({
	entry: Object.fromEntries(
		packageEntries().map(({ name, source }) => [name, source]),
	),
	format: ["esm", "cjs"],
	platform: "neutral",
	fixedExtension: false,
	dts: true,
	sourcemap: true,
	clean: true,
	deps: {
		neverBundle: true,
		dts: {
			neverBundle: true,
		},
	},
	inputOptions: {
		preserveEntrySignatures: "strict",
	},
	copy: {
		from: "src/layout.css",
		to: "dist",
	},
	tsconfig: "tsconfig.build.json",
})
