"use client"

import { createFormKit } from "../create-form-kit.js"
import { createMuiControls } from "./controls.js"
import { createMuiSlots } from "./slots.js"
import type { CreateMuiFormKitOptions, MuiFormKitI18n } from "./types.js"

/** English messages used when no MUI preset translations are supplied. */
const defaultI18n = /* @__PURE__ */ Object.freeze({
	addItem: "Add item",
	removeItem: (position) => `Remove item ${position}`,
	moveItemUp: (position) => `Move item ${position} up`,
	moveItemDown: (position) => `Move item ${position} down`,
	chooseFile: "Choose file",
} satisfies MuiFormKitI18n)

/** The 12-column scale supported by the MUI preset. */
const muiGrid = /* @__PURE__ */ Object.freeze([
	1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
] as const)

/**
 * Creates a ready-to-use form kit with Material UI controls and slots.
 *
 * @see https://r13v.github.io/form-please/examples/mui-yup
 */
export function createMuiFormKit(options?: CreateMuiFormKitOptions) {
	const i18n = Object.freeze({
		addItem: options?.i18n?.addItem ?? defaultI18n.addItem,
		removeItem: options?.i18n?.removeItem ?? defaultI18n.removeItem,
		moveItemUp: options?.i18n?.moveItemUp ?? defaultI18n.moveItemUp,
		moveItemDown: options?.i18n?.moveItemDown ?? defaultI18n.moveItemDown,
		chooseFile: options?.i18n?.chooseFile ?? defaultI18n.chooseFile,
	})

	return createFormKit({
		controls: createMuiControls(i18n),
		grid: muiGrid,
		slots: createMuiSlots(i18n),
	})
}

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
