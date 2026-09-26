import type { ReactElement } from "react"

import { markdownFallback } from "./markdown-fallback"
import { MigrationDemoClient } from "./migration-demo.client"

export const MigrationDemo = Object.assign(
	function MigrationDemo(): ReactElement {
		return <MigrationDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The live migration demo runs only in a browser. It switches between the React Hook Form version and the Form, Please version of the same support ticket form. Both versions use one schema and show the same issues and output.",
				"docs-site/src/snippets/migration-after.tsx",
			)
		},
	},
)
