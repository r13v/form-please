import type { FormPersistenceAdapter, JsonValue } from "form-please/persistence"

export type QueryStringDraftBridge = Readonly<{
	read(): string | null
	write(value: string | null): unknown | Promise<unknown>
}>

/** Adapts a nuqs string state to the Form, Please persistence transport. */
export function createNuqsPersistenceAdapter(
	bridge: QueryStringDraftBridge,
): FormPersistenceAdapter {
	return {
		async load() {
			const value = bridge.read()
			if (value === null) return undefined
			return JSON.parse(value) as JsonValue
		},
		async remove() {
			await bridge.write(null)
		},
		async save(_key, value) {
			await bridge.write(JSON.stringify(value))
		},
	}
}
