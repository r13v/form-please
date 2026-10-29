"use client"

import {
	type ArrayActionsI18n,
	type ArrayAddI18nData,
	type ArrayItemI18nData,
	type I18nMessage,
	resolveI18nMessage,
	withArrayActionDefaults,
} from "../array-actions-i18n.js"
import type {
	ArrayItemSlotProps,
	ArraySlotProps,
	ErrorMessageSlotProps,
	FieldSlotProps,
	FormKitSlots,
	SectionSlotProps,
	SubmitSlotProps,
} from "../types.js"

/** A fixed message or a formatter that uses slot-specific data. */
export type DefaultSlotI18nValue<Data> = I18nMessage<Data>
/** Data supplied to the default array-add message formatter. */
export type DefaultArrayAddI18nData = ArrayAddI18nData
/** Data supplied to default array-item action message formatters. */
export type DefaultArrayItemI18nData = ArrayItemI18nData
/** Messages used by the default array action controls. */
export type DefaultSlotsI18n = ArrayActionsI18n

/**
 * Creates semantic, unstyled structural slots with optional translated actions.
 *
 * @example
 * ```ts
 * const slots = createDefaultSlots({
 *   i18n: { arrayAdd: "Add another" },
 * })
 * ```
 *
 * @see https://r13v.github.io/form-please/styling
 */
export function createDefaultSlots(options?: {
	/** Overrides one or more English array action messages. */
	readonly i18n?: Partial<DefaultSlotsI18n>
}): FormKitSlots {
	const i18n = withArrayActionDefaults(options?.i18n)

	/** Renders the default array wrapper and append action. */
	function DefaultArraySlot({
		rootProps,
		label,
		labelProps,
		description,
		descriptionProps,
		errors,
		canAdd,
		add,
		children,
	}: ArraySlotProps) {
		return (
			<div {...rootProps}>
				{label === undefined ? null : <div {...labelProps}>{label}</div>}
				{description === undefined ? null : (
					<p {...descriptionProps}>{description}</p>
				)}
				{errors}
				{children}
				<button
					data-fp-array-action="add"
					disabled={!canAdd}
					type="button"
					onClick={add}
				>
					{resolveI18nMessage(
						i18n.arrayAdd,
						Object.freeze({
							label,
						}),
					)}
				</button>
			</div>
		)
	}

	/** Renders the default array item wrapper and item actions. */
	function DefaultArrayItemSlot({
		rootProps,
		index,
		disabled,
		readOnly,
		canMoveUp,
		canMoveDown,
		remove,
		move,
		children,
	}: ArrayItemSlotProps) {
		const actionData = Object.freeze({
			index,
			position: index + 1,
		})
		const moveUpLabel = resolveI18nMessage(i18n.arrayMoveUp, actionData)
		const moveDownLabel = resolveI18nMessage(i18n.arrayMoveDown, actionData)
		const removeLabel = resolveI18nMessage(i18n.arrayRemove, actionData)

		return (
			<div {...rootProps}>
				{children}
				<fieldset
					aria-label={`#${actionData.position}`}
					data-fp-array-item-actions=""
				>
					<span aria-hidden="true" data-fp-array-item-position="">
						#{actionData.position}
					</span>
					<button
						aria-label={moveUpLabel}
						data-fp-array-action="move-up"
						disabled={disabled || readOnly || !canMoveUp}
						title={moveUpLabel}
						type="button"
						onClick={() => move(index - 1)}
					>
						<span aria-hidden="true">↑</span>
					</button>
					<button
						aria-label={moveDownLabel}
						data-fp-array-action="move-down"
						disabled={disabled || readOnly || !canMoveDown}
						title={moveDownLabel}
						type="button"
						onClick={() => move(index + 1)}
					>
						<span aria-hidden="true">↓</span>
					</button>
					<button
						aria-label={removeLabel}
						data-fp-array-action="remove"
						disabled={disabled || readOnly}
						title={removeLabel}
						type="button"
						onClick={remove}
					>
						<span aria-hidden="true">❌</span>
					</button>
				</fieldset>
			</div>
		)
	}

	return Object.freeze({
		Field: DefaultFieldSlot,
		Section: DefaultSectionSlot,
		Array: DefaultArraySlot,
		ArrayItem: DefaultArrayItemSlot,
		ErrorMessage: DefaultErrorMessageSlot,
		Submit: DefaultSubmitSlot,
	})
}

/** Renders the default field structure. */
function DefaultFieldSlot({
	rootProps,
	label,
	labelProps,
	description,
	descriptionProps,
	control,
	errors,
}: FieldSlotProps) {
	return (
		<div {...rootProps}>
			{label === undefined ? null : (
				<label {...labelProps} htmlFor={labelProps.htmlFor}>
					{label}
				</label>
			)}
			{description === undefined ? null : (
				<p {...descriptionProps}>{description}</p>
			)}
			{control}
			{errors}
		</div>
	)
}

/** Renders the default section and grid structure. */
function DefaultSectionSlot({
	rootProps,
	layoutProps,
	title,
	description,
	children,
}: SectionSlotProps) {
	return (
		<section {...rootProps}>
			{title === undefined ? null : <h2>{title}</h2>}
			{description === undefined ? null : <p>{description}</p>}
			<div {...layoutProps}>{children}</div>
		</section>
	)
}

/** Renders one default validation message with alert semantics. */
function DefaultErrorMessageSlot({ rootProps, issue }: ErrorMessageSlotProps) {
	return (
		<p {...rootProps} role="alert">
			{issue.message}
		</p>
	)
}

/** Renders the default native submit button. */
function DefaultSubmitSlot({ buttonProps }: SubmitSlotProps) {
	return <button {...buttonProps} />
}
