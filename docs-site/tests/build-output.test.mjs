import assert from "node:assert/strict"
import { access, readdir, readFile } from "node:fs/promises"
import { test } from "node:test"
import { normalizeBasePath } from "../../scripts/fix-vocs-skip-links.mjs"

const publicRoot = new URL("../dist/public/", import.meta.url)
const expectProductionUrl = process.env.EXPECT_PRODUCTION_URL === "true"
const basePath = normalizeBasePath(process.env.BASE_PATH ?? "/")

test("Vocs emits every supported Markdown route and index artifact", async () => {
	for (const file of [
		"index.html",
		"404.html",
		"assets/md/index.md",
		"assets/md/get-started.md",
		"assets/md/playground.md",
		"assets/md/ai-agents.md",
		"assets/md/definitions.md",
		"assets/md/validation.md",
		"assets/md/conditional-fields.md",
		"assets/md/arrays.md",
		"assets/md/middleware.md",
		"assets/md/history.md",
		"assets/md/persistence.md",
		"assets/md/form-kits.md",
		"assets/md/resources.md",
		"assets/md/styling.md",
		"assets/md/api.md",
		"assets/md/recipes.md",
		"assets/md/types.md",
		"assets/md/faqs.md",
		"assets/md/examples.md",
		"assets/md/examples/history.md",
		"assets/md/examples/persistence.md",
		"assets/md/examples/mui-yup.md",
		"assets/md/examples/shadcn-valibot.md",
		"assets/md/examples/async-multiselect.md",
		"assets/md/examples/research-grant.md",
		"assets/md/examples/studio-policies.md",
		"assets/md/examples/makerspace-launch.md",
		"assets/md/examples/learning-cohort.md",
		"assets/md/examples/membership-ladder.md",
		"assets/md/examples/campaign-builder.md",
		"llms.txt",
		"llms-full.txt",
		"sitemap.xml",
		"robots.txt",
	]) {
		await access(new URL(file, publicRoot))
	}
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
