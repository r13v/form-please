"use client"

import {
	type ComponentPropsWithoutRef,
	type ComponentType,
	createContext,
	createElement,
	type KeyboardEvent,
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
	type FormArray,
	reconcileGeneratedArray,
	registerGeneratedArray,
} from "./array-reconcile.js"
import {
	createFormFragment,
	hasWhenHidden,
	normalizeDefinition,
	normalizeGrid,
	type ResolvedArrayNode,
	type ResolvedDefinition,
	type ResolvedFieldNode,
	type ResolvedNode,
	readErrorDisplay,
	resolveDefinition,
	resolveHiddenFieldWrites,
} from "./definition.js"
import {
	formDiagnosticNow,
	hasFormDiagnosticSink,
	publishFormDiagnosticEvent,
} from "./diagnostics.js"
import { createFormIssueStore, type FormIssueStore } from "./form-issues.js"
import { cloneFormValue } from "./form-value.js"
import {
	cloneItemDefault,
	fieldPathSegments,
	getMutableArrayValue,
} from "./generated-array.js"
import {
	createStandardSchemaResolver,
	fieldErrorsToIssues,
	fieldErrorToIssues,
	hasFieldError,
} from "./standard-schema-resolver.js"
import type {
	ArrayFieldPath,
	ArraySlotProps,
	ControlDefinitionRegistry,
	ControlProps,
	DeepReadonly,
	ErrorDisplay,
	FieldPath,
	FieldSlotProps,
	FormDefinition,
	FormDefinitionBuilder,
	FormDefinitionSource,
	FormDefinitionUpdatePolicy,
	FormFragment,
	FormInput,
	FormIssue,
	FormKitSlots,
	FormOutput,
	FormPleaseStyle,
	PathValue,
	SectionSlotProps,
	StandardSchema,
	StructuralNodeName,
	StructuralRootProps,
	SubmitSlotProps,
} from "./types.js"
import { useFieldOptions } from "./use-field-options.js"
import { useSnapshot } from "./use-snapshot.js"
import {
	attachValueCoordinatorCapability,
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

/** An issue that application code reports for a typed input path. */
export type FormIssueInput<Schema extends StandardSchema> = {
	/** The user-facing message. */
	readonly message: string
	/** The input path that the issue selects, or none for a form issue. */
	readonly path?: FieldPath<FormInput<Schema>>
}

/** Values supplied to the validator of one submit action. */
export type FormActionValidateDetails<Schema extends StandardSchema> = {
	/** The validated and possibly transformed schema output. */
	readonly value: FormOutput<Schema>
	/** The editable input snapshot used for this submission. */
	readonly input: FormInput<Schema>
}

/** The validator and handler of one submit action. */
export type FormActionConfig<
	Schema extends StandardSchema,
	Context = unknown,
> = {
	/** Whether Enter in a single-line field runs this action. */
	readonly implicit?: boolean
	/** Returns action issues after successful schema validation. */
	readonly validate?: (
		details: FormActionValidateDetails<Schema>,
	) =>
		| readonly FormIssueInput<Schema>[]
		| Promise<readonly FormIssueInput<Schema>[]>
	/** Handles a submission that passed schema and action validation. */
	readonly onSubmit: (
		details: FormSubmitDetails<Schema, Context>,
	) => unknown | Promise<unknown>
}

/** Named submit actions configured for one form. */
export type FormActionsConfig<
	Schema extends StandardSchema,
	Context = unknown,
> = Readonly<Record<string, FormActionConfig<Schema, Context>>>

/** A submit action bound to the form that created it. */
export type FormAction<
	Schema extends StandardSchema = AnyFormSchema,
	Context = unknown,
	Name extends string = string,
> = {
	/** The configured action name. */
	readonly name: Name
	/** The form binding that owns this action. */
	readonly form: FormBinding<Schema, Context, Name>
}

/** The live submission state of one form. */
export type FormSubmissionSnapshot<Name extends string = string> = {
	/** The name of the running action, or null when no action runs. */
	readonly action: Name | null
}

/** An external store with the live submission state of one form. */
export type FormSubmission<Name extends string = string> = {
	/** Returns the current immutable submission snapshot. */
	getSnapshot(): FormSubmissionSnapshot<Name>
	/** Calls the listener after the submission snapshot changes. */
	subscribe(listener: () => void): () => void
}

/** Options for replacing external issues. */
export type SetIssuesOptions<Schema extends StandardSchema> = {
	/** A field to focus, or true to focus the first available invalid field. */
	readonly focus?: FieldPath<FormInput<Schema>> | true
}

/** Options shared by every `useForm` configuration. */
type BaseUseFormOptions<
	Schema extends StandardSchema,
	Context = unknown,
> = ContextOption<Context> & {
	/** Initial editable values, fixed for the hook lifetime. */
	readonly defaultValues: FormInput<Schema>
	/** Milliseconds to delay the display of validation errors. */
	readonly delayError?: number
	/** Whether all generated controls reject user interaction. */
	readonly disabled?: boolean
	/** Overrides the kit error display for this form. */
	readonly errorDisplay?: ErrorDisplay
	/** The React Hook Form validation mode. */
	readonly mode?: Mode
	/** Whether all generated controls prevent value changes. */
	readonly readOnly?: boolean
	/** The validation mode used after the first submit attempt. */
	readonly reValidateMode?: Exclude<Mode, "all" | "onTouched">
}

/** Configuration used to bind a definition to React Hook Form. */
export type UseFormOptions<
	Schema extends StandardSchema,
	Context = unknown,
	Actions extends FormActionsConfig<Schema, Context> = FormActionsConfig<
		Schema,
		Context
	>,
> = BaseUseFormOptions<Schema, Context> &
	(
		| {
				/** Handles successful validation as the implicit `submit` action. */
				readonly onSubmit?: (
					details: FormSubmitDetails<Schema, Context>,
				) => unknown | Promise<unknown>
				readonly actions?: undefined
		  }
		| {
				/** Named submit actions; the form has no `submit` shorthand action. */
				readonly actions: Actions
				readonly onSubmit?: undefined
		  }
	)

/** Optional managed-update policy supplied while defining one form. */
export type DefineFormOptions<
	Schema extends StandardSchema,
	Context = unknown,
> = Omit<FormDefinitionUpdatePolicy<Schema, Context>, "middleware"> & {
	/** Ordered value middleware initialized separately for each form binding. */
	readonly middleware?: readonly FormMiddleware<FormValues<Schema>, Context>[]
}

/** A form definition bound to a React Hook Form instance and runtime context. */
export type FormBinding<
	Schema extends StandardSchema = AnyFormSchema,
	Context = unknown,
	Actions extends string = string,
> = {
	/** The unchanged typed React Hook Form API. */
	readonly api: NativeApi<Schema, Context>
	/** The normalized definition fixed for this binding. */
	readonly definition: FormDefinition<
		Schema,
		ControlDefinitionRegistry,
		Context
	> &
		FormDefinitionUpdatePolicy<Schema, Context>
	/** Application data available to resolvers and controls. */
	readonly context: Context
	/** Atomically applies one managed value recipe through middleware. */
	update(recipe: FormUpdateRecipe<FormValues<Schema>>): unknown
	/** Submit actions with stable identity for `kit.Submit`. */
	readonly actions: {
		readonly [Name in Actions]: FormAction<Schema, Context, Name>
	}
	/** The live submission state, readable with `useSnapshot`. */
	readonly submission: FormSubmission<Actions>
	/** Replaces the external issues and optionally moves focus. */
	setIssues(
		issues: readonly FormIssueInput<Schema>[],
		options?: SetIssuesOptions<Schema>,
	): void
	/** Selects a mounted generated array for managed row reconciliation. */
	array<Path extends ArrayFieldPath<FormValues<Schema>>>(
		path: Path,
	): FormArray<
		PathValue<
			FormValues<Schema>,
			Extract<Path, FieldPath<FormValues<Schema>>>
		> extends readonly (infer Item)[]
			? Item
			: never
	>
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
	/** The error display used by nodes without their own value. */
	readonly errorDisplay: ErrorDisplay
	/** Focusable generated inputs indexed by absolute path. */
	readonly inputRefs: Map<string, HTMLElement>
	/** The first summary issue used as a focus fallback. */
	readonly errorSummaryRef: RefObject<HTMLElement | null>
	/** The mounted native form element, when one exists. */
	formElement: HTMLFormElement | null
	/** Action and external issues stored beside schema errors. */
	readonly issues: FormIssueStore
	/** The live submission state. */
	readonly submission: FormSubmission
	/** The action that `kit.Submit` without an action runs, when one exists. */
	readonly defaultAction: string | undefined
	/** The action that Enter in a single-line field runs, when one exists. */
	readonly implicitAction: string | undefined
	/** Runs one action unless another submission is pending. */
	readonly submitAction: (
		name: string,
		submitter: FormSubmitDetails<AnyFormSchema>["submitter"],
		formElement: HTMLFormElement,
	) => Promise<void>
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
	options?: DefineFormOptions<Schema, Context>,
) => FormDefinition<
	Schema,
	Controls,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid,
	FormDefinitionUpdatePolicy<Schema, Context>
>

/** The typed `useForm` hook exposed by a form kit. */
type UseForm<
	Controls extends ControlDefinitionRegistry,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Context,
	Grid extends number,
> = {
	<Schema extends StandardSchema>(
		definition: FormDefinition<
			Schema,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid,
			FormDefinitionUpdatePolicy<Schema, Context>
		>,
		options: UseFormOptions<Schema, Context> & { readonly actions?: undefined },
	): FormBinding<Schema, Context, "submit">
	<
		Schema extends StandardSchema,
		const Actions extends FormActionsConfig<Schema, Context>,
	>(
		definition: FormDefinition<
			Schema,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid,
			FormDefinitionUpdatePolicy<Schema, Context>
		>,
		options: UseFormOptions<Schema, Context, Actions> & {
			readonly actions: Actions
		},
	): FormBinding<Schema, Context, Extract<keyof Actions, string>>
}

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
		/** Renders static content for an action or the `submit` shorthand action. */
		<Schema extends StandardSchema>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type"> & {
				/** The action that this button runs. */
				readonly action?: FormAction<Schema, Context>
			},
		): ReactElement
		/** Renders custom content with live state typed by the action form. */
		<Schema extends StandardSchema>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
				/** The action that this button runs. */
				readonly action: FormAction<Schema, Context>
				/** Renders custom content from live typed submit state. */
				readonly children: (props: SubmitSlotProps<Schema>) => ReactNode
			},
		): ReactElement
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
	/** How many validation messages each field and array shows. Defaults to `"all"`. */
	readonly errorDisplay?: ErrorDisplay
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
	const errorDisplay =
		readErrorDisplay(options.errorDisplay, "createFormKit") ?? "all"

	return assembleKit(
		controls,
		slots as unknown as RuntimeSlots,
		grid,
		errorDisplay,
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
	kitErrorDisplay: ErrorDisplay,
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
	}) as DefineForm<
		ControlDefinitionRegistry,
		unknown,
		unknown,
		unknown,
		unknown,
		number
	>

	const useForm = (<Schema extends StandardSchema>(
		definition: FormDefinition<Schema> &
			FormDefinitionUpdatePolicy<Schema, unknown>,
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
		const inputRefs = useRef(new Map<string, HTMLElement>())
		const errorSummaryRef = useRef<HTMLElement | null>(null)
		const optionsRef = useRef(options)
		optionsRef.current = options
		const issuesRef = useRef<FormIssueStore | undefined>(undefined)
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
				(values) => issuesRef.current?.current(values) ?? [],
			),
			shouldFocusError: true,
			shouldUnregister: false,
		})
		const apiRef = useRef(api)
		apiRef.current = api
		const contextRef = useRef(options.context)
		contextRef.current = options.context
		const validation: ManagedValidationOptions = {
			isSubmitted: api.formState.isSubmitted,
			mode: options.mode ?? "onSubmit",
			reValidateMode: options.reValidateMode ?? "onChange",
		}
		const validationRef = useRef(validation)
		validationRef.current = validation
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
				afterUpdate: fixedDefinition.afterUpdate,
				beforeUpdate: fixedDefinition.beforeUpdate,
				commit: commitRef.current,
				getContext: () => contextRef.current,
				getValues: () => apiRef.current.getValues(),
				middleware: fixedDefinition.middleware,
				resolveHiddenFieldWrites: hasWhenHidden(fixedDefinition)
					? (transaction) =>
							resolveHiddenFieldWrites(
								fixedDefinition,
								transaction,
								fixedDefaultValues,
							)
					: undefined,
				restore: restoreRef.current,
			})
		}
		const commit = commitRef.current
		const coordinator = coordinatorRef.current
		const bindingRef = useRef<FormBinding<Schema, unknown> | undefined>(
			undefined,
		)
		const runtimeRef = useRef<RuntimeForm | undefined>(undefined)
		const submissionRef = useRef<FormSubmissionRuntime | undefined>(undefined)
		if (submissionRef.current === undefined) {
			const issues = createFormIssueStore(
				() =>
					apiRef.current as unknown as UseFormReturn<
						FieldValues,
						unknown,
						unknown
					>,
			)
			issuesRef.current = issues
			submissionRef.current = createFormSubmissionRuntime({
				issues,
				options: options as UseFormOptions<AnyFormSchema>,
				getBinding: () => bindingRef.current as unknown as FormBinding,
				getOptions: () => optionsRef.current as UseFormOptions<AnyFormSchema>,
				getRuntime: () => runtimeRef.current as RuntimeForm,
			})
		}
		const submission = submissionRef.current
		useLayoutEffect(
			() =>
				api.subscribe({
					formState: { values: true },
					callback: () => {
						submission.issues.clearChanged(apiRef.current.getValues())
					},
				}),
			[api, submission],
		)

		const binding = useMemo(() => {
			const instance: FormBinding<Schema, unknown> = {
				api,
				definition: fixedDefinition,
				context: options.context,
				update: coordinator.update,
				actions: submission.actions as unknown as FormBinding<
					Schema,
					unknown
				>["actions"],
				submission: submission.store,
				setIssues: submission.setIssues as FormBinding<
					Schema,
					unknown
				>["setIssues"],
				array: (path) => ({
					reconcile: (keys, options) =>
						reconcileGeneratedArray(
							runtimeForms.get(instance) as RuntimeForm,
							path,
							keys,
							options as unknown as Parameters<
								typeof reconcileGeneratedArray
							>[3],
						),
				}),
			}
			attachValueCoordinatorCapability(instance, coordinator)
			const diagnosticTarget = getValueCoordinatorCapability(coordinator)
			const runtime = {
				...instance,
				commit,
				diagnosticTarget,
				disabled: options.disabled === true,
				dispatch: coordinator.dispatch,
				errorDisplay:
					readErrorDisplay(options.errorDisplay, "useForm") ?? kitErrorDisplay,
				errorSummaryRef,
				formElement: null,
				defaultAction: submission.defaultAction,
				implicitAction: submission.implicitAction,
				inputRefs: inputRefs.current,
				issues: submission.issues,
				readOnly: options.readOnly === true,
				submission: submission.store,
				submitAction: submission.submitAction,
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
			options.errorDisplay,
			options.readOnly,
			submission,
		])
		bindingRef.current = binding.instance
		runtimeRef.current = binding.runtime
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
							onKeyDown={(event) => {
								nativeProps.onKeyDown?.(event)
								// The onSubmit shorthand keeps native implicit submission and its submitter.
								if (runtimeForm.defaultAction !== undefined) return
								if (!isImplicitSubmitKey(event)) return
								event.preventDefault()
								const name = runtimeForm.implicitAction
								if (runtimeForm.disabled || name === undefined) return
								void runtimeForm.submitAction(name, null, event.currentTarget)
							}}
							onReset={(event) => {
								event.preventDefault()
								runtimeForm.issues.forget()
								form.api.reset()
							}}
							onSubmit={(event) => {
								event.preventDefault()
								if (runtimeForm.disabled) return
								const name =
									submitterAction(event.nativeEvent) ??
									runtimeForm.implicitAction
								if (name === undefined) return
								void runtimeForm.submitAction(
									name,
									snapshotSubmitter(event.nativeEvent),
									event.currentTarget,
								)
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
			readonly action?: FormAction<Schema, unknown>
			readonly binding?: FormBinding<Schema, unknown>
			readonly children?:
				| ReactNode
				| ((props: SubmitSlotProps<Schema>) => ReactNode)
		},
	) {
		const { action, binding, children, ...nativeProps } = props
		const runtime = useRuntimeForm()
		if (binding !== undefined && runtimeForms.get(binding) !== runtime) {
			throw new Error("Submit binding must match the surrounding Form")
		}
		if (action !== undefined && runtimeForms.get(action.form) !== runtime) {
			throw new Error("Submit action must belong to the surrounding Form")
		}
		const actionName = action?.name ?? runtime.defaultAction
		if (actionName === undefined) {
			throw new Error(
				"Submit requires an action when useForm configures actions",
			)
		}
		const isPending = useSnapshot(runtime.submission).action !== null
		const state = useFormState({ control: runtime.api.control })
		const values = useWatch({ control: runtime.api.control })
		const Slot = slots.Submit
		const renderProps: SubmitSlotProps<Schema> = {
			buttonProps: {
				...nativeProps,
				"data-fp-action": actionName,
				disabled:
					props.disabled === true ||
					runtime.disabled ||
					isPending ||
					state.isValidating ||
					state.isSubmitting,
				type: "submit",
			} as SubmitSlotProps<Schema>["buttonProps"],
			isPending,
			isSubmitting: state.isSubmitting,
			isDirty: state.isDirty,
			canSubmit: !isPending && !state.isValidating && !state.isSubmitting,
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
	const showErrors =
		touched || formState.submitCount > 0 || form.issues.has(path)
	const { displayErrors, errorIds, errors } = useGeneratedIssues(
		fieldState.error,
		path,
		inputId,
		showErrors,
		node.errorDisplay ?? form.errorDisplay,
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
	useLayoutEffect(
		() =>
			registerGeneratedArray(form.api.control, path, { append, move, remove }),
		[form.api.control, path, append, move, remove],
	)
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
	const showErrors =
		touched || formState.submitCount > 0 || form.issues.has(path)
	const { displayErrors, errorIds } = useGeneratedIssues(
		fieldState.error,
		path,
		arrayId,
		showErrors,
		node.errorDisplay ?? form.errorDisplay,
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
	errorDisplay: ErrorDisplay,
): {
	readonly errors: readonly FormIssue[]
	readonly displayErrors: readonly FormIssue[]
	readonly errorIds: readonly string[]
} {
	const errors = useMemo(() => fieldErrorToIssues(error, path), [error, path])
	const displayErrors = useMemo(() => {
		if (!showErrors) return []
		return errorDisplay === "first" ? errors.slice(0, 1) : errors
	}, [errorDisplay, errors, showErrors])
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
	if (state.submitCount === 0 && form.issues.list().length === 0) return null

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
			rootProps={errorProps(ids[index], path)}
		/>
	))
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

/** Private submission state shared by one binding and its runtime form. */
type FormSubmissionRuntime = {
	readonly actions: Readonly<Record<string, FormAction>>
	readonly defaultAction: string | undefined
	readonly implicitAction: string | undefined
	readonly issues: FormIssueStore
	readonly store: FormSubmission
	readonly setIssues: FormBinding["setIssues"]
	readonly submitAction: RuntimeForm["submitAction"]
}

/** Fixes action names and creates the submission entry point of one form. */
function createFormSubmissionRuntime({
	getBinding,
	getOptions,
	getRuntime,
	issues,
	options,
}: {
	readonly getBinding: () => FormBinding
	readonly getOptions: () => UseFormOptions<AnyFormSchema>
	readonly getRuntime: () => RuntimeForm
	readonly issues: FormIssueStore
	readonly options: UseFormOptions<AnyFormSchema>
}): FormSubmissionRuntime {
	if (options.actions !== undefined && options.onSubmit !== undefined) {
		throw new TypeError("useForm accepts onSubmit or actions, not both")
	}
	const configured = options.actions
	const names = configured === undefined ? ["submit"] : Object.keys(configured)
	const implicitNames =
		configured === undefined
			? ["submit"]
			: names.filter((name) => configured[name]?.implicit === true)
	if (implicitNames.length > 1) {
		throw new TypeError("useForm accepts at most one implicit action")
	}
	const actions = Object.freeze(
		Object.fromEntries(
			names.map((name) => [
				name,
				Object.freeze({
					name,
					get form() {
						return getBinding()
					},
				}),
			]),
		),
	)

	let snapshot: FormSubmissionSnapshot = Object.freeze({ action: null })
	const listeners = new Set<() => void>()
	const publish = (action: string | null): void => {
		snapshot = Object.freeze({ action })
		for (const listener of listeners) listener()
	}
	const store: FormSubmission = {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
	}

	const readAction = (
		name: string,
	): Partial<FormActionConfig<AnyFormSchema>> => {
		const current = getOptions()
		if (current.actions === undefined) return { onSubmit: current.onSubmit }
		const action = current.actions[name]
		if (action === undefined) {
			throw new Error(`Form action "${name}" is no longer configured`)
		}
		return action
	}

	return {
		actions,
		defaultAction: configured === undefined ? "submit" : undefined,
		implicitAction: implicitNames[0],
		issues,
		store,
		setIssues(nextIssues, setOptions) {
			issues.replace("external", nextIssues as readonly FormIssue[])
			if (setOptions?.focus !== undefined) {
				focusIssue(getRuntime(), setOptions.focus)
			}
		},
		async submitAction(name, submitter, formElement) {
			if (snapshot.action !== null) return
			publish(name)
			try {
				const runtime = getRuntime()
				const action = readAction(name)
				const input = cloneFormValue(runtime.api.getValues())
				issues.replace("action", [])
				issues.replace("external", [])
				await runtime.api.handleSubmit(
					async (value) => {
						const actionIssues =
							(await action.validate?.({ input, value })) ?? []
						if (actionIssues.length > 0) {
							issues.replace("action", actionIssues as readonly FormIssue[])
							focusIssue(runtime, true)
							return
						}
						await action.onSubmit?.({
							form: getBinding(),
							input,
							submitter,
							value,
						})
					},
					(errors) => {
						setTimeout(() => {
							focusErrorSummaryFallback(errors, formElement, runtime)
						}, 0)
					},
				)()
			} finally {
				publish(null)
			}
		},
	}
}

/** Input types where Enter requests implicit submission in HTML. */
const implicitSubmitInputTypes = new Set([
	"date",
	"datetime-local",
	"email",
	"month",
	"number",
	"password",
	"search",
	"tel",
	"text",
	"time",
	"url",
	"week",
])

/** Tests whether a key event requests implicit submission from a single-line field. */
function isImplicitSubmitKey(event: KeyboardEvent<HTMLFormElement>): boolean {
	const target = event.target
	return (
		event.key === "Enter" &&
		!event.defaultPrevented &&
		!event.nativeEvent.isComposing &&
		target instanceof HTMLElement &&
		target.tagName === "INPUT" &&
		implicitSubmitInputTypes.has((target as HTMLInputElement).type)
	)
}

/** Reads the action of the `kit.Submit` button that submitted the form. */
function submitterAction(event: Event): string | undefined {
	if (!("submitter" in event)) return undefined
	const { submitter } = event
	if (!(submitter instanceof HTMLElement)) return undefined
	return submitter.getAttribute("data-fp-action") ?? undefined
}

/** Focuses an issue field after render, or the error summary when it is unavailable. */
function focusIssue(form: RuntimeForm, target: string | true): void {
	setTimeout(() => {
		const errors = form.api.formState.errors
		const paths =
			target === true
				? [...form.api.control._names.mount].filter((path) =>
						hasFieldError(errors, path),
					)
				: [target]
		for (const path of paths) {
			if (focusField(form, path)) return
		}
		form.errorSummaryRef.current?.focus()
	}, 0)
}

/** Focuses one registered field when it is enabled and visible. */
function focusField(form: RuntimeForm, path: string): boolean {
	const input = form.inputRefs.get(path)
	if (input?.matches(":disabled")) return false
	const document = form.formElement?.ownerDocument ?? globalThis.document
	const before = document.activeElement
	form.api.setFocus(path)
	const active = document.activeElement
	if (active === null || active === document.body) return false
	if (input !== undefined) return input === active || input.contains(active)
	return active !== before || active.getAttribute("name") === path
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
