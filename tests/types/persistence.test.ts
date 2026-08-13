import { z } from "zod"

import { createFormKit } from "../../src/create-form-kit.js"
import { createDefaultSlots } from "../../src/default-slots/index.js"
import type * as RootPublic from "../../src/index.js"
import { createNativeControls } from "../../src/native-controls/index.js"
import {
	createDateCodec,
	createLocalStorageAdapter,
	createPersistenceMiddleware,
	type FormPersistenceAdapter,
	type JsonValue,
	type PersistenceCodec,
	type PersistenceErrorDetails,
	type PersistenceMigration,
	type PersistenceRestoreResult,
	type UsePersistenceResult,
	usePersistence,
} from "../../src/persistence/index.js"
import type {
	FormMiddleware,
	ValueTransactionSource,
} from "../../src/value-middleware.js"

type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <
		Value,
	>() => Value extends Right ? 1 : 2
		? true
		: false
type Expect<Condition extends true> = Condition

const schema = z.object({
	createdAt: z.date(),
	name: z.string(),
})
type Input = z.input<typeof schema>
type Context = { readonly locale: string }

const adapter: FormPersistenceAdapter = {
	async load(_key) {
		return undefined
	},
	async remove(_key) {},
	async save(_key, value) {
		value satisfies JsonValue
	},
}
const migration: PersistenceMigration = (value, fromVersion, toVersion) => {
	fromVersion satisfies number
	toVersion satisfies number
	return value
}
const dateCodec: PersistenceCodec<Date> = createDateCodec()
const onPersistenceError = (
	_error: unknown,
	details: PersistenceErrorDetails,
) => {
	details.operation satisfies "restore" | "save" | "clear"
}
const feature = createPersistenceMiddleware({
	adapter,
	codecs: [dateCodec],
	key: "profile",
	migrate: migration,
	onError: onPersistenceError,
	version: 2,
})
const middleware: FormMiddleware<Input, Context> = feature

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
}).forContext<Context>()
const definition = kit.defineForm(schema, { ui: [] })

function usePersistenceForm() {
	const form = kit.useForm(definition, {
		context: { locale: "en" },
		defaultValues: { createdAt: new Date(), name: "Ada" },
		middleware: [feature],
	})
	const persistence: UsePersistenceResult = usePersistence(form, feature)
	const snapshot = persistence.snapshot
	const restore: () => Promise<PersistenceRestoreResult> = persistence.restore

	if (snapshot.phase === "failed") snapshot.error satisfies unknown
	if (snapshot.save.status === "failed") {
		snapshot.save.operation satisfies "save" | "clear"
	}
	persistence.start()
	void persistence.flush()
	void persistence.clear()

	return { form, persistence, restore }
}

declare const source: ValueTransactionSource<Input>
if (source.type === "persistence") {
	source.action satisfies "restore"
}

const localStorageAdapter = createLocalStorageAdapter(() => localStorage)
localStorageAdapter satisfies FormPersistenceAdapter

type _NoRootPersistence = Expect<
	Equal<
		"createPersistenceMiddleware" extends keyof typeof RootPublic
			? true
			: false,
		false
	>
>

const json: JsonValue = { active: true, nested: [null, 1, "value"] }
// @ts-expect-error undefined needs the persistence envelope encoding.
const invalidJson: JsonValue = undefined

void invalidJson
void json
void middleware
void onPersistenceError
void usePersistenceForm
