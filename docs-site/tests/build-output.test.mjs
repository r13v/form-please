import assert from "node:assert/strict"
import { access, readdir, readFile } from "node:fs/promises"
import { test } from "node:test"
import {
	mapOutsideInlineCode,
	mapProseLines,
} from "../../scripts/fix-vocs-llms-links.mjs"
import { normalizeBasePath } from "../../scripts/fix-vocs-skip-links.mjs"
import { pages } from "./pages.mjs"

const siteRoot = new URL("../", import.meta.url)
const publicRoot = new URL("dist/public/", siteRoot)
const expectProductionUrl = process.env.EXPECT_PRODUCTION_URL === "true"
const basePath = normalizeBasePath(process.env.BASE_PATH ?? "/")
const llmFiles = ["llms.txt", "llms-full.txt", ...pages.map((p) => p.markdown)]

/** The built file that a root-relative href under the base path opens. */
function builtFileFor(href) {
	const path = href.replace(/[?#].*$/, "")
	const route = (
		path === basePath || path.startsWith(`${basePath}/`)
			? path.slice(basePath.length)
			: path
	).replace(/^\/+|\/+$/g, "")
	if (/\.\w+$/.test(route)) return route
	return route === "" ? "index.html" : `${route}/index.html`
}

test("Vocs emits the Markdown file of each page and the index artifacts", async () => {
	for (const file of [
		"index.html",
		"404.html",
		...llmFiles,
		"sitemap.xml",
		"robots.txt",
	]) {
		await access(new URL(file, publicRoot))
	}
})

test("each internal anchor link matches an id on its target page", async () => {
	const htmlFiles = (await readdir(publicRoot, { recursive: true })).filter(
		(name) => name === "index.html" || name.endsWith("/index.html"),
	)
	const ids = new Map()
	const links = []
	for (const file of htmlFiles) {
		const html = await readFile(new URL(file, publicRoot), "utf8")
		ids.set(
			file,
			new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), ([, id]) => id)),
		)
		for (const [, href] of html.matchAll(/\shref="([^"]*#[^"]*)"/g)) {
			links.push([file, href])
		}
	}
	let checked = 0

	for (const [file, href] of links) {
		const [path, hash] = href.split("#")
		if (hash === "vocs-content" || /^[a-z]+:|^\/\//i.test(path)) continue
		const target = path.replace(/\?.*$/, "") === "" ? file : builtFileFor(path)
		assert.ok(ids.has(target), `${file} links to missing page ${href}`)
		assert.ok(
			ids.get(target).has(decodeURIComponent(hash)),
			`${file} links to missing anchor ${href}`,
		)
		checked++
	}

	assert.ok(checked > 0, "no anchor links were checked")
})

test("generated LLM documentation describes the current runtime", async () => {
	const full = await readFile(new URL("llms-full.txt", publicRoot), "utf8")
	assert.match(full, /FormProvider/)
	assert.match(full, /Controller/)
	assert.match(full, /useFormState/)
	assert.match(full, /complete schema input/i)
	assert.match(full, /stable field-array ID/i)
	assert.match(full, /useWatch/)
	assert.match(full, /fromResource/)
	assert.match(full, /does not create another form store/i)
	assert.match(full, /Call `next` before the first `await`/)
	assert.match(full, /HistoryJournal<Input>` version 1/)
	assert.match(full, /createHistoryMiddleware/)
	assert.match(full, /createPersistenceMiddleware/)
	assert.match(full, /Persistence restore \| `persistence`/)
})

test("LLM files link to built pages under the base path", async () => {
	let checked = 0

	for (const file of llmFiles) {
		const markdown = await readFile(new URL(file, publicRoot), "utf8")
		assert.doesNotMatch(markdown, /import\.meta\.env/, `${file} has a template`)
		const hrefs = []
		mapProseLines(markdown, (line) =>
			mapOutsideInlineCode(line, (text) => {
				for (const [, href] of text.matchAll(
					/(?:\]\(|\]:\s*|href=")(\/(?!\/)[^)\s"]*)/g,
				)) {
					hrefs.push(href)
				}
				return text
			}),
		)

		for (const href of hrefs) {
			assert.ok(
				href === basePath || href.startsWith(`${basePath}/`),
				`${file} links to ${href} without ${basePath}`,
			)
			await access(new URL(builtFileFor(href), publicRoot))
			checked++
		}
	}

	assert.ok(checked > 0, "no root-relative links were checked")
})

test("the AI agents page lists LLM files that the build emits", async () => {
	const page = await readFile(
		new URL("src/pages/ai-agents.mdx", siteRoot),
		"utf8",
	)
	const files = Array.from(
		page.matchAll(/https:\/\/r13v\.github\.io\/form-please\/([^\s)`<]+)/g),
		([, file]) => file,
	).filter((file) => /\.(md|txt)$/.test(file))

	assert.ok(files.length > 0, "ai-agents.mdx lists no LLM files")
	for (const file of files) {
		await access(new URL(file, publicRoot))
	}
})

test("production metadata uses the GitHub Pages URL", async () => {
	if (!expectProductionUrl) return
	const html = await readFile(
		new URL("get-started/index.html", publicRoot),
		"utf8",
	)
	assert.doesNotMatch(html, /http:\/\/127\.0\.0\.1/)
	assert.match(
		html,
		/<link rel="canonical" href="https:\/\/r13v\.github\.io\/form-please\/get-started"/,
	)
})
