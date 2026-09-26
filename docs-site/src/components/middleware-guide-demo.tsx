import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import {
	CancellationMiddlewarePreviewClient,
	ComplexMiddlewareEditingPreviewClient,
	DerivedTotalMiddlewarePreviewClient,
} from "./middleware-guide-demo.client"

export const DerivedTotalMiddlewareDemo = Object.assign(
	function DerivedTotalMiddlewareDemo(): ReactElement {
		return <DerivedTotalMiddlewarePreviewClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The derived-total preview runs only in a browser. `beforeUpdate` updates a read-only total in the same commit as its source values.",
				"docs-site/src/snippets/middleware-guide.tsx",
			)
		},
	},
)

export const CancellationMiddlewareDemo = Object.assign(
	function CancellationMiddlewareDemo(): ReactElement {
		return <CancellationMiddlewarePreviewClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The cancellation preview runs only in a browser. It compares a managed update that `beforeUpdate` cancels with a raw React Hook Form update that bypasses the hooks.",
				"docs-site/src/snippets/middleware-guide.tsx",
			)
		},
	},
)

export const ComplexMiddlewareEditingDemo = Object.assign(
	function ComplexMiddlewareEditingDemo(): ReactElement {
		return <ComplexMiddlewareEditingPreviewClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The complex editing preview runs only in a browser. It renders 18 text inputs and sends each edit through middleware.",
				"docs-site/src/snippets/middleware-guide.tsx",
			)
		},
	},
)
