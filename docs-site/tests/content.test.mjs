import assert from "node:assert/strict"
import { access, readFile } from "node:fs/promises"
import { test } from "node:test"

const siteRoot = new URL("../", import.meta.url)
const repositoryRoot = new URL("../", siteRoot)

const pages = [
	["src/pages/index.mdx", "Form, Please"],
	["src/pages/get-started.mdx", "Get started"],
	["src/pages/ai-agents.mdx", "Use with AI agents"],
	["src/pages/definitions.mdx", "Definitions"],
	["src/pages/validation.mdx", "Validation and submission"],
	["src/pages/conditional-fields.mdx", "Conditional fields"],
	["src/pages/arrays.mdx", "Arrays"],
	["src/pages/middleware.mdx", "Value middleware"],
	["src/pages/history.mdx", "Managed value history"],
	["src/pages/persistence.mdx", "Form persistence"],
	["src/pages/form-kits.mdx", "Form kits"],
	["src/pages/resources.mdx", "Resource state"],
	["src/pages/styling.mdx", "Styling"],
	["src/pages/api.mdx", "API"],
	["src/pages/recipes.mdx", "Production recipes"],
	["src/pages/workflows.mdx", "Product workflows"],
	["src/pages/types.mdx", "TypeScript"],
	["src/pages/faqs.mdx", "FAQs"],
	["src/pages/examples/index.mdx", "Examples"],
	["src/pages/examples/history.mdx", "History workflow"],
	["src/pages/examples/persistence.mdx", "Query string persistence"],
	["src/pages/examples/mui-yup.mdx", "Material UI with Yup"],
	["src/pages/examples/shadcn-valibot.mdx", "Shadcn with Valibot"],
	["src/pages/examples/async-multiselect.mdx", "Async multiselect"],
	["src/pages/examples/research-grant.mdx", "Research grant application"],
	["src/pages/examples/studio-policies.mdx", "Creative studio policies"],
	["src/pages/examples/makerspace-launch.mdx", "Makerspace launch wizard"],
	["src/pages/examples/learning-cohort.mdx", "Learning cohort editor"],
	["src/pages/examples/membership-ladder.mdx", "Membership ladder"],
	["src/pages/examples/campaign-builder.mdx", "Campaign builder"],
]

const exampleSnippets = [
	"src/snippets/mui-yup-conference.tsx",
	"src/snippets/shadcn-valibot-workshop.tsx",
	"src/snippets/complex-research-grant.tsx",
	"src/snippets/complex-studio-policies.tsx",
	"src/snippets/complex-makerspace-launch.tsx",
	"src/snippets/complex-learning-cohort.tsx",
	"src/snippets/complex-membership-ladder.tsx",
	"src/snippets/complex-campaign-builder.tsx",
	"src/snippets/lab-profile-form.tsx",
	"src/snippets/async-multiselect.tsx",
	"src/snippets/async-multiselect-request.ts",
	"src/snippets/history-guide.tsx",
	"src/snippets/persistence-basics.tsx",
	"src/snippets/persistence-local-storage.tsx",
	"src/snippets/persistence-nuqs.ts",
	"src/snippets/persistence-tanstack-query.ts",
]

const referenceSnippets = [
	"src/snippets/api-reference.tsx",
	"src/snippets/form-kits-control.tsx",
	"src/snippets/form-kits.tsx",
	"src/snippets/production-recipes.tsx",
	"src/snippets/product-workflow.tsx",
	"src/snippets/workflow-review.tsx",
	"src/snippets/workflow-router-guard.tsx",
	"src/snippets/workflow-server-issues.tsx",
	"src/snippets/workflow-submit-actions.tsx",
	"src/snippets/middleware-guide.tsx",
	"src/snippets/validation-guide.tsx",
]

test("documents only the supported navigation surface", async () => {
	const config = await readFile(new URL("vocs.config.ts", siteRoot), "utf8")
	for (const [path, title] of pages) {
		const source = await readFile(new URL(path, siteRoot), "utf8")
		assert.match(
			source,
			new RegExp(`^---[\\s\\S]*title: ${escapeRegExp(title)}`, "m"),
		)
	}

	for (const route of [
		"/get-started",
		"/ai-agents",
		"/definitions",
		"/validation",
		"/conditional-fields",
		"/arrays",
		"/middleware",
		"/history",
		"/persistence",
		"/form-kits",
		"/resources",
		"/styling",
		"/api",
		"/recipes",
		"/workflows",
		"/types",
		"/faqs",
		"/examples",
		"/examples/history",
		"/examples/persistence",
		"/examples/mui-yup",
		"/examples/shadcn-valibot",
		"/examples/async-multiselect",
		"/examples/research-grant",
		"/examples/studio-policies",
		"/examples/makerspace-launch",
		"/examples/learning-cohort",
		"/examples/membership-ladder",
		"/examples/campaign-builder",
	]) {
		assert.match(config, new RegExp(`link: "${escapeRegExp(route)}"`))
	}

	const getStartedIndex = config.indexOf(
		'{ text: "Get started", link: "/get-started" }',
	)
	const aiAgentsIndex = config.indexOf(
		'{ text: "AI agents", link: "/ai-agents" }',
	)
	assert.ok(
		aiAgentsIndex > getStartedIndex,
		"AI agents follows Get started in the Start navigation",
	)

	let previousGuideIndex = -1
	for (const [text, route] of [
		["Form kits", "/form-kits"],
		["Definitions", "/definitions"],
		["Validation & submission", "/validation"],
		["Styling", "/styling"],
		["Conditional fields", "/conditional-fields"],
		["Arrays", "/arrays"],
		["Recipes", "/recipes"],
		["Product workflows", "/workflows"],
		["Resources", "/resources"],
		["Middleware", "/middleware"],
		["Persistence", "/persistence"],
		["History", "/history"],
	]) {
		const guideIndex = config.indexOf(`{ text: "${text}", link: "${route}" }`)
		assert.ok(guideIndex > previousGuideIndex, `${text} is in guide order`)
		previousGuideIndex = guideIndex
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

test("documents the React Hook Form runtime decisions", async () => {
	const allPages = (
		await Promise.all(
			pages.map(([path]) => readFile(new URL(path, siteRoot), "utf8")),
		)
	).join("\n")

	for (const term of [
		"FormProvider",
		"Controller",
		"useWatch",
		"useFormState",
		"fromResource",
		"complete schema input",
		"Hidden fields preserve",
		"stable field-array ID",
		"parses once",
	]) {
		assert.match(
			allPages,
			new RegExp(escapeRegExp(term), "i"),
			`missing ${term}`,
		)
	}
})

test("does not teach retired runtime entries or APIs", async () => {
	const files = [
		...pages.map(([path]) => path),
		"src/snippets/profile-form.tsx",
		...exampleSnippets,
		...referenceSnippets,
		"src/components/ui/form-please/shadcn-form-kit.tsx",
		"vocs.config.ts",
	]
	const source = (
		await Promise.all(
			files.map((path) => readFile(new URL(path, siteRoot), "utf8")),
		)
	).join("\n")

	for (const forbidden of [
		"form-please/core",
		"form-please/tanstack",
		"form-please/react19",
		"form-please/server",
		"form-please/devtools",
		"useCreateForm",
		"useBindForm",
		"form.api.Field",
		"form.api.FormGroup",
		"form.api.Subscribe",
		"form.api.pushFieldValue",
		"useArrayField",
		"valuePolicy",
		"kit.tf",
	]) {
		assert.doesNotMatch(source, new RegExp(escapeRegExp(forbidden)))
	}
})

test("keeps the supported live documentation demos", async () => {
	for (const [path, expected] of [
		["src/pages/index.mdx", "<OverviewDemo />"],
		["src/pages/get-started.mdx", "<InteractiveLab />"],
		["src/pages/styling.mdx", "<TailwindProfileDemo />"],
		["src/pages/examples/async-multiselect.mdx", "<AsyncMultiSelectDemo />"],
		["src/pages/validation.mdx", "~/snippets/zod-error-messages.ts"],
		["src/pages/examples/persistence.mdx", "<PersistenceDemo />"],
	]) {
		const source = await readFile(new URL(path, siteRoot), "utf8")
		assert.match(source, new RegExp(escapeRegExp(expected)))
	}
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
		"Do not return a promise from the `options` resolver",
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

	for (const snippet of referenceSnippets) {
		await access(new URL(snippet, siteRoot))
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
	assert.match(example, /useSnapshot\(history\)/)
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
	const docsPackage = JSON.parse(
		await readFile(new URL("package.json", siteRoot), "utf8"),
	)
	const rootCss = await readFile(
		new URL("src/pages/_root.css", siteRoot),
		"utf8",
	)
	const [item] = registry.items

	assert.equal(registry.name, "form-please")
	assert.equal(item.name, "shadcn-form-kit")
	assert.deepEqual(item.files, [
		{
			path: "docs-site/src/components/ui/form-please/shadcn-form-kit.tsx",
			type: "registry:component",
			target: "@ui/form-please/shadcn-form-kit.tsx",
		},
	])
	assert.equal(item.dependencies.includes("form-please"), true)
	assert.equal(
		item.dependencies.some((dependency) =>
			dependency.startsWith("form-please@"),
		),
		false,
	)
	assert.equal(components.style, "base-nova")
	assert.equal(components.aliases.ui, "#components/ui")
	assert.equal(docsPackage.dependencies["tw-animate-css"], "1.4.0")
	assert.match(rootCss, /@import "tw-animate-css"/)
	assert.match(page, /npx shadcn@latest add r13v\/form-please\/shadcn-form-kit/)
	assert.match(page, /registry manifest/)
	assert.equal(
		rootPackage.scripts["test:registry"],
		"node scripts/verify-shadcn-registry.mjs",
	)
	assert.match(rootPackage.scripts.verify, /npm run test:registry/)
})

test("keeps only the supported example routes", async () => {
	for (const path of [
		"src/pages/examples/devtools.mdx",
		"src/pages/examples/tanstack-form.mdx",
	]) {
		await assert.rejects(access(new URL(path, siteRoot)))
	}

	const config = await readFile(new URL("vocs.config.ts", siteRoot), "utf8")
	for (const route of ["/examples/devtools", "/examples/tanstack-form"]) {
		assert.doesNotMatch(config, new RegExp(escapeRegExp(route)))
	}
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
	assert.equal(packageJson.dependencies["react-hook-form"], "7.84.0")
	assert.equal(packageJson.dependencies["form-please"], "file:..")

	const rootPackage = JSON.parse(
		await readFile(new URL("package.json", repositoryRoot), "utf8"),
	)
	assert.equal(rootPackage.peerDependencies["react-hook-form"], "^7.76.1")
})

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
