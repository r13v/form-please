"use client"

import type { Draft } from "immer"
import {
	type ComponentPropsWithoutRef,
	type ComponentType,
	createContext,
	createElement,
	memo,
	type ReactElement,
	type ReactNode,
	type RefObject,
	useContext,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react"
import {
	type DefaultValues,
	type FieldError,
	type FieldErrors,
	type FieldValues,
	FormProvider,
	get,
	type Mode,
	set,
	type UseFormReturn,
	useController,
	useFieldArray,
	useFormState,
	useForm as useReactHookForm,
	useWatch,
} from "react-hook-form"
import {
	createFormFragment,
	normalizeDefinition,
	normalizeGrid,
	type ResolvedArrayNode,
	type ResolvedDefinition,
	type ResolvedFieldNode,
	type ResolvedNode,
	resolveDefinition,
} from "./definition.js"
import {
	formDiagnosticNow,
	hasFormDiagnosticSink,
	publishFormDiagnosticEvent,
} from "./diagnostics.js"
import { cloneFormValue } from "./form-value.js"
import {
	createStandardSchemaResolver,
	fieldErrorsToIssues,
	fieldErrorToIssues,
	hasFieldError,
} from "./standard-schema-resolver.js"
import type {
	ArraySlotProps,
	ControlDefinitionRegistry,
	ControlProps,
	DeepReadonly,
	FieldSlotProps,
	FormDefinition,
	FormDefinitionBuilder,
	FormDefinitionSource,
	FormFragment,
	FormInput,
	FormIssue,
	FormKitSlots,
	FormOutput,
	FormPleaseStyle,
	SectionSlotProps,
	StandardSchema,
	StructuralNodeName,
	StructuralRootProps,
	SubmitSlotProps,
} from "./types.js"
import { useFieldOptions } from "./use-field-options.js"
import {
	attachValueCoordinatorCapability,
	type BeforeUpdateResult,
	createValueCoordinator,
	type FormMiddleware,
	type FormUpdateRecipe,
	getValueCoordinatorCapability,
	type ValueCoordinator,
	type ValuePatch,
	type ValueTransaction,
	type ValueTransactionCommit,
	type ValueTransactionSource,
} from "./value-middleware.js"

/** Narrows schema input to the object shape required by React Hook Form. */
type FormValues<Schema extends StandardSchema> = Extract<
	FormInput<Schema>,
	FieldValues
>
/** A schema shape used when a concrete form schema is unknown. */
type AnyFormSchema = StandardSchema<FieldValues, unknown>

/** The typed React Hook Form API exposed by a form binding. */
type NativeApi<Schema extends StandardSchema, Context> = UseFormReturn<
	FormValues<Schema>,
	Context,
	FormOutput<Schema>
>

/** Makes runtime context optional only when its type is unknown. */
type ContextOption<Context> = unknown extends Context
	? {
			/** Application data available to resolvers and controls. */
			readonly context?: Context
		}
	: {
			/** Application data available to resolvers and controls. */
			readonly context: Context
		}

/** Values supplied to a successful Form Please submit handler. */
export type FormSubmitDetails<
	Schema extends StandardSchema,
	Context = unknown,
> = {
	/** The validated and possibly transformed schema output. */
	readonly value: FormOutput<Schema>
	/** The editable input snapshot used for this submission. */
	readonly input: FormInput<Schema>
	/** The binding that submitted the form. */
	readonly form: FormBinding<Schema, Context>
	/** The native submit control captured before validation, or null for an implicit submit. */
	readonly submitter: Readonly<{
		/** The submit control name. */
		readonly name: string
		/** The submit control value. */
		readonly value: string
	}> | null
}

/** Configuration used to bind a definition to React Hook Form. */
export type UseFormOptions<
	Schema extends StandardSchema,
	Context = unknown,
> = ContextOption<Context> & {
	/** Adjusts or cancels a proposed managed value update before middleware. */
	readonly beforeUpdate?: (
		draft: Draft<FormValues<Schema>>,
		transaction: ValueTransaction<FormValues<Schema>, Context>,
	) => BeforeUpdateResult
	/** Observes the final transaction after commit and middleware unwind. */
	readonly afterUpdate?: (
		transaction: ValueTransaction<FormValues<Schema>, Context>,
	) => void
	/** Initial editable values, fixed for the hook lifetime. */
	readonly defaultValues: FormInput<Schema>
	/** Milliseconds to delay the display of validation errors. */
	readonly delayError?: number
	/** Whether all generated controls reject user interaction. */
	readonly disabled?: boolean
	/** The React Hook Form validation mode. */
	readonly mode?: Mode
	/** Ordered value middleware, fixed for the hook lifetime. */
	readonly middleware?: readonly FormMiddleware<FormValues<Schema>, Context>[]
	/** Whether all generated controls prevent value changes. */
	readonly readOnly?: boolean
	/** The validation mode used after the first submit attempt. */
	readonly reValidateMode?: Exclude<Mode, "all" | "onTouched">
	/** Handles successful validation with output and matching input values. */
	readonly onSubmit?: (
		details: FormSubmitDetails<Schema, Context>,
	) => unknown | Promise<unknown>
}

/** A form definition bound to a React Hook Form instance and runtime context. */
export type FormBinding<
	Schema extends StandardSchema = AnyFormSchema,
	Context = unknown,
> = {
	/** The unchanged typed React Hook Form API. */
	readonly api: NativeApi<Schema, Context>
	/** The normalized definition fixed for this binding. */
	readonly definition: FormDefinition<Schema>
	/** Application data available to resolvers and controls. */
	readonly context: Context
	/** Atomically applies one managed value recipe through middleware. */
	update(recipe: FormUpdateRecipe<FormValues<Schema>>): unknown
}

/** Native form props that remain under application control. */
type NativeFormProps = Omit<
	ComponentPropsWithoutRef<"form">,
	"action" | "children" | "noValidate" | "onReset" | "onSubmit" | "style"
> & {
	/** Native CSS plus Form Please layout variables. */
	readonly style?: FormPleaseStyle
}

/** Props for the form provider and native form element. */
export type FormProps<
	Schema extends StandardSchema = AnyFormSchema,
	Context = unknown,
> = NativeFormProps & {
	/** The form binding created by this exact kit. */
	readonly form: FormBinding<Schema, Context>
	/** Form content rendered inside the providers. */
	readonly children?: ReactNode
}

/** Props for a form that automatically renders its errors and fields. */
export type AutoFormProps<
	Schema extends StandardSchema = AnyFormSchema,
	Context = unknown,
> = FormProps<Schema, Context>

/** Private form data used by generated runtime components. */
type RuntimeForm = {
	/** The React Hook Form API with erased public type parameters. */
	readonly api: UseFormReturn<FieldValues, unknown, unknown>
	/** Application data supplied to controls and resolvers. */
	readonly context: unknown
	/** The normalized definition fixed for this form. */
	readonly definition: FormDefinition
	/** Canonical coordinator capability used by optional diagnostics. */
	readonly diagnosticTarget: object
	/** Dispatches a generated managed update through middleware. */
	readonly dispatch: ValueCoordinator<FieldValues, unknown>["dispatch"]
	/** Commits one terminal transaction to React Hook Form. */
	readonly commit: ValueTransactionCommit<FieldValues, unknown>
	/** Whether all generated controls are disabled. */
	readonly disabled: boolean
	/** Whether all generated controls are read-only. */
	readonly readOnly: boolean
	/** Focusable generated inputs indexed by absolute path. */
	readonly inputRefs: Map<string, HTMLElement>
	/** The first summary issue used as a focus fallback. */
	readonly errorSummaryRef: RefObject<HTMLElement | null>
	/** The mounted native form element, when one exists. */
	formElement: HTMLFormElement | null
	/** The configured successful-submit handler. */
	readonly onSubmit?: (
		details: FormSubmitDetails<AnyFormSchema>,
	) => unknown | Promise<unknown>
	/** The latest resolved UI already retained by the generated fields. */
	resolved?: ResolvedDefinition
}

/** Package-private runtime data consumed by the optional devtools entry. */
export type FormDiagnosticsRuntime = Readonly<
	Pick<RuntimeForm, "diagnosticTarget" | "disabled" | "inputRefs" | "readOnly">
> & {
	readonly formElement: HTMLFormElement | null
	readonly resolved?: ResolvedDefinition
}

const formDiagnosticsRuntimeKey = Symbol.for(
	"form-please.form-diagnostics-runtime",
)

/** Reads private runtime data from an exact current Form Please binding. */
export function getFormDiagnosticsRuntime(
	target: object,
): FormDiagnosticsRuntime {
	const runtime = (target as Record<PropertyKey, unknown>)[
		formDiagnosticsRuntimeKey
	]
	if (runtime === undefined) {
		throw new TypeError("Devtools require a current Form Please form binding")
	}
	return runtime as FormDiagnosticsRuntime
}

/** Attaches private runtime data without extending the public form binding type. */
function attachFormDiagnosticsRuntime(
	target: object,
	runtime: RuntimeForm,
): void {
	Object.defineProperty(target, formDiagnosticsRuntimeKey, { value: runtime })
}
/** Validation policy used after one managed value commit. */
type ManagedValidationOptions = {
	readonly isSubmitted: boolean
	readonly mode: Mode
	readonly reValidateMode: Exclude<Mode, "all" | "onTouched">
}
/** Slot options after their concrete form-kit type is erased. */
type RuntimeSlotOptions = Readonly<unknown> | undefined
/** Form kit slots with erased application option types. */
type RuntimeSlots = FormKitSlots<
	Record<string, unknown>,
	Record<string, unknown>,
	Record<string, unknown>
>

/** Object or schema-bound builder authoring accepted by definition methods. */
type DefinitionAuthoringSource<
	Schema extends StandardSchema,
	Controls extends ControlDefinitionRegistry,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Context,
	Grid extends number,
> =
	| FormDefinitionSource<
			Schema,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid
	  >
	| FormDefinitionBuilder<
			Schema,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid
	  >

/** The typed `defineFragment` method exposed by a form kit. */
type DefineFragment<
	Controls extends ControlDefinitionRegistry,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Context,
	Grid extends number,
> = <Schema extends StandardSchema>(
	schema: FormInput<Schema> extends FieldValues ? Schema : never,
	source: DefinitionAuthoringSource<
		Schema,
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Context,
		Grid
	>,
) => FormFragment<
	Schema,
	Controls,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid
>

/** The typed `defineForm` method exposed by a form kit. */
type DefineForm<
	Controls extends ControlDefinitionRegistry,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Context,
	Grid extends number,
> = <Schema extends StandardSchema>(
	schema: FormInput<Schema> extends FieldValues ? Schema : never,
	source: DefinitionAuthoringSource<
		Schema,
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Context,
		Grid
	>,
) => FormDefinition<
	Schema,
	Controls,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid
>

/** The typed `useForm` hook exposed by a form kit. */
type UseForm<
	Controls extends ControlDefinitionRegistry,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Context,
	Grid extends number,
> = <Schema extends StandardSchema>(
	definition: FormDefinition<
		Schema,
		Controls,
		Context,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Grid
	>,
	options: UseFormOptions<Schema, Context>,
) => FormBinding<Schema, Context>

/** A fixed registry, renderer, and React Hook Form integration. */
export interface FormKit<
	Controls extends ControlDefinitionRegistry,
	FieldOptions = never,
	SectionOptions = never,
	ArrayOptions = never,
	Context = unknown,
	Grid extends number = 1 | 2 | 3 | 4,
> {
	/** The immutable named control registry. */
	readonly controls: Controls
	/** The immutable structural slot registry. */
	readonly slots: FormKitSlots<FieldOptions, SectionOptions, ArrayOptions>
	/** The allowed grid column counts and node spans. */
	readonly grid: readonly Grid[]
	/** Validates and binds one reusable schema-owned UI fragment to this kit. */
	readonly defineFragment: DefineFragment<
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Context,
		Grid
	>
	/** Validates and binds a typed definition to this kit. */
	readonly defineForm: DefineForm<
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Context,
		Grid
	>
	/** Creates a React Hook Form binding for a definition from this kit. */
	readonly useForm: UseForm<
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Context,
		Grid
	>
	/** Provides form contexts and owns native submit and reset events. */
	readonly Form: <Schema extends StandardSchema>(
		props: FormProps<Schema, Context>,
	) => ReactElement
	/** Renders resolved definition nodes followed by optional application content. */
	readonly Fields: (props: {
		/** Content rendered after the generated fields. */
		readonly children?: ReactNode
	}) => ReactElement
	/** Renders the configured submit slot with current form state. */
	readonly Submit: {
		/** Renders static content through the configured submit slot. */
		(props: Omit<ComponentPropsWithoutRef<"button">, "type">): ReactElement
		/** Renders custom content with live state typed by the matching binding. */
		<Schema extends StandardSchema>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
				/** The binding mounted by the surrounding `Form`. */
				readonly binding: FormBinding<Schema, Context>
				/** Renders custom content from live typed submit state. */
				readonly children: (props: SubmitSlotProps<Schema>) => ReactNode
			},
		): ReactElement
	}
	/** Composes `Form`, the error summary, and generated fields. */
	readonly AutoForm: <Schema extends StandardSchema>(
		props: AutoFormProps<Schema, Context>,
	) => ReactElement
	/** Returns a type-only view of this kit for a narrower context contract. */
	readonly forContext: <NextContext extends Context>() => FormKit<
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		NextContext,
		Grid
	>
}

/** Registries and optional grid used to create an immutable form kit. */
export type CreateFormKitOptions<
	Controls extends ControlDefinitionRegistry,
	FieldOptions = never,
	SectionOptions = never,
	ArrayOptions = never,
	Grid extends number = 1 | 2 | 3 | 4,
> = {
	/** The complete named control registry. */
	readonly controls: Controls
	/** The complete structural slot registry. */
	readonly slots: FormKitSlots<FieldOptions, SectionOptions, ArrayOptions>
	/** Allowed grid column counts and spans. Defaults to `1` through `4`. */
	readonly grid?: readonly Grid[]
}

/** Provides private form runtime data to generated components. */
const FormContext = createContext<RuntimeForm | null>(null)
/** Provides the current native form ID to generated components. */
const FormIdContext = createContext<string | null>(null)

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
	options: CreateFormKitOptions<
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Grid
	>,
): FormKit<
	Controls,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	unknown,
	Grid
> {
	const controls = Object.freeze({ ...options.controls }) as Controls
	const slots = Object.freeze({ ...options.slots }) as FormKitSlots<
		FieldOptions,
		SectionOptions,
		ArrayOptions
	>
	assertSlots(options.slots)
	const grid = normalizeGrid(options.grid, "createFormKit")

	return assembleKit(
		controls,
		slots as unknown as RuntimeSlots,
		grid,
	) as unknown as FormKit<
		Controls,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		unknown,
		Grid
	>
}

/** Assembles one runtime kit and its exact-definition ownership checks. */
function assembleKit(
	controls: ControlDefinitionRegistry,
	slots: RuntimeSlots,
	grid: readonly number[],
): FormKit<
	ControlDefinitionRegistry,
	unknown,
	unknown,
	unknown,
	unknown,
	number
> {
	const fragments = new WeakSet<object>()
	const definitions = new WeakSet<object>()
	const runtimeForms = new WeakMap<object, RuntimeForm>()
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
	}) as DefineFragment<
		ControlDefinitionRegistry,
		unknown,
		unknown,
		unknown,
		unknown,
		number
	>
	const defineForm = ((schema: StandardSchema, source: unknown) => {
		const definition = normalizeDefinition(
			schema,
			source,
			controls,
			grid,
			ownsFragment,
		)
		definitions.add(definition)
		return definition
	}) as DefineForm<
		ControlDefinitionRegistry,
		unknown,
		unknown,
		unknown,
		unknown,
		number
	>

	const useForm = (<Schema extends StandardSchema>(
		definition: FormDefinition<Schema>,
		options: UseFormOptions<Schema, unknown>,
	) => {
		const fixedDefinition = useRef(definition).current
		if (!definitions.has(fixedDefinition)) {
			throw new TypeError(
				"kit.useForm requires a definition from this exact form kit",
			)
		}
		const fixedDefaultValues = useRef(options.defaultValues).current
		if (!isFieldValues(fixedDefaultValues)) {
			throw new TypeError("Form defaultValues must be an object")
		}
		const fixedMiddlewareRef = useRef<
			readonly FormMiddleware<FormValues<Schema>, unknown>[] | undefined
		>(undefined)
		if (fixedMiddlewareRef.current === undefined) {
			fixedMiddlewareRef.current = Object.freeze([
				...(options.middleware ?? []),
			])
		}
		const beforeUpdateRef = useRef(options.beforeUpdate)
		beforeUpdateRef.current = options.beforeUpdate
		const afterUpdateRef = useRef(options.afterUpdate)
		afterUpdateRef.current = options.afterUpdate

		const inputRefs = useRef(new Map<string, HTMLElement>())
		const errorSummaryRef = useRef<HTMLElement | null>(null)
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
			),
			shouldFocusError: true,
			shouldUnregister: false,
		})
		const apiRef = useRef(api)
		apiRef.current = api
		const contextRef = useRef(options.context)
		contextRef.current = options.context
		const validationRef = useRef<ManagedValidationOptions>({
			isSubmitted: api.formState.isSubmitted,
			mode: options.mode ?? "onSubmit",
			reValidateMode: options.reValidateMode ?? "onChange",
		})
		validationRef.current = {
			isSubmitted: api.formState.isSubmitted,
			mode: options.mode ?? "onSubmit",
			reValidateMode: options.reValidateMode ?? "onChange",
		}
		const commitRef = useRef<
			ValueTransactionCommit<FormValues<Schema>, unknown> | undefined
		>(undefined)
		if (commitRef.current === undefined) {
			commitRef.current = (transaction) => {
				commitManagedTransaction(
					apiRef.current,
					transaction,
					validationRef.current,
				)
			}
		}
		const restoreRef = useRef<
			ValueTransactionCommit<FormValues<Schema>, unknown> | undefined
		>(undefined)
		if (restoreRef.current === undefined) {
			restoreRef.current = (transaction) => {
				commitManagedRestore(apiRef.current, transaction, validationRef.current)
			}
		}
		const coordinatorRef = useRef<
			ValueCoordinator<FormValues<Schema>, unknown> | undefined
		>(undefined)
		if (coordinatorRef.current === undefined) {
			coordinatorRef.current = createValueCoordinator({
				commit: commitRef.current,
				getAfterUpdate: () => afterUpdateRef.current,
				getBeforeUpdate: () => beforeUpdateRef.current,
				getContext: () => contextRef.current,
				getValues: () => apiRef.current.getValues(),
				middleware: fixedMiddlewareRef.current,
				restore: restoreRef.current,
			})
		}
		const commit = commitRef.current
		const coordinator = coordinatorRef.current

		const binding = useMemo(() => {
			const instance: FormBinding<Schema, unknown> = {
				api,
				definition: fixedDefinition,
				context: options.context,
				update: coordinator.update,
			}
			attachValueCoordinatorCapability(instance, coordinator)
			const diagnosticTarget = getValueCoordinatorCapability(coordinator)
			const runtime = {
				...instance,
				commit,
				diagnosticTarget,
				disabled: options.disabled === true,
				dispatch: coordinator.dispatch,
				errorSummaryRef,
				formElement: null,
				inputRefs: inputRefs.current,
				onSubmit: options.onSubmit as RuntimeForm["onSubmit"],
				readOnly: options.readOnly === true,
			} as unknown as RuntimeForm
			attachFormDiagnosticsRuntime(instance, runtime)
			return {
				instance,
				runtime,
			}
		}, [
			api,
			commit,
			coordinator,
			fixedDefinition,
			options.context,
			options.disabled,
			options.onSubmit,
			options.readOnly,
		])
		runtimeForms.set(binding.instance, binding.runtime)
		return binding.instance
	}) as UseForm<
		ControlDefinitionRegistry,
		unknown,
		unknown,
		unknown,
		unknown,
		number
	>

	/** Provides the binding contexts and renders the native form element. */
	function Form<Schema extends StandardSchema>({
		form,
		children,
		id,
		...nativeProps
	}: FormProps<Schema, unknown>) {
		const generatedId = `form-please-${useId().replaceAll(":", "")}`
		const formId = id ?? generatedId
		const runtimeForm = runtimeForms.get(form)
		if (runtimeForm === undefined) {
			throw new Error("Form binding is not mounted by this form kit")
		}

		return (
			<FormProvider {...form.api}>
				<FormContext.Provider value={runtimeForm}>
					<FormIdContext.Provider value={formId}>
						<form
							{...nativeProps}
							data-disabled={booleanData(runtimeForm.disabled)}
							data-fp-node="form"
							data-readonly={booleanData(runtimeForm.readOnly)}
							id={formId}
							noValidate
							ref={(element) => {
								runtimeForm.formElement = element
							}}
							onReset={(event) => {
								event.preventDefault()
								form.api.reset()
							}}
							onSubmit={(event) => {
								event.preventDefault()
								if (runtimeForm.disabled) return
								const formElement = event.currentTarget
								const submitter = snapshotSubmitter(event.nativeEvent)
								const input = cloneFormValue(
									form.api.getValues(),
								) as FormValues<Schema>
								void form.api.handleSubmit(
									async (value) => {
										await runtimeForm.onSubmit?.({
											form: form as unknown as FormBinding,
											input,
											submitter,
											value,
										})
									},
									(errors) => {
										setTimeout(() => {
											focusErrorSummaryFallback(
												errors,
												formElement,
												runtimeForm,
											)
										}, 0)
									},
								)(event)
							}}
						>
							{children}
						</form>
					</FormIdContext.Provider>
				</FormContext.Provider>
			</FormProvider>
		)
	}

	/** Resolves and renders generated fields for the current form context. */
	function Fields({
		children,
	}: {
		/** Content rendered after the generated fields. */
		readonly children?: ReactNode
	}) {
		const form = useRuntimeForm()
		const values = useWatch({ control: form.api.control })
		return (
			<ResolvedFields
				controls={controls}
				form={form}
				slots={slots}
				values={values}
			>
				{children}
			</ResolvedFields>
		)
	}

	/** Renders the kit submit slot with live form state. */
	function Submit<Schema extends StandardSchema>(
		props: Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
			readonly binding?: FormBinding<Schema, unknown>
			readonly children?:
				| ReactNode
				| ((props: SubmitSlotProps<Schema>) => ReactNode)
		},
	) {
		const { binding, children, ...nativeProps } = props
		const runtime = useRuntimeForm()
		if (binding !== undefined && runtimeForms.get(binding) !== runtime) {
			throw new Error("Submit binding must match the surrounding Form")
		}
		const state = useFormState({ control: runtime.api.control })
		const values = useWatch({ control: runtime.api.control })
		const Slot = slots.Submit
		const renderProps: SubmitSlotProps<Schema> = {
			buttonProps: {
				...nativeProps,
				disabled:
					props.disabled === true ||
					runtime.disabled ||
					state.isValidating ||
					state.isSubmitting,
				type: "submit",
			},
			isSubmitting: state.isSubmitting,
			isDirty: state.isDirty,
			canSubmit: !state.isValidating && !state.isSubmitting,
			values: values as DeepReadonly<FormInput<Schema>>,
		}
		if (typeof children === "function") {
			return <>{children(renderProps)}</>
		}
		const slotProps = renderProps as unknown as SubmitSlotProps
		return (
			<Slot
				{...slotProps}
				buttonProps={{ ...slotProps.buttonProps, children }}
			/>
		)
	}

	/** Composes a native form, its error summary, and generated fields. */
	function AutoForm<Schema extends StandardSchema>(
		props: AutoFormProps<Schema, unknown>,
	) {
		const { children, form, ...formProps } = props
		return (
			<Form {...formProps} form={form}>
				<ErrorSummary slots={slots} />
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
		Submit,
		AutoForm,
		forContext: () => kit,
	}) as unknown as FormKit<
		ControlDefinitionRegistry,
		unknown,
		unknown,
		unknown,
		unknown,
		number
	>
	kit = result
	return result
}

/** Resolves the current definition and renders its root nodes. */
function ResolvedFields({
	form,
	controls,
	slots,
	values,
	children,
}: {
	/** Private runtime form data. */
	readonly form: RuntimeForm
	/** Controls available to resolved field nodes. */
	readonly controls: ControlDefinitionRegistry
	/** Structural components used by generated nodes. */
	readonly slots: RuntimeSlots
	/** Current React Hook Form input values. */
	readonly values: unknown
	/** Content rendered after the generated fields. */
	readonly children?: ReactNode
}) {
	const previous = useRef<ResolvedDefinition | undefined>(undefined)
	const resolutionDuration = useRef<number | undefined>(undefined)
	const resolved = useMemo(() => {
		const observed = hasFormDiagnosticSink(form.diagnosticTarget)
		const startedAt = observed ? formDiagnosticNow() : undefined
		const next = resolveDefinition(
			form.definition,
			values as FormInput<StandardSchema>,
			form.context,
			{ disabled: form.disabled, readOnly: form.readOnly },
			previous.current,
		)
		previous.current = next
		form.resolved = next
		resolutionDuration.current =
			startedAt === undefined ? undefined : formDiagnosticNow() - startedAt
		return next
	}, [form, values])
	useLayoutEffect(() => {
		if (!hasFormDiagnosticSink(form.diagnosticTarget)) return
		publishFormDiagnosticEvent(form.diagnosticTarget, {
			...(resolutionDuration.current === undefined
				? {}
				: { duration: resolutionDuration.current }),
			kind: "definition",
			resolved,
			time: formDiagnosticNow(),
		})
	}, [form, resolved])
	return (
		<>
			{resolved.ui.map((node) => (
				<MemoizedGeneratedNode
					controls={controls}
					form={form}
					key={node.id}
					node={node}
					slots={slots}
				/>
			))}
			{children}
		</>
	)
}

/** Selects and renders the component for one resolved node. */
function GeneratedNode({
	form,
	controls,
	slots,
	node,
}: {
	/** Private runtime form data. */
	readonly form: RuntimeForm
	/** Controls available to resolved field nodes. */
	readonly controls: ControlDefinitionRegistry
	/** Structural components used by this node. */
	readonly slots: RuntimeSlots
	/** The resolved node to render. */
	readonly node: ResolvedNode
}): ReactNode {
	if (!node.visible) {
		return null
	}
	switch (node.kind) {
		case "field":
			return (
				<GeneratedField
					controls={controls}
					form={form}
					node={node}
					slots={slots}
				/>
			)
		case "section": {
			const Slot = slots.Section as ComponentType<SectionSlotProps<unknown>>
			return (
				<Slot
					description={node.description}
					layoutProps={{
						"data-fp-layout": "grid",
						"data-fp-columns": node.columns,
					}}
					rootProps={structuralProps("section", node)}
					slotOptions={node.slotOptions as RuntimeSlotOptions}
					title={node.title}
				>
					{node.children.map((child) => (
						<MemoizedGeneratedNode
							controls={controls}
							form={form}
							key={child.id}
							node={child}
							slots={slots}
						/>
					))}
				</Slot>
			)
		}
		case "array":
			return (
				<GeneratedArray
					controls={controls}
					form={form}
					node={node}
					slots={slots}
				/>
			)
		case "render":
			return createElement(node.component, {
				disabled: node.disabled,
				readOnly: node.readOnly,
			})
	}
}

const MemoizedGeneratedNode = memo(GeneratedNode)

/** Connects one resolved field node to its control and structural slot. */
function GeneratedField({
	form,
	controls,
	slots,
	node,
}: {
	/** Private runtime form data. */
	readonly form: RuntimeForm
	/** Controls available to the field node. */
	readonly controls: ControlDefinitionRegistry
	/** Structural components used by the field. */
	readonly slots: RuntimeSlots
	/** The resolved field node. */
	readonly node: ResolvedFieldNode
}) {
	const path = node.path
	const inputId = createDomId(useFormId(), path)
	const descriptionId =
		node.description === undefined ? undefined : `${inputId}-description`
	const Slot = slots.Field as ComponentType<FieldSlotProps<unknown>>
	const { field, fieldState, formState } = useController({
		control: form.api.control,
		name: path,
	})
	const dirty = fieldState.isDirty
	const touched = fieldState.isTouched
	const validating = fieldState.isValidating
	const showErrors = touched || formState.submitCount > 0
	const { displayErrors, errorIds, errors } = useGeneratedIssues(
		fieldState.error,
		path,
		inputId,
		showErrors,
	)
	const describedBy = useMemo(
		() => joinIds([descriptionId, ...errorIds]),
		[descriptionId, errorIds],
	)
	const blurRef = useRef(field.onBlur)
	blurRef.current = field.onBlur
	const blur = useRef(() => blurRef.current()).current
	const resolvedOptions = useFieldOptions(
		node.options,
		node.optionValues,
		form.context,
		{ path, target: form.diagnosticTarget },
	)
	const control = controls[String(node.control)]
	if (control === undefined || typeof control.component !== "function") {
		throw new TypeError(`Unknown control "${String(node.control)}"`)
	}
	const Control = control.component as ComponentType<
		ControlProps<unknown, unknown, unknown> & {
			readonly options?: readonly unknown[]
		}
	>
	const { ref: fieldRef, value } = field

	return useMemo(
		() => (
			<Slot
				control={
					<Control
						props={node.props ?? {}}
						context={form.context}
						disabled={node.disabled}
						input={{
							id: inputId,
							name: path,
							ref(element) {
								fieldRef(element)
								if (element === null) {
									form.inputRefs.delete(path)
								} else {
									form.inputRefs.set(path, element)
								}
							},
							...(describedBy === undefined
								? {}
								: { "aria-describedby": describedBy }),
						}}
						meta={{
							dirty,
							touched,
							validating,
							errors,
							displayErrors,
							invalid: displayErrors.length > 0,
						}}
						{...(node.options === undefined
							? {}
							: { options: resolvedOptions })}
						path={path}
						readOnly={node.readOnly}
						required={node.required === true}
						value={value}
						blur={blur}
						setValue={(nextValue) =>
							form.dispatch((draft) => set(draft, path, nextValue), {
								path,
								type: "control",
							})
						}
					/>
				}
				description={node.description}
				descriptionProps={
					descriptionId === undefined ? {} : { id: descriptionId }
				}
				disabled={node.disabled}
				errors={renderErrors(displayErrors, errorIds, slots, path)}
				label={node.label}
				labelProps={{ htmlFor: inputId, id: `${inputId}-label` }}
				readOnly={node.readOnly}
				required={node.required === true}
				rootProps={structuralProps("field", {
					...node,
					path,
					invalid: displayErrors.length > 0,
					dirty,
					touched,
					validating,
				})}
				slotOptions={node.slotOptions as RuntimeSlotOptions}
			/>
		),
		[
			Control,
			Slot,
			blur,
			describedBy,
			descriptionId,
			dirty,
			displayErrors,
			errorIds,
			errors,
			fieldRef,
			form,
			inputId,
			node,
			path,
			resolvedOptions,
			slots,
			touched,
			validating,
			value,
		],
	)
}

/** Connects one resolved array node to React Hook Form array operations. */
function GeneratedArray({
	form,
	controls,
	slots,
	node,
}: {
	/** Private runtime form data. */
	readonly form: RuntimeForm
	/** Controls available to nested field nodes. */
	readonly controls: ControlDefinitionRegistry
	/** Structural components used by the array. */
	readonly slots: RuntimeSlots
	/** The resolved array node. */
	readonly node: ResolvedArrayNode
}) {
	const path = node.path
	getMutableArrayValue(form.api.getValues(), path)
	const arrayId = createDomId(useFormId(), path)
	const Slot = slots.Array as ComponentType<ArraySlotProps<unknown>>
	const Item = slots.ArrayItem
	const { append, fields, move, remove } = useFieldArray({
		control: form.api.control,
		name: path,
	})
	const previousFieldIds = useRef<readonly string[] | undefined>(undefined)
	const fieldIds = useMemo(() => {
		const next = fields.map((field) => field.id)
		const previous = previousFieldIds.current
		const result =
			previous !== undefined &&
			previous.length === next.length &&
			next.every((id, index) => id === previous[index])
				? previous
				: next
		previousFieldIds.current = result
		return result
	}, [fields])
	const formState = useFormState({ control: form.api.control, name: path })
	const fieldState = form.api.getFieldState(path, formState)
	const dirty = fieldState.isDirty
	const touched = fieldState.isTouched
	const validating = fieldState.isValidating
	const showErrors = touched || formState.submitCount > 0
	const { displayErrors, errorIds } = useGeneratedIssues(
		fieldState.error,
		path,
		arrayId,
		showErrors,
	)
	const canAdd = !node.disabled && !node.readOnly
	return useMemo(
		() => (
			<Slot
				add={() => {
					if (!canAdd) return
					const item = cloneItemDefault(node.itemDefault)
					const index = fieldIds.length
					dispatchArrayAction(
						form,
						path,
						(draftItems) => {
							draftItems.push(item)
						},
						{ action: "append", index, path, type: "array" },
						(transaction) => {
							append(getMutableArrayValue(transaction.nextValues, path)[index])
						},
					)
				}}
				canAdd={canAdd}
				description={node.description}
				descriptionProps={{ id: `${arrayId}-description` }}
				errors={renderErrors(displayErrors, errorIds, slots, path)}
				invalid={displayErrors.length > 0}
				label={node.label}
				labelProps={{ id: `${arrayId}-label` }}
				rootProps={structuralProps("array", {
					...node,
					id: arrayId,
					path,
					invalid: displayErrors.length > 0,
					dirty,
					touched,
					validating,
				})}
				slotOptions={node.slotOptions as RuntimeSlotOptions}
			>
				{fieldIds.map((fieldId, index) => (
					<Item
						canMoveDown={canAdd && index < fieldIds.length - 1}
						canMoveUp={canAdd && index > 0}
						disabled={node.disabled}
						index={index}
						key={fieldId}
						move={(toIndex) => {
							if (
								canAdd &&
								Number.isSafeInteger(toIndex) &&
								toIndex >= 0 &&
								toIndex < fieldIds.length
							) {
								dispatchArrayAction(
									form,
									path,
									(draftItems) => {
										const [item] = draftItems.splice(index, 1)
										draftItems.splice(toIndex, 0, item)
									},
									{
										action: "move",
										fromIndex: index,
										path,
										toIndex,
										type: "array",
									},
									() => move(index, toIndex),
								)
							}
						}}
						readOnly={node.readOnly}
						remove={() => {
							if (!canAdd) return
							dispatchArrayAction(
								form,
								path,
								(draftItems) => {
									draftItems.splice(index, 1)
								},
								{ action: "remove", index, path, type: "array" },
								() => remove(index),
							)
						}}
						rootProps={structuralProps("array-item", {
							path: `${path}.${index}`,
							disabled: node.disabled,
							readOnly: node.readOnly,
						})}
					>
						{node.itemChildren[index]?.map((child) => (
							<MemoizedGeneratedNode
								controls={controls}
								form={form}
								key={child.id}
								node={child}
								slots={slots}
							/>
						))}
					</Item>
				))}
			</Slot>
		),
		[
			Item,
			Slot,
			append,
			arrayId,
			canAdd,
			controls,
			dirty,
			displayErrors,
			errorIds,
			fieldIds,
			form,
			move,
			node,
			path,
			remove,
			slots,
			touched,
			validating,
		],
	)
}

/** Keeps generated issue props stable while their field state is unchanged. */
function useGeneratedIssues(
	error: FieldError | undefined,
	path: string,
	id: string,
	showErrors: boolean,
): {
	readonly errors: readonly FormIssue[]
	readonly displayErrors: readonly FormIssue[]
	readonly errorIds: readonly string[]
} {
	const errors = useMemo(() => fieldErrorToIssues(error, path), [error, path])
	const displayErrors = useMemo(
		() => (showErrors ? errors : []),
		[errors, showErrors],
	)
	const errorIds = useMemo(
		() => displayErrors.map((_issue, index) => `${id}-error-${index}`),
		[displayErrors, id],
	)
	return { errors, displayErrors, errorIds }
}

/** Renders issues that cannot be focused through a generated enabled input. */
function ErrorSummary({
	slots,
}: {
	/** Structural components used for issue messages. */
	readonly slots: RuntimeSlots
}) {
	const form = useRuntimeForm()
	const formId = useFormId()
	const state = useFormState({ control: form.api.control })
	const Slot = slots.ErrorMessage
	if (state.submitCount === 0) return null

	const summaryIssues = fieldErrorsToIssues(state.errors).filter((issue) => {
		if (issue.path === "root" || issue.path?.startsWith("root.")) return true
		const input =
			issue.path === undefined ? undefined : form.inputRefs.get(issue.path)
		return input === undefined || input.matches(":disabled")
	})
	return summaryIssues.map((issue, index) => (
		<Slot
			issue={issue}
			key={`${issue.path ?? "form"}:${issue.message}`}
			rootProps={{
				...errorProps(`${formId}-summary-error-${index}`, issue.path),
				...(index === 0
					? {
							ref(element: HTMLElement | null) {
								form.errorSummaryRef.current = element
							},
							tabIndex: -1,
						}
					: {}),
			}}
		/>
	))
}

/** Renders field issues through the configured error-message slot. */
function renderErrors(
	issues: readonly FormIssue[],
	ids: readonly string[],
	slots: RuntimeSlots,
	path: string,
): readonly ReactNode[] {
	const Slot = slots.ErrorMessage
	return issues.map((issue, index) => (
		<Slot
			issue={issue}
			key={`${path}:${issue.message}`}
			rootProps={errorProps(ids[index] ?? `${path}-error-${index}`, path)}
		/>
	))
}

/** Creates an independent value from an array node item default. */
function cloneItemDefault(value: unknown): unknown {
	const candidate = typeof value === "function" ? value() : value
	return cloneFormValue(candidate)
}

/** Runs a generated array proposal before preserving its native row operation. */
function dispatchArrayAction(
	form: RuntimeForm,
	path: string,
	recipe: (items: unknown[]) => void,
	source: Extract<ValueTransactionSource<FieldValues>, { type: "array" }>,
	commitArray: (transaction: ValueTransaction<FieldValues, unknown>) => void,
): unknown {
	const arrayPath = fieldPathSegments(form.api.getValues(), path)
	return form.dispatch(
		(draft) => recipe(getMutableArrayValue(draft, path)),
		source,
		{
			arrayPath,
			commit: (transaction) => {
				commitArray(transaction)
				form.commit(transaction)
			},
		},
	)
}

/** Reads an array value at an RHF path or reports a malformed form value. */
function getMutableArrayValue(values: unknown, path: string): unknown[] {
	const value = get(values, path)
	if (!Array.isArray(value)) {
		throw new TypeError(`Generated array path "${path}" must contain an array`)
	}
	return value
}

/** Converts an RHF dot path to Immer segments using numeric array indices. */
function fieldPathSegments(
	values: unknown,
	path: string,
): readonly (string | number)[] {
	let current = values
	return path.split(".").map((segment) => {
		const key =
			Array.isArray(current) && /^(0|[1-9]\d*)$/.test(segment)
				? Number(segment)
				: segment
		current =
			current !== null && typeof current === "object"
				? (current as Record<string | number, unknown>)[key]
				: undefined
		return key
	})
}

/** Publishes one managed value transaction and schedules change validation. */
function commitManagedTransaction<Input extends FieldValues, Context, Output>(
	api: UseFormReturn<Input, Context, Output>,
	transaction: ValueTransaction<Input, Context>,
	validation: ManagedValidationOptions,
): void {
	if (transaction.patches.length === 0) return
	api.setValues(topLevelUpdates(transaction), { shouldDirty: true })
	if (!shouldValidateManagedTransaction(api, transaction, validation)) return
	const paths = patchedFieldPaths(transaction.patches)
	void api.trigger(
		paths === undefined || paths.length === 0
			? undefined
			: (paths as Parameters<typeof api.trigger>[0]),
	)
}

/** Restores complete values while retaining RHF state outside value history. */
function commitManagedRestore<Input extends FieldValues, Context, Output>(
	api: UseFormReturn<Input, Context, Output>,
	transaction: ValueTransaction<Input, Context>,
	validation: ManagedValidationOptions,
): void {
	if (transaction.source.type === "persistence") {
		api.reset(cloneFormValue(transaction.nextValues) as Input, {
			keepDefaultValues: true,
		})
		return
	}
	api.reset(cloneFormValue(transaction.nextValues) as Input, {
		keepDefaultValues: true,
		keepErrors: true,
		keepIsSubmitted: true,
		keepIsSubmitSuccessful: true,
		keepIsValid: true,
		keepSubmitCount: true,
		keepTouched: true,
	})
	if (!shouldValidateManagedTransaction(api, transaction, validation)) return
	void api.trigger()
}

/** Selects complete changed roots because RHF `setValues` shallow-merges them. */
function topLevelUpdates<Input extends FieldValues, Context>(
	transaction: ValueTransaction<Input, Context>,
): Partial<Input> {
	if (transaction.patches.some((patch) => patch.path.length === 0)) {
		return transaction.nextValues as Partial<Input>
	}
	const updates: FieldValues = {}
	const nextValues = transaction.nextValues as FieldValues
	for (const patch of transaction.patches) {
		const root = patch.path[0]
		if (root !== undefined) updates[String(root)] = nextValues[String(root)]
	}
	return updates as Partial<Input>
}

/** Mirrors RHF change validation modes for managed value proposals. */
function shouldValidateManagedTransaction<
	Input extends FieldValues,
	Context,
	Output,
>(
	api: UseFormReturn<Input, Context, Output>,
	transaction: ValueTransaction<Input, Context>,
	validation: ManagedValidationOptions,
): boolean {
	if (validation.isSubmitted) {
		return validation.reValidateMode === "onChange"
	}
	if (validation.mode === "all" || validation.mode === "onChange") return true
	if (validation.mode !== "onTouched") return false
	const paths = patchedFieldPaths(transaction.patches)
	if (paths === undefined && hasTouchedField(api.formState.touchedFields)) {
		return true
	}
	const sourcePath =
		transaction.source.type === "control" || transaction.source.type === "array"
			? String(transaction.source.path)
			: undefined
	const touchedPaths = new Set(paths ?? [])
	if (sourcePath !== undefined) touchedPaths.add(sourcePath)
	return [...touchedPaths].some(
		(path) =>
			api.getFieldState(path as Parameters<typeof api.getFieldState>[0])
				.isTouched,
	)
}

/** Tests whether an RHF touched-field tree contains one touched leaf. */
function hasTouchedField(value: unknown): boolean {
	if (value === true) return true
	if (value === null || typeof value !== "object") return false
	return Object.values(value).some(hasTouchedField)
}

/** Converts Immer patch paths to deduplicated RHF paths for one trigger call. */
function patchedFieldPaths(
	patches: readonly ValuePatch[],
): readonly string[] | undefined {
	if (patches.some((patch) => patch.path.length === 0)) return undefined
	return [
		...new Set(
			patches.map((patch) =>
				patch.path.map((segment) => String(segment)).join("."),
			),
		),
	]
}

/** Focuses the summary when React Hook Form did not focus an invalid input. */
function focusErrorSummaryFallback(
	errors: FieldErrors<FieldValues>,
	formElement: HTMLFormElement,
	form: RuntimeForm,
): void {
	const activeElement = formElement.ownerDocument.activeElement
	if (activeElement instanceof HTMLElement) {
		for (const [path, input] of form.inputRefs) {
			if (
				(activeElement === input || input.contains(activeElement)) &&
				hasFieldError(errors, path)
			) {
				publishFocusDiagnostic(form, "field", path)
				return
			}
		}
		const fieldName = activeElement.getAttribute("name")
		if (fieldName !== null && hasFieldError(errors, fieldName)) {
			publishFocusDiagnostic(form, "field", fieldName)
			return
		}
		if (activeElement === form.errorSummaryRef.current) {
			publishFocusDiagnostic(form, "summary")
			return
		}
	}
	const summary = form.errorSummaryRef.current
	if (summary === null) {
		publishFocusDiagnostic(form, "unavailable")
		return
	}
	summary.focus()
	publishFocusDiagnostic(form, "summary")
}

/** Publishes the observed invalid-submit focus destination when requested. */
function publishFocusDiagnostic(
	form: RuntimeForm,
	target: "field" | "summary" | "unavailable",
	path?: string,
): void {
	if (!hasFormDiagnosticSink(form.diagnosticTarget)) return
	publishFormDiagnosticEvent(form.diagnosticTarget, {
		kind: "focus",
		...(path === undefined ? {} : { path }),
		target,
		time: formDiagnosticNow(),
	})
}

/** Tests whether a value can serve as React Hook Form field values. */
function isFieldValues(value: unknown): value is FieldValues {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}

/** Reads private form data from the current generated form context. */
function useRuntimeForm(): RuntimeForm {
	const form = useContext(FormContext)
	if (form === null) {
		throw new Error("React Hook Form context is missing")
	}
	return form
}

/** Reads the native form ID from the current generated form context. */
function useFormId(): string {
	const id = useContext(FormIdContext)
	if (id === null) {
		throw new Error("React Hook Form id context is missing")
	}
	return id
}

/** Creates a DOM-safe ID for an input path within a form. */
function createDomId(prefix: string, value: string): string {
	return `${prefix}-${encodeURIComponent(value).replaceAll(".", "%2E")}`
}

function snapshotSubmitter(
	event: Event,
): FormSubmitDetails<AnyFormSchema>["submitter"] {
	if (!("submitter" in event)) return null
	const { submitter } = event
	if (
		typeof submitter !== "object" ||
		submitter === null ||
		!("name" in submitter) ||
		typeof submitter.name !== "string" ||
		!("value" in submitter) ||
		typeof submitter.value !== "string"
	) {
		return null
	}
	return Object.freeze({ name: submitter.name, value: submitter.value })
}

/** Converts resolved node state to structural DOM props and data attributes. */
function structuralProps(
	kind: StructuralNodeName,
	value: Readonly<Record<string, unknown>>,
): StructuralRootProps {
	const props = {
		"data-fp-node": kind,
		...(typeof value.id === "string" ? { id: value.id } : {}),
		...(typeof value.path === "string" ? { "data-fp-path": value.path } : {}),
		...(typeof value.className === "string"
			? { className: value.className }
			: {}),
		...(value.span === undefined ? {} : { "data-fp-span": String(value.span) }),
		"data-invalid": booleanData(value.invalid === true),
		"data-dirty": booleanData(value.dirty === true),
		"data-disabled": booleanData(value.disabled === true),
		"data-readonly": booleanData(value.readOnly === true),
		"data-required": booleanData(value.required === true),
		"data-touched": booleanData(value.touched === true),
		"data-validating": booleanData(value.validating === true),
	}
	return props as StructuralRootProps
}

/** Creates structural DOM props for one validation message. */
function errorProps(id: string, path?: string): StructuralRootProps {
	return {
		"data-fp-node": "error-message",
		...(path === undefined ? {} : { "data-fp-path": path }),
		id,
	}
}

/** Converts boolean state to a presence-only data attribute value. */
function booleanData(value: boolean): "" | undefined {
	return value ? "" : undefined
}

/** Joins defined accessibility IDs into one attribute value. */
function joinIds(values: readonly (string | undefined)[]): string | undefined {
	const joined = values.filter((value) => value !== undefined).join(" ")
	return joined.length === 0 ? undefined : joined
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
			throw new TypeError(`createFormKit requires a ${key} slot`)
		}
	}
}
