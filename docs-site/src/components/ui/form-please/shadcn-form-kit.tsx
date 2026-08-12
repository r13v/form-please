"use client"

import {
	type ArrayItemSlotProps,
	type ArraySlotProps,
	type ControlProps,
	createFormKit,
	defineControl,
	type ErrorMessageSlotProps,
	type FieldSlotProps,
	type FormKitSlots,
	type OptionValue,
	type SectionSlotProps,
	type SubmitSlotProps,
} from "form-please"
import type {
	NativeDateProps,
	NativeFileProps,
	NativeNumberProps,
	NativeSelectOption as NativeSelectItem,
	NativeSelectProps,
	NativeTextareaProps,
	NativeTextProps,
	NativeTimeProps,
} from "form-please/native-controls"
import {
	ArrowDownIcon,
	ArrowUpIcon,
	CalendarIcon,
	PlusIcon,
	Trash2Icon,
} from "lucide-react"
import {
	type ChangeEvent,
	Fragment,
	type ReactElement,
	useEffect,
	useRef,
	useState,
} from "react"

import { Button } from "../button"
import { Calendar } from "../calendar"
import { Checkbox } from "../checkbox"
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from "../combobox"
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "../field"
import { Input } from "../input"
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSeparator,
	InputOTPSlot,
} from "../input-otp"
import { NativeSelect, NativeSelectOption } from "../native-select"
import { Popover, PopoverContent, PopoverTrigger } from "../popover"
import { RadioGroup, RadioGroupItem } from "../radio-group"
import { Slider } from "../slider"
import { Switch } from "../switch"
import { Textarea } from "../textarea"

type ShadcnOption = {
	readonly value: OptionValue<string>
	readonly label: string
	readonly description?: string
	readonly disabled?: boolean
}

type ShadcnRadioProps = {
	readonly orientation?: "horizontal" | "vertical"
}

type ShadcnSwitchProps = {
	readonly size?: "default" | "sm"
}

type ShadcnSliderProps = {
	readonly min?: number
	readonly max?: number
	readonly step?: number
	readonly largeStep?: number
	readonly minStepsBetweenValues?: number
	readonly orientation?: "horizontal" | "vertical"
	readonly locale?: Intl.LocalesArgument
	readonly format?: Intl.NumberFormatOptions
	readonly thumbCollisionBehavior?: "none" | "push" | "swap"
}

type ShadcnComboboxProps = {
	readonly placeholder?: string
	readonly emptyText?: string
	readonly autoComplete?: string
	readonly autoHighlight?: boolean
	readonly showClear?: boolean
}

type ShadcnDatePreset = {
	readonly value: string
	readonly label: string
}

type ShadcnDatePickerProps = {
	readonly placeholder?: string
	readonly min?: string
	readonly max?: string
	readonly captionLayout?:
		| "dropdown"
		| "dropdown-months"
		| "dropdown-years"
		| "label"
	readonly presets?: readonly ShadcnDatePreset[]
}

type ShadcnDateRange = {
	readonly from?: string
	readonly to?: string
}

type ShadcnDateRangePickerProps = Omit<ShadcnDatePickerProps, "presets"> & {
	readonly numberOfMonths?: number
}

type ShadcnInputOtpProps = {
	readonly maxLength: number
	readonly pattern?: string
	readonly groups?: readonly number[]
	readonly separator?: boolean
	readonly autoComplete?: string
}

function ShadcnTextControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeTextProps>): ReactElement {
	return (
		<Input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			autoComplete={controlProps.autoComplete}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value)}
			placeholder={controlProps.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			type={controlProps.type ?? "text"}
			value={value ?? ""}
		/>
	)
}

function ShadcnTextareaControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeTextareaProps>): ReactElement {
	return (
		<Textarea
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			autoComplete={controlProps.autoComplete}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value)}
			placeholder={controlProps.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			rows={controlProps.rows}
			value={value ?? ""}
		/>
	)
}

function ShadcnNumberControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<number | undefined, NativeNumberProps>): ReactElement {
	function handleChange(event: ChangeEvent<HTMLInputElement>): void {
		if (event.currentTarget.value === "") {
			setValue(undefined)
			return
		}

		const nextValue = event.currentTarget.valueAsNumber
		if (!Number.isNaN(nextValue)) setValue(nextValue)
	}

	return (
		<Input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			max={controlProps.max}
			min={controlProps.min}
			name={input.name}
			onBlur={blur}
			onChange={handleChange}
			placeholder={controlProps.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			step={controlProps.step}
			type="number"
			value={value === undefined ? "" : String(value)}
		/>
	)
}

function ShadcnDateControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeDateProps>): ReactElement {
	return (
		<Input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			max={controlProps.max}
			min={controlProps.min}
			name={input.name}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value || undefined)}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			type="date"
			value={value ?? ""}
		/>
	)
}

function ShadcnTimeControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, NativeTimeProps>): ReactElement {
	return (
		<Input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			max={controlProps.max}
			min={controlProps.min}
			name={input.name}
			onBlur={blur}
			onChange={(event) => setValue(event.currentTarget.value || undefined)}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			step={controlProps.step}
			type="time"
			value={value ?? ""}
		/>
	)
}

function ShadcnSelectControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<
	string | undefined,
	NativeSelectProps,
	unknown,
	NativeSelectItem
>): ReactElement {
	validateSelectOptions(value, controlProps, options)

	return (
		<NativeSelect
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-readonly={readOnly || undefined}
			className="w-full"
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
					nextValue === "" && controlProps.emptyOption !== undefined
						? undefined
						: nextValue,
				)
			}}
			onKeyDown={(event) => {
				if (readOnly && isSelectMutationKey(event.key)) preventReadOnly(event)
			}}
			onMouseDown={(event) => {
				if (readOnly) preventReadOnly(event)
			}}
			ref={input.ref}
			required={required}
			value={value ?? ""}
		>
			{controlProps.emptyOption === undefined ? null : (
				<NativeSelectOption
					disabled={controlProps.emptyOption.disabled}
					value=""
				>
					{controlProps.emptyOption.label}
				</NativeSelectOption>
			)}
			{options.map((option) => (
				<NativeSelectOption
					disabled={option.disabled}
					key={option.value}
					value={option.value}
				>
					{option.label}
				</NativeSelectOption>
			))}
		</NativeSelect>
	)
}

function ShadcnCheckboxControl({
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
		<Checkbox
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-readonly={readOnly || undefined}
			checked={value}
			className="!size-4 self-start"
			disabled={disabled}
			id={input.id}
			inputRef={input.ref}
			name={input.name}
			onBlur={blur}
			onCheckedChange={(checked) => setValue(checked)}
			readOnly={readOnly}
			required={required}
			value="true"
		/>
	)
}

function ShadcnFileControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<File | undefined, NativeFileProps>): ReactElement {
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const [nativeFile, setNativeFile] = useState<File | undefined>()
	const hasSubmittableNativeFile =
		nativeFile !== undefined && Object.is(value, nativeFile)

	useEffect(() => {
		if (hasSubmittableNativeFile || fileInputRef.current === null) return

		fileInputRef.current.value = ""
		if (nativeFile !== undefined) setNativeFile(undefined)
	}, [hasSubmittableNativeFile, nativeFile])

	return (
		<Input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-readonly={readOnly || undefined}
			accept={controlProps.accept}
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
				if (readOnly) preventReadOnly(event)
			}}
			onDrop={(event) => {
				if (readOnly) preventReadOnly(event)
			}}
			onKeyDown={(event) => {
				if (readOnly && isActivationKey(event.key)) preventReadOnly(event)
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

function ShadcnRadioControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<
	string | undefined,
	ShadcnRadioProps,
	unknown,
	ShadcnOption
>): ReactElement {
	validateOptions("radio", options)

	return (
		<RadioGroup
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-labelledby={`${input.id}-label`}
			className={
				controlProps.orientation === "horizontal"
					? "flex flex-wrap gap-4"
					: undefined
			}
			disabled={disabled}
			inputRef={input.ref}
			name={input.name}
			onBlur={blur}
			onValueChange={(nextValue) => setValue(nextValue)}
			readOnly={readOnly}
			required={required}
			value={value ?? null}
		>
			{options.map((option, index) => {
				const optionId = `${input.id}-${index}`
				return (
					<label
						className="flex items-start gap-2 text-sm"
						htmlFor={optionId}
						key={option.value}
					>
						<RadioGroupItem
							aria-invalid={meta.invalid || undefined}
							disabled={option.disabled}
							id={optionId}
							value={option.value}
						/>
						<span className="grid gap-0.5">
							<span>{option.label}</span>
							{option.description === undefined ? null : (
								<span className="text-muted-foreground">
									{option.description}
								</span>
							)}
						</span>
					</label>
				)
			})}
		</RadioGroup>
	)
}

function ShadcnSwitchControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<boolean, ShadcnSwitchProps>): ReactElement {
	return (
		<Switch
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-readonly={readOnly || undefined}
			checked={value}
			disabled={disabled}
			id={input.id}
			inputRef={input.ref}
			name={input.name}
			onBlur={blur}
			onCheckedChange={(checked) => setValue(checked)}
			readOnly={readOnly}
			required={required}
			size={controlProps.size}
			uncheckedValue="false"
			value="true"
		/>
	)
}

function ShadcnSliderControl(
	props: ControlProps<number, ShadcnSliderProps>,
): ReactElement {
	// The generated shadcn wrapper uses an array default to decide how many
	// thumbs to render, while Base UI needs a scalar value for pointer updates.
	return renderSlider(props, props.value, [props.value], (value) => {
		if (typeof value === "number") props.setValue(value)
	})
}

function ShadcnRangeSliderControl(
	props: ControlProps<readonly [number, number], ShadcnSliderProps>,
): ReactElement {
	return renderSlider(props, props.value, undefined, (values) => {
		if (!Array.isArray(values)) return
		const from = values[0]
		const to = values[1]
		if (from !== undefined && to !== undefined) props.setValue([from, to])
	})
}

function ShadcnMultiSliderControl(
	props: ControlProps<readonly number[], ShadcnSliderProps>,
): ReactElement {
	return renderSlider(props, props.value, undefined, (values) => {
		if (Array.isArray(values)) props.setValue(values)
	})
}

function renderSlider<Value>(
	props: ControlProps<Value, ShadcnSliderProps>,
	value: number | readonly number[],
	defaultValue: readonly number[] | undefined,
	setValue: (value: number | readonly number[]) => void,
): ReactElement {
	const {
		blur,
		disabled,
		input,
		meta,
		props: controlProps,
		readOnly,
		required,
	} = props

	return (
		<Slider
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			aria-labelledby={`${input.id}-label`}
			aria-readonly={readOnly || undefined}
			aria-required={required || undefined}
			disabled={disabled}
			defaultValue={defaultValue}
			format={controlProps.format}
			largeStep={controlProps.largeStep}
			locale={controlProps.locale}
			max={controlProps.max}
			min={controlProps.min}
			minStepsBetweenValues={controlProps.minStepsBetweenValues}
			onBlurCapture={blur}
			onKeyDownCapture={(event) => {
				if (readOnly && isSliderMutationKey(event.key)) preventReadOnly(event)
			}}
			onPointerDownCapture={(event) => {
				if (readOnly) preventReadOnly(event)
			}}
			onValueChange={(nextValue) => {
				if (!readOnly) setValue(nextValue)
			}}
			orientation={controlProps.orientation}
			ref={(element) => {
				input.ref(element?.querySelector("input[type=range]") ?? null)
			}}
			step={controlProps.step}
			thumbCollisionBehavior={controlProps.thumbCollisionBehavior}
			value={Array.isArray(value) ? [...value] : value}
		/>
	)
}

function ShadcnComboboxControl(
	props: ControlProps<
		string | undefined,
		ShadcnComboboxProps,
		unknown,
		ShadcnOption
	>,
): ReactElement {
	const {
		value,
		setValue,
		blur,
		input,
		meta,
		props: controlProps,
		options,
		disabled,
		readOnly,
		required,
	} = props
	validateOptions("combobox", options)
	const values = options.map((option) => option.value)
	const labels = new Map(options.map((option) => [option.value, option.label]))

	return (
		<Combobox
			autoComplete={controlProps.autoComplete}
			autoHighlight={controlProps.autoHighlight}
			disabled={disabled}
			itemToStringLabel={(itemValue) => labels.get(itemValue) ?? itemValue}
			items={values}
			onValueChange={(nextValue) => setValue(nextValue ?? undefined)}
			readOnly={readOnly}
			required={required}
			value={value ?? null}
		>
			<ComboboxInput
				aria-describedby={input["aria-describedby"]}
				aria-invalid={meta.invalid || undefined}
				id={input.id}
				onBlur={blur}
				placeholder={controlProps.placeholder}
				ref={input.ref}
				showClear={controlProps.showClear}
			/>
			<ComboboxContent>
				<ComboboxEmpty>
					{controlProps.emptyText ?? "No options found."}
				</ComboboxEmpty>
				<ComboboxList>
					{options.map((option) => (
						<ComboboxItem
							disabled={option.disabled}
							key={option.value}
							value={option.value}
						>
							{option.label}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
}

function ShadcnMultiComboboxControl(
	props: ControlProps<
		readonly string[],
		ShadcnComboboxProps,
		unknown,
		ShadcnOption
	>,
): ReactElement {
	const {
		value,
		setValue,
		blur,
		input,
		meta,
		props: controlProps,
		options,
		disabled,
		readOnly,
		required,
	} = props
	validateOptions("multiCombobox", options)
	const anchor = useComboboxAnchor()
	const values = options.map((option) => option.value)
	const labels = new Map(options.map((option) => [option.value, option.label]))

	return (
		<Combobox
			autoComplete={controlProps.autoComplete}
			autoHighlight={controlProps.autoHighlight}
			disabled={disabled}
			itemToStringLabel={(itemValue) => labels.get(itemValue) ?? itemValue}
			items={values}
			multiple
			onValueChange={setValue}
			readOnly={readOnly}
			required={required}
			value={[...value]}
		>
			<ComboboxChips ref={anchor}>
				<ComboboxValue>
					{(selectedValues: string[]) => (
						<>
							{selectedValues.map((selectedValue) => (
								<ComboboxChip key={selectedValue}>
									{labels.get(selectedValue) ?? selectedValue}
								</ComboboxChip>
							))}
							<ComboboxChipsInput
								aria-describedby={input["aria-describedby"]}
								aria-invalid={meta.invalid || undefined}
								id={input.id}
								onBlur={blur}
								placeholder={controlProps.placeholder}
								ref={input.ref}
							/>
						</>
					)}
				</ComboboxValue>
			</ComboboxChips>
			<ComboboxContent anchor={anchor}>
				<ComboboxEmpty>
					{controlProps.emptyText ?? "No options found."}
				</ComboboxEmpty>
				<ComboboxList>
					{options.map((option) => (
						<ComboboxItem
							disabled={option.disabled}
							key={option.value}
							value={option.value}
						>
							{option.label}
						</ComboboxItem>
					))}
				</ComboboxList>
			</ComboboxContent>
		</Combobox>
	)
}

function ShadcnDatePickerControl(
	props: ControlProps<string | undefined, ShadcnDatePickerProps>,
): ReactElement {
	const {
		value,
		setValue,
		blur,
		input,
		meta,
		props: controlProps,
		disabled,
		readOnly,
		required,
	} = props
	const selected = parseIsoDate(value)

	return (
		<Popover open={readOnly ? false : undefined}>
			<PopoverTrigger
				render={
					<Button
						aria-describedby={input["aria-describedby"]}
						aria-invalid={meta.invalid || undefined}
						aria-readonly={readOnly || undefined}
						aria-required={required || undefined}
						className="w-full justify-start"
						disabled={disabled}
						id={input.id}
						onBlur={blur}
						ref={input.ref}
						type="button"
						variant="outline"
					/>
				}
			>
				<CalendarIcon />
				{selected === undefined
					? (controlProps.placeholder ?? "Pick a date")
					: formatDisplayDate(selected)}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto">
				<Calendar
					captionLayout={controlProps.captionLayout}
					disabled={dateMatchers(controlProps.min, controlProps.max)}
					mode="single"
					onSelect={(date) => setValue(toIsoDate(date))}
					selected={selected}
				/>
				<DatePresetButtons
					disabled={disabled || readOnly}
					onSelect={setValue}
					presets={controlProps.presets}
				/>
			</PopoverContent>
		</Popover>
	)
}

function ShadcnDateRangePickerControl(
	props: ControlProps<ShadcnDateRange, ShadcnDateRangePickerProps>,
): ReactElement {
	const {
		value,
		setValue,
		blur,
		input,
		meta,
		props: controlProps,
		disabled,
		readOnly,
		required,
	} = props
	const selected = {
		from: parseIsoDate(value.from),
		to: parseIsoDate(value.to),
	}

	return (
		<Popover open={readOnly ? false : undefined}>
			<PopoverTrigger
				render={
					<Button
						aria-describedby={input["aria-describedby"]}
						aria-invalid={meta.invalid || undefined}
						aria-readonly={readOnly || undefined}
						aria-required={required || undefined}
						className="w-full justify-start"
						disabled={disabled}
						id={input.id}
						onBlur={blur}
						ref={input.ref}
						type="button"
						variant="outline"
					/>
				}
			>
				<CalendarIcon />
				{formatDisplayRange(selected, controlProps.placeholder)}
			</PopoverTrigger>
			<PopoverContent align="start" className="w-auto">
				<Calendar
					captionLayout={controlProps.captionLayout}
					disabled={dateMatchers(controlProps.min, controlProps.max)}
					mode="range"
					numberOfMonths={controlProps.numberOfMonths ?? 2}
					onSelect={(range) =>
						setValue({
							from: toIsoDate(range?.from),
							to: toIsoDate(range?.to),
						})
					}
					selected={selected}
				/>
			</PopoverContent>
		</Popover>
	)
}

function DatePresetButtons({
	presets,
	disabled,
	onSelect,
}: {
	readonly presets?: readonly ShadcnDatePreset[]
	readonly disabled: boolean
	onSelect(value: string): void
}): ReactElement | null {
	if (presets === undefined || presets.length === 0) return null

	return (
		<div className="flex flex-wrap gap-2 border-t pt-2">
			{presets.map((preset) => (
				<Button
					disabled={disabled}
					key={preset.value}
					onClick={() => onSelect(preset.value)}
					size="sm"
					type="button"
					variant="ghost"
				>
					{preset.label}
				</Button>
			))}
		</div>
	)
}

function ShadcnInputOtpControl({
	value,
	setValue,
	blur,
	input,
	meta,
	props: controlProps,
	disabled,
	readOnly,
	required,
}: ControlProps<string, ShadcnInputOtpProps>): ReactElement {
	const groups = resolveOtpGroups(controlProps)
	let slotIndex = 0

	return (
		<InputOTP
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			autoComplete={controlProps.autoComplete}
			disabled={disabled}
			id={input.id}
			maxLength={controlProps.maxLength}
			name={input.name}
			onBlur={blur}
			onChange={setValue}
			pattern={controlProps.pattern}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			value={value}
		>
			{groups.map((groupLength, groupIndex) => {
				const groupStart = slotIndex
				const slots = Array.from({ length: groupLength }, () => slotIndex++)
				return (
					<Fragment key={`${groupStart}:${groupLength}`}>
						{groupIndex === 0 || controlProps.separator === false ? null : (
							<InputOTPSeparator />
						)}
						<InputOTPGroup>
							{slots.map((index) => (
								<InputOTPSlot
									aria-invalid={meta.invalid || undefined}
									index={index}
									key={index}
								/>
							))}
						</InputOTPGroup>
					</Fragment>
				)
			})}
		</InputOTP>
	)
}

const controls = Object.freeze({
	text: defineControl<string | undefined, NativeTextProps>({
		component: ShadcnTextControl,
	}),
	textarea: defineControl<string | undefined, NativeTextareaProps>({
		component: ShadcnTextareaControl,
	}),
	select: defineControl<
		string | undefined,
		NativeSelectProps,
		unknown,
		NativeSelectItem
	>({
		component: ShadcnSelectControl,
	}),
	checkbox: defineControl<boolean>({
		component: ShadcnCheckboxControl,
	}),
	number: defineControl<number | undefined, NativeNumberProps>({
		component: ShadcnNumberControl,
	}),
	date: defineControl<string | undefined, NativeDateProps>({
		component: ShadcnDateControl,
	}),
	time: defineControl<string | undefined, NativeTimeProps>({
		component: ShadcnTimeControl,
	}),
	file: defineControl<File | undefined, NativeFileProps>({
		component: ShadcnFileControl,
	}),
	radio: defineControl<
		string | undefined,
		ShadcnRadioProps,
		unknown,
		ShadcnOption
	>({
		component: ShadcnRadioControl,
	}),
	switch: defineControl<boolean, ShadcnSwitchProps>({
		component: ShadcnSwitchControl,
	}),
	slider: defineControl<number, ShadcnSliderProps>({
		component: ShadcnSliderControl,
	}),
	rangeSlider: defineControl<readonly [number, number], ShadcnSliderProps>({
		component: ShadcnRangeSliderControl,
	}),
	multiSlider: defineControl<readonly number[], ShadcnSliderProps>({
		component: ShadcnMultiSliderControl,
	}),
	combobox: defineControl<
		string | undefined,
		ShadcnComboboxProps,
		unknown,
		ShadcnOption
	>({
		component: ShadcnComboboxControl,
	}),
	multiCombobox: defineControl<
		readonly string[],
		ShadcnComboboxProps,
		unknown,
		ShadcnOption
	>({
		component: ShadcnMultiComboboxControl,
	}),
	datePicker: defineControl<string | undefined, ShadcnDatePickerProps>({
		component: ShadcnDatePickerControl,
	}),
	dateRangePicker: defineControl<ShadcnDateRange, ShadcnDateRangePickerProps>({
		component: ShadcnDateRangePickerControl,
	}),
	inputOtp: defineControl<string, ShadcnInputOtpProps>({
		component: ShadcnInputOtpControl,
	}),
})

const slots = Object.freeze({
	Field: ShadcnFieldSlot,
	Section: ShadcnSectionSlot,
	Array: ShadcnArraySlot,
	ArrayItem: ShadcnArrayItemSlot,
	ErrorMessage: ShadcnErrorMessageSlot,
	Submit: ShadcnSubmitSlot,
}) satisfies FormKitSlots

export const shadcnFormKit = createFormKit({ controls, slots })

function ShadcnFieldSlot({
	rootProps,
	label,
	labelProps,
	description,
	descriptionProps,
	control,
	errors,
	disabled,
	readOnly,
	required,
}: FieldSlotProps): ReactElement {
	return (
		<Field
			{...rootProps}
			className={joinClassNames("gap-2", rootProps.className)}
			data-disabled={disabled ? "true" : undefined}
			data-invalid={
				rootProps["aria-invalid"] === true ||
				rootProps["aria-invalid"] === "true"
					? "true"
					: undefined
			}
			data-readonly={readOnly ? "true" : undefined}
			data-required={required ? "true" : undefined}
		>
			{label === undefined ? null : (
				<FieldLabel
					{...labelProps}
					id={
						labelProps.htmlFor === undefined
							? undefined
							: `${labelProps.htmlFor}-label`
					}
				>
					{label}
				</FieldLabel>
			)}
			{description === undefined ? null : (
				<FieldDescription {...descriptionProps}>{description}</FieldDescription>
			)}
			{control}
			{errors}
		</Field>
	)
}

function ShadcnSectionSlot({
	rootProps,
	layoutProps,
	title,
	description,
	children,
}: SectionSlotProps): ReactElement {
	return (
		<section
			{...rootProps}
			className={joinClassNames(
				"grid gap-4 rounded-xl border bg-background p-4",
				rootProps.className,
			)}
		>
			{title === undefined ? null : (
				<h2 className="text-base font-medium">{title}</h2>
			)}
			{description === undefined ? null : (
				<FieldDescription>{description}</FieldDescription>
			)}
			<FieldGroup
				{...layoutProps}
				className={joinClassNames(
					"grid grid-cols-1 gap-4 md:data-[fp-columns=2]:grid-cols-2 md:data-[fp-columns=3]:grid-cols-3 md:data-[fp-columns=4]:grid-cols-4",
					layoutProps.className,
				)}
			>
				{children}
			</FieldGroup>
		</section>
	)
}

function ShadcnArraySlot({
	rootProps,
	label,
	labelProps,
	description,
	descriptionProps,
	errors,
	invalid,
	canAdd,
	add,
	children,
}: ArraySlotProps): ReactElement {
	return (
		<FieldSet
			{...rootProps}
			className={joinClassNames(
				"rounded-xl border bg-background p-4",
				rootProps.className,
			)}
			data-invalid={invalid ? "true" : undefined}
		>
			{label === undefined ? null : (
				<FieldLegend {...labelProps}>{label}</FieldLegend>
			)}
			{description === undefined ? null : (
				<FieldDescription {...descriptionProps}>{description}</FieldDescription>
			)}
			{errors}
			<FieldGroup>{children}</FieldGroup>
			<Button
				className="w-fit"
				data-fp-array-action="add"
				disabled={!canAdd}
				onClick={add}
				type="button"
				variant="outline"
			>
				<PlusIcon /> Add item
			</Button>
		</FieldSet>
	)
}

function ShadcnArrayItemSlot({
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
	return (
		<div
			{...rootProps}
			className={joinClassNames(
				"grid gap-4 rounded-lg border bg-muted/30 p-3",
				rootProps.className,
			)}
		>
			{children}
			<fieldset
				aria-label={`Item ${position}`}
				className="flex items-center gap-2"
				data-fp-array-item-actions=""
			>
				<span className="mr-auto text-sm text-muted-foreground">
					#{position}
				</span>
				<Button
					aria-label={`Move item ${position} up`}
					data-fp-array-action="move-up"
					disabled={disabled || readOnly || !canMoveUp}
					onClick={() => move(index - 1)}
					size="icon-sm"
					title={`Move item ${position} up`}
					type="button"
					variant="ghost"
				>
					<ArrowUpIcon />
				</Button>
				<Button
					aria-label={`Move item ${position} down`}
					data-fp-array-action="move-down"
					disabled={disabled || readOnly || !canMoveDown}
					onClick={() => move(index + 1)}
					size="icon-sm"
					title={`Move item ${position} down`}
					type="button"
					variant="ghost"
				>
					<ArrowDownIcon />
				</Button>
				<Button
					aria-label={`Remove item ${position}`}
					data-fp-array-action="remove"
					disabled={disabled || readOnly}
					onClick={remove}
					size="icon-sm"
					title={`Remove item ${position}`}
					type="button"
					variant="ghost"
				>
					<Trash2Icon />
				</Button>
			</fieldset>
		</div>
	)
}

function ShadcnErrorMessageSlot({
	rootProps,
	issue,
}: ErrorMessageSlotProps): ReactElement {
	return (
		<FieldError {...rootProps} className={rootProps.className}>
			{issue.message}
		</FieldError>
	)
}

function ShadcnSubmitSlot({ buttonProps }: SubmitSlotProps): ReactElement {
	return <Button {...buttonProps} />
}

function validateSelectOptions(
	value: string | undefined,
	controlProps: NativeSelectProps,
	options: readonly NativeSelectItem[],
): void {
	if (!Array.isArray(options)) {
		throw new TypeError("shadcnFormKit select requires options")
	}
	if (
		controlProps.emptyOption !== undefined &&
		options.some((option) => option.value === "")
	) {
		throw new TypeError(
			'shadcnFormKit select cannot combine props.emptyOption with an option whose value is ""',
		)
	}
	if (value === undefined && controlProps.emptyOption === undefined) {
		throw new TypeError(
			"shadcnFormKit select requires props.emptyOption to represent undefined",
		)
	}
}

function validateOptions(
	control: string,
	options: readonly ShadcnOption[],
): void {
	if (!Array.isArray(options)) {
		throw new TypeError(`shadcnFormKit ${control} requires options`)
	}
	const values = new Set<string>()
	for (const option of options) {
		if (values.has(option.value)) {
			throw new TypeError(
				`shadcnFormKit ${control} requires unique option values`,
			)
		}
		values.add(option.value)
	}
}

function resolveOtpGroups(
	controlProps: ShadcnInputOtpProps,
): readonly number[] {
	if (!Number.isInteger(controlProps.maxLength) || controlProps.maxLength < 1) {
		throw new TypeError("shadcnFormKit inputOtp requires a positive maxLength")
	}
	const groups = controlProps.groups ?? [controlProps.maxLength]
	if (
		groups.length === 0 ||
		groups.some((group) => !Number.isInteger(group) || group < 1) ||
		groups.reduce((total, group) => total + group, 0) !== controlProps.maxLength
	) {
		throw new TypeError(
			"shadcnFormKit inputOtp groups must be positive integers that sum to maxLength",
		)
	}
	return groups
}

function parseIsoDate(value: string | undefined): Date | undefined {
	if (value === undefined) return undefined
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
	if (match === null) return undefined
	const year = Number(match[1])
	const month = Number(match[2])
	const day = Number(match[3])
	const date = new Date(year, month - 1, day)
	return date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
		? date
		: undefined
}

function toIsoDate(date: Date | undefined): string | undefined {
	if (date === undefined) return undefined
	const year = String(date.getFullYear()).padStart(4, "0")
	const month = String(date.getMonth() + 1).padStart(2, "0")
	const day = String(date.getDate()).padStart(2, "0")
	return `${year}-${month}-${day}`
}

function formatDisplayDate(date: Date): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
		date,
	)
}

function formatDisplayRange(
	value: { readonly from?: Date; readonly to?: Date },
	placeholder: string | undefined,
): string {
	if (value.from === undefined) return placeholder ?? "Pick a date range"
	if (value.to === undefined) return `${formatDisplayDate(value.from)} – …`
	return `${formatDisplayDate(value.from)} – ${formatDisplayDate(value.to)}`
}

function dateMatchers(min: string | undefined, max: string | undefined) {
	const before = parseIsoDate(min)
	const after = parseIsoDate(max)
	return [
		...(before === undefined ? [] : [{ before }]),
		...(after === undefined ? [] : [{ after }]),
	]
}

function joinClassNames(
	...classNames: readonly (string | undefined)[]
): string | undefined {
	const value = classNames.filter(Boolean).join(" ")
	return value || undefined
}

function preventReadOnly(event: {
	preventDefault(): void
	stopPropagation(): void
}): void {
	event.preventDefault()
	event.stopPropagation()
}

function isActivationKey(key: string): boolean {
	return key === " " || key === "Enter"
}

function isSelectMutationKey(key: string): boolean {
	return (
		isActivationKey(key) ||
		key === "ArrowDown" ||
		key === "ArrowUp" ||
		key === "End" ||
		key === "Home" ||
		key === "PageDown" ||
		key === "PageUp"
	)
}

function isSliderMutationKey(key: string): boolean {
	return (
		key === "ArrowDown" ||
		key === "ArrowLeft" ||
		key === "ArrowRight" ||
		key === "ArrowUp" ||
		key === "End" ||
		key === "Home" ||
		key === "PageDown" ||
		key === "PageUp"
	)
}
