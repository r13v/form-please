import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { test } from "node:test"

const siteRoot = new URL("../", import.meta.url)
const repositoryRoot = new URL("../", siteRoot)

const pages = [
	"src/pages/index.mdx",
	"src/pages/get-started.mdx",
	"src/pages/playground.mdx",
	"src/pages/ai-agents.mdx",
	"src/pages/definitions.mdx",
	"src/pages/validation.mdx",
	"src/pages/conditional-fields.mdx",
	"src/pages/arrays.mdx",
	"src/pages/middleware.mdx",
	"src/pages/history.mdx",
	"src/pages/persistence.mdx",
	"src/pages/devtools.mdx",
	"src/pages/form-kits.mdx",
	"src/pages/resources.mdx",
	"src/pages/styling.mdx",
	"src/pages/api.mdx",
	"src/pages/recipes.mdx",
	"src/pages/workflows.mdx",
	"src/pages/types.mdx",
	"src/pages/faqs.mdx",
	"src/pages/examples/index.mdx",
	"src/pages/examples/history.mdx",
	"src/pages/examples/persistence.mdx",
	"src/pages/examples/mui-yup.mdx",
	"src/pages/examples/shadcn-valibot.mdx",
	"src/pages/examples/async-multiselect.mdx",
	"src/pages/examples/research-grant.mdx",
	"src/pages/examples/studio-policies.mdx",
	"src/pages/examples/makerspace-launch.mdx",
	"src/pages/examples/learning-cohort.mdx",
	"src/pages/examples/membership-ladder.mdx",
	"src/pages/examples/campaign-builder.mdx",
]

test("uses Twoslash for complete TypeScript snippets", async () => {
	for (const path of pages) {
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

test("keeps supported routes in navigation", async () => {
	const config = await readFile(new URL("vocs.config.ts", siteRoot), "utf8")
	for (const path of pages) {
		const route = path
			.replace("src/pages", "")
			.replace(/\/index\.mdx$|\.mdx$/g, "")
		if (route === "") continue
		assert.match(config, new RegExp(`link: "${escapeRegExp(route)}"`))
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

	for (const phrase of [
		"first submit attempt",
		"FormInput<Schema>",
		"FormOutput<Schema>",
		"kit.AutoForm",
		"Server validation is still required",
	]) {
		assert.match(validation, new RegExp(escapeRegExp(phrase)))
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
		"accessible-control",
	]) {
		assert.match(recipes, new RegExp(`production-recipes\\.tsx:${region}`))
	}
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

test("does not present native FormData as the submission source", async () => {
	const sources = await Promise.all([
		readFile(new URL("src/pages/get-started.mdx", siteRoot), "utf8"),
		readFile(
			new URL("src/components/interactive-lab.client.tsx", siteRoot),
			"utf8",
		),
		readFile(new URL("src/snippets/lab-profile-form.tsx", siteRoot), "utf8"),
	])
	const source = sources.join("\n")
	assert.doesNotMatch(source, /Form, Please keeps it in FormData/)
	assert.match(source, /Submission uses (?:the )?React Hook Form values/)
	assert.match(source, /File stays in the React Hook Form input/)
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

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
