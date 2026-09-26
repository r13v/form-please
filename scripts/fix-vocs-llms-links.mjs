import { readdir, readFile, writeFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { normalizeBasePath } from "./fix-vocs-skip-links.mjs"

const publicRoot = new URL("../docs-site/dist/public/", import.meta.url)
const markdownRoot = new URL("assets/md/", publicRoot)
const rootLinkPattern = /\]\((\/[^)\s]*)/g
const baseUrlPattern = /\{`\$\{import\.meta\.env\.BASE_URL\}([^`]*)`\}/g
const fencePattern = /^\s{0,3}(`{3,}|~{3,})(.*)$/

if (isMain()) {
	await patchMarkdownFiles(process.env.BASE_PATH ?? "/")
}

export async function patchMarkdownFiles(basePath) {
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

/**
 * Adds the base path to root-relative Markdown links, and replaces the
 * `import.meta.env.BASE_URL` templates that MDX JSX leaves in the output.
 */
export function prefixMarkdownLinks(markdown, basePathValue) {
	const basePath = normalizeBasePath(basePathValue)

	return mapProseLines(markdown, (line) =>
		mapOutsideInlineCode(
			line.replace(baseUrlPattern, (_template, path) => {
				return `"${basePath}/${path}"`
			}),
			(text) =>
				basePath === ""
					? text
					: text.replace(rootLinkPattern, (_link, href) => {
							return `](${prefixHref(href, basePath)}`
						}),
		),
	)
}

/** Calls `rewrite` on each line outside code fences. */
export function mapProseLines(markdown, rewrite) {
	let fence = null

	return markdown
		.split("\n")
		.map((line) => {
			const [, marker, info] = line.match(fencePattern) ?? []

			if (fence !== null) {
				if (
					marker?.[0] === fence[0] &&
					marker.length >= fence.length &&
					info.trim() === ""
				) {
					fence = null
				}
				return line
			}

			if (marker !== undefined) {
				fence = marker
				return line
			}

			return rewrite(line)
		})
		.join("\n")
}

/** Calls `rewrite` on each part of the line outside inline code spans. */
export function mapOutsideInlineCode(line, rewrite) {
	return line
		.split(/(`[^`]*`)/)
		.map((part, index) => (index % 2 === 0 ? rewrite(part) : part))
		.join("")
}

function prefixHref(href, basePath) {
	if (href.startsWith("//") || hasBasePath(href, basePath)) {
		return href
	}

	const index = href.match(/^\/index(?=$|[/?#])\/?(.*)$/)

	if (index !== null) {
		return `${basePath}/${index[1]}`
	}

	return `${basePath}${href}`
}

function hasBasePath(href, basePath) {
	const rest = href.slice(basePath.length)

	return href.startsWith(basePath) && (rest === "" || /^[/#?]/.test(rest))
}
