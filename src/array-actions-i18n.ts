import type { ReactNode } from "react"

/** A fixed message or a formatter that uses action-specific data. */
export type I18nMessage<Data> = string | ((data: Readonly<Data>) => string)

/** Data supplied to the array-add message formatter. */
export type ArrayAddI18nData = {
	/** The resolved array label, when the definition supplies one. */
	readonly label?: ReactNode
}

/** Data supplied to array-item action message formatters. */
export type ArrayItemI18nData = {
	/** The zero-based item index. */
	readonly index: number
	/** The one-based item position for user-facing text. */
	readonly position: number
}

/** Messages of the array actions. The default slots and every preset use these keys. */
export type ArrayActionsI18n = {
	/** Labels the button that appends an array item. */
	readonly arrayAdd: I18nMessage<ArrayAddI18nData>
	/** Labels the button that removes an array item. */
	readonly arrayRemove: I18nMessage<ArrayItemI18nData>
	/** Labels the button that moves an array item toward the start. */
	readonly arrayMoveUp: I18nMessage<ArrayItemI18nData>
	/** Labels the button that moves an array item toward the end. */
	readonly arrayMoveDown: I18nMessage<ArrayItemI18nData>
}

/** English array action messages used when no translation is supplied. */
const englishArrayActionsI18n = /* @__PURE__ */ Object.freeze({
	arrayAdd: "Add item",
	arrayRemove: ({ position }) => `Remove item ${position}`,
	arrayMoveUp: ({ position }) => `Move item ${position} up`,
	arrayMoveDown: ({ position }) => `Move item ${position} down`,
} satisfies ArrayActionsI18n)

/** Fills each missing array action message with its English default. */
export function withArrayActionDefaults(
	i18n: Partial<ArrayActionsI18n> | undefined,
): ArrayActionsI18n {
	return Object.freeze({
		arrayAdd: i18n?.arrayAdd ?? englishArrayActionsI18n.arrayAdd,
		arrayRemove: i18n?.arrayRemove ?? englishArrayActionsI18n.arrayRemove,
		arrayMoveUp: i18n?.arrayMoveUp ?? englishArrayActionsI18n.arrayMoveUp,
		arrayMoveDown: i18n?.arrayMoveDown ?? englishArrayActionsI18n.arrayMoveDown,
	})
}

/** Formats one message with its data. */
export function resolveI18nMessage<Data>(
	message: I18nMessage<Data>,
	data: Readonly<Data>,
): string {
	return typeof message === "function" ? message(data) : message
}
