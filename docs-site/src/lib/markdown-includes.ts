import { readFileSync } from "node:fs"
import { resolve } from "node:path"

type MarkdownNode = {
	children?: MarkdownNode[]
	type: string
	value?: string
}

const includePattern =
	/^\s*\/\/ \[!include ([^\s:\]]+)(?::([^\s\]]+))?(.*)\]\s*$/
const regionMarkerPattern = /^\s*\/\/ \[!(end)?region (.*)\]\s*$/
// `// @ts-expect-error` and similar pragmas are code, not Twoslash directives.
const twoslashDirectivePattern = /^\s*\/\/\s*(@(?!ts-)|\^\?)/

/**
 * Markdown output only: replaces `// [!include ~/…]` lines in code fences with
 * the snippet code, as Vocs does for the HTML page, and removes Twoslash
 * directives. Vocs 2.12.0 resolves only virtual files in Markdown output, so
 * without this plugin `llms.txt` readers get the include lines, not the code.
 */
export function remarkSnippetIncludes(options: { srcDir: string }) {
	return (tree: unknown) => {
		visitCode(tree as MarkdownNode, (node) => {
			node.value = resolveIncludes(node.value ?? "", (fileName) =>
				readFileSync(resolve(options.srcDir, fileName), "utf8"),
			)
		})
	}
}

/**
 * Resolves each include line. `readSource` gets the path relative to the Vocs
 * source directory. An include that does not resolve throws, so a broken
 * snippet reference fails the build instead of shipping without code.
 */
export function resolveIncludes(
	code: string,
	readSource: (fileName: string) => string,
): string {
	return code
		.split("\n")
		.flatMap((line) => {
			const match = line.match(includePattern)

			if (match === null) return [line]

			const [, fileName = "", region, rest = ""] = match

			if (!fileName.startsWith("~/") || rest.trim() !== "") {
				throw new Error(`Unsupported snippet include: ${line.trim()}`)
			}

			return extractRegion(readSource(fileName.slice(2)), region, fileName)
		})
		.filter((line) => !twoslashDirectivePattern.test(line))
		.join("\n")
		.replace(/\n+$/, "")
}

function extractRegion(
	source: string,
	region: string | undefined,
	fileName: string,
): string[] {
	const lines: string[] = []
	let inside = region === undefined
	let found = region === undefined

	for (const line of source.split("\n")) {
		const marker = line.match(regionMarkerPattern)

		if (marker === null) {
			if (inside) lines.push(line)
		} else if (marker[2] === region) {
			inside = marker[1] === undefined
			found = true
		}
	}

	if (!found) {
		throw new Error(`Snippet region ${region} not found in ${fileName}`)
	}

	return lines
}

function visitCode(
	node: MarkdownNode,
	visit: (node: MarkdownNode) => void,
): void {
	if (node.type === "code") visit(node)
	for (const child of node.children ?? []) visitCode(child, visit)
}
