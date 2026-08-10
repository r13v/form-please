// @jsx: react-jsx
"use client"

import type { FormSubmitDetails } from "form-please"
import { useSnapshot } from "form-please"
import {
	createLocalStorageAdapter,
	createPersistenceMiddleware,
} from "form-please/persistence"
import { nativeFormKit } from "form-please/preset-native"
import { useEffect, useState } from "react"
import { z } from "zod"

const releaseSchema = z.object({
	title: z.string().min(1, "Enter a title"),
	description: z.string().min(20, "Write at least 20 characters"),
})
const releaseDefinition = nativeFormKit.defineForm(releaseSchema, {
	ui: [
		{ kind: "field", path: "title", control: "text", label: "Title" },
		{
			kind: "field",
			path: "description",
			control: "textarea",
			label: "Description",
			options: { rows: 5 },
		},
	],
})

const releasePersistence = createPersistenceMiddleware({
	adapter: createLocalStorageAdapter(() => localStorage),
	key: "release-draft",
	version: 1,
})

type ValidatedIntent = "publish" | "save-and-close"
type ReleaseSubmitter = FormSubmitDetails<typeof releaseSchema>["submitter"]

function readValidatedIntent(submitter: ReleaseSubmitter): ValidatedIntent {
	if (submitter === null) return "publish"
	if (submitter.name !== "intent") {
		throw new TypeError(`Unknown submitter: ${submitter.name}`)
	}
	if (submitter.value === "publish" || submitter.value === "save-and-close") {
		return submitter.value
	}
	throw new TypeError(`Unknown submit intent: ${submitter.value}`)
}

function submitIntent(intent: ValidatedIntent) {
	return { name: "intent", value: intent } as const
}

async function sendRelease(
	value: z.output<typeof releaseSchema>,
	intent: ValidatedIntent,
): Promise<void> {
	const response = await fetch("/api/releases", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ intent, release: value }),
	})
	if (!response.ok) throw new Error("The release could not be saved")
}

export function ReleaseActions({ onClose }: { readonly onClose: () => void }) {
	const [status, setStatus] = useState("Restoring the draft…")
	const form = nativeFormKit.useForm(releaseDefinition, {
		defaultValues: { title: "", description: "" },
		middleware: [releasePersistence],
		onSubmit: async ({ form, input, submitter, value }) => {
			const intent = readValidatedIntent(submitter)
			if (intent === "publish") setStatus("Publishing…")
			else setStatus("Saving…")
			await sendRelease(value, intent)
			await releasePersistence.handle(form).clear()
			form.api.reset(input)
			if (intent === "save-and-close") onClose()
			else setStatus("Published.")
		},
	})
	const persistence = releasePersistence.handle(form)
	const persistenceState = useSnapshot(persistence)
	const persistenceReady = persistenceState.phase === "active"

	useEffect(() => {
		void persistence.restore().then(
			() => setStatus("Draft ready."),
			() => setStatus("The draft could not be restored."),
		)
	}, [persistence])

	async function saveDraft() {
		setStatus("Saving draft…")
		try {
			await persistence.flush()
			setStatus("Draft saved.")
		} catch {
			setStatus("The draft could not be saved.")
		}
	}

	return (
		<nativeFormKit.AutoForm form={form}>
			<output aria-live="polite">{status}</output>
			<button
				disabled={!persistenceReady}
				type="button"
				onClick={() => void saveDraft()}
			>
				Save draft
			</button>
			<nativeFormKit.Submit
				{...submitIntent("publish")}
				disabled={!persistenceReady}
			>
				Publish
			</nativeFormKit.Submit>
			<nativeFormKit.Submit
				{...submitIntent("save-and-close")}
				disabled={!persistenceReady}
			>
				Save and close
			</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
