import { readdir, readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { normalizeBasePath } from "./fix-vocs-skip-links.mjs"

const publicRoot = new URL("../docs-site/dist/public/", import.meta.url)
const markdownRoot = new URL("assets/md/", publicRoot)
const rootLinkPattern = /\]\((\/[^)\s]*)/g
const fencePattern = /^\s{0,3}(`{3,}|~{3,})/

if (isMain()) {
	await patchMarkdownFiles(process.env.BASE_PATH ?? "/")
}

export async function patchMarkdownFiles(basePathValue) {
	const basePath = normalizeBasePath(basePathValue)

	if (basePath === "") {
		return
	}

	const files = [
		new URL("llms.txt", publicRoot),
		new URL("llms-full.txt", publicRoot),
		...(await readdir(markdownRoot, { recursive: true }))
			.filter((name) => name.endsWith(".md"))
			.map((name) => new URL(name, markdownRoot)),
	]

	for (const file of files) {
		const source = await readFile(file, "utf8")
		const output = prefixMarkdownLinks(source, basePath)

		if (output !== source) {
			await writeFile(file, output)
		}
	}
}

function isMain() {
	return (
		process.argv[1] !== undefined &&
		import.meta.url === pathToFileURL(process.argv[1]).href
	)
}

export function prefixMarkdownLinks(markdown, basePathValue) {
	const basePath = normalizeBasePath(basePathValue)

	if (basePath === "") {
		return markdown
	}

	let fence = null

	return markdown
		.split("\n")
		.map((line) => {
			const marker = line.match(fencePattern)?.[1]

			if (fence !== null) {
				if (marker?.[0] === fence[0] && marker.length >= fence.length) {
					fence = null
				}
				return line
			}

			if (marker !== undefined) {
				fence = marker
				return line
			}

			return line.replace(rootLinkPattern, (_link, href) => {
				return `](${prefixHref(href, basePath)}`
			})
		})
		.join("\n")
}

function prefixHref(href, basePath) {
	if (href.startsWith("//") || hasBasePath(href, basePath)) {
		return href
	}

	const [path, hash] = splitHash(href)

	if (path === "/index") {
		return `${basePath}/${hash}`
	}

	return `${basePath}${href}`
}

function hasBasePath(href, basePath) {
	const rest = href.slice(basePath.length)

	return href.startsWith(basePath) && (rest === "" || /^[/#?]/.test(rest))
}

function splitHash(href) {
	const index = href.indexOf("#")

	return index === -1 ? [href, ""] : [href.slice(0, index), href.slice(index)]
}
