import type {
	ComponentPropsWithoutRef,
	ReactElement,
	ReactNode,
	RefObject,
} from "react"
import type { FieldValues, Mode, UseFormReturn } from "react-hook-form"
import type { FormArray } from "./array-reconcile.js"
import type { ResolvedDefinition } from "./definition.js"
import type { FormIssueStore } from "./form-issues.js"
import type {
	ArrayFieldPath,
	ControlDefinitionRegistry,
	ErrorDisplay,
	FieldPath,
	FormDefinition,
	FormDefinitionBuilder,
	FormDefinitionSource,
	FormDefinitionUpdatePolicy,
	FormFragment,
	FormInput,
	FormKitSlots,
	FormOutput,
	FormPleaseStyle,
	PathValue,
	StandardSchema,
	SubmitSlotProps,
} from "./types.js"
import type {
	FormMiddleware,
	FormUpdateRecipe,
	ValueCoordinator,
	ValueTransactionCommit,
} from "./value-middleware.js"

/** Narrows schema input to the object shape required by React Hook Form. */
export type FormValues<Schema extends StandardSchema> = Extract<
	FormInput<Schema>,
	FieldValues
>
/** A schema shape used when a concrete form schema is unknown. */
export type AnyFormSchema = StandardSchema<FieldValues, unknown>

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
	/**
	 * The rejection of the last action `onSubmit`, or null. The wrapper object
	 * keeps a rejection with `undefined` or another falsy value visible. A new
	 * accepted submission and `setIssues` set it to null.
	 */
	readonly error: { readonly value: unknown } | null
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
export type RuntimeForm = {
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
	/** Forgets stored issues and the last submission error after a native reset. */
	readonly resetSubmission: () => void
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

/** Validation policy used after one managed value commit. */
export type ManagedValidationOptions = {
	/** Reads the live RHF submitted flag, which a render-time read can leave stale. */
	readonly isSubmitted: () => boolean
	readonly mode: Mode
	readonly reValidateMode: Exclude<Mode, "all" | "onTouched">
}
/** Slot options after their concrete form-kit type is erased. */
export type RuntimeSlotOptions = Readonly<unknown> | undefined
/** Form kit slots with erased application option types. */
export type RuntimeSlots = FormKitSlots<
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
export type DefineFragment<
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
export type DefineForm<
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
export type UseForm<
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
	readonly Form: <
		Schema extends StandardSchema,
		BindingContext extends Context = Context,
	>(
		props: FormProps<Schema, BindingContext>,
	) => ReactElement
	/** Renders resolved definition nodes followed by optional application content. */
	readonly Fields: (props: {
		/** Content rendered after the generated fields. */
		readonly children?: ReactNode
	}) => ReactElement
	/** Renders the configured submit slot with current form state. */
	readonly Submit: {
		/** Renders static content for an action or the `submit` shorthand action. */
		<Schema extends StandardSchema, BindingContext extends Context = Context>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type"> & {
				/**
				 * The action that this button runs. Outside `Form`, the action
				 * selects the form. Set the native `form` attribute to the Form `id`.
				 */
				readonly action?: FormAction<Schema, BindingContext>
				/**
				 * The form binding. Outside `Form`, the binding selects the form.
				 * Set the native `form` attribute to the Form `id`.
				 */
				readonly binding?: FormBinding<Schema, BindingContext>
			},
		): ReactElement
		/** Renders custom content with live state typed by the action form. */
		<Schema extends StandardSchema, BindingContext extends Context = Context>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
				/**
				 * The action that this button runs. Outside `Form`, the action
				 * selects the form. Set the native `form` attribute to the Form `id`.
				 */
				readonly action: FormAction<Schema, BindingContext>
				/** The form binding. It must own the action. */
				readonly binding?: FormBinding<Schema, BindingContext>
				/** Renders custom content from live typed submit state. */
				readonly children: (props: SubmitSlotProps<Schema>) => ReactNode
			},
		): ReactElement
		/** Renders custom content with live state typed by the matching binding. */
		<Schema extends StandardSchema, BindingContext extends Context = Context>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
				/**
				 * The binding of the surrounding `Form`. Outside `Form`, the binding
				 * selects the form. Set the native `form` attribute to the Form `id`.
				 */
				readonly binding: FormBinding<Schema, BindingContext>
				/** Renders custom content from live typed submit state. */
				readonly children: (props: SubmitSlotProps<Schema>) => ReactNode
			},
		): ReactElement
	}
	/** Composes `Form`, the error summary, and generated fields. */
	readonly AutoForm: <
		Schema extends StandardSchema,
		BindingContext extends Context = Context,
	>(
		props: AutoFormProps<Schema, BindingContext>,
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
