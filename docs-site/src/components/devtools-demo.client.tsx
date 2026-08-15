"use client"

import { FormPleaseDevtools } from "form-please/devtools"
import { createHistoryMiddleware, useHistory } from "form-please/history"
import {
	createPersistenceMiddleware,
	type JsonValue,
	usePersistence,
} from "form-please/persistence"
import { nativeFormKit as kit } from "form-please/preset-native"
import { z } from "zod"

const demoDrafts = new Map<string, JsonValue>()
const historyFeature = createHistoryMiddleware({ groupWindow: 0, limit: 12 })
const persistenceFeature = createPersistenceMiddleware({
	adapter: {
		async load(key) {
			return demoDrafts.get(key)
		},
		async remove(key) {
			demoDrafts.delete(key)
		},
		async save(key, value) {
			demoDrafts.set(key, value)
		},
	},
	key: "devtools-profile",
	saveDelay: 150,
	version: 1,
})

const profileSchema = z.object({
	name: z.string().min(1, "Enter a name"),
	profileType: z.enum(["individual", "team"]),
	role: z.enum(["designer", "engineer", "lead"]),
	teamName: z.string().optional(),
})

const profileDefinition = kit.defineForm(profileSchema, {
	ui: [
		{
			control: "text",
			kind: "field",
			label: "Name",
			path: "name",
			required: true,
		},
		{
			control: "select",
			kind: "field",
			label: "Profile type",
			options: [
				{ label: "Individual", value: "individual" },
				{ label: "Team", value: "team" },
			],
			path: "profileType",
		},
		{
			control: "select",
			kind: "field",
			label: "Role",
			options: ({ values }) => {
				if (values.profileType === "team") {
					return [
						{ label: "Designer", value: "designer" },
						{ label: "Engineer", value: "engineer" },
						{ label: "Team lead", value: "lead" },
					]
				}
				return [
					{ label: "Designer", value: "designer" },
					{ label: "Engineer", value: "engineer" },
				]
			},
			path: "role",
		},
		{
			control: "text",
			kind: "field",
			label: "Team name",
			path: "teamName",
			visible: ({ profileType }) => profileType === "team",
		},
	],
})

export function DevtoolsDemoClient() {
	const form = kit.useForm(profileDefinition, {
		defaultValues: {
			name: "Ada Lovelace",
			profileType: "individual",
			role: "engineer",
			teamName: "Analytical Engines",
		},
		middleware: [historyFeature, persistenceFeature],
	})
	const history = useHistory(form, historyFeature)
	const persistence = usePersistence(form, persistenceFeature)

	return (
		<section
			aria-label="Live Form Please devtools demo"
			className="form-please-complex form-please-lab"
			data-testid="devtools-demo"
		>
			<p className="form-please-lab__kicker">Live demo</p>
			<p className="form-please-lab__summary">
				Edit the form, then open the Form Please launcher at the bottom-right.
			</p>
			<kit.AutoForm className="form-please-lab__form" form={form}>
				<div className="form-please-lab__actions">
					<kit.Submit>Validate profile</kit.Submit>
					<button
						disabled={!history.snapshot.canUndo}
						onClick={() => void history.undo()}
						type="button"
					>
						Undo
					</button>
					<button
						disabled={!history.snapshot.canRedo}
						onClick={() => void history.redo()}
						type="button"
					>
						Redo
					</button>
				</div>
				<output aria-live="polite">
					History position {history.snapshot.index} of {history.snapshot.length}
					. Persistence {persistence.snapshot.phase}; save{" "}
					{persistence.snapshot.save.status}.
				</output>
			</kit.AutoForm>
			<FormPleaseDevtools form={form} name="Docs profile" />
		</section>
	)
}
