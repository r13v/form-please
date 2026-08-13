"use client"

import {
	createLocalStorageAdapter,
	createPersistenceMiddleware,
	usePersistence,
} from "form-please/persistence"
import { nativeFormKit } from "form-please/preset-native"
import { z } from "zod"

const settingsSchema = z.object({ theme: z.string() })
const settingsDefinition = nativeFormKit.defineForm(settingsSchema, {
	ui: [{ control: "text", kind: "field", label: "Theme", path: "theme" }],
})

// [!region local-storage]
const settingsPersistence = createPersistenceMiddleware({
	adapter: createLocalStorageAdapter(() => localStorage),
	key: "settings-draft",
	onError: (error, { operation }) => {
		console.error(`Settings persistence ${operation} failed`, error)
	},
	version: 1,
})

export function SettingsDraftForm() {
	const form = nativeFormKit.useForm(settingsDefinition, {
		defaultValues: { theme: "system" },
		middleware: [settingsPersistence],
	})
	usePersistence(form, settingsPersistence)

	return <nativeFormKit.AutoForm form={form} />
}
// [!endregion local-storage]
