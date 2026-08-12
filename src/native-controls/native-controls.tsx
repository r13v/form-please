"use client"

import {
	type ChangeEvent,
	type ReactElement,
	useEffect,
	useRef,
	useState,
} from "react"

import { defineControl } from "../control-definition.js"
import type { ControlProps, OptionValue } from "../types.js"

/** A supported HTML input type for the native text control. */
export type NativeTextType =
	| "text"
	| "email"
	| "password"
	| "search"
	| "tel"
	| "url"

/** HTML behavior supported by the native text control. */
export type NativeTextProps = {
	/** The semantic HTML input type. Defaults to `text`. */
	readonly type?: NativeTextType
	/** A short hint shown when the input has no value. */
	readonly placeholder?: string
	/** A browser autofill token or token list. */
	readonly autoComplete?: string
}

/** HTML behavior supported by the native textarea control. */
export type NativeTextareaProps = {
	/** A short hint shown when the textarea has no value. */
	readonly placeholder?: string
	/** A browser autofill token or token list. */
	readonly autoComplete?: string
	/** The visible text-line height of the textarea. */
	readonly rows?: number
}

/** HTML constraints and presentation for the native number control. */
export type NativeNumberProps = {
	/** The minimum accepted number. */
	readonly min?: number
	/** The maximum accepted number. */
	readonly max?: number
	/** The valid interval, or `any` for unrestricted precision. */
	readonly step?: number | "any"
	/** A short hint shown when the input has no value. */
	readonly placeholder?: string
}

/** ISO date limits for the native date control. */
export type NativeDateProps = {
	/** The earliest accepted date in `YYYY-MM-DD` format. */
	readonly min?: string
	/** The latest accepted date in `YYYY-MM-DD` format. */
	readonly max?: string
}

/** Time limits and precision for the native time control. */
export type NativeTimeProps = {
	/** The earliest accepted time as a valid HTML time value. */
	readonly min?: string
	/** The latest accepted time as a valid HTML time value. */
	readonly max?: string
	/** The valid interval in seconds, or `any` for unrestricted precision. */
	readonly step?: number | "any"
}

/** One selectable value in a native select control. */
export type NativeSelectOption<Value extends string | undefined = string> = {
	/** The non-undefined field value represented by this option. */
	readonly value: OptionValue<Exclude<Value, undefined>>
	/** The text shown to the user. */
	readonly label: string
	/** Whether the user cannot select this option. */
	readonly disabled?: boolean
}

/** The select option that represents an undefined field value. */
export type NativeSelectEmptyOption = {
	/** The text shown for the undefined value. */
	readonly label: string
	/** Whether the user cannot return to the undefined value. */
	readonly disabled?: boolean
}

/** Application-owned props for the native select control. */
export type NativeSelectProps = {
	/** The optional entry that maps an empty HTML value to `undefined`. */
	readonly emptyOption?: NativeSelectEmptyOption
}

/** Accepted file types for the native single-file control. */
export type NativeFileProps = {
	/** A comma-separated HTML file-type filter. */
	readonly accept?: string
}

/** Renders the native single-line text control. */
function NativeTextControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: inputProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeTextProps>): ReactElement {
	return (
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			autoComplete={inputProps.autoComplete}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value)}
			placeholder={inputProps.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			type={inputProps.type ?? "text"}
			value={value ?? ""}
		/>
	)
}

/** Renders the native multiline text control. */
function NativeTextareaControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: textareaProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeTextareaProps>): ReactElement {
	return (
		<textarea
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			autoComplete={textareaProps.autoComplete}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value)}
			placeholder={textareaProps.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			rows={textareaProps.rows}
			value={value ?? ""}
		/>
	)
}

/** Renders the native number control and preserves `undefined` for empty input. */
function NativeNumberControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: numberProps,
	disabled,
	readOnly,
	required,
}: ControlProps<number | undefined, NativeNumberProps>): ReactElement {
	/** Converts an HTML number input change to the field value contract. */
	function handleChange(event: ChangeEvent<HTMLInputElement>): void {
		if (event.currentTarget.value === "") {
			setValue(undefined)
			return
		}

		const nextValue = event.currentTarget.valueAsNumber
		if (!Number.isNaN(nextValue)) {
			setValue(nextValue)
		}
	}

	return (
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			max={numberProps.max}
			min={numberProps.min}
			name={input.name}
			onBlur={blur}
			onChange={handleChange}
			placeholder={numberProps.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			step={numberProps.step}
			type="number"
			value={value === undefined ? "" : String(value)}
		/>
	)
}

/** Renders the native ISO date control. */
function NativeDateControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: dateProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeDateProps>): ReactElement {
	return (
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			max={dateProps.max}
			min={dateProps.min}
			name={input.name}
			onBlur={blur}
			onChange={(event) =>
				setValue(
					event.currentTarget.value === ""
						? undefined
						: event.currentTarget.value,
				)
			}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			type="date"
			value={value ?? ""}
		/>
	)
}

/** Renders the native time control. */
function NativeTimeControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: timeProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeTimeProps>): ReactElement {
	return (
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			max={timeProps.max}
			min={timeProps.min}
			name={input.name}
			onBlur={blur}
			onChange={(event) =>
				setValue(
					event.currentTarget.value === ""
						? undefined
						: event.currentTarget.value,
				)
			}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			step={timeProps.step}
			type="time"
			value={value ?? ""}
		/>
	)
}

/** Renders the native single-value select control. */
function NativeSelectControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: selectProps,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<
	string | undefined,
	NativeSelectProps,
	unknown,
	NativeSelectOption
>): ReactElement {
	if (
		selectProps.emptyOption !== undefined &&
		options.some((option) => option.value === "")
	) {
		throw new TypeError(
			'createNativeControls().select cannot combine props.emptyOption with an option whose value is ""',
		)
	}
	if (value === undefined && selectProps.emptyOption === undefined) {
		throw new TypeError(
			"createNativeControls().select requires props.emptyOption to represent undefined",
		)
	}

	return (
		<select
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-readonly={readOnly || undefined}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) => {
				if (readOnly) {
					event.preventDefault()
					event.currentTarget.value = value ?? ""
					return
				}

				const nextValue = event.currentTarget.value
				setValue(
					nextValue === "" && selectProps.emptyOption !== undefined
						? undefined
						: nextValue,
				)
			}}
			onKeyDown={(event) => {
				if (readOnly && isSelectMutationKey(event.key)) {
					preventReadOnlyEvent(event)
				}
			}}
			onMouseDown={(event) => {
				if (readOnly) {
					preventReadOnlyEvent(event)
				}
			}}
			ref={input.ref}
			required={required}
			value={value ?? ""}
		>
			{selectProps.emptyOption === undefined ? null : (
				<option disabled={selectProps.emptyOption.disabled} value="">
					{selectProps.emptyOption.label}
				</option>
			)}
			{options.map((option) => (
				<option
					disabled={option.disabled}
					key={option.value}
					value={option.value}
				>
					{option.label}
				</option>
			))}
		</select>
	)
}

/** Renders the native boolean checkbox control. */
function NativeCheckboxControl({
	value,
	setValue,
	blur,
	input,
	meta,
	disabled,
	readOnly,
	required,
}: ControlProps<boolean>): ReactElement {
	return (
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-readonly={readOnly || undefined}
			checked={value}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) => {
				if (readOnly) {
					event.preventDefault()
					event.currentTarget.checked = value
					return
				}

				setValue(event.currentTarget.checked)
			}}
			onClick={(event) => {
				if (readOnly) {
					preventReadOnlyEvent(event)
				}
			}}
			onKeyDown={(event) => {
				if (readOnly && isActivationKey(event.key)) {
					preventReadOnlyEvent(event)
				}
			}}
			ref={input.ref}
			required={required}
			type="checkbox"
			value="true"
		/>
	)
}

/** Renders the native single-file control and tracks browser-owned file state. */
function NativeFileControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: fileProps,
	disabled,
	readOnly,
	required,
}: ControlProps<File | undefined, NativeFileProps>): ReactElement {
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const [nativeFile, setNativeFile] = useState<File | undefined>(undefined)
	const hasSubmittableNativeFile =
		nativeFile !== undefined && Object.is(value, nativeFile)

	useEffect(() => {
		if (hasSubmittableNativeFile || fileInputRef.current === null) {
			return
		}

		fileInputRef.current.value = ""
		if (nativeFile !== undefined) {
			setNativeFile(undefined)
		}
	}, [hasSubmittableNativeFile, nativeFile])

	return (
		// biome-ignore lint/a11y/useAriaPropsSupportedByRole: File inputs have no native readOnly state, so the control exposes the locked state explicitly.
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-readonly={readOnly || undefined}
			accept={fileProps.accept}
			disabled={disabled}
			id={input.id}
			name={hasSubmittableNativeFile ? input.name : undefined}
			onBlur={blur}
			onChange={(event) => {
				if (readOnly) {
					event.preventDefault()
					return
				}

				const nextFile = event.currentTarget.files?.item(0) ?? undefined
				setNativeFile(nextFile)
				setValue(nextFile)
			}}
			onClick={(event) => {
				if (readOnly) {
					preventReadOnlyEvent(event)
				}
			}}
			onDrop={(event) => {
				if (readOnly) {
					preventReadOnlyEvent(event)
				}
			}}
			onKeyDown={(event) => {
				if (readOnly && isActivationKey(event.key)) {
					preventReadOnlyEvent(event)
				}
			}}
			ref={(element) => {
				fileInputRef.current = element
				input.ref(element)
			}}
			required={required}
			type="file"
		/>
	)
}

/**
 * Creates the built-in registry of native HTML controls.
 *
 * @see https://r13v.github.io/form-please/form-kits
 */
export function createNativeControls() {
	const text = defineControl<string | undefined, NativeTextProps>({
		component: NativeTextControl,
	})

	const textarea = defineControl<string | undefined, NativeTextareaProps>({
		component: NativeTextareaControl,
	})

	const number = defineControl<number | undefined, NativeNumberProps>({
		component: NativeNumberControl,
	})

	const date = defineControl<string | undefined, NativeDateProps>({
		component: NativeDateControl,
	})

	const time = defineControl<string | undefined, NativeTimeProps>({
		component: NativeTimeControl,
	})

	const select = defineControl<
		string | undefined,
		NativeSelectProps,
		unknown,
		NativeSelectOption
	>({
		component: NativeSelectControl,
	})

	const checkbox = defineControl<boolean>({
		component: NativeCheckboxControl,
	})

	const file = defineControl<File | undefined, NativeFileProps>({
		component: NativeFileControl,
	})

	return Object.freeze({
		text,
		textarea,
		select,
		checkbox,
		number,
		date,
		time,
		file,
	})
}

/** Cancels a value-changing event for a read-only native control. */
function preventReadOnlyEvent(event: {
	/** Cancels the browser default action. */
	preventDefault(): void
	/** Prevents ancestor handlers from receiving the event. */
	stopPropagation(): void
}): void {
	event.preventDefault()
	event.stopPropagation()
}

/** Tests whether a keyboard key can change a native select value. */
function isSelectMutationKey(key: string): boolean {
	return [
		" ",
		"Enter",
		"ArrowDown",
		"ArrowUp",
		"End",
		"Home",
		"PageDown",
		"PageUp",
	].includes(key)
}

/** Tests whether a keyboard key activates a button-like control. */
function isActivationKey(key: string): boolean {
	return key === " " || key === "Enter"
}
