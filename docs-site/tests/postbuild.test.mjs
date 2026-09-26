import assert from "node:assert/strict"
import { test } from "node:test"
import { prefixMarkdownLinks } from "../../scripts/fix-vocs-llms-links.mjs"

const basePath = "/form-please"

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
	assert.equal(
		prefixMarkdownLinks("[Why](/index#why)", basePath),
		"[Why](/form-please/#why)",
	)
})

test("prefixMarkdownLinks keeps links that need no base path", () => {
	for (const markdown of [
		"[Get started](/form-please/get-started)",
		"[Home](/form-please)",
		"[Releases](https://github.com/r13v/form-please/releases)",
		"[CDN](//cdn.example.com/file.js)",
		"[Below](#below)",
	]) {
		assert.equal(prefixMarkdownLinks(markdown, basePath), markdown)
	}
	assert.equal(
		prefixMarkdownLinks("[Lookalike](/form-pleased)", basePath),
		"[Lookalike](/form-please/form-pleased)",
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
