const docsStyleCompiler = (source) => {
	const imports = []
	if (source.includes("@fontsource-variable/newsreader")) {
		imports.push('import "@fontsource-variable/newsreader"')
	}
	if (source.includes("tailwindcss/")) {
		imports.push('import "tailwindcss"')
	}
	if (source.includes("tw-animate-css")) {
		imports.push('import "tw-animate-css"')
	}
	return imports.join("\n")
}

export default {
	compilers: {
		css: docsStyleCompiler,
		mdx: true,
	},
	ignore: ["tests/fixtures/**"],
	ignoreDependencies: ["form-please", "zod"],
	ignoreFiles: [],
	workspaces: {
		".": {
			entry: [
				"src/index.ts",
				"src/default-slots/index.ts",
				"src/devtools/index.ts",
				"src/native-controls/index.ts",
				"src/preset-native/index.ts",
				"src/preset-mui/index.ts",
			],
			project: ["src/**/*.{ts,tsx}", "tests/**/*.{ts,tsx}"],
		},
		"docs-site": {
			entry: [
				"vocs.config.ts",
				"src/pages/**/*.mdx",
				"src/pages/**/*.css",
				"src/snippets/**/*.{ts,tsx}",
			],
			project: ["src/**/*.{js,jsx,mjs,ts,tsx,mdx,css}"],
		},
	},
	tags: ["-lintignore"],
}
