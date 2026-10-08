// @jsx: react-jsx
"use client"

import type { FormSubmitDetails } from "form-please"
import {
	createLocalStorageAdapter,
	createPersistenceMiddleware,
	usePersistence,
} from "form-please/persistence"
import { nativeFormKit } from "form-please/preset-native"
import { useEffect, useState } from "react"
import { z } from "zod"

const releaseSchema = z.object({
	title: z.string().min(1, "Enter a title"),
	description: z.string().min(20, "Write at least 20 characters"),
})
const releasePersistence = createPersistenceMiddleware({
	adapter: createLocalStorageAdapter(() => localStorage),
	key: "release-draft",
	version: 1,
})
const releaseDefinition = nativeFormKit.defineForm(
	releaseSchema,
	(ui) => [
		ui.field("title", { control: "text", label: "Title" }),
		ui.field("description", {
			control: "textarea",
			label: "Description",
			props: { rows: 5 },
		}),
	],
	{ middleware: [releasePersistence] },
)

type ReleaseIntent = "publish" | "save-and-close"

async function sendRelease(
	value: z.output<typeof releaseSchema>,
	intent: ReleaseIntent,
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
	async function finishRelease(
		{ form, input, value }: FormSubmitDetails<typeof releaseSchema>,
		intent: ReleaseIntent,
	) {
		if (intent === "publish") setStatus("Publishing…")
		else setStatus("Saving…")
		await sendRelease(value, intent)
		await releasePersistence.handle(form).clear()
		form.api.reset(input)
		if (intent === "save-and-close") onClose()
		else setStatus("Published.")
	}
	const form = nativeFormKit.useForm(releaseDefinition, {
		defaultValues: { title: "", description: "" },
		actions: {
			publish: {
				implicit: true,
				onSubmit: (details) => finishRelease(details, "publish"),
			},
			saveAndClose: {
				onSubmit: (details) => finishRelease(details, "save-and-close"),
			},
		},
	})
	const persistence = usePersistence(form, releasePersistence)
	const persistenceState = persistence.snapshot
	const persistenceReady = persistenceState.phase === "active"

	useEffect(() => {
		if (persistenceState.phase === "active") setStatus("Draft ready.")
		else if (persistenceState.phase === "failed") {
			setStatus("The draft could not be restored.")
		} else if (persistenceState.phase === "conflict") {
			setStatus("The form changed before the draft could be restored.")
		}
	}, [persistenceState.phase])

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
				action={form.actions.publish}
				disabled={!persistenceReady}
			>
				Publish
			</nativeFormKit.Submit>
			<nativeFormKit.Submit
				action={form.actions.saveAndClose}
				disabled={!persistenceReady}
			>
				Save and close
			</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
