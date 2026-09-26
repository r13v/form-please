import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import { WhenHiddenDemoClient } from "./when-hidden-demo.client"

export const WhenHiddenDemo = Object.assign(
	function WhenHiddenDemo(): ReactElement {
		return <WhenHiddenDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The live account form runs only in a browser. It renders the CompanyNameForm component. Enter a company name, select Personal, and then select Company again. The company name is empty, because whenHidden reset it to its default value.",
				"docs-site/src/snippets/when-hidden.tsx",
			)
		},
	},
)
