"use client"

import { useEffect, useMemo } from "react"

import type { FormBinding } from "../create-form-kit.js"
import type { StandardSchema } from "../types.js"
import { useSnapshot } from "../use-snapshot.js"
import type {
	PersistenceFeature,
	PersistenceHandle,
	PersistenceSnapshot,
} from "./persistence.js"

/** A form-specific persistence handle with its current React snapshot. */
export type UsePersistenceResult = PersistenceHandle &
	Readonly<{ snapshot: PersistenceSnapshot }>

/** Restores one configured persistence feature and subscribes to its state. */
export function usePersistence<
	Schema extends StandardSchema,
	Context = unknown,
>(
	form: FormBinding<Schema, Context>,
	feature: PersistenceFeature,
): UsePersistenceResult {
	const persistence = feature.handle(form)
	const snapshot = useSnapshot(persistence)

	useEffect(() => {
		void persistence.restore().catch(() => undefined)
	}, [persistence])

	return useMemo(
		() => Object.freeze({ ...persistence, snapshot }),
		[persistence, snapshot],
	)
}
