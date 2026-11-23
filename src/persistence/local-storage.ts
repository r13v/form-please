import { errorMessage } from "../error-codes.js"
import type { JsonValue } from "./encoding.js"
import type { FormPersistenceAdapter } from "./persistence.js"

type PersistenceStorage = Readonly<{
	getItem(key: string): string | null
	setItem(key: string, value: string): void
	removeItem(key: string): void
}>

/** Adapts lazy browser storage access to the persistence transport contract. */
export function createLocalStorageAdapter(
	getStorage: () => PersistenceStorage,
): FormPersistenceAdapter {
	if (typeof getStorage !== "function") {
		throw new TypeError(
			errorMessage("FP521", "localStorage adapter requires a storage getter"),
		)
	}
	return Object.freeze({
		async load(key) {
			const value = getStorage().getItem(key)
			return value === null ? undefined : (JSON.parse(value) as JsonValue)
		},
		async remove(key) {
			getStorage().removeItem(key)
		},
		async save(key, value) {
			getStorage().setItem(key, JSON.stringify(value))
		},
	})
}
