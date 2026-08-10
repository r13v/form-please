import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import { ProductWorkflowDemoClient } from "./product-workflow-demo.client"

export const ProductWorkflowDemo = Object.assign(
	function ProductWorkflowDemo(): ReactElement {
		return <ProductWorkflowDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The product-workflow preview runs only in a browser. It validates each visible screen, skips conditional screens, shows progress, and opens the first screen with invalid input.",
				"docs-site/src/snippets/product-workflow.tsx",
			)
		},
	},
)
