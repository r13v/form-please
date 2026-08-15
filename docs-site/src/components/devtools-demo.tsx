import type { ReactElement } from "react"

import { DevtoolsDemoClient } from "./devtools-demo.client"
import { markdownFallback } from "./markdown-fallback"

export const DevtoolsDemo = Object.assign(
	function DevtoolsDemo(): ReactElement {
		return <DevtoolsDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The live devtools demo runs only in a browser. Edit the form, inspect resolved fields and updates, and review option, history, and persistence diagnostics.",
				"docs-site/src/components/devtools-demo.client.tsx",
			)
		},
	},
)
