// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
import { createFormKit } from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { createMuiFormKit } from "form-please/preset-mui"
import { nativeFormKit } from "form-please/preset-native"
import { useMemo } from "react"
import * as v from "valibot"
import { setLocale } from "yup"
import { z } from "zod"

// [!region context-labels]
type Locale = "en" | "fr"

type LocaleContext = {
	readonly locale: Locale
}

const labels = {
	en: { email: "Email", newsletter: "Send product news" },
	fr: { email: "E-mail", newsletter: "Recevoir les nouveautés" },
} as const

const signupSchema = z.object({
	email: z.string(),
	newsletter: z.boolean(),
})

const localeKit = nativeFormKit.forContext<LocaleContext>()

const signupDefinition = localeKit.defineForm(signupSchema, (ui) => [
	ui.field("email", {
		control: "text",
		label: (_values, { context }) => labels[context.locale].email,
	}),
	ui.field("newsletter", {
		control: "checkbox",
		label: (_values, { context }) => labels[context.locale].newsletter,
	}),
])

function SignupForm({ locale }: { readonly locale: Locale }) {
	const context = useMemo(() => ({ locale }), [locale])
	const form = localeKit.useForm(signupDefinition, {
		defaultValues: { email: "", newsletter: false },
		context,
	})

	return <localeKit.AutoForm form={form} />
}
// [!endregion context-labels]

// [!region zod-messages]
z.config(z.locales.fr())

z.config({
	customError: (issue) => {
		if (issue.code === "too_small" && issue.origin === "string") {
			return `Saisissez au moins ${issue.minimum} caractères`
		}

		return undefined
	},
})
// [!endregion zod-messages]

// [!region valibot-messages]
v.setGlobalConfig({ lang: "fr" })
v.setGlobalMessage("Valeur non valide", "fr")
v.setSpecificMessage(
	v.minLength,
	(issue) => `Saisissez au moins ${issue.requirement} caractères`,
	"fr",
)
// [!endregion valibot-messages]

// [!region yup-messages]
setLocale({
	mixed: { required: "Ce champ est obligatoire" },
	string: { min: ({ min }) => `Saisissez au moins ${min} caractères` },
})
// [!endregion yup-messages]

// [!region default-slots-i18n]
const frenchSlots = createDefaultSlots({
	i18n: {
		arrayAdd: ({ label }) => {
			if (typeof label === "string") return `Ajouter : ${label}`
			return "Ajouter un élément"
		},
		arrayRemove: ({ position }) => `Supprimer l'élément ${position}`,
		arrayMoveUp: ({ position }) => `Monter l'élément ${position}`,
		arrayMoveDown: ({ position }) => `Descendre l'élément ${position}`,
	},
})

const frenchNativeKit = createFormKit({
	controls: createNativeControls(),
	slots: frenchSlots,
})
// [!endregion default-slots-i18n]

// [!region mui-i18n]
const frenchMuiKit = createMuiFormKit({
	i18n: {
		addItem: "Ajouter un élément",
		removeItem: (position) => `Supprimer l'élément ${position}`,
		moveItemUp: (position) => `Monter l'élément ${position}`,
		moveItemDown: (position) => `Descendre l'élément ${position}`,
		chooseFile: "Choisir un fichier",
	},
})
// [!endregion mui-i18n]
