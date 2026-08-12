import type {
	AutocompleteProps,
	ButtonProps,
	CheckboxProps,
	FormControlLabelProps,
	RadioGroupProps,
	RadioProps,
	SelectProps,
	SliderProps,
	SwitchProps,
	TextFieldProps,
} from "@mui/material"
import type { SxProps, Theme } from "@mui/material/styles"
import type { ComponentPropsWithoutRef, ReactNode } from "react"

import type { OptionValue } from "../types.js"

/** Removes owned properties from each member of a MUI prop union. */
type DistributiveOmit<Value, Keys extends PropertyKey> = Value extends unknown
	? Omit<Value, Keys>
	: never

/** Represents a MUI component without application-added props. */
type NoAdditionalProps = Record<never, never>

/** Text field props controlled by Form Please or the selected control. */
type TextFieldOwnedProps =
	| "defaultValue"
	| "disabled"
	| "error"
	| "helperText"
	| "id"
	| "inputRef"
	| "label"
	| "multiline"
	| "name"
	| "required"
	| "type"
	| "value"

/** Application-owned MUI TextField props for text, number, and date controls. */
export type MuiTextFieldProps = DistributiveOmit<
	TextFieldProps,
	TextFieldOwnedProps
>

/** One option rendered by a MUI select control. */
export type MuiSelectOption = {
	/** The string field value represented by this option. */
	readonly value: OptionValue<string>
	/** The content shown to the user. */
	readonly label: ReactNode
	/** Whether the user cannot select this option. */
	readonly disabled?: boolean
}

/** Select props controlled by Form Please or the selected control. */
type SelectOwnedProps =
	| "defaultValue"
	| "disabled"
	| "error"
	| "id"
	| "label"
	| "labelId"
	| "multiple"
	| "name"
	| "readOnly"
	| "required"
	| "value"

/** Application-owned props and optional options for the MUI select control. */
export type MuiSelectProps = DistributiveOmit<
	SelectProps<string>,
	SelectOwnedProps
>

/** Application-owned props and options for the MUI multi-select control. */
export type MuiSelectMultipleProps = DistributiveOmit<
	SelectProps<readonly string[]>,
	SelectOwnedProps
>

/** One value and its presentation in a MUI radio group. */
export type MuiRadioOption = {
	/** The string field value represented by this radio. */
	readonly value: OptionValue<string>
	/** The content shown beside the radio. */
	readonly label: ReactNode
	/** Whether the user cannot select this radio. */
	readonly disabled?: boolean
	/** Application-owned props for this MUI Radio element. */
	readonly radioProps?: Omit<
		RadioProps,
		"checked" | "disabled" | "id" | "inputRef" | "name" | "required" | "value"
	>
	/** Application-owned props for this MUI FormControlLabel element. */
	readonly labelProps?: Omit<
		FormControlLabelProps,
		| "checked"
		| "control"
		| "disabled"
		| "inputRef"
		| "label"
		| "name"
		| "required"
		| "value"
	>
}

/** Application-owned MUI RadioGroup props and optional radio options. */
export type MuiRadioProps = Omit<
	RadioGroupProps,
	"defaultValue" | "name" | "value"
>

/** Application-owned props for the MUI checkbox control. */
export type MuiCheckboxProps = Omit<
	CheckboxProps,
	| "checked"
	| "defaultChecked"
	| "disabled"
	| "id"
	| "inputRef"
	| "name"
	| "readOnly"
	| "required"
	| "value"
>

/** Application-owned props for the MUI switch control. */
export type MuiSwitchProps = Omit<
	SwitchProps,
	| "checked"
	| "defaultChecked"
	| "disabled"
	| "id"
	| "inputRef"
	| "name"
	| "readOnly"
	| "required"
	| "value"
>

/** Autocomplete props controlled by Form Please or the selected control. */
type AutocompleteOwnedProps =
	| "defaultValue"
	| "disabled"
	| "id"
	| "multiple"
	| "readOnly"
	| "renderInput"
	| "value"

/** Application-owned TextField props used inside a MUI autocomplete control. */
export type MuiAutocompleteTextFieldProps = DistributiveOmit<
	TextFieldProps,
	TextFieldOwnedProps | "onBlur"
>

/** Application-owned props for the MUI single-value autocomplete control. */
export type MuiAutocompleteProps = Omit<
	AutocompleteProps<string, false, boolean, boolean>,
	AutocompleteOwnedProps | "options"
> & {
	/** Props for the TextField rendered by the autocomplete. */
	readonly textFieldProps?: MuiAutocompleteTextFieldProps
}

/** Application-owned props for the MUI multi-value autocomplete control. */
export type MuiAutocompleteMultipleProps = Omit<
	AutocompleteProps<string, true, boolean, boolean>,
	AutocompleteOwnedProps | "options"
> & {
	/** Props for the TextField rendered by the autocomplete. */
	readonly textFieldProps?: MuiAutocompleteTextFieldProps
}

/** Slider props controlled by Form Please or the selected control. */
type SliderOwnedProps =
	| "defaultValue"
	| "disabled"
	| "id"
	| "name"
	| "readOnly"
	| "value"

/** Application-owned props for the MUI scalar slider control. */
export type MuiSliderProps = Omit<
	SliderProps<"span", NoAdditionalProps, number>,
	SliderOwnedProps
>

/** Application-owned props for the MUI range slider control. */
export type MuiRangeSliderProps = Omit<
	SliderProps<"span", NoAdditionalProps, readonly number[]>,
	SliderOwnedProps
>

/** Native file input props used to define the file option boundary. */
type FileInputProps = ComponentPropsWithoutRef<"input">

/** Presentation and native input props for MUI file controls. */
export type MuiFileProps = {
	/** MUI system styles applied to the file control wrapper. */
	readonly sx?: SxProps<Theme>
	/** Application-owned props for the file-selection button. */
	readonly buttonProps?: Omit<
		ButtonProps<"label">,
		"component" | "disabled" | "role" | "tabIndex" | "type"
	>
	/** Application-owned props for the hidden native file input. */
	readonly inputProps?: Omit<
		FileInputProps,
		| "defaultValue"
		| "disabled"
		| "id"
		| "multiple"
		| "name"
		| "readOnly"
		| "ref"
		| "required"
		| "type"
		| "value"
	>
}

/** MUI system styles for a field slot. */
export type MuiFieldSlotOptions = {
	/** Styles applied to the MUI FormControl root. */
	readonly sx?: SxProps<Theme>
}

/** MUI system styles for a section slot and its child grid. */
export type MuiSectionSlotOptions = {
	/** Styles applied to the section root. */
	readonly sx?: SxProps<Theme>
	/** Styles applied to the section grid. */
	readonly layoutSx?: SxProps<Theme>
}

/** MUI system styles for an array slot and its item list. */
export type MuiArraySlotOptions = {
	/** Styles applied to the array root. */
	readonly sx?: SxProps<Theme>
	/** Styles applied to the array item list. */
	readonly itemsSx?: SxProps<Theme>
}

/** User-facing messages used by MUI controls and slots. */
export type MuiFormKitI18n = {
	/** Labels the button that appends an array item. */
	readonly addItem: string
	/** Labels removal of the item at a one-based position. */
	readonly removeItem: (position: number) => string
	/** Labels an upward move for the item at a one-based position. */
	readonly moveItemUp: (position: number) => string
	/** Labels a downward move for the item at a one-based position. */
	readonly moveItemDown: (position: number) => string
	/** Labels the file-selection button. */
	readonly chooseFile: string
}

/** Optional localization overrides for `createMuiFormKit`. */
export type CreateMuiFormKitOptions = {
	/** Overrides one or more default English messages. */
	readonly i18n?: Partial<MuiFormKitI18n>
}
