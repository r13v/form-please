import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import { ResourceStateDemoClient } from "./resources-guide-demo.client"

export const ResourceStateDemo = Object.assign(
	function ResourceStateDemo(): ReactElement {
		return <ResourceStateDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The resource state preview runs only in a browser. One request state controls the options, description, and disabled state of a country field.",
				"docs-site/src/snippets/resources-guide.tsx",
			)
		},
	},
)
