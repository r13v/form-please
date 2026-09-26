export type ScenarioId =
	| "basic"
	| "transform"
	| "conditional"
	| "derived"
	| "array"
	| "typo"

export type Scenario = Readonly<{
	id: ScenarioId
	title: string
	summary: string
	tryThis: string
}>

export const scenarios: readonly Scenario[] = [
	{
		id: "basic",
		title: "Schema to form",
		summary:
			"One Zod schema, one definition, one hook. Every path in the definition must exist in the schema.",
		tryThis:
			"Clear the email and submit. The Zod message appears next to the field.",
	},
	{
		id: "transform",
		title: "Typed output",
		summary:
			"The schema transform adds a handle. The submit callback receives the transformed output type, not the input.",
		tryThis:
			"Submit and compare the output with the fields. Hover value in the code to see its type.",
	},
	{
		id: "conditional",
		title: "Conditional field",
		summary:
			"Visibility and required state are functions of the typed input. Hidden fields keep their values.",
		tryThis:
			"Switch the account type to Company. A required company name appears.",
	},
	{
		id: "derived",
		title: "Dependent values",
		summary:
			"beforeUpdate in the definition keeps the total in sync and can cancel a change. The total commits with its sources, without an effect or a second render.",
		tryThis:
			"Change the quantity and watch the total. Then enter 60: the hook cancels the change, and the quantity stays.",
	},
	{
		id: "array",
		title: "Arrays",
		summary:
			"Array rows get stable keys, reorder buttons, and per-row fields typed against the item schema.",
		tryThis:
			"Add a member, leave the email empty, and submit. The row error stays with its row.",
	},
	{
		id: "typo",
		title: "Catch the typo",
		summary:
			"A misspelled path and a text control on a boolean. Both fail at compile time, and the message lists the valid options.",
		tryThis:
			"Hover the red marks. Then fix emial and change the last control to checkbox.",
	},
]

export function findScenario(id: string | null | undefined): Scenario {
	return scenarios.find((scenario) => scenario.id === id) ?? scenarios[0]
}
