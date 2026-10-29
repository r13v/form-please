import type { FieldValues } from "react-hook-form"

import {
	claimFeature,
	type FormMiddlewareApi,
	type FormMiddlewareNext,
	getValueCoordinatorCapability,
	readFeatureClaim,
	type ValueCoordinatorCapability,
	type ValueTransaction,
} from "./value-middleware.js"

/** The per-form state that one managed feature keeps. */
export type ManagedFeatureState<Handle> = {
	/** The public operations that `feature.handle(form)` returns. */
	readonly handle: Handle
	/** Reads the committed transaction after `next`, also when `next` throws. */
	observeCommit(): void
	/** Receives the form binding each time `feature.handle(form)` is called. */
	attach?(form: object): void
}

/**
 * Creates the middleware and `handle` lookup of one managed feature. Each form
 * accepts one feature of a `name`, and `handle` returns the state only for a
 * form that configures this exact feature.
 */
export function defineManagedFeature<Handle>(
	name: string,
	createState: (
		capability: ValueCoordinatorCapability<FieldValues, unknown>,
	) => ManagedFeatureState<Handle>,
): ((
	api: FormMiddlewareApi<FieldValues>,
) => (
	next: FormMiddlewareNext,
) => (transaction: ValueTransaction<FieldValues, unknown>) => unknown) & {
	readonly handle: (form: object) => Handle
} {
	const claimKey = Symbol.for(`form-please.${name}-feature-claim`)
	const states = new WeakMap<object, ManagedFeatureState<Handle>>()
	const feature = (api: FormMiddlewareApi<FieldValues>) => {
		const capability = getValueCoordinatorCapability<FieldValues, unknown>(api)
		claimFeature(
			capability,
			claimKey,
			feature,
			`A form can configure only one ${name} feature`,
		)
		const state = createState(capability)
		states.set(capability, state)
		return (next: FormMiddlewareNext) =>
			(transaction: ValueTransaction<FieldValues, unknown>) => {
				try {
					return next(transaction.patches)
				} finally {
					state.observeCommit()
				}
			}
	}
	Object.defineProperty(feature, "handle", {
		enumerable: true,
		value(form: object) {
			const capability = getValueCoordinatorCapability(form)
			const state = states.get(capability)
			if (
				state === undefined ||
				readFeatureClaim(capability, claimKey) !== feature
			) {
				throw new TypeError(
					`This ${name} feature is not configured for the supplied form`,
				)
			}
			state.attach?.(form)
			return state.handle
		},
	})
	return Object.freeze(feature) as typeof feature & {
		readonly handle: (form: object) => Handle
	}
}

/** A set of snapshot listeners that a feature notifies after each change. */
export function createListenerSet(name: string): {
	subscribe(listener: () => void): () => void
	notify(): void
} {
	const listeners = new Set<() => void>()
	return {
		subscribe(listener) {
			if (typeof listener !== "function") {
				throw new TypeError(`${name} listener must be a function`)
			}
			listeners.add(listener)
			let subscribed = true
			return () => {
				if (!subscribed) return
				subscribed = false
				listeners.delete(listener)
			}
		},
		notify() {
			for (const listener of [...listeners]) listener()
		},
	}
}
