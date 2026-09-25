import {
	Children,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react"
import type { ScenarioId } from "#lib/playground-scenarios"

import { markdownFallback } from "./markdown-fallback"
import {
	type ScriptedPanel,
	ScriptedPlaygroundClient,
} from "./scripted-playground.client"

type ScenarioProps = Readonly<{ id: ScenarioId; children: ReactNode }>

function Scenario(_props: ScenarioProps): null {
	return null
}

export const ScriptedPlayground = Object.assign(
	function ScriptedPlayground({
		children,
	}: {
		readonly children: ReactNode
	}): ReactElement {
		const panels: ScriptedPanel[] = []
		for (const child of Children.toArray(children)) {
			if (!isValidElement<ScenarioProps>(child) || child.type !== Scenario) {
				continue
			}
			panels.push({ id: child.props.id, code: child.props.children })
		}
		return <ScriptedPlaygroundClient panels={panels} />
	},
	{
		Scenario,
		toMarkdown() {
			return [
				...markdownFallback(
					"The scenario playground runs only in a browser. Each tab pairs one complete TypeScript program from docs-site/src/snippets/playground-*.tsx with the form it renders.",
					"docs-site/src/components/scripted-playground.client.tsx",
				),
			]
		},
	},
)
