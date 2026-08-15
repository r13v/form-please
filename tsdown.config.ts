import { defineConfig } from "tsdown"

export default defineConfig({
	entry: {
		index: "src/index.ts",
		"default-slots": "src/default-slots/index.ts",
		devtools: "src/devtools/index.ts",
		history: "src/history/index.ts",
		"native-controls": "src/native-controls/index.ts",
		persistence: "src/persistence/index.ts",
		"preset-native": "src/preset-native/index.ts",
		"preset-mui": "src/preset-mui/index.ts",
	},
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
