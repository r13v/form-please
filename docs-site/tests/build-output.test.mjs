import assert from "node:assert/strict"
import { access, readdir, readFile } from "node:fs/promises"
import { test } from "node:test"
import { normalizeBasePath } from "../../scripts/fix-vocs-skip-links.mjs"
import { pages } from "./pages.mjs"

const publicRoot = new URL("../dist/public/", import.meta.url)
const expectProductionUrl = process.env.EXPECT_PRODUCTION_URL === "true"
const basePath = normalizeBasePath(process.env.BASE_PATH ?? "/")

test("Vocs emits the Markdown file of each page and the index artifacts", async () => {
	assert.ok(pages.length > 0, "the page list must not be empty")
	for (const file of [
		"index.html",
		"404.html",
		...pages.map(({ markdown }) => markdown),
		"llms.txt",
		"llms-full.txt",
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
	for (const file of htmlFiles) {
		const html = await readFile(new URL(file, publicRoot), "utf8")
		ids.set(
			file,
			new Set(Array.from(html.matchAll(/\sid="([^"]+)"/g), ([, id]) => id)),
		)
	}
	let checked = 0

	for (const file of htmlFiles) {
		const html = await readFile(new URL(file, publicRoot), "utf8")
		for (const [, href] of html.matchAll(/\shref="([^"]*#[^"]*)"/g)) {
			const [pathWithQuery, hash] = href.split("#")
			const path = pathWithQuery.replace(/\?.*$/, "")
			if (hash === "vocs-content" || /^[a-z]+:|^\/\//i.test(path)) continue
			let target = file
			if (path !== "") {
				const route = (
					path.startsWith(`${basePath}/`) || path === basePath
						? path.slice(basePath.length)
						: path
				).replace(/^\/+|\/+$/g, "")
				target = route === "" ? "index.html" : `${route}/index.html`
			}
			assert.ok(ids.has(target), `${file} links to missing page ${href}`)
			assert.ok(
				ids.get(target).has(decodeURIComponent(hash)),
				`${file} links to missing anchor ${href}`,
			)
			checked++
		}
	}

	assert.ok(checked > 0, "no anchor links were checked")
})

test("generated LLM documentation describes the current runtime", async () => {
	const full = await readFile(new URL("llms-full.txt", publicRoot), "utf8")
	assert.match(full, /FormProvider/)
	assert.match(full, /Controller/)
	assert.match(full, /useFormState/)
	assert.match(full, /complete schema input/i)
	assert.match(full, /Hidden fields preserve/i)
	assert.match(full, /stable field-array ID/i)
	assert.match(full, /useWatch/)
	assert.match(full, /fromResource/)
	assert.match(full, /parses once/i)
	assert.match(full, /does not create another form store/i)
	assert.match(full, /Call `next` before the first `await`/)
	assert.match(full, /HistoryJournal<Input>` version 1/)
	assert.match(full, /createHistoryMiddleware/)
	assert.match(full, /createPersistenceMiddleware/)
	assert.match(full, /Persistence restore \| `persistence`/)
})

test("LLM files link to built pages under the base path", async () => {
	if (basePath === "") return
	const markdownFiles = (
		await readdir(new URL("assets/md/", publicRoot), { recursive: true })
	)
		.filter((name) => name.endsWith(".md"))
		.map((name) => `assets/md/${name}`)
	let checked = 0

	for (const file of ["llms.txt", "llms-full.txt", ...markdownFiles]) {
		const markdown = await readFile(new URL(file, publicRoot), "utf8")

		for (const [, href] of markdown.matchAll(/\]\((\/[^)\s]*)/g)) {
			assert.ok(
				href.startsWith(`${basePath}/`),
				`${file} links to ${href} without ${basePath}`,
			)
			const route = href
				.slice(basePath.length)
				.replace(/[#?].*$/, "")
				.replace(/^\/+|\/+$/g, "")
			await access(
				new URL(
					route === "" ? "index.html" : `${route}/index.html`,
					publicRoot,
				),
			)
			checked++
		}
	}

	assert.ok(checked > 0, "no root-relative links were checked")
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
