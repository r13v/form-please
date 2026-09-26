import { readdirSync, readFileSync } from "node:fs"
import { defineConfig } from "vitest/config"

const snippetRoot = "docs-site/src/snippets"

// Runs the documentation snippets that contain Vitest tests. They import the
// built package, so `npm run test:docs` builds it first.
export default defineConfig({
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
