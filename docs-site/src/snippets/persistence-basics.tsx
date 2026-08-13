// @jsx: react-jsx
"use client"

import {
	createPersistenceMiddleware,
	usePersistence,
} from "form-please/persistence"
import { nativeFormKit } from "form-please/preset-native"
import { parseAsString, useQueryState } from "nuqs"
import { useRef, useState } from "react"
import { z } from "zod"

import { createNuqsPersistenceAdapter } from "./persistence-nuqs.js"

const profileSchema = z.object({
	name: z.string().min(1, "Enter a name"),
	role: z.string(),
})

const profileDefinition = nativeFormKit.defineForm(profileSchema, {
	ui: [
		{ control: "text", kind: "field", label: "Name", path: "name" },
		{ control: "text", kind: "field", label: "Role", path: "role" },
	],
})

const draftParser = parseAsString.withOptions({
	history: "replace",
	shallow: true,
})

// [!region query-string-form]
export function PersistencePreview() {
	const [, setQueryDraft] = useQueryState("draft", draftParser)
	const setQueryDraftRef = useRef(setQueryDraft)
	setQueryDraftRef.current = setQueryDraft

	const [feature] = useState(() =>
		createPersistenceMiddleware({
			adapter: createNuqsPersistenceAdapter({
				read: () => new URLSearchParams(window.location.search).get("draft"),
				write: (value) => setQueryDraftRef.current(value),
			}),
			key: "profile",
			saveDelay: 250,
			version: 1,
		}),
	)
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: { name: "Ada Lovelace", role: "Programmer" },
		middleware: [feature],
	})
	const persistence = usePersistence(form, feature)
	const { snapshot } = persistence
	const canKeepCurrent =
		snapshot.phase === "conflict" || snapshot.phase === "failed"

	return (
		<section
			aria-label="Query string persistence preview"
			className="form-please-complex form-please-lab"
		>
			<p className="form-please-lab__kicker">Query string draft</p>
			<p className="form-please-lab__summary">
				Edit either field. The URL draft parameter updates after 250 ms.
			</p>
			<nativeFormKit.AutoForm className="form-please-lab__form" form={form}>
				<div className="form-please-lab__actions">
					<button
						onClick={() => void persistence.flush().catch(() => undefined)}
						type="button"
					>
						Save now
					</button>
					<button
						onClick={() => void persistence.clear().catch(() => undefined)}
						type="button"
					>
						Clear saved draft
					</button>
					{canKeepCurrent && (
						<button onClick={() => persistence.start()} type="button">
							Keep current form
						</button>
					)}
				</div>
				<output aria-live="polite">
					Restore: {snapshot.phase}. Save: {snapshot.save.status}.
				</output>
			</nativeFormKit.AutoForm>
		</section>
	)
}
// [!endregion query-string-form]
