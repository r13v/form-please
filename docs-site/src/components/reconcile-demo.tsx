import { markdownFallback } from "./markdown-fallback"
import { ReconcileDemoClient } from "./reconcile-demo.client"

export const ReconcileDemo = Object.assign(
	function ReconcileDemo() {
		return <ReconcileDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"Choose Alex, Sam, or Maria. Edit an access expiry, remove another delegate, and select a new delegate. Retained delegates keep their edited values.",
				"docs-site/src/snippets/reconcile.tsx",
			)
		},
	},
)
