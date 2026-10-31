/** The Markdown output that Vocs gives to `markdown.output.transform`. */
export type MarkdownOutput = {
	index: string
	pages: Readonly<Record<string, string>>
}

export function transformMarkdownOutput(
	output: MarkdownOutput,
	basePathValue: string,
): MarkdownOutput
