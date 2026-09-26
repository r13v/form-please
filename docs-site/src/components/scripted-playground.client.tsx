"use client"

import { type ReactNode, useState } from "react"
import { findScenario, type ScenarioId } from "#lib/playground-scenarios"
import { TeamForm } from "../snippets/playground-array"
import { SignupForm } from "../snippets/playground-basic"
import { AccountForm } from "../snippets/playground-conditional"
import { OrderForm } from "../snippets/playground-derived"
import { ProfileForm } from "../snippets/playground-transform"

export type ScriptedPanel = Readonly<{
	id: ScenarioId
	code: ReactNode
}>

const previews: Readonly<Record<ScenarioId, (() => ReactNode) | null>> = {
	array: TeamForm,
	basic: SignupForm,
	conditional: AccountForm,
	derived: OrderForm,
	transform: ProfileForm,
	typo: null,
}

function ScenarioPreview({
	Preview,
	selected,
}: {
	readonly Preview: (() => ReactNode) | null
	readonly selected: boolean
}) {
	if (Preview === null) {
		return (
			<>
				<p className="form-please-lab__kicker">Nothing to render</p>
				<p className="form-please-playground__refused">
					TypeScript rejected this definition before it reached a browser. Hover
					the red marks to read the message: it lists the valid paths and the
					controls that accept the value.
				</p>
			</>
		)
	}
	return (
		<>
			<p className="form-please-lab__kicker">Rendered form</p>
			<div className="form-please-playground__form">
				{selected && <Preview />}
			</div>
		</>
	)
}

export function ScriptedPlaygroundClient({
	panels,
}: {
	readonly panels: readonly ScriptedPanel[]
}) {
	const [activeId, setActiveId] = useState<ScenarioId>("basic")

	return (
		<section
			aria-label="Scenario playground"
			className="form-please-complex form-please-playground"
			data-testid="scripted-playground"
		>
			<div className="form-please-playground__tabs" role="tablist">
				{panels.map((panel) => {
					const scenario = findScenario(panel.id)
					const selected = panel.id === activeId
					return (
						<button
							aria-controls={`scripted-playground-${panel.id}`}
							aria-selected={selected}
							className="form-please-playground__tab"
							id={`scripted-playground-tab-${panel.id}`}
							key={panel.id}
							onClick={() => setActiveId(panel.id)}
							role="tab"
							type="button"
						>
							{scenario.title}
						</button>
					)
				})}
			</div>
			{panels.map((panel) => {
				const scenario = findScenario(panel.id)
				const Preview = previews[panel.id]
				const selected = panel.id === activeId
				return (
					<div
						aria-labelledby={`scripted-playground-tab-${panel.id}`}
						className="form-please-playground__panel"
						hidden={!selected}
						id={`scripted-playground-${panel.id}`}
						key={panel.id}
						role="tabpanel"
					>
						<p className="form-please-playground__summary">
							{scenario.summary}
						</p>
						<div className="form-please-playground__grid">
							<div className="form-please-playground__code">{panel.code}</div>
							<div className="form-please-playground__preview">
								<ScenarioPreview Preview={Preview} selected={selected} />
								<p className="form-please-playground__try">
									<strong>Try this.</strong> {scenario.tryThis}
								</p>
								<a
									className="form-please-playground__open"
									href={`${import.meta.env.BASE_URL}playground?scenario=${panel.id}`}
								>
									Edit this scenario in the playground
								</a>
							</div>
						</div>
					</div>
				)
			})}
		</section>
	)
}
