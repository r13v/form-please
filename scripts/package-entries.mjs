// Derives the JavaScript entry points from package.json#exports, so the build,
// knip, and package tests cannot drift from the published entry list.
import { readFileSync } from "node:fs"

const manifest = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
)

/** Returns each published JavaScript entry with its dist name and source module. */
export function packageEntries() {
	return Object.entries(manifest.exports)
		.filter(([, target]) => typeof target === "object")
		.map(([subpath]) => {
			const name = subpath === "." ? "index" : subpath.slice(2)
			const source = subpath === "." ? "src/index.ts" : `src/${name}/index.ts`
			return { name, source }
		})
}
