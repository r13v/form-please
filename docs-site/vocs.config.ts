import { defineConfig } from "vocs/config"

const basePath = process.env.BASE_PATH ?? "/"
const assetBasePath = basePath.replace(/\/$/, "")

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
	socials: [{ icon: "github", link: "https://github.com/r13v/form-please" }],
	editLink: {
		link: "https://github.com/r13v/form-please/edit/main/docs-site/:path",
		text: "Edit this page",
	},
	sidebar: [
		{
			text: "Start",
			collapsed: false,
			items: [
				{ text: "Overview", link: "/" },
				{ text: "Get started", link: "/get-started" },
				{ text: "AI agents", link: "/ai-agents" },
			],
		},
		{
			text: "Guides",
			collapsed: false,
			items: [
				{ text: "Form kits", link: "/form-kits" },
				{ text: "Definitions", link: "/definitions" },
				{ text: "Validation & submission", link: "/validation" },
				{ text: "Styling", link: "/styling" },
				{ text: "Conditional fields", link: "/conditional-fields" },
				{ text: "Arrays", link: "/arrays" },
				{ text: "Recipes", link: "/recipes" },
				{ text: "Product workflows", link: "/workflows" },
				{ text: "Resources", link: "/resources" },
				{ text: "Middleware", link: "/middleware" },
				{ text: "Persistence", link: "/persistence" },
				{ text: "History", link: "/history" },
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
