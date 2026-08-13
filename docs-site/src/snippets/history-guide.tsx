// @jsx: react-jsx
"use client"

import {
	createHistoryMiddleware,
	type HistoryHandle,
	type HistoryJournal,
	type HistoryOperationResult,
	useHistory,
} from "form-please/history"
import { nativeFormKit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const historySchema = z.object({
	name: z.string().min(1, "Enter a name"),
	projects: z.array(z.object({ title: z.string() })),
})
type HistoryInput = z.input<typeof historySchema>

const historyDefinition = nativeFormKit.defineForm(historySchema, {
	ui: [
		{ control: "text", kind: "field", label: "Name", path: "name" },
		{
			children: [
				{
					control: "text",
					kind: "field",
					label: "Project title",
					path: "title",
				},
			],
			itemDefault: { title: "" },
			kind: "array",
			label: "Projects",
			path: "projects",
		},
	],
})

// [!region setup]
const historyFeature = createHistoryMiddleware({ limit: 50 })

export function HistoryPreview() {
	const form = nativeFormKit.useForm(historyDefinition, {
		defaultValues: { name: "Ada Lovelace", projects: [] },
		middleware: [historyFeature],
	})
	const history = useHistory(form, historyFeature)
	const { snapshot } = history
	// [!endregion setup]
	const [exported, setExported] = useState<HistoryJournal<HistoryInput>>()
	const [message, setMessage] = useState("Edit the form to create history.")

	async function navigate(
		label: string,
		operation: Promise<HistoryOperationResult>,
	) {
		try {
			setMessage(`${label}: ${await operation}`)
		} catch (error) {
			if (error instanceof Error) {
				setMessage(error.message)
			} else {
				setMessage(`${label} failed`)
			}
		}
	}

	return (
		<section
			aria-label="Managed value history preview"
			className="form-please-complex form-please-lab"
		>
			<p className="form-please-lab__kicker">Managed value history</p>
			<p className="form-please-lab__summary">
				Edit the name or projects, then navigate the retained input positions.
			</p>
			<nativeFormKit.AutoForm className="form-please-lab__form" form={form}>
				<div className="form-please-lab__actions">
					<button
						disabled={!snapshot.canUndo}
						onClick={() => void navigate("Undo", history.undo())}
						type="button"
					>
						Undo
					</button>
					<button
						disabled={!snapshot.canRedo}
						onClick={() => void navigate("Redo", history.redo())}
						type="button"
					>
						Redo
					</button>
					<button
						disabled={snapshot.index === 0}
						onClick={() => void navigate("Seek", history.seek(0))}
						type="button"
					>
						First position
					</button>
					<button
						onClick={() => {
							const journal = history.export()
							setExported(journal)
							setMessage(`Exported ${journal.entries.length} positions.`)
						}}
						type="button"
					>
						Export
					</button>
					<button
						disabled={exported === undefined}
						onClick={() => {
							if (exported !== undefined) {
								void navigate("Import", history.import(exported))
							}
						}}
						type="button"
					>
						Import
					</button>
					<button
						onClick={() => {
							history.clear()
							setMessage("History cleared at the current values.")
						}}
						type="button"
					>
						Clear history
					</button>
				</div>
				<output aria-live="polite">
					{message} Position {snapshot.index} of {snapshot.length}.
				</output>
			</nativeFormKit.AutoForm>
		</section>
	)
}

// [!region journal]
export async function copyHistoryJournal(
	source: HistoryHandle<HistoryInput>,
	target: HistoryHandle<HistoryInput>,
): Promise<HistoryOperationResult> {
	const journal = source.export()
	return target.import(journal)
}
// [!endregion journal]
