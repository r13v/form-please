import assert from "node:assert/strict"
import { access, readdir, readFile } from "node:fs/promises"
import { test } from "node:test"
import { proseSegments } from "../../scripts/fix-vocs-llms-links.mjs"
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

test("the plain-text full file includes the same text as each Markdown page", async () => {
	const full = await readFile(new URL("llms-full.txt", publicRoot), "utf8")
	for (const { markdown: file } of pages) {
		const markdown = await readFile(new URL(file, publicRoot), "utf8")
		assert.ok(
			full.includes(markdown.trim()),
			`llms-full.txt is missing ${file}`,
		)
	}
})

test("LLM files link to built pages under the base path", async () => {
	let checked = 0

	for (const file of llmFiles) {
		const markdown = await readFile(new URL(file, publicRoot), "utf8")
		assert.doesNotMatch(markdown, /import\.meta\.env/, `${file} has a template`)
		const hrefs = []
		for (const text of proseSegments(markdown)) {
			for (const [, href] of text.matchAll(
				/(?:\]\(|\]:\s*|href=")(\/(?!\/)[^)\s"]*)/g,
			)) {
				hrefs.push(href)
			}
		}

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

test("the AI agents page and skill list LLM files that the build emits", async () => {
	for (const source of [
		new URL("src/pages/ai-agents.mdx", siteRoot),
		new URL("../skills/form-please/SKILL.md", siteRoot),
	]) {
		const page = await readFile(source, "utf8")
		const files = Array.from(
			page.matchAll(/https:\/\/r13v\.github\.io\/form-please\/([^\s)`<]+)/g),
			([, file]) => file,
		).filter((file) => /\.(md|txt)$/.test(file))

		assert.ok(files.length > 0, `${source.pathname} lists no LLM files`)
		for (const file of files) {
			await access(new URL(file, publicRoot))
		}
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

test("sitemap, robots, metadata, and HTML links agree on the deployment path", async () => {
	const firstPage = await readFile(
		new URL("get-started/index.html", publicRoot),
		"utf8",
	)
	const [, firstCanonical] =
		firstPage.match(/<link rel="canonical" href="([^"]+)"/) ?? []
	assert.ok(firstCanonical, "missing canonical URL")
	const origin = new URL(firstCanonical).origin
	const expectedUrls = []

	for (const { route } of pages) {
		const path = `${basePath}${route}`
		const expectedUrl = `${origin}${path.replace(/\/$/, "") || "/"}`
		// Vocs keeps the trailing slash for the site root.
		const canonical = route === "/" ? `${origin}${basePath}/` : expectedUrl
		expectedUrls.push(canonical)
		const html = await readFile(new URL(builtFileFor(path), publicRoot), "utf8")
		assert.ok(
			html.includes(`<link rel="canonical" href="${canonical}"`),
			`${route} must have canonical URL ${canonical}`,
		)
		assert.ok(
			html.includes(`<meta property="og:url" content="${canonical}"`),
			`${route} must have og:url ${canonical}`,
		)

		for (const [, href] of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
			if (!href.startsWith("/") && !href.startsWith(`${origin}/`)) continue
			const url = new URL(href, origin)
			if (url.origin !== origin) continue
			assert.ok(
				url.pathname === basePath || url.pathname.startsWith(`${basePath}/`),
				`${route} links outside the deployment: ${href}`,
			)
			if (basePath !== "") {
				assert.ok(
					!url.pathname.startsWith(`${basePath}${basePath}/`),
					`${route} doubles the deployment path: ${href}`,
				)
			}
		}
	}

	const sitemap = await readFile(new URL("sitemap.xml", publicRoot), "utf8")
	const urls = Array.from(
		sitemap.matchAll(/<loc>([^<]+)<\/loc>/g),
		([, url]) => url,
	)
	assert.deepEqual(urls.sort(), expectedUrls.sort())
	const robots = await readFile(new URL("robots.txt", publicRoot), "utf8")
	assert.match(robots, /^User-agent: \*\nAllow: \/\n/m)
	assert.deepEqual(
		robots.split("\n").filter((line) => line.startsWith("Sitemap:")),
		[`Sitemap: ${origin}${basePath}/sitemap.xml`],
	)
})
