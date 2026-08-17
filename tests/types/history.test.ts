import { z } from "zod"

import { createFormKit } from "../../src/create-form-kit.js"
import { createDefaultSlots } from "../../src/default-slots/index.js"
import {
	createHistoryMiddleware,
	type HistoryJournal,
	type HistoryOperationResult,
	type UseHistoryResult,
	useHistory,
} from "../../src/history/index.js"
import type * as RootPublic from "../../src/index.js"
import { createNativeControls } from "../../src/native-controls/index.js"
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
	items: z.array(z.object({ name: z.string() })),
	name: z.string(),
})
type Input = z.input<typeof schema>
type Context = { readonly locale: string }

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
}).forContext<Context>()
const feature = createHistoryMiddleware({ groupWindow: 0, limit: 20 })
const middleware: FormMiddleware<Input, Context> = feature
const definition = kit.defineForm(schema, { ui: [] }, { middleware: [feature] })

function useHistoryForm() {
	const form = kit.useForm(definition, {
		context: { locale: "en" },
		defaultValues: { items: [], name: "Ada" },
	})
	const history: UseHistoryResult<Input> = useHistory(form, feature)
	const snapshot = history.snapshot
	const operation: Promise<HistoryOperationResult> = history.undo()
	const journal: HistoryJournal<Input> = history.export()

	snapshot.canUndo satisfies boolean
	journal.entries[0]?.name satisfies string | undefined
	void history.import(journal)
	void history.redo()
	void history.seek(0)
	history.clear()

	return { form, history, operation }
}

declare const source: ValueTransactionSource<Input>
if (source.type === "history") {
	source.action satisfies "undo" | "redo" | "seek" | "import"
}

type _NoRootHistory = Expect<
	Equal<
		"createHistoryMiddleware" extends keyof typeof RootPublic ? true : false,
		false
	>
>
type _NoReplayJournal = Expect<
	Equal<
		"replayJournal" extends keyof typeof import("../../src/history/index.js")
			? true
			: false,
		false
	>
>

const journal: HistoryJournal<Input> = {
	entries: [{ items: [], name: "Ada" }],
	index: 0,
	version: 1,
}
// @ts-expect-error History journal version 1 is the only supported protocol.
const unsupportedJournal: HistoryJournal<Input> = { ...journal, version: 2 }
// @ts-expect-error History journal entries must use an object-shaped form input.
type UnsupportedInputJournal = HistoryJournal<string>

void middleware
void unsupportedJournal
void useHistoryForm
void (undefined as unknown as UnsupportedInputJournal)
