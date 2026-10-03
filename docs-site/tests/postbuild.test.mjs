import assert from "node:assert/strict"
import { test } from "node:test"
import {
	prefixMarkdownLinks,
	proseSegments,
} from "../../scripts/fix-vocs-llms-links.mjs"
import { prefixSitemapUrl } from "../../scripts/fix-vocs-sitemap.mjs"

const basePath = "/form-please"

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
