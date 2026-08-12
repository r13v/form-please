"use client"

import type {
	AutocompleteRenderInputParams,
	TextFieldProps,
} from "@mui/material"
import {
	Autocomplete,
	Button,
	Checkbox,
	FormControlLabel,
	MenuItem,
	Radio,
	RadioGroup,
	Select,
	Slider,
	Switch,
	TextField,
} from "@mui/material"
import { type ReactElement, useEffect, useRef, useState } from "react"

import { defineControl } from "../control-definition.js"
import type { ControlProps, OptionValue } from "../types.js"
import type {
	MuiAutocompleteMultipleProps,
	MuiAutocompleteProps,
	MuiCheckboxProps,
	MuiFileProps,
	MuiFormKitI18n,
	MuiRadioOption,
	MuiRadioProps,
	MuiRangeSliderProps,
	MuiSelectMultipleProps,
	MuiSelectOption,
	MuiSelectProps,
	MuiSliderProps,
	MuiSwitchProps,
	MuiTextFieldProps,
} from "./types.js"
import { mergeSx } from "./utils.js"

/** HTML input types supported by MUI string text controls. */
type TextInputType = "email" | "password" | "search" | "tel" | "text" | "url"

/** HTML input types supported by MUI date and time controls. */
type DateInputType = "date" | "datetime-local" | "time"

/** Visually hides a native file input while keeping it accessible. */
const visuallyHiddenInputStyle = {
	clip: "rect(0 0 0 0)",
	clipPath: "inset(50%)",
	height: 1,
	overflow: "hidden",
	position: "absolute",
	whiteSpace: "nowrap",
	width: 1,
} as const

/** Creates the complete control registry used by the Material UI preset. */
export function createMuiControls(i18n: MuiFormKitI18n) {
	const text = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiTextControl("text"),
	})
	const textarea = defineControl<string | undefined, MuiTextFieldProps>({
		component: MuiTextareaControl,
	})
	const password = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiTextControl("password"),
	})
	const email = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiTextControl("email"),
	})
	const url = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiTextControl("url"),
	})
	const tel = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiTextControl("tel"),
	})
	const search = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiTextControl("search"),
	})
	const number = defineControl<number | undefined, MuiTextFieldProps>({
		component: MuiNumberControl,
	})
	const date = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiDateControl("date"),
	})
	const time = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiDateControl("time"),
	})
	const datetimeLocal = defineControl<string | undefined, MuiTextFieldProps>({
		component: createMuiDateControl("datetime-local"),
	})
	const select = defineControl<
		string | undefined,
		MuiSelectProps,
		unknown,
		MuiSelectOption
	>({
		component: MuiSelectControl,
	})
	const selectMultiple = defineControl<
		readonly string[],
		MuiSelectMultipleProps,
		unknown,
		MuiSelectOption
	>({
		component: MuiSelectMultipleControl,
	})
	const radio = defineControl<
		string | undefined,
		MuiRadioProps,
		unknown,
		MuiRadioOption
	>({
		component: MuiRadioControl,
	})
	const checkbox = defineControl<boolean, MuiCheckboxProps>({
		component: MuiCheckboxControl,
	})
	const switchControl = defineControl<boolean, MuiSwitchProps>({
		component: MuiSwitchControl,
	})
	const autocomplete = defineControl<
		string | undefined,
		MuiAutocompleteProps,
		unknown,
		OptionValue<string>
	>({
		component: MuiAutocompleteControl,
	})
	const autocompleteMultiple = defineControl<
		readonly string[],
		MuiAutocompleteMultipleProps,
		unknown,
		OptionValue<string>
	>({
		component: MuiAutocompleteMultipleControl,
	})
	const file = defineControl<File | undefined, MuiFileProps>({
		component: (props) => <MuiFileControl {...props} i18n={i18n} />,
	})
	const files = defineControl<readonly File[], MuiFileProps>({
		component: (props) => <MuiFilesControl {...props} i18n={i18n} />,
	})
	const slider = defineControl<number, MuiSliderProps>({
		component: MuiSliderControl,
	})
	const rangeSlider = defineControl<readonly number[], MuiRangeSliderProps>({
		component: MuiRangeSliderControl,
	})

	return Object.freeze({
		text,
		textarea,
		password,
		email,
		url,
		tel,
		search,
		number,
		date,
		time,
		"datetime-local": datetimeLocal,
		select,
		"select-multiple": selectMultiple,
		radio,
		checkbox,
		switch: switchControl,
		autocomplete,
		"autocomplete-multiple": autocompleteMultiple,
		file,
		files,
		slider,
		"range-slider": rangeSlider,
	})
}

/** Creates a MUI string control for one semantic HTML input type. */
function createMuiTextControl(type: TextInputType) {
	return function MuiTextControl(
		props: ControlProps<string | undefined, MuiTextFieldProps>,
	): ReactElement {
		return <MuiStringTextField {...props} type={type} />
	}
}

/** Creates a MUI string control for one date or time input type. */
function createMuiDateControl(type: DateInputType) {
	return function MuiDateControl(
		props: ControlProps<string | undefined, MuiTextFieldProps>,
	): ReactElement {
		return <MuiStringTextField {...props} emptyIsUndefined type={type} />
	}
}

/** Renders a multiline MUI string control. */
function MuiTextareaControl(
	props: ControlProps<string | undefined, MuiTextFieldProps>,
): ReactElement {
	return <MuiStringTextField {...props} multiline type="text" />
}

/** Renders shared MUI text behavior for string, date, and time controls. */
function MuiStringTextField({
	value,
	setValue,
	blur,
	input,
	meta,
	props: textFieldProps,
	disabled,
	readOnly,
	required,
	type,
	multiline = false,
	emptyIsUndefined = false,
}: ControlProps<string | undefined, MuiTextFieldProps> & {
	/** The semantic HTML input type. */
	readonly type: TextInputType | DateInputType
	/** Whether the TextField renders a textarea. */
	readonly multiline?: boolean
	/** Whether an empty HTML value maps to `undefined`. */
	readonly emptyIsUndefined?: boolean
}): ReactElement {
	const { onBlur, onChange, slotProps, ...muiProps } =
		textFieldProps as TextFieldProps
	return (
		<TextField
			fullWidth
			{...muiProps}
			disabled={disabled}
			error={meta.invalid}
			id={input.id}
			inputRef={input.ref}
			multiline={multiline}
			name={input.name}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event) => {
				const nextValue = event.currentTarget.value
				setValue(emptyIsUndefined && nextValue === "" ? undefined : nextValue)
				onChange?.(event)
			}}
			required={required}
			slotProps={mergeTextFieldSlotProps(slotProps, {
				"aria-describedby": input["aria-describedby"],
				"aria-invalid": meta.invalid || undefined,
				defaultValue: undefined,
				disabled,
				id: input.id,
				name: input.name,
				readOnly,
				ref: input.ref,
				required,
				value: value ?? "",
			})}
			type={type}
			value={value ?? ""}
		/>
	)
}

/** Renders a MUI number control and preserves `undefined` for empty input. */
function MuiNumberControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: textFieldProps,
	disabled,
	readOnly,
	required,
}: ControlProps<number | undefined, MuiTextFieldProps>): ReactElement {
	const { onBlur, onChange, slotProps, ...muiProps } =
		textFieldProps as TextFieldProps
	return (
		<TextField
			fullWidth
			{...muiProps}
			disabled={disabled}
			error={meta.invalid}
			id={input.id}
			inputRef={input.ref}
			name={input.name}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event) => {
				const nextValue = event.currentTarget.value
				if (nextValue === "") {
					setValue(undefined)
				} else {
					const numberValue = (event.currentTarget as HTMLInputElement)
						.valueAsNumber
					if (!Number.isNaN(numberValue)) setValue(numberValue)
				}
				onChange?.(event)
			}}
			required={required}
			slotProps={mergeTextFieldSlotProps(slotProps, {
				"aria-describedby": input["aria-describedby"],
				"aria-invalid": meta.invalid || undefined,
				defaultValue: undefined,
				disabled,
				id: input.id,
				name: input.name,
				readOnly,
				ref: input.ref,
				required,
				value: value === undefined ? "" : String(value),
			})}
			type="number"
			value={value === undefined ? "" : String(value)}
		/>
	)
}

/** Renders a single-value MUI select control. */
function MuiSelectControl({
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
	MuiSelectProps,
	unknown,
	MuiSelectOption
>): ReactElement {
	const { children, inputProps, onBlur, onChange, ...muiProps } = selectProps
	return (
		<Select<string>
			fullWidth
			{...muiProps}
			disabled={disabled}
			error={meta.invalid}
			id={input.id}
			inputProps={{
				...inputProps,
				"aria-describedby": input["aria-describedby"],
				"aria-invalid": meta.invalid || undefined,
				"aria-readonly": readOnly || undefined,
				defaultValue: undefined,
				disabled,
				error: meta.invalid,
				id: undefined,
				name: input.name,
				readOnly,
				required,
				value: value ?? "",
			}}
			inputRef={input.ref}
			name={input.name}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, child) => {
				setValue(event.target.value === "" ? undefined : event.target.value)
				onChange?.(event, child)
			}}
			readOnly={readOnly}
			required={required}
			value={value ?? ""}
		>
			{children ?? renderSelectOptions(options)}
		</Select>
	)
}

/** Renders a multi-value MUI select control. */
function MuiSelectMultipleControl({
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
	readonly string[],
	MuiSelectMultipleProps,
	unknown,
	MuiSelectOption
>): ReactElement {
	const { children, inputProps, onBlur, onChange, ...muiProps } = selectProps
	return (
		<Select<readonly string[]>
			fullWidth
			{...muiProps}
			disabled={disabled}
			error={meta.invalid}
			id={input.id}
			inputProps={{
				...inputProps,
				"aria-describedby": input["aria-describedby"],
				"aria-invalid": meta.invalid || undefined,
				"aria-readonly": readOnly || undefined,
				defaultValue: undefined,
				disabled,
				error: meta.invalid,
				id: undefined,
				name: undefined,
				readOnly,
				required,
				value,
			}}
			inputRef={input.ref}
			multiple
			name={undefined}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, child) => {
				const nextValue = event.target.value
				setValue(
					typeof nextValue === "string" ? nextValue.split(",") : nextValue,
				)
				onChange?.(event, child)
			}}
			readOnly={readOnly}
			required={required}
			value={value}
		>
			{children ?? renderSelectOptions(options)}
		</Select>
	)
}

/** Renders typed select options as MUI menu items. */
function renderSelectOptions(options: readonly MuiSelectOption[]) {
	return options.map((option) => (
		<MenuItem
			disabled={option.disabled}
			key={option.value}
			value={option.value}
		>
			{option.label}
		</MenuItem>
	))
}

/** Renders a MUI radio group with typed or application-rendered options. */
function MuiRadioControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: radioGroupProps,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<
	string | undefined,
	MuiRadioProps,
	unknown,
	MuiRadioOption
>): ReactElement {
	const { children, onBlur, onChange, ...muiProps } = radioGroupProps
	return (
		<RadioGroup
			{...muiProps}
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-labelledby={`${input.id}-label`}
			aria-readonly={readOnly || undefined}
			id={input.id}
			name={input.name}
			onBlur={(event) => {
				if (children !== undefined) blur()
				onBlur?.(event)
			}}
			onChange={(event, nextValue) => {
				if (children !== undefined && !readOnly) setValue(nextValue)
				onChange?.(event, nextValue)
			}}
			ref={children === undefined ? undefined : input.ref}
			tabIndex={-1}
			value={value ?? ""}
		>
			{children ??
				options.map((option, index) => {
					const {
						onBlur: onRadioBlur,
						onChange: onRadioChange,
						onClick: onRadioClick,
						onKeyDown: onRadioKeyDown,
						slotProps,
						...radioProps
					} = option.radioProps ?? {}
					const { onChange: onLabelChange, ...labelProps } =
						option.labelProps ?? {}
					const radioId = `${input.id}-${index}`
					return (
						<FormControlLabel
							{...labelProps}
							control={
								<Radio
									{...radioProps}
									disabled={disabled || option.disabled}
									id={radioId}
									onBlur={(event) => {
										blur()
										onRadioBlur?.(event)
									}}
									onChange={(event, checked) => {
										if (!readOnly && checked) setValue(option.value)
										onRadioChange?.(event, checked)
										onLabelChange?.(event, checked)
									}}
									onClick={(event) => {
										if (readOnly) event.preventDefault()
										onRadioClick?.(event)
									}}
									onKeyDown={(event) => {
										if (readOnly && isActivationKey(event.key)) {
											event.preventDefault()
										}
										onRadioKeyDown?.(event)
									}}
									required={required}
									slotProps={{
										...slotProps,
										input: mergeSlotProps(slotProps?.input, {
											"aria-describedby": input["aria-describedby"],
											"aria-invalid": meta.invalid || undefined,
											"aria-readonly": readOnly || undefined,
											checked: value === option.value,
											defaultChecked: undefined,
											disabled: disabled || option.disabled,
											id: radioId,
											name: input.name,
											ref: index === 0 ? input.ref : undefined,
											required,
											value: option.value,
										}),
									}}
								/>
							}
							disabled={disabled || option.disabled}
							key={option.value}
							label={option.label}
							required={required}
							value={option.value}
						/>
					)
				})}
		</RadioGroup>
	)
}

/** Renders the MUI boolean checkbox control. */
function MuiCheckboxControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: checkboxProps,
	disabled,
	readOnly,
	required,
}: ControlProps<boolean, MuiCheckboxProps>): ReactElement {
	const { onBlur, onChange, onClick, slotProps, sx, ...muiProps } =
		checkboxProps
	return (
		<Checkbox
			{...muiProps}
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			checked={value}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, checked) => {
				if (!readOnly) setValue(checked)
				onChange?.(event, checked)
			}}
			onClick={(event) => {
				if (readOnly) event.preventDefault()
				onClick?.(event)
			}}
			required={required}
			slotProps={{
				...slotProps,
				input: mergeSlotProps(slotProps?.input, {
					"aria-describedby": input["aria-describedby"],
					"aria-invalid": meta.invalid || undefined,
					"aria-readonly": readOnly || undefined,
					checked: value,
					defaultChecked: undefined,
					disabled,
					id: input.id,
					name: input.name,
					ref: input.ref,
					required,
					value: "true",
				}),
			}}
			sx={mergeSx({ alignSelf: "flex-start" }, sx)}
			value="true"
		/>
	)
}

/** Renders the MUI boolean switch control. */
function MuiSwitchControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: switchProps,
	disabled,
	readOnly,
	required,
}: ControlProps<boolean, MuiSwitchProps>): ReactElement {
	const { onBlur, onChange, onClick, slotProps, ...muiProps } = switchProps
	return (
		<Switch
			{...muiProps}
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			checked={value}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, checked) => {
				if (!readOnly) setValue(checked)
				onChange?.(event, checked)
			}}
			onClick={(event) => {
				if (readOnly) event.preventDefault()
				onClick?.(event)
			}}
			required={required}
			slotProps={{
				...slotProps,
				input: mergeSlotProps(slotProps?.input, {
					"aria-describedby": input["aria-describedby"],
					"aria-invalid": meta.invalid || undefined,
					"aria-readonly": readOnly || undefined,
					checked: value,
					defaultChecked: undefined,
					disabled,
					id: input.id,
					name: input.name,
					ref: input.ref,
					required,
					value: "true",
				}),
			}}
			value="true"
		/>
	)
}

/** Renders the single-value MUI autocomplete control. */
function MuiAutocompleteControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: autocompleteProps,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<
	string | undefined,
	MuiAutocompleteProps,
	unknown,
	OptionValue<string>
>): ReactElement {
	const { textFieldProps, onBlur, onChange, ...muiProps } = autocompleteProps
	return (
		<Autocomplete<string, false, boolean, boolean>
			fullWidth
			{...muiProps}
			disabled={disabled}
			id={input.id}
			multiple={false}
			options={options}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, nextValue, reason, details) => {
				setValue(nextValue ?? undefined)
				onChange?.(event, nextValue, reason, details)
			}}
			readOnly={readOnly}
			renderInput={(params) =>
				renderAutocompleteInput({
					params,
					textFieldProps,
					input,
					invalid: meta.invalid,
					disabled,
					readOnly,
					required,
				})
			}
			value={value ?? null}
		/>
	)
}

/** Renders the multi-value MUI autocomplete control. */
function MuiAutocompleteMultipleControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: autocompleteProps,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<
	readonly string[],
	MuiAutocompleteMultipleProps,
	unknown,
	OptionValue<string>
>): ReactElement {
	const { textFieldProps, onBlur, onChange, ...muiProps } = autocompleteProps
	return (
		<Autocomplete<string, true, boolean, boolean>
			fullWidth
			{...muiProps}
			disabled={disabled}
			id={input.id}
			multiple
			options={options}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, nextValue, reason, details) => {
				setValue(nextValue)
				onChange?.(event, nextValue, reason, details)
			}}
			readOnly={readOnly}
			renderInput={(params) =>
				renderAutocompleteInput({
					params,
					textFieldProps,
					input,
					invalid: meta.invalid,
					disabled,
					readOnly,
					required,
				})
			}
			value={[...value]}
		/>
	)
}

/** Connects a MUI autocomplete input to Form Please metadata and refs. */
function renderAutocompleteInput({
	params,
	textFieldProps,
	input,
	invalid,
	disabled,
	readOnly,
	required,
}: {
	/** Input props generated by the MUI autocomplete. */
	readonly params: AutocompleteRenderInputParams
	/** Application-owned props for the rendered MUI TextField. */
	readonly textFieldProps:
		| MuiAutocompleteProps["textFieldProps"]
		| MuiAutocompleteMultipleProps["textFieldProps"]
	/** IDs, name, and registration ref owned by Form Please. */
	readonly input: ControlProps<unknown>["input"]
	/** Whether the control currently displays a validation error. */
	readonly invalid: boolean
	/** Whether user interaction is disabled. */
	readonly disabled: boolean
	/** Whether value changes are read-only. */
	readonly readOnly: boolean
	/** Whether the definition marks the field as required. */
	readonly required: boolean
}): ReactElement {
	const { slotProps, ...muiTextFieldProps } = (textFieldProps ??
		{}) as TextFieldProps
	return (
		<TextField
			{...params}
			{...muiTextFieldProps}
			disabled={disabled}
			error={invalid}
			id={input.id}
			required={required}
			slotProps={{
				...slotProps,
				inputLabel: mergeSlotProps(
					slotProps?.inputLabel,
					params.slotProps.inputLabel,
				),
				input: mergeSlotProps(slotProps?.input, params.slotProps.input),
				htmlInput: mergeSlotProps(
					mergeSlotProps(slotProps?.htmlInput, params.slotProps.htmlInput),
					{
						"aria-describedby": input["aria-describedby"],
						"aria-invalid": invalid || undefined,
						id: input.id,
						name: undefined,
						readOnly,
						ref: mergeRefs(params.slotProps.htmlInput.ref, input.ref),
					},
				),
			}}
		/>
	)
}

/** Renders the scalar MUI slider control. */
function MuiSliderControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: sliderProps,
	disabled,
	readOnly,
	required,
}: ControlProps<number, MuiSliderProps>): ReactElement {
	const { onBlur, onChange, onKeyDown, onMouseDown, slotProps, ...muiProps } =
		sliderProps
	return (
		<Slider
			{...muiProps}
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-labelledby={`${input.id}-label`}
			disabled={disabled}
			name={undefined}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, nextValue, activeThumb) => {
				if (!readOnly) setValue(nextValue)
				onChange?.(event, nextValue, activeThumb)
			}}
			onKeyDown={(event) => {
				if (readOnly && isSliderMutationKey(event.key)) event.preventDefault()
				onKeyDown?.(event)
			}}
			onMouseDown={(event) => {
				if (readOnly) event.preventDefault()
				onMouseDown?.(event)
			}}
			slotProps={{
				...slotProps,
				input: mergeSlotProps(
					slotProps?.input,
					{
						"aria-describedby": input["aria-describedby"],
						"aria-invalid": meta.invalid || undefined,
						"aria-labelledby": `${input.id}-label`,
						"aria-readonly": readOnly || undefined,
						id: input.id,
						name: undefined,
						ref: input.ref,
						required,
					},
					["aria-valuenow", "defaultValue", "value"],
				),
			}}
			value={value}
		/>
	)
}

/** Renders the range MUI slider control. */
function MuiRangeSliderControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: sliderProps,
	disabled,
	readOnly,
	required,
}: ControlProps<readonly number[], MuiRangeSliderProps>): ReactElement {
	const { onBlur, onChange, onKeyDown, onMouseDown, slotProps, ...muiProps } =
		sliderProps
	return (
		<Slider
			{...muiProps}
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-labelledby={`${input.id}-label`}
			disabled={disabled}
			id={input.id}
			name={undefined}
			onBlur={(event) => {
				blur()
				onBlur?.(event)
			}}
			onChange={(event, nextValue, activeThumb) => {
				if (!readOnly) setValue(nextValue as readonly number[])
				onChange?.(event, nextValue, activeThumb)
			}}
			onKeyDown={(event) => {
				if (readOnly && isSliderMutationKey(event.key)) event.preventDefault()
				onKeyDown?.(event)
			}}
			onMouseDown={(event) => {
				if (readOnly) event.preventDefault()
				onMouseDown?.(event)
			}}
			slotProps={{
				...slotProps,
				input: mergeSlotProps(
					slotProps?.input,
					{
						"aria-describedby": input["aria-describedby"],
						"aria-invalid": meta.invalid || undefined,
						"aria-labelledby": `${input.id}-label`,
						"aria-readonly": readOnly || undefined,
						id: undefined,
						name: undefined,
						ref: input.ref,
						required,
					},
					["aria-valuenow", "defaultValue", "value"],
				),
			}}
			value={[...value]}
		/>
	)
}

/** Renders the MUI single-file control and tracks browser-owned file state. */
function MuiFileControl(
	props: ControlProps<File | undefined, MuiFileProps> & {
		/** User-facing messages for the file control. */
		readonly i18n: MuiFormKitI18n
	},
): ReactElement {
	const inputElement = useRef<HTMLInputElement | null>(null)
	const [nativeValue, setNativeValue] = useState<File | undefined>()
	const hasNativeValue =
		nativeValue !== undefined && props.value === nativeValue

	useEffect(() => {
		if (hasNativeValue || inputElement.current === null) return
		inputElement.current.value = ""
		if (nativeValue !== undefined) setNativeValue(undefined)
	}, [hasNativeValue, nativeValue])

	return (
		<MuiFileButton
			{...props}
			hasNativeValue={hasNativeValue}
			inputElement={inputElement}
			label={props.value?.name ?? props.i18n.chooseFile}
			onFiles={(files) => {
				const nextFile = files?.item(0) ?? undefined
				setNativeValue(nextFile)
				props.setValue(nextFile)
			}}
		/>
	)
}

/** Renders the MUI multi-file control and tracks browser-owned file state. */
function MuiFilesControl(
	props: ControlProps<readonly File[], MuiFileProps> & {
		/** User-facing messages for the file control. */
		readonly i18n: MuiFormKitI18n
	},
): ReactElement {
	const inputElement = useRef<HTMLInputElement | null>(null)
	const [nativeValue, setNativeValue] = useState<readonly File[]>([])
	const hasNativeValue = sameFiles(props.value, nativeValue)
	const label =
		props.value.length === 0
			? props.i18n.chooseFile
			: props.value.map((file) => file.name).join(", ")

	useEffect(() => {
		if (hasNativeValue || inputElement.current === null) return
		inputElement.current.value = ""
		if (nativeValue.length > 0) setNativeValue([])
	}, [hasNativeValue, nativeValue])

	return (
		<MuiFileButton
			{...props}
			hasNativeValue={hasNativeValue && props.value.length > 0}
			inputElement={inputElement}
			label={label}
			multiple
			onFiles={(files) => {
				const nextFiles = files === null ? [] : Array.from(files)
				setNativeValue(nextFiles)
				props.setValue(nextFiles)
			}}
		/>
	)
}

/** Renders the shared MUI file button and hidden native file input. */
function MuiFileButton<Value extends File | undefined | readonly File[]>({
	blur,
	input,
	meta,
	props: fileProps,
	disabled,
	readOnly,
	required,
	hasNativeValue,
	inputElement,
	label,
	multiple = false,
	onFiles,
}: ControlProps<Value, MuiFileProps> & {
	/** User-facing messages for the file control. */
	readonly i18n: MuiFormKitI18n
	/** Whether the native input still owns the current field files. */
	readonly hasNativeValue: boolean
	/** Mutable reference to the hidden native file input. */
	readonly inputElement: {
		/** The mounted hidden input, or `null` before mount. */
		current: HTMLInputElement | null
	}
	/** Text shown inside the file-selection button. */
	readonly label: string
	/** Whether the native input accepts more than one file. */
	readonly multiple?: boolean
	/** Updates the field from the native file selection. */
	onFiles(files: FileList | null): void
}): ReactElement {
	const { buttonProps = {}, inputProps = {}, sx } = fileProps
	const {
		children,
		onClick: onButtonClick,
		sx: buttonSx,
		...restButtonProps
	} = buttonProps
	const { onBlur, onChange, onClick, onDrop, onKeyDown, ...restInputProps } =
		inputProps
	return (
		// biome-ignore lint/a11y/useValidAriaRole: MUI adds role="button" to a label root; explicit undefined keeps only the native file input interactive.
		<Button
			component="label"
			variant="outlined"
			{...restButtonProps}
			aria-disabled={readOnly || undefined}
			disabled={disabled}
			onClick={(event) => {
				if (readOnly) event.preventDefault()
				onButtonClick?.(event)
			}}
			role={undefined}
			sx={mergeSx(sx, buttonSx)}
			tabIndex={-1}
			type="button"
		>
			{children ?? label}
			{/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: File inputs have no native readOnly state, so the control exposes the locked state explicitly. */}
			<input
				{...restInputProps}
				aria-describedby={input["aria-describedby"]}
				aria-invalid={meta.invalid || undefined}
				aria-readonly={readOnly || undefined}
				disabled={disabled}
				id={input.id}
				multiple={multiple}
				name={hasNativeValue ? input.name : undefined}
				onBlur={(event) => {
					blur()
					onBlur?.(event)
				}}
				onChange={(event) => {
					if (!readOnly) onFiles(event.currentTarget.files)
					onChange?.(event)
				}}
				onClick={(event) => {
					if (readOnly) event.preventDefault()
					onClick?.(event)
				}}
				onDrop={(event) => {
					if (readOnly) event.preventDefault()
					onDrop?.(event)
				}}
				onKeyDown={(event) => {
					if (readOnly && isActivationKey(event.key)) event.preventDefault()
					onKeyDown?.(event)
				}}
				ref={(element) => {
					inputElement.current = element
					input.ref(element)
				}}
				required={required}
				style={visuallyHiddenInputStyle}
				type="file"
			/>
		</Button>
	)
}

/** Adds Form Please-owned native input props to MUI TextField slot props. */
function mergeTextFieldSlotProps(
	slotProps: TextFieldProps["slotProps"],
	ownedInputProps: Record<string, unknown>,
): TextFieldProps["slotProps"] {
	return {
		...slotProps,
		htmlInput: mergeSlotProps(slotProps?.htmlInput, ownedInputProps),
	}
}

/** Merges supplied MUI slot props with runtime-owned props. */
function mergeSlotProps(
	supplied: unknown,
	owned: unknown,
	omitted: readonly string[] = [],
):
	| Record<string, unknown>
	| ((ownerState: unknown) => Record<string, unknown>) {
	const ownedProps = (owned ?? {}) as Record<string, unknown>
	const merge = (suppliedProps: Record<string, unknown>) => {
		const merged = { ...suppliedProps }
		for (const key of omitted) delete merged[key]
		return { ...merged, ...ownedProps }
	}
	if (typeof supplied === "function") {
		return (ownerState) =>
			merge(supplied(ownerState) as Record<string, unknown>)
	}
	return merge((supplied ?? {}) as Record<string, unknown>)
}

/** Creates one callback ref that updates an external ref and an owned callback. */
function mergeRefs<Value>(
	first:
		| ((value: Value | null) => void)
		| {
				/** The current value held by a mutable React ref. */
				current: Value | null
		  }
		| null
		| undefined,
	second: (value: Value | null) => void,
): (value: Value | null) => void {
	return (value) => {
		if (typeof first === "function") first(value)
		else if (first != null) first.current = value
		second(value)
	}
}

/** Tests whether two file arrays contain the same object references in order. */
function sameFiles(left: readonly File[], right: readonly File[]): boolean {
	return (
		left.length === right.length &&
		left.every((file, index) => file === right[index])
	)
}

/** Tests whether a keyboard key activates a button-like control. */
function isActivationKey(key: string): boolean {
	return key === " " || key === "Enter"
}

/** Tests whether a keyboard key can change a MUI slider value. */
function isSliderMutationKey(key: string): boolean {
	return [
		"ArrowDown",
		"ArrowLeft",
		"ArrowRight",
		"ArrowUp",
		"End",
		"Home",
		"PageDown",
		"PageUp",
	].includes(key)
}
