// @jsx: react-jsx
"use client"

import {
	autoUpdate,
	FloatingFocusManager,
	flip,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
	useListNavigation,
	useMergeRefs,
	useRole,
} from "@floating-ui/react"
import {
	CheckIcon,
	ChevronDownIcon,
	MagnifyingGlassIcon,
	XMarkIcon,
} from "@heroicons/react/20/solid"
import {
	keepPreviousData,
	QueryClient,
	QueryClientProvider,
	useQuery,
} from "@tanstack/react-query"
import {
	type ControlProps,
	createFormKit,
	defineControl,
	type FormInput,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useEffect, useMemo, useRef, useState } from "react"
import { z } from "zod"

// [!region control]
// [!region option-contract]
export type AsyncMultiSelectOption = {
	readonly value: string
	readonly label: string
	readonly disabled?: boolean
}

export type AsyncMultiSelectOptions = {
	readonly queryKey: readonly unknown[]
	readonly queryFn: (
		search: string,
		signal: AbortSignal,
	) => Promise<readonly AsyncMultiSelectOption[]>
	readonly initialOptions?: readonly AsyncMultiSelectOption[]
	readonly debounceMs?: number
	readonly staleTime?: number
	readonly maxVisibleTags?: number
	readonly placeholder?: string
	readonly searchPlaceholder?: string
	readonly emptyMessage?: string
	readonly dialogLabel?: string
}
// [!endregion option-contract]

const emptyOptions: readonly AsyncMultiSelectOption[] = []

function AsyncMultiSelectControl({
	value,
	setValue,
	blur,
	input,
	meta,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<string[], AsyncMultiSelectOptions>) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState("")
	const [activeIndex, setActiveIndex] = useState<number | null>(null)
	const debouncedSearch = useDebouncedValue(search, options.debounceMs ?? 250)
	const searchRef = useRef<HTMLInputElement>(null)
	const listRef = useRef<Array<HTMLElement | null>>([])
	// [!region label-cache]
	const optionCache = useRef(
		new Map(
			(options.initialOptions ?? []).map(
				(option) => [option.value, option] as const,
			),
		),
	)

	// [!region query-state]
	const optionsQuery = useQuery({
		queryKey: [...options.queryKey, debouncedSearch],
		queryFn: ({ signal }) => options.queryFn(debouncedSearch, signal),
		enabled: open,
		placeholderData: keepPreviousData,
		staleTime: options.staleTime ?? 30_000,
	})
	// [!endregion query-state]

	useEffect(() => {
		for (const option of options.initialOptions ?? []) {
			optionCache.current.set(option.value, option)
		}
	}, [options.initialOptions])

	useEffect(() => {
		for (const option of optionsQuery.data ?? []) {
			optionCache.current.set(option.value, option)
		}
	}, [optionsQuery.data])
	// [!endregion label-cache]

	const normalizedSearch = normalizeSearch(search)
	const availableOptions = useMemo(
		() =>
			(optionsQuery.data ?? emptyOptions).filter((option) =>
				normalizeSearch(option.label).includes(normalizedSearch),
			),
		[normalizedSearch, optionsQuery.data],
	)
	const selectedOptions = value.map(
		(selectedValue) =>
			optionCache.current.get(selectedValue) ?? {
				value: selectedValue,
				label: selectedValue,
			},
	)
	const maxVisibleTags = options.maxVisibleTags ?? 3
	const visibleTags = selectedOptions.slice(0, maxVisibleTags)
	const hiddenTagCount = selectedOptions.length - visibleTags.length
	const listboxId = `${input.id}-listbox`
	const { context, floatingStyles, refs } = useFloating({
		open,
		onOpenChange: handleOpenChange,
		placement: "bottom-start",
		middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
		whileElementsMounted: autoUpdate,
	})
	const click = useClick(context, { enabled: !disabled })
	const dismiss = useDismiss(context)
	const role = useRole(context, { role: "dialog" })
	const listNavigation = useListNavigation(context, {
		listRef,
		activeIndex,
		onNavigate: setActiveIndex,
		loop: true,
		focusItemOnOpen: false,
		disabledIndices: availableOptions.flatMap((option, index) => {
			if (option.disabled) return [index]
			return []
		}),
	})
	const { getFloatingProps, getItemProps, getReferenceProps } = useInteractions(
		[click, dismiss, role, listNavigation],
	)
	const referenceRef = useMergeRefs([refs.setReference, input.ref])
	let hiddenSelectionNoun = "selections"
	if (hiddenTagCount === 1) hiddenSelectionNoun = "selection"
	let controlledListboxId: string | undefined
	if (open) controlledListboxId = listboxId
	let toggleLabel = "Open options"
	if (open) toggleLabel = "Close options"

	useEffect(() => {
		setActiveIndex(null)
		listRef.current.length = availableOptions.length
	}, [availableOptions.length])

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen)
		if (!nextOpen) {
			setSearch("")
			setActiveIndex(null)
			blur()
		}
	}

	function toggleOption(option: AsyncMultiSelectOption) {
		if (readOnly || option.disabled) return

		if (value.includes(option.value)) {
			setValue(value.filter((selectedValue) => selectedValue !== option.value))
			return
		}

		setValue([...value, option.value])
	}

	return (
		<fieldset
			className="async-multiselect"
			data-disabled={disabled || undefined}
			data-invalid={meta.invalid || undefined}
			data-readonly={readOnly || undefined}
		>
			<div
				className="async-multiselect__trigger"
				ref={refs.setPositionReference}
			>
				<div className="async-multiselect__tags">
					{visibleTags.map((option) => (
						<span className="async-multiselect__tag" key={option.value}>
							<span>{option.label}</span>
							<button
								aria-label={`Remove ${option.label}`}
								disabled={disabled || readOnly}
								onClick={() =>
									setValue(
										value.filter(
											(selectedValue) => selectedValue !== option.value,
										),
									)
								}
								type="button"
							>
								<XMarkIcon
									aria-hidden="true"
									className="async-multiselect__small-icon"
								/>
							</button>
						</span>
					))}
					{hiddenTagCount > 0 && (
						<span className="async-multiselect__tag async-multiselect__tag--count">
							<span>+{hiddenTagCount}</span>
							<button
								aria-label={`Remove ${hiddenTagCount} hidden ${hiddenSelectionNoun}`}
								disabled={disabled || readOnly}
								onClick={() => setValue(value.slice(0, maxVisibleTags))}
								type="button"
							>
								<XMarkIcon
									aria-hidden="true"
									className="async-multiselect__small-icon"
								/>
							</button>
						</span>
					)}
					{selectedOptions.length === 0 && (
						<span className="async-multiselect__placeholder">
							{options.placeholder ?? "Choose options"}
						</span>
					)}
				</div>

				<button
					aria-label="Clear selection"
					className="async-multiselect__icon-button"
					disabled={disabled || readOnly || value.length === 0}
					onClick={() => setValue([])}
					type="button"
				>
					<XMarkIcon
						aria-hidden="true"
						className="async-multiselect__small-icon"
					/>
				</button>
				<span aria-hidden="true" className="async-multiselect__separator" />
				<button
					aria-controls={controlledListboxId}
					aria-describedby={input["aria-describedby"]}
					aria-expanded={open}
					aria-haspopup="listbox"
					aria-invalid={meta.invalid || undefined}
					aria-label={toggleLabel}
					className="async-multiselect__icon-button"
					disabled={disabled}
					id={input.id}
					ref={referenceRef}
					type="button"
					{...getReferenceProps()}
				>
					<ChevronDownIcon
						aria-hidden="true"
						className="async-multiselect__small-icon"
					/>
				</button>
			</div>

			{open && (
				<FloatingFocusManager
					context={context}
					initialFocus={searchRef}
					modal={false}
					restoreFocus
				>
					<div
						aria-label={options.dialogLabel ?? "Options"}
						className="async-multiselect__dropdown"
						ref={refs.setFloating}
						role="dialog"
						style={floatingStyles}
						{...getFloatingProps()}
					>
						<div className="async-multiselect__search-row">
							<MagnifyingGlassIcon
								aria-hidden="true"
								className="async-multiselect__search-icon"
							/>
							<input
								aria-autocomplete="list"
								aria-controls={listboxId}
								aria-expanded="true"
								aria-label={options.searchPlaceholder ?? "Search options"}
								aria-required={required || undefined}
								autoComplete="off"
								className="async-multiselect__search-input"
								onChange={(event) => {
									setSearch(event.currentTarget.value)
									setActiveIndex(null)
								}}
								placeholder={options.searchPlaceholder ?? "Search options"}
								readOnly={readOnly}
								ref={searchRef}
								role="combobox"
								type="search"
								value={search}
							/>
							{optionsQuery.isFetching && (
								<span aria-live="polite" className="async-multiselect__status">
									Loading…
								</span>
							)}
						</div>

						<div
							aria-busy={optionsQuery.isFetching || undefined}
							aria-multiselectable="true"
							className="async-multiselect__options"
							id={listboxId}
							role="listbox"
						>
							{optionsQuery.isError && (
								<div className="async-multiselect__message" role="alert">
									<span>Could not load options.</span>
									<button onClick={() => optionsQuery.refetch()} type="button">
										Try again
									</button>
								</div>
							)}
							{!optionsQuery.isError &&
								!optionsQuery.isPending &&
								availableOptions.length === 0 && (
									<p className="async-multiselect__message" role="status">
										{options.emptyMessage ?? "No options found."}
									</p>
								)}
							{availableOptions.map((option, index) => {
								const selected = value.includes(option.value)
								let tabIndex = -1
								if (activeIndex === index) tabIndex = 0

								return (
									<div
										aria-disabled={option.disabled || undefined}
										aria-selected={selected}
										className="async-multiselect__option"
										data-active={index === (activeIndex ?? 0) || undefined}
										id={`${listboxId}-option-${index}`}
										key={option.value}
										ref={(element) => {
											listRef.current[index] = element
										}}
										role="option"
										tabIndex={tabIndex}
										{...getItemProps({
											onClick: () => toggleOption(option),
											onKeyDown: (event) => {
												if (event.key === "Enter" || event.key === " ") {
													event.preventDefault()
													toggleOption(option)
												}
											},
										})}
									>
										<span
											aria-hidden="true"
											className="async-multiselect__check"
											data-selected={selected || undefined}
										>
											{selected && (
												<CheckIcon className="async-multiselect__check-icon" />
											)}
										</span>
										<span>{option.label}</span>
									</div>
								)
							})}
						</div>

						<div className="async-multiselect__footer">
							<button
								disabled={readOnly || value.length === 0}
								onClick={() => setValue([])}
								type="button"
							>
								Clear
							</button>
							<button onClick={() => handleOpenChange(false)} type="button">
								Close
							</button>
						</div>
					</div>
				</FloatingFocusManager>
			)}
		</fieldset>
	)
}

export const asyncMultiSelect = defineControl<
	string[],
	AsyncMultiSelectOptions
>({
	component: AsyncMultiSelectControl,
})

function useDebouncedValue<Value>(value: Value, delayMs: number): Value {
	const [debouncedValue, setDebouncedValue] = useState(value)

	useEffect(() => {
		const timer = window.setTimeout(() => setDebouncedValue(value), delayMs)
		return () => window.clearTimeout(timer)
	}, [delayMs, value])

	return debouncedValue
}

function normalizeSearch(value: string): string {
	return value.trim().toLocaleLowerCase()
}
// [!endregion control]

// [!region example]
// [!region schema-values]
const initiallySelected = [
	{ value: "tokyo", label: "Tokyo" },
	{ value: "istanbul", label: "Istanbul" },
	{ value: "moscow", label: "Moscow" },
	{ value: "mumbai", label: "Mumbai" },
] satisfies readonly AsyncMultiSelectOption[]

const schema = z.object({
	cityIds: z.array(z.string()).min(1, "Choose at least one city"),
})

const defaultValues = {
	cityIds: initiallySelected.map((city) => city.value),
} satisfies FormInput<typeof schema>
// [!endregion schema-values]

const cities = [
	...initiallySelected,
	{ value: "rome", label: "Rome" },
	{ value: "berlin", label: "Berlin" },
	{ value: "lisbon", label: "Lisbon" },
	{ value: "paris", label: "Paris" },
] satisfies readonly AsyncMultiSelectOption[]

// [!region demo-query]
async function searchCities(
	search: string,
	signal: AbortSignal,
): Promise<readonly AsyncMultiSelectOption[]> {
	await abortableDelay(450, signal)
	const normalizedSearch = normalizeSearch(search)

	return cities.filter((city) =>
		normalizeSearch(city.label).includes(normalizedSearch),
	)
}
// [!endregion demo-query]

// [!region register-control]
const kit = createFormKit({
	controls: {
		...createNativeControls(),
		asyncMultiSelect,
	},
	slots: createDefaultSlots(),
})
// [!endregion register-control]

// [!region field-definition]
const definition = kit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "cityIds",
			control: "asyncMultiSelect",
			label: "Cities",
			description: "Search the remote list and keep more than one city.",
			required: true,
			options: {
				queryKey: ["cities"],
				queryFn: searchCities,
				initialOptions: initiallySelected,
				placeholder: "Choose cities",
				searchPlaceholder: "Search cities",
				emptyMessage: "No cities match this search.",
				dialogLabel: "City options",
			},
		},
	],
})
// [!endregion field-definition]

// [!region provider-submit]
export function AsyncMultiSelectExample() {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						retry: false,
					},
				},
			}),
	)
	const [savedCityIds, setSavedCityIds] = useState<readonly string[]>()
	const form = kit.useForm(definition, {
		defaultValues,
		onSubmit: ({ value }) => setSavedCityIds(value.cityIds),
	})
	let output = "Submit to see the validated city IDs."
	if (savedCityIds !== undefined) {
		output = `Saved: ${savedCityIds.join(", ")}`
	}

	return (
		<QueryClientProvider client={queryClient}>
			<section
				aria-label="Async multiselect example"
				className="form-please-complex form-please-async-demo"
				data-testid="async-multiselect-demo"
			>
				<p className="form-please-async-demo__kicker">Live demo</p>
				<p className="form-please-async-demo__summary">
					Open the list and search for “m”. Repeated searches reuse the query
					cache.
				</p>
				<kit.AutoForm form={form}>
					<kit.Submit>Save selection</kit.Submit>
				</kit.AutoForm>
				<output aria-live="polite" data-testid="async-multiselect-output">
					{output}
				</output>
			</section>
		</QueryClientProvider>
	)
}
// [!endregion provider-submit]

function abortableDelay(delayMs: number, signal: AbortSignal): Promise<void> {
	if (signal.aborted) {
		return Promise.reject(new DOMException("Aborted", "AbortError"))
	}

	return new Promise((resolve, reject) => {
		function handleAbort() {
			window.clearTimeout(timer)
			reject(new DOMException("Aborted", "AbortError"))
		}

		const timer = window.setTimeout(() => {
			signal.removeEventListener("abort", handleAbort)
			resolve()
		}, delayMs)

		signal.addEventListener("abort", handleAbort, { once: true })
	})
}
// [!endregion example]
