import type { ReactElement } from "react"

import { GetStartedDemoClient } from "./get-started-demo.client"
import { markdownFallback } from "./markdown-fallback"

export const GetStartedDemo = Object.assign(
	function GetStartedDemo(): ReactElement {
		return <GetStartedDemoClient />
	},
	{
		toMarkdown() {
			return markdownFallback(
				"The live Get started form runs only in a browser. It renders the ProfileForm component from step 3. After a valid submit, it shows the schema output, including slug.",
				"docs-site/src/snippets/profile-form.tsx",
			)
		},
	},
)
