import { readdir, readFile } from "node:fs/promises"

const siteRoot = new URL("../", import.meta.url)
const pageFiles = await readdir(new URL("src/pages/", siteRoot), {
	recursive: true,
})
const unsupported = pageFiles.filter((name) => /\.[jt]sx?$/.test(name))

if (unsupported.length > 0) {
	throw new Error(
		`tests/pages.mjs reads only .md and .mdx pages: ${unsupported.join(", ")}`,
	)
}

/** Each docs page from `src/pages/**\/*.{md,mdx}`, with its route and Markdown output. */
export const pages = pageFiles
	.filter((name) => /\.mdx?$/.test(name))
	.sort()
	.map((name) => {
		const route = `/${name.replace(/(^|\/)index\.mdx?$|\.mdx?$/, "")}`
		return {
			source: `src/pages/${name}`,
			route,
			markdown: `assets/md/${route === "/" ? "index" : route.slice(1)}.md`,
		}
	})

if (pages.length === 0) {
	throw new Error("tests/pages.mjs found no pages")
}

const config = await readFile(new URL("vocs.config.ts", siteRoot), "utf8")

/**
 * The internal sidebar links. Node cannot load the config, so a regex reads
 * the text after `sidebar:`, without comment lines.
 */
export const sidebarLinks = new Set(
	Array.from(
		config
			.slice(config.indexOf("\n\tsidebar: ["))
			.replace(/^\s*\/\/.*$/gm, "")
			.matchAll(/link: "(\/[^"]*)"/g),
		([, link]) => link,
	),
)
