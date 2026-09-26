import type { ReactElement } from "react"

import { AccountVariantsDemoClient } from "./account-variants-demo.client"
import { markdownFallback } from "./markdown-fallback"

export const AccountVariantsDemo = Object.assign(
	function AccountVariantsDemo(): ReactElement {
		return <AccountVariantsDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The live account form runs only in a browser. It renders the AccountForm component. Select Personal or Company to show the fields of that variant. After a valid submit, it shows the schema output of the selected variant only.",
				"docs-site/src/snippets/account-variants.tsx",
			)
		},
	},
)
