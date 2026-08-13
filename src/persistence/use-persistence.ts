"use client"

import { useEffect, useMemo } from "react"

import type { FormBinding } from "../create-form-kit.js"
import type { StandardSchema } from "../types.js"
import { useSnapshot } from "../use-snapshot.js"
import {
	type PersistenceFeature,
	type PersistenceHandle,
	type PersistenceSnapshot,
	retainPersistenceHook,
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
		const release = retainPersistenceHook(persistence)
		void persistence.restore().catch(() => undefined)
		return release
	}, [persistence])

	return useMemo(
		() => Object.freeze({ ...persistence, snapshot }),
		[persistence, snapshot],
	)
}
