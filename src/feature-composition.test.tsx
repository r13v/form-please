import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { z } from "zod"
import type { FormBinding } from "./create-form-kit.js"
import { createFormKit } from "./create-form-kit.js"
import { createDefaultSlots } from "./default-slots/index.js"
import { createHistoryMiddleware } from "./history/index.js"
import { createNativeControls } from "./native-controls/index.js"
import { encodePersistenceEnvelope } from "./persistence/encoding.js"
import {
	createPersistenceMiddleware,
	type FormPersistenceAdapter,
	type JsonValue,
	usePersistence,
} from "./persistence/index.js"

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const schema = z.object({ name: z.string() })

describe("history with persistence", () => {
	it("treats a persistence restore as a history boundary", async () => {
		const storage = createMemoryAdapter(
			await encodePersistenceEnvelope(
				{ name: "Persisted" },
				{ codecs: [], version: 1 },
			),
		)
		const history = createHistoryMiddleware()
		const persistence = createPersistenceMiddleware({
			adapter: storage.adapter,
			key: "profile",
			version: 1,
		})
		const definition = kit.defineForm(
			schema,
			{ ui: [{ control: "text", kind: "field", label: "Name", path: "name" }] },
			{ middleware: [history, persistence] },
		)
		let form!: FormBinding<typeof schema>
		let phase = ""
		function View() {
			form = kit.useForm(definition, { defaultValues: { name: "Ada" } })
			phase = usePersistence(form, persistence).snapshot.phase
			return <kit.AutoForm form={form} />
		}
		render(<View />)
		await waitFor(() => expect(phase).toBe("active"))
		const handle = history.handle(form)
		expect(form.api.getValues().name).toBe("Persisted")
		expect(handle.getSnapshot().canUndo).toBe(false)

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Edited" },
		})
		await act(() => handle.undo())
		expect(form.api.getValues().name).toBe("Persisted")
		expect(handle.getSnapshot().canUndo).toBe(false)
	})
})

function createMemoryAdapter(initial: JsonValue | undefined) {
	let stored = initial
	const adapter: FormPersistenceAdapter = {
		load: async () => stored,
		save: async (_key, value) => {
			stored = value
		},
		remove: async () => {
			stored = undefined
		},
	}
	return {
		adapter,
		get value() {
			return stored
		},
	}
}
