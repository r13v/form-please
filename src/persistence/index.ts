"use client"

export { createDateCodec } from "./codecs.js"
export type {
	JsonValue,
	PersistenceCodec,
	PersistenceMigration,
} from "./encoding.js"
export { createLocalStorageAdapter } from "./local-storage.js"
export {
	type CreatePersistenceOptions,
	createPersistenceMiddleware,
	type FormPersistenceAdapter,
	type PersistenceErrorDetails,
	type PersistenceFeature,
	type PersistenceHandle,
	type PersistenceRestoreResult,
	type PersistenceSnapshot,
} from "./persistence.js"
export type { UsePersistenceResult } from "./use-persistence.js"
export { usePersistence } from "./use-persistence.js"
