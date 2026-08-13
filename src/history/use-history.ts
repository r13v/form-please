"use client"

import { useMemo } from "react"
import type { FieldValues } from "react-hook-form"

import type { FormBinding } from "../create-form-kit.js"
import type { FormInput, StandardSchema } from "../types.js"
import { useSnapshot } from "../use-snapshot.js"
import type {
	HistoryFeature,
	HistoryHandle,
	HistorySnapshot,
} from "./history.js"

type BindingInput<Schema extends StandardSchema> = Extract<
	FormInput<Schema>,
	FieldValues
>

/** A form-specific history handle with its current React snapshot. */
export type UseHistoryResult<Input extends FieldValues> = HistoryHandle<Input> &
	Readonly<{ snapshot: HistorySnapshot }>

/** Reads one configured history feature and subscribes to its current state. */
export function useHistory<Schema extends StandardSchema, Context = unknown>(
	form: FormBinding<Schema, Context>,
	feature: HistoryFeature,
): UseHistoryResult<BindingInput<Schema>> {
	const history = feature.handle(form)
	const snapshot = useSnapshot(history)
	return useMemo(
		() => Object.freeze({ ...history, snapshot }),
		[history, snapshot],
	)
}
