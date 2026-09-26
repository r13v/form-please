import { readdir, readFile } from "node:fs/promises"

const siteRoot = new URL("../", import.meta.url)

/** Each docs page from `src/pages/**\/*.mdx`, with its route and Markdown output. */
export const pages = (
	await readdir(new URL("src/pages/", siteRoot), { recursive: true })
)
	.filter((name) => name.endsWith(".mdx"))
	.sort()
	.map((name) => {
		const route = `/${name.replace(/(^|\/)index\.mdx$|\.mdx$/, "")}`
		return {
			source: `src/pages/${name}`,
			route,
			markdown: `assets/md/${route === "/" ? "index" : route.slice(1)}.md`,
		}
	})

/** The internal sidebar links. Node cannot load the config, so a regex reads it. */
export const sidebarLinks = new Set(
	Array.from(
		(await readFile(new URL("vocs.config.ts", siteRoot), "utf8")).matchAll(
			/link: "(\/[^"]*)"/g,
		),
		([, link]) => link,
	),
)
