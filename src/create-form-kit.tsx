"use client"

import {
	type ComponentPropsWithoutRef,
	type ReactNode,
	useContext,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react"
import {
	type Control,
	type DefaultValues,
	type FieldValues,
	FormProvider,
	type UseFormReturn,
	useFormState,
	useForm as useReactHookForm,
	useWatch,
} from "react-hook-form"
import {
	createFormFragment,
	normalizeDefinition,
	normalizeGrid,
	readErrorDisplay,
} from "./definition.js"
import { errorMessage } from "./error-codes.js"
import {
	FormContext,
	FormIdContext,
	FormValuesContext,
} from "./form-context.js"
import type {
	AnyFormSchema,
	AutoFormProps,
	CreateFormKitOptions,
	DefineForm,
	DefineFormOptions,
	DefineFragment,
	FormAction,
	FormBinding,
	FormKit,
	FormProps,
	FormValues,
	RuntimeSlots,
	UseForm,
	UseFormOptions,
} from "./form-kit-types.js"
import {
	createFormRuntime,
	type FormRuntime,
	readFormSettings,
} from "./form-runtime.js"
import {
	isImplicitSubmitKey,
	snapshotSubmitter,
	submitterAction,
} from "./form-submission.js"
import {
	booleanData,
	ErrorSummary,
	ResolvedFields,
	useFieldControl,
} from "./generated-nodes.js"
import { createStandardSchemaResolver } from "./standard-schema-resolver.js"
import type {
	ControlDefinitionRegistry,
	ErrorDisplay,
	FormDefinition,
	FormDefinitionUpdatePolicy,
	FormKitTypes,
	FormOutput,
	StandardSchema,
	SubmitRenderProps,
	SubmitSlotProps,
} from "./types.js"
import { useSnapshot } from "./use-snapshot.js"

export type { FormDiagnosticsRuntime } from "./diagnostics.js"
export type {
	AutoFormProps,
	CreateFormKitOptions,
	DefineFormOptions,
	FormAction,
	FormActionConfig,
	FormActionsConfig,
	FormActionValidateDetails,
	FormBinding,
	FormIssueInput,
	FormKit,
	FormKitTypesOf,
	FormProps,
	FormSubmission,
	FormSubmissionSnapshot,
	FormSubmitDetails,
	FormSubmitResult,
	SetIssuesOptions,
	UseFormOptions,
} from "./form-kit-types.js"

/**
 * Creates an immutable form kit from control and slot registries.
 *
 * @example
 * ```tsx
 * const kit = createFormKit({ controls, slots })
 * const definition = kit.defineForm(schema, (ui) => [
 *   ui.field("name", { control: "text" }),
 * ])
 * ```
 *
 * @see https://r13v.github.io/form-please/get-started
 */
export function createFormKit<
	Controls extends ControlDefinitionRegistry,
	FieldOptions = never,
	SectionOptions = never,
	ArrayOptions = never,
	const Grid extends number = 1 | 2 | 3 | 4,
>(
	options: CreateFormKitOptions<{
		readonly controls: Controls
		readonly fieldOptions: FieldOptions
		readonly sectionOptions: SectionOptions
		readonly arrayOptions: ArrayOptions
		readonly grid: Grid
	}>,
): FormKit<{
	readonly controls: Controls
	readonly context: unknown
	readonly fieldOptions: FieldOptions
	readonly sectionOptions: SectionOptions
	readonly arrayOptions: ArrayOptions
	readonly grid: Grid
}> {
	const controls = Object.freeze({ ...options.controls })
	const slots = Object.freeze({ ...options.slots })
	assertSlots(options.slots)
	const grid = normalizeGrid(options.grid, "createFormKit")
	const errorDisplay =
		readErrorDisplay(options.errorDisplay, "createFormKit") ?? "all"

	return assembleKit(
		controls,
		slots as unknown as RuntimeSlots,
		grid,
		errorDisplay,
	) as unknown as FormKit<{
		readonly controls: Controls
		readonly context: unknown
		readonly fieldOptions: FieldOptions
		readonly sectionOptions: SectionOptions
		readonly arrayOptions: ArrayOptions
		readonly grid: Grid
	}>
}

/** Assembles one runtime kit and its exact-definition ownership checks. */
function assembleKit(
	controls: ControlDefinitionRegistry,
	slots: RuntimeSlots,
	grid: readonly number[],
	kitErrorDisplay: ErrorDisplay,
): FormKit<FormKitTypes> {
	const fragments = new WeakSet<object>()
	const definitions = new WeakSet<object>()
	const runtimeForms = new WeakMap<object, FormRuntime>()
	const ownsFragment = (fragment: object) => fragments.has(fragment)
	const defineFragment = ((schema: StandardSchema, source: unknown) => {
		const fragment = createFormFragment(
			schema,
			source,
			controls,
			grid,
			ownsFragment,
		)
		fragments.add(fragment)
		return fragment
	}) as DefineFragment<FormKitTypes>
	const defineForm = ((
		schema: StandardSchema,
		source: unknown,
		options?: DefineFormOptions<StandardSchema, unknown>,
	) => {
		const definition = normalizeDefinition(
			schema,
			source,
			controls,
			grid,
			ownsFragment,
			options,
		)
		definitions.add(definition)
		return definition
	}) as DefineForm<FormKitTypes>

	const useForm = (<Schema extends StandardSchema>(
		definition: FormDefinition<Schema> &
			FormDefinitionUpdatePolicy<Schema, unknown>,
		options: UseFormOptions<Schema, unknown>,
	) => {
		const fixedDefinition = useRef(definition).current
		if (!definitions.has(fixedDefinition)) {
			throw new TypeError(
				errorMessage(
					"FP002",
					"kit.useForm requires a definition from this exact form kit. If this error appears after a hot reload, reload the page or remount the component that calls kit.useForm.",
				),
			)
		}
		const fixedDefaultValues = useRef(options.defaultValues).current
		if (!isFieldValues(fixedDefaultValues)) {
			throw new TypeError(
				errorMessage("FP003", "Form defaultValues must be an object"),
			)
		}
		const anyOptions = options as UseFormOptions<AnyFormSchema>
		const settings = readFormSettings(
			anyOptions,
			readErrorDisplay(options.errorDisplay, "useForm") ?? kitErrorDisplay,
		)
		const api = useReactHookForm<
			FormValues<Schema>,
			unknown,
			FormOutput<Schema>
		>({
			context: options.context,
			criteriaMode: "all",
			defaultValues: fixedDefaultValues as DefaultValues<FormValues<Schema>>,
			delayError: options.delayError,
			mode: options.mode ?? "onSubmit",
			reValidateMode: options.reValidateMode ?? "onChange",
			resolver: createStandardSchemaResolver(
				fixedDefinition.schema as StandardSchema<
					FormValues<Schema>,
					FormOutput<Schema>
				>,
				// RHF calls the resolver only after render, when the runtime exists.
				(values) => runtime.issues.current(values),
			),
			shouldFocusError: true,
			shouldUnregister: false,
		})
		const [runtime] = useState(() => {
			const created = createFormRuntime({
				api: api as unknown as UseFormReturn<FieldValues, unknown, unknown>,
				defaultValues: fixedDefaultValues,
				definition: fixedDefinition as unknown as FormBinding["definition"],
				options: anyOptions,
				settings,
			})
			runtimeForms.set(created.binding, created)
			return created
		})
		useLayoutEffect(() => runtime.update(anyOptions, settings))
		useLayoutEffect(() => runtime.connect(), [runtime])

		return runtime.binding as unknown as FormBinding<Schema, unknown>
	}) as UseForm<FormKitTypes>

	/** Provides the binding contexts and renders the native form element. */
	function Form<Schema extends StandardSchema>({
		form,
		children,
		id,
		...nativeProps
	}: FormProps<Schema, unknown>) {
		const generatedId = `form-please-${useId().replaceAll(":", "")}`
		const formId = id ?? generatedId
		const runtime = runtimeForms.get(form)
		if (runtime === undefined) {
			throw new Error(
				errorMessage("FP004", "Form binding is not mounted by this form kit"),
			)
		}
		const { disabled, readOnly } = useSnapshot(runtime.settings)
		const { submission } = runtime

		return (
			<FormProvider {...form.api}>
				<FormContext.Provider value={runtime}>
					<FormIdContext.Provider value={formId}>
						<form
							{...nativeProps}
							data-disabled={booleanData(disabled)}
							data-fp-node="form"
							data-readonly={booleanData(readOnly)}
							id={formId}
							noValidate
							ref={(element) => {
								runtime.formElement = element
							}}
							onKeyDown={(event) => {
								nativeProps.onKeyDown?.(event)
								// The onSubmit shorthand keeps native implicit submission and its submitter.
								if (submission.defaultAction !== undefined) return
								if (!isImplicitSubmitKey(event)) return
								event.preventDefault()
								const name = submission.implicitAction
								if (name === undefined) return
								void submission.submitAction(name, null)
							}}
							onReset={(event) => {
								event.preventDefault()
								submission.reset()
								form.api.reset()
							}}
							onSubmit={(event) => {
								event.preventDefault()
								const name =
									submitterAction(event.nativeEvent) ??
									submission.implicitAction
								if (name === undefined) return
								void submission.submitAction(
									name,
									snapshotSubmitter(event.nativeEvent),
								)
							}}
						>
							<WatchedValues control={runtime.api.control}>
								{children}
							</WatchedValues>
						</form>
					</FormIdContext.Provider>
				</FormContext.Provider>
			</FormProvider>
		)
	}

	/** Resolves and renders generated fields for the current form context. */
	function Fields({
		node,
		children,
	}: {
		/** The ID of one definition node; only that node renders. */
		readonly node?: string
		/** Content rendered after the generated fields. */
		readonly children?: ReactNode
	}) {
		const form = useSurroundingRuntime("kit.Fields")
		const values = useContext(FormValuesContext)
		return (
			<ResolvedFields
				controls={controls}
				form={form}
				slots={slots}
				values={values}
				{...(node === undefined ? {} : { node })}
			>
				{children}
			</ResolvedFields>
		)
	}

	/** Renders the error summary of the surrounding form. */
	function KitErrorSummary() {
		const form = useSurroundingRuntime("kit.ErrorSummary")

		return <ErrorSummary form={form} slots={slots} />
	}

	/** Reads the runtime of a surrounding `kit.Form`; a Form of another kit throws. */
	function useOptionalSurroundingRuntime(owner: string): FormRuntime | null {
		const runtime = useContext(FormContext)
		if (runtime !== null && !runtimeForms.has(runtime.binding)) {
			throw surroundingFormError(owner)
		}

		return runtime
	}

	/** Reads the runtime of the surrounding `kit.Form`, which must come from this kit. */
	function useSurroundingRuntime(owner: string): FormRuntime {
		const runtime = useOptionalSurroundingRuntime(owner)
		if (runtime === null) throw surroundingFormError(owner)

		return runtime
	}

	/**
	 * Returns the binding of the surrounding `kit.Form`. The binding keeps one
	 * identity, so the settings subscription is what renders the caller again
	 * when `context`, `disabled` or `readOnly` changes.
	 */
	function useFormContext() {
		const runtime = useSurroundingRuntime("kit.useFormContext")
		useSnapshot(runtime.settings)

		return runtime.binding
	}

	/** Connects one custom field path to the surrounding form. */
	function useField(form: FormBinding, path: string) {
		const runtime = useSurroundingRuntime("kit.useField")
		if (runtimeForms.get(form) !== runtime) {
			throw new Error(
				errorMessage(
					"FP006",
					"kit.useField binding must match the surrounding Form",
				),
			)
		}

		return useFieldControl(runtime, path).control
	}

	/**
	 * Selects the runtime form of `kit.Submit`. Inside `kit.Form`, the action
	 * must belong to the surrounding form. Outside `kit.Form`, the action
	 * selects the form.
	 */
	function resolveSubmitRuntime(
		surrounding: FormRuntime | null,
		action: { readonly form: object } | undefined,
	): FormRuntime {
		const fromAction =
			action === undefined ? undefined : runtimeForms.get(action.form)
		if (surrounding !== null) {
			if (action !== undefined && fromAction !== surrounding) {
				throw new Error(
					errorMessage(
						"FP007",
						"Submit action must belong to the surrounding Form",
					),
				)
			}
			return surrounding
		}
		if (action === undefined) {
			throw new Error(
				errorMessage("FP008", "Submit outside Form requires an action"),
			)
		}
		if (fromAction === undefined) {
			throw new Error(
				errorMessage("FP009", "Submit action is not mounted by this form kit"),
			)
		}

		return fromAction
	}

	/** Renders the kit submit slot with live form state. */
	function Submit<Schema extends StandardSchema>(
		props: Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
			/**
			 * The action that the button runs. Outside `kit.Form`, the action
			 * also selects the form. Set the native `form` attribute to the
			 * Form `id`.
			 */
			readonly action?: FormAction<Schema, unknown>
			readonly children?:
				| ReactNode
				| ((props: SubmitRenderProps<Schema>) => ReactNode)
		},
	) {
		const { action } = props
		const runtime = resolveSubmitRuntime(
			useOptionalSurroundingRuntime("kit.Submit"),
			action,
		)
		const actionName = action?.name ?? runtime.submission.defaultAction
		if (actionName === undefined) {
			throw new Error(
				errorMessage(
					"FP010",
					"Submit requires an action when useForm configures actions",
				),
			)
		}
		const isPending = useSnapshot(runtime.submission.store).action !== null
		const { disabled } = useSnapshot(runtime.settings)
		const { isDirty, isSubmitting, isValidating } = useFormState({
			control: runtime.api.control,
		})
		// RHF re-renders this component on each value change while isDirty is
		// read, so the slot element changes only when its props change.
		const content = useMemo(() => {
			const { action: _action, children: _children, ...nativeProps } = props
			const slotProps: SubmitSlotProps = {
				buttonProps: {
					...nativeProps,
					"data-fp-action": actionName,
					disabled:
						props.disabled === true ||
						disabled ||
						isPending ||
						isValidating ||
						isSubmitting,
					type: "submit",
				} as SubmitSlotProps["buttonProps"],
				isPending,
				isSubmitting,
				isDirty,
				canSubmit: !isPending && !isValidating && !isSubmitting,
			}
			if (typeof props.children === "function") {
				return (
					<SubmitRender
						control={runtime.api.control}
						render={props.children as (props: SubmitRenderProps) => ReactNode}
						slotProps={slotProps}
					/>
				)
			}
			const Slot = slots.Submit

			return (
				<Slot
					{...slotProps}
					buttonProps={{ ...slotProps.buttonProps, children: props.children }}
				/>
			)
		}, [
			actionName,
			disabled,
			isDirty,
			isPending,
			isSubmitting,
			isValidating,
			props,
			runtime,
		])

		return content
	}

	/** Composes a native form, its error summary, and generated fields. */
	function AutoForm<Schema extends StandardSchema>(
		props: AutoFormProps<Schema, unknown>,
	) {
		const { children, form, ...formProps } = props
		return (
			<Form {...formProps} form={form}>
				<KitErrorSummary />
				<Fields />
				{children}
			</Form>
		)
	}

	let kit: unknown
	const result = Object.freeze({
		controls,
		slots,
		grid,
		defineFragment,
		defineForm,
		useForm,
		Form,
		Fields,
		ErrorSummary: KitErrorSummary,
		useField,
		useFormContext,
		Submit,
		AutoForm,
		forContext: () => kit,
	}) as unknown as FormKit<FormKitTypes>
	kit = result
	return result
}

/**
 * Watches all values once for one `kit.Form`. Every `kit.Fields` reads them
 * from context, so all of them get one values object per change and share one
 * resolution. RHF gives each `useWatch` hook its own copy of the values.
 */
function WatchedValues({
	control,
	children,
}: {
	readonly control: Control<FieldValues, unknown, unknown>
	readonly children?: ReactNode
}) {
	const values = useWatch({ control })

	return (
		<FormValuesContext.Provider value={values}>
			{children}
		</FormValuesContext.Provider>
	)
}

/** Calls a `kit.Submit` render function; it subscribes to all values only for that function. */
function SubmitRender({
	control,
	render,
	slotProps,
}: {
	readonly control: Control<FieldValues, unknown, unknown>
	readonly render: (props: SubmitRenderProps) => ReactNode
	readonly slotProps: SubmitSlotProps
}) {
	const values = useWatch({ control }) as SubmitRenderProps["values"]

	return <>{render({ ...slotProps, values })}</>
}

/** Creates the error for a kit hook or component outside a Form of its kit. */
function surroundingFormError(owner: string): Error {
	return new Error(
		errorMessage(
			"FP005",
			`${owner} must be called inside a Form of this form kit`,
		),
	)
}

/** Tests whether a value can serve as React Hook Form field values. */
function isFieldValues(value: unknown): value is FieldValues {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Verifies that every required structural slot is registered. */
function assertSlots(slots: Readonly<Record<string, unknown>>): void {
	for (const key of [
		"Field",
		"Section",
		"Array",
		"ArrayItem",
		"ErrorMessage",
		"Submit",
	] as const) {
		if (slots[key] === undefined) {
			throw new TypeError(
				errorMessage("FP001", `createFormKit requires a ${key} slot`),
			)
		}
	}
}
