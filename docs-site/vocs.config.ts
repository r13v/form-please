import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vocs/config"
import { findScenario } from "#lib/playground-scenarios"

const basePath = process.env.BASE_PATH ?? "/"
const assetBasePath = basePath.replace(/\/$/, "")
const { version } = JSON.parse(
	readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string }

type MarkdownNode = {
	attributes?: readonly { name?: string; value?: unknown }[]
	children?: MarkdownNode[]
	name?: string
	type: string
	value?: string
}

/**
 * Markdown output only: replaces the overview's scenario playground with a
 * heading and summary per scenario followed by its Twoslash code fence, so
 * llms.txt readers get the complete programs instead of JSX.
 */
function remarkScriptedPlayground() {
	return (tree: unknown) => {
		unwrapPlayground(tree as MarkdownNode)
	}
}

function unwrapPlayground(node: MarkdownNode): void {
	if (node.children === undefined) return
	node.children = node.children.flatMap((child) => {
		if (child.type !== "mdxJsxFlowElement") {
			unwrapPlayground(child)
			return [child]
		}
		if (child.name === "ScriptedPlayground") {
			unwrapPlayground(child)
			return child.children ?? []
		}
		if (child.name === "ScriptedPlayground.Scenario") {
			const id = child.attributes?.find((attribute) => attribute.name === "id")
			const scenario = findScenario(String(id?.value))
			return [
				{
					type: "paragraph",
					children: [
						{
							type: "strong",
							children: [{ type: "text", value: scenario.title }],
						},
						{ type: "text", value: ` ${scenario.summary}` },
					],
				},
				...(child.children ?? []),
			]
		}
		unwrapPlayground(child)
		return [child]
	})
}

export default defineConfig({
	title: "Form, Please",
	description:
		"Typed, schema-validated React forms that keep native HTML semantics and your design system.",
	// logoUrl: "/brand/form-please-icon.png",
	iconUrl: `${assetBasePath}/favicon.ico`,
	baseUrl: process.env.BASE_URL ?? "https://r13v.github.io",
	basePath,
	renderStrategy: "full-static",
	checkDeadlinks: true,
	codeHighlight: {
		themes: {
			light: "github-light",
			dark: "github-dark",
		},
	},
	twoslash: {
		twoslashOptions: {
			vfsRoot: fileURLToPath(new URL("./src/snippets", import.meta.url)),
		},
	},
	markdown: { outputRemarkPlugins: [remarkScriptedPlayground] },
	socials: [{ icon: "github", link: "https://github.com/r13v/form-please" }],
	editLink: {
		link: "https://github.com/r13v/form-please/edit/main/docs-site/:path",
		text: "Edit this page",
	},
	topNav: [
		{
			text: "Docs",
			link: "/get-started",
			// Vocs serializes this function with toString(), so it must not read
			// outer variables. It matches each page except the overview and the
			// pages of the other tabs.
			match: (path) =>
				path !== undefined &&
				!/^\/($|examples(\/|$)|playground\/?$|api\/?$|types\/?$)/.test(path),
		},
		{ text: "Examples", link: "/examples", match: "/examples" },
		{ text: "Playground", link: "/playground" },
		{
			text: "API",
			link: "/api",
			match: (path) => path !== undefined && /^\/(api|types)\/?$/.test(path),
		},
		{
			text: `v${version}`,
			items: [
				{
					text: "Releases",
					link: "https://github.com/r13v/form-please/releases",
				},
			],
		},
	],
	sidebar: [
		{
			text: "Start",
			collapsed: false,
			items: [
				{ text: "Overview", link: "/" },
				{ text: "Playground", link: "/playground" },
				{ text: "AI agents", link: "/ai-agents" },
			],
		},
		{
			text: "Learn",
			collapsed: false,
			items: [
				{ text: "Get started", link: "/get-started" },
				{ text: "Definitions", link: "/definitions" },
				{ text: "Form kits", link: "/form-kits" },
				{ text: "Validation & submission", link: "/validation" },
				{ text: "Styling", link: "/styling" },
			],
		},
		{
			text: "Build",
			collapsed: false,
			items: [
				{ text: "Conditional fields", link: "/conditional-fields" },
				{ text: "Arrays", link: "/arrays" },
				{ text: "Recipes", link: "/recipes" },
				{ text: "Product workflows", link: "/workflows" },
				{ text: "Persistence", link: "/persistence" },
				{ text: "History", link: "/history" },
			],
		},
		{
			text: "Advanced",
			collapsed: false,
			items: [
				{ text: "Middleware", link: "/middleware" },
				{ text: "Resources", link: "/resources" },
				{ text: "Devtools", link: "/devtools" },
				{ text: "Testing", link: "/testing" },
			],
		},
		{
			text: "Examples",
			collapsed: false,
			items: [
				{ text: "Examples", link: "/examples" },
				{ text: "History workflow", link: "/examples/history" },
				{
					text: "Query string persistence",
					link: "/examples/persistence",
				},
				{ text: "Material UI with Yup", link: "/examples/mui-yup" },
				{ text: "Shadcn with Valibot", link: "/examples/shadcn-valibot" },
				{
					text: "Async multiselect",
					link: "/examples/async-multiselect",
				},
				{ text: "Research grant", link: "/examples/research-grant" },
				{ text: "Studio policies", link: "/examples/studio-policies" },
				{ text: "Makerspace launch", link: "/examples/makerspace-launch" },
				{ text: "Learning cohort", link: "/examples/learning-cohort" },
				{ text: "Membership ladder", link: "/examples/membership-ladder" },
				{ text: "Campaign builder", link: "/examples/campaign-builder" },
			],
		},
		{
			text: "Reference",
			collapsed: false,
			items: [
				{ text: "API", link: "/api" },
				{ text: "TypeScript", link: "/types" },
				{
					text: "LLM documentation index",
					link: "https://r13v.github.io/form-please/llms.txt",
				},
				{
					text: "Full documentation for LLMs",
					link: "https://r13v.github.io/form-please/llms-full.txt",
				},
			],
		},
		{
			text: "Help",
			collapsed: false,
			items: [{ text: "FAQs", link: "/faqs" }],
		},
	],
})
