import type { ComponentPropsWithoutRef, ReactElement, ReactNode } from "react"
import type { FieldValues, Mode, UseFormReturn } from "react-hook-form"
import type { FormArray } from "./array-reconcile.js"
import type {
	ArrayFieldPath,
	ErrorDisplay,
	FieldPath,
	FormDefinition,
	FormDefinitionBuilder,
	FormDefinitionUpdatePolicy,
	FormFragment,
	FormInput,
	FormIssue,
	FormKitSlots,
	FormKitTypes,
	FormOutput,
	FormPleaseStyle,
	PathValue,
	StandardSchema,
	SubmitRenderProps,
	UseFieldResult,
} from "./types.js"
import type {
	FormMiddleware,
	FormUpdateRecipe,
	FormUpdateResult,
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

/**
 * The result of one submission. An accepted submission passed schema and
 * action validation, and its `onSubmit` resolved.
 */
export type FormSubmitResult<Name extends string = string> =
	| {
			readonly accepted: true
			/** The name of the action that ran. */
			readonly action: Name
	  }
	| {
			readonly accepted: false
			/** The name of the requested action. */
			readonly action: Name
			/** The schema or action validation failed. */
			readonly reason: "invalid"
			/** The schema issues or the action issues that rejected the submission. */
			readonly issues: readonly FormIssue[]
	  }
	| {
			readonly accepted: false
			/** The name of the requested action. */
			readonly action: Name
			/** Another submission was running, or the form option `disabled` is set. */
			readonly reason: "disabled" | "pending"
	  }
	| {
			readonly accepted: false
			/** The name of the requested action. */
			readonly action: Name
			/** The action `onSubmit` rejected. */
			readonly reason: "failed"
			/** The rejection of the action `onSubmit`. */
			readonly error: unknown
	  }

/** The action argument of `form.submit`: optional only for the `onSubmit` shorthand. */
type SubmitArguments<
	Schema extends StandardSchema,
	Context,
	Actions extends string,
	Name extends Actions,
> = [Actions] extends ["submit"]
	? [action?: FormAction<Schema, Context, Name>]
	: [action: FormAction<Schema, Context, Name>]

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
		KitWithContext<FormKitTypes, Context>
	> &
		FormDefinitionUpdatePolicy<Schema, Context>
	/**
	 * The context of the latest committed render, which generated UI uses. In
	 * the render that passes a new `context` option, this still returns the
	 * previous context; read your own variable there. A new object with the
	 * same top-level values keeps the first object.
	 */
	readonly context: Context
	/** Atomically applies one managed value recipe through middleware. */
	update(
		recipe: FormUpdateRecipe<FormValues<Schema>>,
	): FormUpdateResult<FormValues<Schema>, Context>
	/** Submit actions with stable identity for `kit.Submit`. */
	readonly actions: {
		readonly [Name in Actions]: FormAction<Schema, Context, Name>
	}
	/** The live submission state, readable with `useSnapshot`. */
	readonly submission: FormSubmission<Actions>
	/**
	 * Runs one submit action through the same path as a native submit and
	 * resolves with its result. The form element does not have to be mounted.
	 */
	submit<Name extends Actions = Actions>(
		...action: SubmitArguments<Schema, Context, Actions, Name>
	): Promise<FormSubmitResult<Name>>
	/**
	 * Lists the paths of the visible fields under one node ID, or of the whole
	 * form, for the current values and the committed `context`, `disabled` and
	 * `readOnly` that generated UI uses. The node does not have to be mounted.
	 * An unknown ID throws.
	 */
	fieldPaths(nodeId?: string): FieldPath<FormValues<Schema>>[]
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
			: never,
		FormValues<Schema>,
		Context
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
export type RuntimeSlots = FormKitSlots<{
	readonly fieldOptions: Record<string, unknown>
	readonly sectionOptions: Record<string, unknown>
	readonly arrayOptions: Record<string, unknown>
}>

/** Replaces the context of a kit type bag and keeps its other contracts. */
type KitWithContext<Kit extends FormKitTypes, Context> = {
	readonly controls: Kit["controls"]
	readonly context: Context
	readonly fieldOptions: Kit["fieldOptions"]
	readonly sectionOptions: Kit["sectionOptions"]
	readonly arrayOptions: Kit["arrayOptions"]
	readonly grid: Kit["grid"]
}

/** The typed `defineFragment` method exposed by a form kit. */
export type DefineFragment<Kit extends FormKitTypes> = <
	Schema extends StandardSchema,
>(
	schema: FormInput<Schema> extends FieldValues ? Schema : never,
	build: FormDefinitionBuilder<Schema, Kit>,
) => FormFragment<Schema, Kit>

/** The typed `defineForm` method exposed by a form kit. */
export type DefineForm<Kit extends FormKitTypes> = <
	Schema extends StandardSchema,
>(
	schema: FormInput<Schema> extends FieldValues ? Schema : never,
	build: FormDefinitionBuilder<Schema, Kit>,
	options?: DefineFormOptions<Schema, Kit["context"]>,
) => FormDefinition<
	Schema,
	Kit,
	FormDefinitionUpdatePolicy<Schema, Kit["context"]>
>

/** The typed `useForm` hook exposed by a form kit. */
export type UseForm<Kit extends FormKitTypes> = {
	<Schema extends StandardSchema>(
		definition: FormDefinition<
			Schema,
			Kit,
			FormDefinitionUpdatePolicy<Schema, Kit["context"]>
		>,
		options: UseFormOptions<Schema, Kit["context"]> & {
			readonly actions?: undefined
		},
	): FormBinding<Schema, Kit["context"], "submit">
	<
		Schema extends StandardSchema,
		const Actions extends FormActionsConfig<Schema, Kit["context"]>,
	>(
		definition: FormDefinition<
			Schema,
			Kit,
			FormDefinitionUpdatePolicy<Schema, Kit["context"]>
		>,
		options: UseFormOptions<Schema, Kit["context"], Actions> & {
			readonly actions: Actions
		},
	): FormBinding<Schema, Kit["context"], Extract<keyof Actions, string>>
}

/** A private key that carries the type bag of a form kit without runtime data. */
declare const formKitTypes: unique symbol

/** Reads the type bag of a form kit, for example `FormKitTypesOf<typeof kit>`. */
export type FormKitTypesOf<
	Kit extends { readonly [formKitTypes]?: FormKitTypes },
> = Kit extends { readonly [formKitTypes]?: infer Types extends FormKitTypes }
	? Types
	: never

/** A fixed registry, renderer, and React Hook Form integration, typed by a kit type bag. */
export interface FormKit<Kit extends FormKitTypes> {
	/** Phantom type data that `FormKitTypesOf` reads. */
	readonly [formKitTypes]?: Kit
	/** The immutable named control registry. */
	readonly controls: Kit["controls"]
	/** The immutable structural slot registry. */
	readonly slots: FormKitSlots<Kit>
	/** The allowed grid column counts and node spans. */
	readonly grid: readonly Kit["grid"][]
	/** Validates and binds one reusable schema-owned UI fragment to this kit. */
	readonly defineFragment: DefineFragment<Kit>
	/** Validates and binds a typed definition to this kit. */
	readonly defineForm: DefineForm<Kit>
	/** Creates a React Hook Form binding for a definition from this kit. */
	readonly useForm: UseForm<Kit>
	/** Provides form contexts and owns native submit and reset events. */
	readonly Form: <
		Schema extends StandardSchema,
		BindingContext extends Kit["context"] = Kit["context"],
	>(
		props: FormProps<Schema, BindingContext>,
	) => ReactElement
	/** Renders resolved definition nodes followed by optional application content. */
	readonly Fields: (props: {
		/** The ID of one definition node; only that node and its children render. */
		readonly node?: string
		/** Content rendered after the generated fields. */
		readonly children?: ReactNode
	}) => ReactElement
	/** Renders the issues of the surrounding `Form` that no enabled generated input shows. */
	readonly ErrorSummary: () => ReactNode
	/** Connects one custom field to the binding of the surrounding `Form`. */
	readonly useField: <
		Schema extends StandardSchema,
		Path extends FieldPath<FormValues<Schema>>,
	>(
		form: FormBinding<Schema, Kit["context"], string>,
		path: Path,
	) => UseFieldResult<PathValue<FormValues<Schema>, Path>>
	/** Returns the binding of the surrounding `Form`; throws outside one. */
	readonly useFormContext: <
		Schema extends StandardSchema = AnyFormSchema,
	>() => FormBinding<Schema, Kit["context"]>
	/** Renders the configured submit slot with current form state. */
	readonly Submit: {
		/** Renders static content for an action or the `submit` shorthand action. */
		<
			Schema extends StandardSchema,
			BindingContext extends Kit["context"] = Kit["context"],
		>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type"> & {
				/**
				 * The action that this button runs. Inside `Form`, it must belong to
				 * the surrounding form. Outside `Form`, it selects the form; set the
				 * native `form` attribute to the Form `id`.
				 */
				readonly action?: FormAction<Schema, BindingContext>
			},
		): ReactElement
		/** Renders custom content with live state typed by the action form. */
		<
			Schema extends StandardSchema,
			BindingContext extends Kit["context"] = Kit["context"],
		>(
			props: Omit<ComponentPropsWithoutRef<"button">, "type" | "children"> & {
				/**
				 * The action that this button runs. It types `values`. Inside `Form`,
				 * it must belong to the surrounding form. Outside `Form`, it selects
				 * the form; set the native `form` attribute to the Form `id`.
				 */
				readonly action: FormAction<Schema, BindingContext>
				/** Renders custom content from live typed submit state. */
				readonly children: (props: SubmitRenderProps<Schema>) => ReactNode
			},
		): ReactElement
	}
	/** Composes `Form`, the error summary, and generated fields. */
	readonly AutoForm: <
		Schema extends StandardSchema,
		BindingContext extends Kit["context"] = Kit["context"],
	>(
		props: AutoFormProps<Schema, BindingContext>,
	) => ReactElement
	/** Returns a type-only view of this kit for a narrower context contract. */
	readonly forContext: <NextContext extends Kit["context"]>() => FormKit<
		KitWithContext<Kit, NextContext>
	>
}

/** Registries and optional grid used to create an immutable form kit, typed by a kit type bag without context. */
export type CreateFormKitOptions<Kit extends Omit<FormKitTypes, "context">> = {
	/** The complete named control registry. */
	readonly controls: Kit["controls"]
	/** The complete structural slot registry. */
	readonly slots: FormKitSlots<{
		readonly fieldOptions: Kit["fieldOptions"]
		readonly sectionOptions: Kit["sectionOptions"]
		readonly arrayOptions: Kit["arrayOptions"]
	}>
	/** Allowed grid column counts and spans. Defaults to `1` through `4`. */
	readonly grid?: readonly Kit["grid"][]
	/** How many validation messages each field and array shows. Defaults to `"all"`. */
	readonly errorDisplay?: ErrorDisplay
}
