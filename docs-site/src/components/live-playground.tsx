import type { ReactElement } from "react"

import { LivePlaygroundClient } from "./live-playground.client"
import { markdownFallback } from "./markdown-fallback"

export const LivePlayground = Object.assign(
	function LivePlayground(): ReactElement {
		return <LivePlaygroundClient />
	},
	{
		toMarkdown() {
			return [
				...markdownFallback(
					"The live playground runs only in a browser. It compiles the editor contents with Sucrase, renders the exported component with the real form-please package, and optionally type checks the code with the TypeScript compiler in a web worker.",
					"docs-site/src/components/live-playground.client.tsx",
				),
			]
		},
	},
)
