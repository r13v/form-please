import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { test } from "node:test"
import { pages, sidebarLinks } from "./pages.mjs"

const siteRoot = new URL("../", import.meta.url)
const repositoryRoot = new URL("../", siteRoot)

test("uses Twoslash for complete TypeScript snippets", async () => {
	for (const { source: path } of pages) {
		const source = await readFile(new URL(path, siteRoot), "utf8")
		const completeSnippets = source.matchAll(
			/^```(?:ts|tsx)([^\n]*)\n\/\/ \[!include ~\/snippets\/[^\]: ]+\]\n```/gm,
		)

		for (const snippet of completeSnippets) {
			assert.match(
				snippet[1],
				/\btwoslash\b/,
				`${path} must use Twoslash for each complete TypeScript snippet`,
			)
		}
	}
})

test("keeps every page route in navigation", () => {
	for (const { route, source } of pages) {
		assert.ok(sidebarLinks.has(route), `${source} has no sidebar link ${route}`)
	}
})

test("documents the complete agent skill lifecycle", async () => {
	const page = await readFile(
		new URL("src/pages/ai-agents.mdx", siteRoot),
		"utf8",
	)

	for (const required of [
		"npx skills add r13v/form-please --skill form-please",
		"--global",
		"Use the form-please skill.",
		"npx skills list",
		"npx skills update form-please",
		"https://r13v.github.io/form-please/llms.txt",
	]) {
		assert.match(page, new RegExp(escapeRegExp(required)))
	}
})

test("includes the live devtools example", async () => {
	const page = await readFile(
		new URL("src/pages/devtools.mdx", siteRoot),
		"utf8",
	)
	assert.match(page, /<DevtoolsDemo \/>/)
})

test("keeps the async multiselect example copyable and production-shaped", async () => {
	const page = await readFile(
		new URL("src/pages/examples/async-multiselect.mdx", siteRoot),
		"utf8",
	)

	for (const region of [
		"schema-values",
		"option-contract",
		"register-control",
		"demo-query",
		"query-state",
		"field-definition",
		"label-cache",
		"provider-submit",
	]) {
		assert.match(page, new RegExp(`async-multiselect\\.tsx:${region}`))
	}

	for (const phrase of [
		"async-multiselect-request.ts",
		"Pass the TanStack Query `AbortSignal` to `fetch`",
		"The generic async field `options` API loads a complete list",
		"Pass the asynchronous function through",
		"The server must confirm",
	]) {
		assert.match(page, new RegExp(escapeRegExp(phrase)))
	}
	assert.match(page, /Its CSS class\s+names have no library styles/)

	await access(new URL("src/snippets/async-multiselect-request.ts", siteRoot))
	await assert.rejects(
		access(new URL("src/pages/async-multiselect.mdx", siteRoot)),
	)
})

test("keeps validation guidance executable and complete", async () => {
	const validation = await readFile(
		new URL("src/pages/validation.mdx", siteRoot),
		"utf8",
	)

	for (const region of ["schema", "definition", "submission", "form-issue"]) {
		assert.match(validation, new RegExp(`validation-guide\\.tsx:${region}`))
	}

	for (const phrase of ["first submit attempt", "kit.AutoForm"]) {
		assert.match(validation, new RegExp(escapeRegExp(phrase)))
	}
})

test("lists each library i18n key in the localization table", async () => {
	const guide = await readFile(
		new URL("src/pages/localization.mdx", siteRoot),
		"utf8",
	)
	const [header, , ...rows] = guide
		.split("\n")
		.filter((line) => line.startsWith("|"))
		.map((line) =>
			line
				.split("|")
				.slice(1, -1)
				.map((cell) => cell.trim()),
		)
	const defaultColumn = header.findIndex((cell) => cell.includes("English"))
	assert.notEqual(defaultColumn, -1, "the table has no English default column")

	for (const [path, objectName, factory] of [
		[
			"src/default-slots/default-slots.tsx",
			"englishDefaultSlotsI18n",
			"createDefaultSlots",
		],
		["src/preset-mui/index.ts", "defaultI18n", "createMuiFormKit"],
	]) {
		const source = await readFile(new URL(path, repositoryRoot), "utf8")
		const body = source.match(
			new RegExp(`const ${objectName} = [^{]*\\{\\n([\\s\\S]*?)\\n\\}`),
		)?.[1]
		assert.ok(body, `${path} has no ${objectName} object`)
		const defaults = new Map(
			body
				.split("\n")
				.filter((line) => line.trim() !== "")
				.map((line) => {
					const entry = line.match(/^\t(\w+): (?:"([^"]*)"|.*`([^`]*)`)/)
					assert.ok(entry, `${path} has an unreadable i18n entry: ${line}`)
					const [, key, text, template] = entry
					return [key, text ?? template.replace(/\$\{[^}]+\}/g, "1")]
				}),
		)
		const column = header.findIndex((cell) => cell.includes(factory))
		assert.notEqual(column, -1, `the table has no ${factory} column`)
		const listed = new Map(
			rows
				.filter((row) => row[column] !== "—")
				.map((row) => [row[column].replace(/^`|`$/g, ""), row[defaultColumn]]),
		)

		assert.deepEqual(
			[...listed.keys()].sort(),
			[...defaults.keys()].sort(),
			`the ${factory} column must list the keys of ${path}`,
		)
		for (const [key, text] of defaults) {
			assert.equal(listed.get(key), text, `wrong English default for ${key}`)
		}
	}
})

test("keeps form kits, API, and production guidance executable", async () => {
	const api = await readFile(new URL("src/pages/api.mdx", siteRoot), "utf8")
	const formKits = await readFile(
		new URL("src/pages/form-kits.mdx", siteRoot),
		"utf8",
	)
	const recipes = await readFile(
		new URL("src/pages/recipes.mdx", siteRoot),
		"utf8",
	)
	const styling = await readFile(
		new URL("src/pages/styling.mdx", siteRoot),
		"utf8",
	)
	const accessibility = await readFile(
		new URL("src/pages/accessibility.mdx", siteRoot),
		"utf8",
	)

	for (const region of [
		"use-snapshot",
		"define-control",
		"create-form-kit",
		"native-factories",
		"native-preset",
		"mui-preset",
		"define-form",
		"render-node",
		"context-kit",
		"use-form",
		"value-middleware",
		"manual-composition",
		"resource-resolver",
		"resources",
	]) {
		assert.match(api, new RegExp(`api-reference\\.tsx:${region}`))
	}

	for (const region of [
		"composition",
		"edit-baseline",
		"saved-baseline",
		"atomic-values",
		"draft-subscription",
		"step-validation",
		"async-submit",
		"server-response",
		"server-field-errors",
		"reset-baseline",
		"parsed-output",
		"json-request",
		"multipart-body",
		"context-resource",
		"form-modes",
	]) {
		assert.match(recipes, new RegExp(`production-recipes\\.tsx:${region}`))
	}
	assert.match(accessibility, /production-recipes\.tsx:accessible-control/)
	for (const preview of [
		"SavedBaselineRecipePreview",
		"AtomicValuesRecipePreview",
		"DraftSubscriptionRecipePreview",
		"StepValidationRecipePreview",
	]) {
		assert.match(recipes, new RegExp(`<${preview} />`))
	}
	for (const version of ["7.77.0", "7.76.1"]) {
		assert.match(recipes, new RegExp(`React Hook Form ${version}`))
	}
	assert.doesNotMatch(recipes, /parses once for validation and\s+again/)
	assert.doesNotMatch(styling, /data-fp-path\^="contacts\["/)

	assert.match(formKits, /form-kits-control\.tsx/)
	for (const region of ["schema", "definition", "component"]) {
		const getStarted = await readFile(
			new URL("src/pages/get-started.mdx", siteRoot),
			"utf8",
		)
		assert.match(getStarted, new RegExp(`profile-form\\.tsx:${region}`))
	}
	for (const region of [
		"register-control",
		"control-options",
		"project-form",
		"field-slot",
		"array-slot",
		"submit-slot",
		"slot-registry",
		"slot-options",
	]) {
		assert.match(formKits, new RegExp(`form-kits\\.tsx:${region}`))
	}
	const definitions = await readFile(
		new URL("src/pages/definitions.mdx", siteRoot),
		"utf8",
	)
	const arrays = await readFile(
		new URL("src/pages/arrays.mdx", siteRoot),
		"utf8",
	)
	const conditional = await readFile(
		new URL("src/pages/conditional-fields.mdx", siteRoot),
		"utf8",
	)
	assert.match(definitions, /api-reference\.tsx:render-node/)
	assert.match(arrays, /lab-profile-form\.tsx:array-node/)
	assert.match(conditional, /lab-profile-form\.tsx:conditional-field/)
})

test("keeps the product workflow tutorial copyable and explicit", async () => {
	const workflows = await readFile(
		new URL("src/pages/workflows.mdx", siteRoot),
		"utf8",
	)
	const makerspace = await readFile(
		new URL("src/pages/examples/makerspace-launch.mdx", siteRoot),
		"utf8",
	)

	for (const snippet of [
		"product-workflow.tsx",
		"workflow-review.tsx",
		"workflow-router-guard.tsx",
		"workflow-server-issues.tsx",
		"workflow-submit-actions.tsx",
	]) {
		assert.match(workflows, new RegExp(`${escapeRegExp(snippet)}\\]`))
	}
	for (const phrase of [
		"validateAllAndFocusFirstInvalid",
		"persistence.flush()",
		"Readonly<{ name: string; value: string }> | null",
		"captured before validation",
		"does not retain a live DOM element",
		"confirmation uses a server receipt",
		"changes navigation only",
		"rejects unexpected submitter names or values",
	]) {
		assert.match(workflows, new RegExp(escapeRegExp(phrase), "i"))
	}
	assert.match(workflows, /```tsx twoslash/g)
	assert.match(makerspace, /external React state/i)
	assert.match(makerspace, /only when the server stores it as a domain field/i)
})

test("documents every managed value type on the TypeScript page", async () => {
	const types = await readFile(new URL("src/pages/types.mdx", siteRoot), "utf8")

	for (const name of [
		"FormUpdateRecipe",
		"FormMiddleware",
		"FormMiddlewareApi",
		"FormMiddlewareNext",
		"ValueTransaction",
		"ValueTransactionSource",
		"ValuePatch",
	]) {
		assert.match(types, new RegExp(`\\b${name}\\b`))
	}
	for (const name of [
		"JsonValue",
		"PersistenceCodec",
		"PersistenceMigration",
		"FormPersistenceAdapter",
		"CreatePersistenceOptions",
		"PersistenceFeature",
		"PersistenceHandle",
		"PersistenceSnapshot",
		"PersistenceRestoreResult",
	]) {
		assert.match(types, new RegExp(`\\b${name}\\b`))
	}
})

test("documents middleware with copyable examples and live previews", async () => {
	const middleware = await readFile(
		new URL("src/pages/middleware.mdx", siteRoot),
		"utf8",
	)
	const normalizedMiddleware = middleware.replace(/\s+/g, " ")

	for (const region of [
		"derived-value",
		"derived-value-form",
		"cancellation",
		"async-after-next",
	]) {
		assert.match(middleware, new RegExp(`middleware-guide\\.tsx:${region}`))
	}

	for (const preview of [
		"DerivedTotalMiddlewareDemo",
		"CancellationMiddlewareDemo",
		"ComplexMiddlewareEditingDemo",
	]) {
		assert.match(middleware, new RegExp(`<${preview} />`))
	}

	for (const phrase of [
		"does not create another form store",
		"`beforeUpdate` and `afterUpdate` provide one application callback",
		"If both fail after commit, dispatch throws an `AggregateError`",
		"Call `next` before the first `await`",
		"Supply consistent derived values in `defaultValues`",
		"Call `api.getValues()` after synchronous `next`",
		"`FormMiddlewareNext` and `form.update` return `unknown`",
		"application-owned `useFieldArray` operations",
		"do not promise one raw RHF publication",
		"not frozen or cloned as archival",
		"18 text inputs",
		"manual check, not a repeatable benchmark",
	]) {
		assert.match(normalizedMiddleware, new RegExp(escapeRegExp(phrase), "i"))
	}
	assert.match(middleware, /api-reference\.tsx:update-hooks/)

	for (const path of [
		"src/pages/recipes.mdx",
		"src/pages/api.mdx",
		"src/pages/arrays.mdx",
		"src/pages/conditional-fields.mdx",
		"src/pages/faqs.mdx",
		"src/pages/types.mdx",
	]) {
		const relatedPage = await readFile(new URL(path, siteRoot), "utf8")
		assert.match(relatedPage, /\[Value middleware\]\(\/middleware\)/)
	}
})

test("documents managed value history with a copyable live example", async () => {
	const guide = await readFile(
		new URL("src/pages/history.mdx", siteRoot),
		"utf8",
	)
	const example = await readFile(
		new URL("src/pages/examples/history.mdx", siteRoot),
		"utf8",
	)
	const normalizedGuide = guide.replace(/\s+/g, " ")

	for (const region of ["setup", "journal"]) {
		assert.match(guide, new RegExp(`history-guide\\.tsx:${region}`))
	}
	for (const phrase of [
		"HistoryJournal<Input>` version 1",
		"non-undoable boundary",
		"temporarily invalid values",
		"does not create another live form store",
	]) {
		assert.match(normalizedGuide, new RegExp(escapeRegExp(phrase), "i"))
	}
	assert.match(example, /<HistoryDemo \/>/)
	assert.match(example, /history-guide\.tsx/)
	assert.match(example, /useHistory\(form, feature\)/)
})

test("documents persistence with query string and storage adapters", async () => {
	const guide = await readFile(
		new URL("src/pages/persistence.mdx", siteRoot),
		"utf8",
	)
	const example = await readFile(
		new URL("src/pages/examples/persistence.mdx", siteRoot),
		"utf8",
	)

	for (const snippet of [
		"persistence-local-storage.tsx:local-storage",
		"persistence-nuqs.ts",
		"persistence-tanstack-query.ts:tanstack-query",
	]) {
		assert.match(guide, new RegExp(escapeRegExp(snippet)))
	}
	for (const phrase of [
		"restore failure",
		"does not run validation",
		"trailing 500 ms",
		"createDateCodec()",
		"`replace` history",
		"shallow URL updates",
	]) {
		assert.match(guide, new RegExp(escapeRegExp(phrase), "i"))
	}
	const middleware = await readFile(
		new URL("src/pages/middleware.mdx", siteRoot),
		"utf8",
	)
	assert.match(middleware, /\| Persistence restore \| `persistence` \|/)
	assert.match(example, /<PersistenceDemo \/>/)
	assert.match(example, /persistence-basics\.tsx/)
	assert.match(example, /usePersistence\(form, feature\)/)
})

test("keeps the shadcn adapter installable and release-version agnostic", async () => {
	const registry = JSON.parse(
		await readFile(new URL("registry.json", repositoryRoot), "utf8"),
	)
	const components = JSON.parse(
		await readFile(new URL("components.json", siteRoot), "utf8"),
	)
	const page = await readFile(
		new URL("src/pages/examples/shadcn-valibot.mdx", siteRoot),
		"utf8",
	)
	const rootPackage = JSON.parse(
		await readFile(new URL("package.json", repositoryRoot), "utf8"),
	)
	const rootCss = await readFile(
		new URL("src/pages/_root.css", siteRoot),
		"utf8",
	)
	const [item] = registry.items

	assert.equal(
		item.dependencies.some((dependency) =>
			dependency.startsWith("form-please@"),
		),
		false,
	)
	assert.equal(components.style, "base-nova")
	assert.equal(components.aliases.ui, "#components/ui")
	assert.match(rootCss, /@import "tw-animate-css"/)
	assert.match(page, /npx shadcn@latest add r13v\/form-please\/shadcn-form-kit/)
	assert.match(page, /registry manifest/)
	assert.equal(
		rootPackage.scripts["test:registry"],
		"node scripts/verify-shadcn-registry.mjs",
	)
	assert.match(rootPackage.scripts.verify, /npm run test:registry/)
})

test("the physical example uses only public package imports", async () => {
	const snippet = await readFile(
		new URL("src/snippets/profile-form.tsx", siteRoot),
		"utf8",
	)
	assert.match(snippet, /from "form-please\/preset-native"/)
	assert.doesNotMatch(snippet, /from "\.\.\//)
	assert.doesNotMatch(snippet, /src\//)

	const packageJson = JSON.parse(
		await readFile(new URL("package.json", siteRoot), "utf8"),
	)
	assert.equal(packageJson.dependencies["form-please"], "file:..")
})

test("documents each public export on the API or TypeScript page", async () => {
	const docs = [
		await readFile(new URL("src/pages/api.mdx", siteRoot), "utf8"),
		await readFile(new URL("src/pages/types.mdx", siteRoot), "utf8"),
	].join("\n")
	const packageJson = JSON.parse(
		await readFile(new URL("package.json", repositoryRoot), "utf8"),
	)
	const tsdownEntries = new Map(
		Array.from(
			(
				await readFile(new URL("tsdown.config.ts", repositoryRoot), "utf8")
			).matchAll(/^\t\t"?([\w-]+)"?: "(src\/[^"]+)"/gm),
			([, name, file]) => [name, file],
		),
	)
	const entries = Object.keys(packageJson.exports)
		.filter((key) => !/\.\w+$/.test(key))
		.map((key) => {
			const entry = tsdownEntries.get(key === "." ? "index" : key.slice(2))
			assert.ok(entry, `tsdown.config.ts has no entry for export ${key}`)
			return entry
		})
	const names = new Set()

	for (const entry of entries) {
		const source = await readFile(new URL(entry, repositoryRoot), "utf8")
		assert.doesNotMatch(
			source,
			/^export\s+(?:\*|default\b)/m,
			`${entry} uses an export form that this gate cannot read`,
		)
		for (const [, list] of source.matchAll(
			/^export\s+(?:type\s+)?\{([^}]*)\}/gm,
		)) {
			for (const item of list.split(",")) {
				const name = item
					.trim()
					.replace(/^type\s+/, "")
					.split(/\s+as\s+/)
					.pop()
				if (name) names.add(name)
			}
		}
		for (const [, name] of source.matchAll(
			/^export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
		)) {
			names.add(name)
		}
	}

	assert.ok(names.size > 100, `found only ${names.size} exported names`)
	const missing = [...names].filter(
		(name) =>
			!new RegExp(`\`[^\`\\n]*\\b${escapeRegExp(name)}\\b[^\`\\n]*\``).test(
				docs,
			),
	)
	assert.deepEqual(
		missing,
		[],
		"api.mdx and types.mdx must name each export in code",
	)
})

test("example pages claim only APIs that their snippets use", async () => {
	let checked = 0

	for (const { source: path } of pages) {
		if (!path.startsWith("src/pages/examples/")) continue
		const page = await readFile(new URL(path, siteRoot), "utf8")
		const section = page.match(
			/^## What this form demonstrates\n([\s\S]*?)(?=^## |(?![\s\S]))/m,
		)?.[1]
		if (!section) continue
		let snippets = ""
		for (const [, snippet, region] of page.matchAll(
			/\/\/ \[!include ~\/snippets\/([^\]:]+)(?::([\w-]+))?\]/g,
		)) {
			const source = await readFile(
				new URL(`src/snippets/${snippet}`, siteRoot),
				"utf8",
			)
			snippets += region
				? (source.match(
						new RegExp(
							`// \\[!region ${region}\\]([\\s\\S]*?)// \\[!endregion ${region}\\]`,
						),
					)?.[1] ?? "")
				: source
		}
		const bullets = section
			.split(/^- /m)
			.slice(1)
			.map((bullet) => bullet.split(/\n\s*\n/)[0])
		let claims = 0
		let pageChecked = 0

		for (const bullet of bullets) {
			for (const [, code] of bullet.matchAll(/`([^`]+)`/g)) {
				claims++
				const identifier = code.replace(/\(\)$/, "")
				if (!/^[A-Za-z_$][\w$.]*$/.test(identifier)) continue
				assert.match(
					snippets,
					new RegExp(`(?<![\\w$])${escapeRegExp(identifier)}(?![\\w$])`),
					`${path} claims \`${identifier}\`, but its snippet does not use it`,
				)
				pageChecked++
			}
		}

		assert.ok(
			snippets === "" || claims === 0 || pageChecked > 0,
			`${path} has claims, but none of them were checked`,
		)
		checked += pageChecked
	}

	assert.ok(checked > 0, "no example claims were checked")
})

test("prose uses one term for each concept", async () => {
	const denied = [/\bForm Please\b/, /\bmanaged changes?\b/i]

	for (const { source: path } of pages) {
		const text = prose(await readFile(new URL(path, siteRoot), "utf8"))
		for (const term of denied) {
			assert.doesNotMatch(text, term, `${path} uses a denied term`)
		}
	}
})

test("prose writes React Hook Form (RHF) at the first mention", async () => {
	let checked = 0

	for (const { source: path } of pages) {
		const source = await readFile(new URL(path, siteRoot), "utf8")
		const text = prose(source.replace(/^---\n[\s\S]*?\n---\n/, ""))
		const first = text.search(/React Hook Form|\bRHF\b/)
		if (first === -1) continue
		assert.ok(
			text.startsWith("React Hook Form (RHF)", first),
			`${path} must write "React Hook Form (RHF)" at the first mention`,
		)
		checked++
	}

	assert.ok(checked > 0, "no page mentions React Hook Form")
})

/** The page text without code fences, inline code, import lines, and link targets. */
function prose(source) {
	let fenced = false
	return source
		.split("\n")
		.filter((line) => {
			if (/^\s*```/.test(line)) {
				fenced = !fenced
				return false
			}
			return !fenced && !/^import\s/.test(line)
		})
		.join("\n")
		.replace(/`[^`\n]*`/g, "")
		.replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/\s+/g, " ")
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
