// @jsx: react-jsx
"use client"

import type { PersistenceHandle } from "form-please/persistence"
import { useCallback, useState } from "react"
import { useBeforeUnload, useBlocker } from "react-router"

type PersistedNavigationGuardProps = Readonly<{
	dirty: boolean
	persistence: PersistenceHandle
}>

/** Use inside a React Router data or framework router. */
export function PersistedNavigationGuard({
	dirty,
	persistence,
}: PersistedNavigationGuardProps) {
	const [error, setError] = useState<string>()
	const [saving, setSaving] = useState(false)
	const blocker = useBlocker(dirty)

	useBeforeUnload(
		useCallback(
			(event) => {
				if (!dirty) return
				event.preventDefault()
				event.returnValue = ""
			},
			[dirty],
		),
	)

	if (blocker.state !== "blocked") return null

	async function saveDraftAndLeave() {
		if (blocker.state !== "blocked") return
		const proceed = blocker.proceed
		setError(undefined)
		setSaving(true)
		try {
			await persistence.flush()
			proceed()
		} catch {
			setError("The draft could not be saved. Navigation is still blocked.")
			setSaving(false)
		}
	}
	let saveLabel = "Save draft and leave"
	if (saving) saveLabel = "Saving draft…"

	return (
		<div aria-labelledby="leave-title" role="dialog" aria-modal="true">
			<h2 id="leave-title">Leave this form?</h2>
			<p>
				Save the latest input before navigation, or leave without saving it.
			</p>
			{error !== undefined && <p role="alert">{error}</p>}
			<button disabled={saving} type="button" onClick={() => blocker.reset()}>
				Stay
			</button>
			<button disabled={saving} type="button" onClick={() => blocker.proceed()}>
				Leave without saving
			</button>
			<button
				disabled={saving}
				type="button"
				onClick={() => void saveDraftAndLeave()}
			>
				{saveLabel}
			</button>
		</div>
	)
}
