import {
	Children,
	isValidElement,
	type ReactElement,
	type ReactNode,
} from "react"
import type { ScenarioId } from "#lib/playground-scenarios"

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
	{ Scenario },
)
