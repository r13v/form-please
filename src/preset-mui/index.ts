"use client"

import { createFormKit } from "../create-form-kit.js"
import { createMuiControls } from "./controls.js"
import { createMuiSlots } from "./slots.js"
import type { CreateMuiFormKitOptions } from "./types.js"

/** The 12-column grid scale of the MUI preset, for kits built from its parts. */
export const muiGrid = /* @__PURE__ */ Object.freeze([
	1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const)

/**
 * Creates a ready-to-use form kit with Material UI controls and slots.
 *
 * @see https://r13v.github.io/form-please/examples/mui-yup
 */
export function createMuiFormKit(options?: CreateMuiFormKitOptions) {
	return createFormKit({
		controls: createMuiControls(options),
		grid: muiGrid,
		slots: createMuiSlots(options),
	})
}

export { createMuiControls } from "./controls.js"
export { createMuiSlots } from "./slots.js"
export type {
	CreateMuiFormKitOptions,
	MuiArraySlotOptions,
	MuiAutocompleteMultipleProps,
	MuiAutocompleteProps,
	MuiAutocompleteTextFieldProps,
	MuiCheckboxProps,
	MuiFieldSlotOptions,
	MuiFileProps,
	MuiFormKitI18n,
	MuiRadioOption,
	MuiRadioProps,
	MuiRangeSliderProps,
	MuiSectionSlotOptions,
	MuiSelectMultipleProps,
	MuiSelectOption,
	MuiSelectProps,
	MuiSliderProps,
	MuiSwitchProps,
	MuiTextFieldProps,
} from "./types.js"
