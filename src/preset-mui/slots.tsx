"use client"

import type { ButtonProps, FormLabelProps, GridProps } from "@mui/material"
import {
	Box,
	Button,
	FormHelperText,
	FormLabel,
	Grid,
	Paper,
	Stack,
	Typography,
} from "@mui/material"
import type { ReactElement } from "react"

import {
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
	StructuralRootProps,
	SubmitSlotProps,
} from "../types.js"
import type {
	CreateMuiFormKitOptions,
	MuiArraySlotOptions,
	MuiFieldSlotOptions,
	MuiSectionSlotOptions,
} from "./types.js"
import { mergeSx } from "./utils.js"

/**
 * Creates the structural slots of the Material UI preset. Missing messages use
 * the English defaults.
 */
export function createMuiSlots(
	options?: CreateMuiFormKitOptions,
): FormKitSlots<
	MuiFieldSlotOptions,
	MuiSectionSlotOptions,
	MuiArraySlotOptions
> {
	const i18n = withArrayActionDefaults(options?.i18n)

	/** Renders a MUI array wrapper, item grid, and append action. */
	function MuiArraySlot({
		rootProps,
		label,
		labelProps,
		description,
		descriptionProps,
		slotOptions,
		errors,
		canAdd,
		add,
		children,
	}: ArraySlotProps<MuiArraySlotOptions>): ReactElement {
		const { color: _labelColor, ...muiLabelProps } = labelProps
		return (
			<Grid
				{...rootProps}
				{...gridItemProps(rootProps)}
				sx={mergeSx(gridItemSx(rootProps), slotOptions?.sx)}
			>
				<Stack spacing={1.5}>
					{label === undefined ? null : (
						<FormLabel
							{...(muiLabelProps as FormLabelProps<"div">)}
							component="div"
						>
							{label}
						</FormLabel>
					)}
					{description === undefined ? null : (
						<FormHelperText {...descriptionProps}>{description}</FormHelperText>
					)}
					{errors}
					<Grid container columns={1} spacing={2} sx={slotOptions?.itemsSx}>
						{children}
					</Grid>
					<Box>
						<Button
							data-fp-array-action="add"
							disabled={!canAdd}
							type="button"
							variant="outlined"
							onClick={add}
						>
							{resolveI18nMessage(i18n.arrayAdd, { label })}
						</Button>
					</Box>
				</Stack>
			</Grid>
		)
	}

	/** Renders a MUI array item card and its item actions. */
	function MuiArrayItemSlot({
		rootProps,
		index,
		disabled,
		readOnly,
		canMoveUp,
		canMoveDown,
		remove,
		move,
		children,
	}: ArrayItemSlotProps): ReactElement {
		const position = index + 1
		const actionData = { index, position }
		const moveUpLabel = resolveI18nMessage(i18n.arrayMoveUp, actionData)
		const moveDownLabel = resolveI18nMessage(i18n.arrayMoveDown, actionData)
		const removeLabel = resolveI18nMessage(i18n.arrayRemove, actionData)
		return (
			<Grid {...rootProps} size={1}>
				<Paper variant="outlined">
					<Stack spacing={1.5} sx={{ p: 2 }}>
						{children}
						<Stack
							aria-label={`#${position}`}
							data-fp-array-item-actions=""
							direction="row"
							spacing={1}
						>
							<Typography
								aria-hidden="true"
								data-fp-array-item-position=""
								sx={{ alignSelf: "center" }}
								variant="body2"
							>
								#{position}
							</Typography>
							<Button
								aria-label={moveUpLabel}
								data-fp-array-action="move-up"
								disabled={disabled || readOnly || !canMoveUp}
								size="small"
								title={moveUpLabel}
								type="button"
								onClick={() => move(index - 1)}
							>
								<span aria-hidden="true">↑</span>
							</Button>
							<Button
								aria-label={moveDownLabel}
								data-fp-array-action="move-down"
								disabled={disabled || readOnly || !canMoveDown}
								size="small"
								title={moveDownLabel}
								type="button"
								onClick={() => move(index + 1)}
							>
								<span aria-hidden="true">↓</span>
							</Button>
							<Button
								aria-label={removeLabel}
								color="error"
								data-fp-array-action="remove"
								disabled={disabled || readOnly}
								size="small"
								title={removeLabel}
								type="button"
								onClick={remove}
							>
								<span aria-hidden="true">×</span>
							</Button>
						</Stack>
					</Stack>
				</Paper>
			</Grid>
		)
	}

	return Object.freeze({
		Field: MuiFieldSlot,
		Section: MuiSectionSlot,
		Array: MuiArraySlot,
		ArrayItem: MuiArrayItemSlot,
		ErrorMessage: MuiErrorMessageSlot,
		Submit: MuiSubmitSlot,
	})
}

/** Renders a MUI field grid item with its label, control, and errors. */
function MuiFieldSlot({
	rootProps,
	label,
	labelProps,
	description,
	descriptionProps,
	slotOptions,
	control,
	errors,
	disabled,
	required,
}: FieldSlotProps<MuiFieldSlotOptions>): ReactElement {
	const invalid = errors.length > 0
	const { color: _labelColor, ...muiLabelProps } = labelProps
	return (
		<Grid
			{...rootProps}
			{...gridItemProps(rootProps)}
			sx={mergeSx(gridItemSx(rootProps), slotOptions?.sx)}
		>
			<Stack spacing={1}>
				{label === undefined ? null : (
					<FormLabel
						{...(muiLabelProps as FormLabelProps<"label">)}
						component="label"
						disabled={disabled}
						error={invalid}
						id={
							labelProps.htmlFor === undefined
								? undefined
								: `${labelProps.htmlFor}-label`
						}
						required={required}
					>
						{label}
					</FormLabel>
				)}
				{description === undefined ? null : (
					<FormHelperText {...descriptionProps}>{description}</FormHelperText>
				)}
				{control}
				{errors}
			</Stack>
		</Grid>
	)
}

/** Renders a MUI section grid item and its responsive child grid. */
function MuiSectionSlot({
	rootProps,
	layoutProps,
	title,
	description,
	slotOptions,
	children,
}: SectionSlotProps<MuiSectionSlotOptions>): ReactElement {
	const columns = Number(layoutProps["data-fp-columns"])
	return (
		<Grid
			{...rootProps}
			{...gridItemProps(rootProps)}
			component="section"
			sx={mergeSx(gridItemSx(rootProps), slotOptions?.sx)}
		>
			<Stack spacing={2}>
				{title === undefined ? null : (
					<Typography component="h2" variant="h5">
						{title}
					</Typography>
				)}
				{description === undefined ? null : (
					<Typography color="text.secondary" variant="body2">
						{description}
					</Typography>
				)}
				<Grid
					{...layoutProps}
					columns={{ xs: 1, sm: columns }}
					container
					spacing={2}
					sx={slotOptions?.layoutSx}
				>
					{children}
				</Grid>
			</Stack>
		</Grid>
	)
}

/** Renders one validation issue with MUI error styling and alert semantics. */
function MuiErrorMessageSlot({
	rootProps,
	issue,
}: ErrorMessageSlotProps): ReactElement {
	return (
		<FormHelperText {...rootProps} error role="alert">
			{issue.message}
		</FormHelperText>
	)
}

/** Renders the MUI submit button. */
function MuiSubmitSlot({ buttonProps }: SubmitSlotProps): ReactElement {
	const { children, ...props } = buttonProps
	return (
		<Button {...(props as ButtonProps)} type="submit" variant="contained">
			{children}
		</Button>
	)
}

/** Converts a structural span to responsive MUI Grid size props. */
function gridItemProps(
	rootProps: StructuralRootProps,
): Pick<GridProps, "size"> {
	const span = structuralSpan(rootProps)
	if (span === undefined || span === "full") return {}
	const numericSpan = Number(span)
	return Number.isInteger(numericSpan) && numericSpan > 0
		? { size: { xs: 1, sm: numericSpan } }
		: {}
}

/** Expands a full-span structural node across the complete MUI grid row. */
function gridItemSx(rootProps: StructuralRootProps) {
	return structuralSpan(rootProps) === "full"
		? { flexBasis: "100%", maxWidth: "100%", width: "100%" }
		: undefined
}

/** Reads a resolved span from structural data props. */
function structuralSpan(rootProps: StructuralRootProps): string | undefined {
	return (
		rootProps as StructuralRootProps & {
			/** The resolved grid span serialized for structural slots. */
			"data-fp-span"?: string
		}
	)["data-fp-span"]
}
