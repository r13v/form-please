import assert from "node:assert/strict"
import { test } from "node:test"
import { rewriteSiteLinks } from "../../scripts/build-agent-docs.mjs"
import {
	prefixMarkdownLinks,
	proseSegments,
	transformMarkdownOutput,
} from "../../scripts/fix-vocs-llms-links.mjs"
import { prefixSitemapUrl } from "../../scripts/fix-vocs-sitemap.mjs"
import { resolveIncludes } from "../src/lib/markdown-includes.ts"

const basePath = "/form-please"
const siteUrl = "https://r13v.github.io/form-please"
const docsContext = {
	basePath,
	pages: new Set([
		"index.md",
		"get-started.md",
		"examples.md",
		"examples/history.md",
	]),
	siteUrl,
}
const snippet = [
	'"use client"',
	"// [!region schema]",
	"// @errors: 2322",
	"const schema = z.object({})",
	"//    ^?",
	"// @ts-expect-error: the value is not a string",
	"// [!endregion schema]",
	"export function Form() {}",
].join("\n")

test("snippet includes resolve to the region code without Twoslash directives", () => {
	const read = (fileName) => {
		assert.equal(fileName, "snippets/form.tsx")
		return snippet
	}

	assert.equal(
		resolveIncludes("// [!include ~/snippets/form.tsx:schema]", read),
		"const schema = z.object({})\n// @ts-expect-error: the value is not a string",
	)
	assert.equal(
		resolveIncludes("before\n// [!include ~/snippets/form.tsx]\nafter", read),
		[
			"before",
			'"use client"',
			"const schema = z.object({})",
			"// @ts-expect-error: the value is not a string",
			"export function Form() {}",
			"after",
		].join("\n"),
	)
})

test("snippet includes that do not resolve fail the build", () => {
	const read = () => snippet

	assert.throws(
		() => resolveIncludes("// [!include ~/snippets/form.tsx:missing]", read),
		/region missing not found/,
	)
	assert.throws(
		() => resolveIncludes("// [!include ~/snippets/form.tsx /a/b/]", read),
		/Unsupported snippet include/,
	)
})

test("package docs link to pages relatively and to everything else on the site", () => {
	const markdown = [
		"See [Get started](/form-please/get-started#install) and [Examples](/form-please/examples/).",
		'<a href="/form-please/playground">Playground</a> and [home](/form-please/).',
		"![Logo](/form-please/brand/logo.png) and [external](https://example.com/x).",
		"```md",
		"[code](/form-please/get-started)",
		"```",
	].join("\n")

	assert.equal(
		rewriteSiteLinks(markdown, "examples/history.md", docsContext),
		[
			"See [Get started](../get-started.md#install) and [Examples](../examples.md).",
			`<a href="${siteUrl}/playground">Playground</a> and [home](../index.md).`,
			`![Logo](${siteUrl}/brand/logo.png) and [external](https://example.com/x).`,
			"```md",
			"[code](/form-please/get-started)",
			"```",
		].join("\n"),
	)
})

test("sitemap URLs reach the deployment once, including the root and nested pages", () => {
	for (const [input, expected] of [
		["/", "/form-please/"],
		["/get-started", "/form-please/get-started"],
		["/examples/history", "/form-please/examples/history"],
		["/sitemap.xml", "/form-please/sitemap.xml"],
		["/form-pleased", "/form-please/form-pleased"],
	]) {
		const url = `https://r13v.github.io${expected}`
		assert.equal(
			prefixSitemapUrl(`https://r13v.github.io${input}`, basePath),
			url,
		)
		assert.equal(prefixSitemapUrl(url, `${basePath}/`), url)
	}
	assert.equal(
		prefixSitemapUrl("https://r13v.github.io/form-please", basePath),
		"https://r13v.github.io/form-please",
	)
})

test("sitemap URLs preserve root deployments and the preview origin", () => {
	const url = "https://r13v.github.io/get-started"
	assert.equal(prefixSitemapUrl(url, "/"), url)
	assert.equal(prefixSitemapUrl(url, ""), url)
	assert.equal(
		prefixSitemapUrl("http://127.0.0.1:4175/examples/history", basePath),
		"http://127.0.0.1:4175/form-please/examples/history",
	)
})

test("prefixMarkdownLinks adds the base path to root-relative links", () => {
	assert.equal(
		prefixMarkdownLinks("- [Get started](/get-started): Install.", basePath),
		"- [Get started](/form-please/get-started): Install.",
	)
	assert.equal(
		prefixMarkdownLinks(
			"[History](/examples/history) and [Submitter](/workflows#understand-submitter)",
			`${basePath}/`,
		),
		"[History](/form-please/examples/history) and [Submitter](/form-please/workflows#understand-submitter)",
	)
})

test("prefixMarkdownLinks maps /index to the site root", () => {
	assert.equal(
		prefixMarkdownLinks("[Form, Please](/index)", basePath),
		"[Form, Please](/form-please/)",
	)
	for (const [href, expected] of [
		["/index#why", "/form-please/#why"],
		["/index?x", "/form-please/?x"],
		["/index/", "/form-please/"],
		["/indexes", "/form-please/indexes"],
	]) {
		assert.equal(
			prefixMarkdownLinks(`[Link](${href})`, basePath),
			`[Link](${expected})`,
		)
	}
})

test("prefixMarkdownLinks keeps links that need no base path", () => {
	for (const markdown of [
		"[Get started](/form-please/get-started)",
		"[Home](/form-please)",
		"[Search](/form-please?x)",
		"[Top](/form-please#top)",
		"[Releases](https://github.com/r13v/form-please/releases)",
		"[CDN](//cdn.example.com/file.js)",
		"[Below](#below)",
	]) {
		assert.equal(prefixMarkdownLinks(markdown, basePath), markdown)
	}
})

test("prefixMarkdownLinks prefixes a path that only starts like the base path", () => {
	assert.equal(
		prefixMarkdownLinks("[Lookalike](/form-pleased)", basePath),
		"[Lookalike](/form-please/form-pleased)",
	)
})

test("prefixMarkdownLinks prefixes image links", () => {
	assert.equal(
		prefixMarkdownLinks("![Logo](/brand/logo.png)", basePath),
		"![Logo](/form-please/brand/logo.png)",
	)
})

test("prefixMarkdownLinks skips inline code", () => {
	assert.equal(
		prefixMarkdownLinks("[API](/api) and `[Docs](/api)`", basePath),
		"[API](/form-please/api) and `[Docs](/api)`",
	)
})

test("prefixMarkdownLinks replaces the MDX base URL template", () => {
	// biome-ignore lint/suspicious/noTemplateCurlyInString: the input is MDX output text.
	const markdown = "<a href={`${import.meta.env.BASE_URL}workflows`}>Go</a>"

	assert.equal(
		prefixMarkdownLinks(markdown, basePath),
		'<a href="/form-please/workflows">Go</a>',
	)
	assert.equal(
		prefixMarkdownLinks(markdown, "/"),
		'<a href="/workflows">Go</a>',
	)
})

test("the Markdown output transform replaces templates and leaves links for validation", () => {
	const page =
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the input is MDX output text.
		"<a href={`${import.meta.env.BASE_URL}workflows`}>Go</a> [Next](/arrays)"
	const index = "- [Arrays](/arrays.md): Rows."

	assert.deepEqual(
		transformMarkdownOutput({ index, pages: { "/": page } }, basePath),
		{
			index,
			pages: { "/": '<a href="/form-please/workflows">Go</a> [Next](/arrays)' },
		},
	)
})

test("prefixMarkdownLinks keeps the MDX base URL template in inline code", () => {
	const markdown = [
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the input is MDX output text.
		"Write `` {`${import.meta.env.BASE_URL}workflows`} `` in MDX.",
		// biome-ignore lint/suspicious/noTemplateCurlyInString: the input is MDX output text.
		"<a href={`${import.meta.env.BASE_URL}workflows`}>Go</a> and ``[Docs](/api)``",
	].join("\n")

	assert.equal(
		prefixMarkdownLinks(markdown, basePath),
		[
			// biome-ignore lint/suspicious/noTemplateCurlyInString: the expected output keeps the template.
			"Write `` {`${import.meta.env.BASE_URL}workflows`} `` in MDX.",
			'<a href="/form-please/workflows">Go</a> and ``[Docs](/api)``',
		].join("\n"),
	)
})

test("prefixMarkdownLinks skips code fences", () => {
	const markdown = [
		"[Before](/api)",
		"````md",
		"[Inside](/api)",
		"```",
		"~~~",
		"[Still inside](/api)",
		"````ts",
		"[Still inside after an info string](/api)",
		"````",
		"[After](/api)",
	].join("\n")

	assert.equal(
		prefixMarkdownLinks(markdown, basePath),
		[
			"[Before](/form-please/api)",
			"````md",
			"[Inside](/api)",
			"```",
			"~~~",
			"[Still inside](/api)",
			"````ts",
			"[Still inside after an info string](/api)",
			"````",
			"[After](/form-please/api)",
		].join("\n"),
	)
})

test("prefixMarkdownLinks changes nothing for base path /", () => {
	const markdown = "[Get started](/get-started) and [Home](/index)"

	assert.equal(prefixMarkdownLinks(markdown, "/"), markdown)
	assert.equal(prefixMarkdownLinks(markdown, ""), markdown)
})

test("proseSegments yields only the text outside code", () => {
	const markdown = [
		"Use `form.submit()` to send.",
		"````md",
		"```ts",
		"hidden",
		"```",
		"````",
		"~~~",
		"hidden",
		"~~~",
		"Done.",
	].join("\n")

	assert.deepEqual([...proseSegments(markdown)], ["Use ", " to send.", "Done."])
})
