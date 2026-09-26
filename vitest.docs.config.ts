import { readdirSync, readFileSync } from "node:fs"
import { defineConfig } from "vitest/config"

const snippetRoot = "docs-site/src/snippets"

// Runs the documentation snippets that contain Vitest tests. They import the
// built package, so `npm run test:docs` builds it first.
export default defineConfig({
	// Snippets that render React must use the React and React Hook Form copies
	// of the built package and Testing Library, not the docs-site copies.
	resolve: { dedupe: ["react", "react-dom", "react-hook-form"] },
	test: {
		environment: "node",
		include: readdirSync(snippetRoot)
			.filter((name) =>
				readFileSync(`${snippetRoot}/${name}`, "utf8").includes(
					'from "vitest"',
				),
			)
			.map((name) => `${snippetRoot}/${name}`),
	},
})
