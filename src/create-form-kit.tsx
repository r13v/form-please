"use client"

import {
	type ComponentPropsWithoutRef,
	type ReactNode,
	useContext,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react"
import {
	type DefaultValues,
	type FieldValues,
	FormProvider,
	type UseFormReturn,
	useFormState,
	useForm as useReactHookForm,
	useWatch,
} from "react-hook-form"
import {
	assertMountedArrayStructures,
	mountedArrayRoots,
	reconcileGeneratedArray,
} from "./array-reconcile.js"
import {
	createFormFragment,
	hasEqualResolvedValue,
	hasWhenHidden,
	normalizeDefinition,
	normalizeGrid,
	readErrorDisplay,
	resolveHiddenFieldWrites,
} from "./definition.js"
import { attachFormDiagnosticsRuntime } from "./diagnostics.js"
import { FormContext, FormIdContext, useRuntimeForm } from "./form-context.js"
import { focusErrorSummaryFallback, focusIssue } from "./form-focus.js"
import { createFormIssueStore, type FormIssueStore } from "./form-issues.js"
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
	ManagedValidationOptions,
	RuntimeForm,
	RuntimeSlots,
	UseForm,
	UseFormOptions,
} from "./form-kit-types.js"
import {
	createFormSubmissionRuntime,
	type FormSubmissionRuntime,
	isImplicitSubmitKey,
	snapshotSubmitter,
	submitterAction,
} from "./form-submission.js"
import { booleanData, ErrorSummary, ResolvedFields } from "./generated-nodes.js"
import {
	commitManagedRestore,
	commitManagedTransaction,
} from "./managed-commit.js"
import { createStandardSchemaResolver } from "./standard-schema-resolver.js"
import type {
	ControlDefinitionRegistry,
	DeepReadonly,
	ErrorDisplay,
	FormDefinition,
	FormDefinitionUpdatePolicy,
	FormInput,
	FormKitSlots,
	FormOutput,
	StandardSchema,
	SubmitSlotProps,
} from "./types.js"
import { useSnapshot } from "./use-snapshot.js"
import {
	attachValueCoordinatorCapability,
	createValueCoordinator,
	getValueCoordinatorCapability,
	type ValueCoordinator,
	type ValueRestoreCommit,
	type ValueTransactionCommit,
} from "./value-middleware.js"

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
	FormProps,
	FormSubmission,
	FormSubmissionSnapshot,
	FormSubmitDetails,
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
				"kit.useForm requires a definition from this exact form kit. If this error appears after a hot reload, reload the page or remount the component that calls kit.useForm.",
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
		// An inline context object with the same entries keeps the binding stable.
		const contextRef = useRef(options.context)
		if (!hasEqualResolvedValue(contextRef.current, options.context)) {
			contextRef.current = options.context
		}
		const context = contextRef.current
		const submittedRef = useRef(false)
		const validation: ManagedValidationOptions = {
			isSubmitted: () => submittedRef.current,
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
				// Array sources check before their native row operations run.
				if (transaction.source.type !== "array") {
					assertMountedArrayStructures(apiRef.current.control, transaction)
				}
				commitManagedTransaction(
					apiRef.current,
					transaction,
					validationRef.current,
					mountedArrayRoots(apiRef.current.control),
				)
			}
		}
		const restoreRef = useRef<
			ValueRestoreCommit<FormValues<Schema>, unknown> | undefined
		>(undefined)
		if (restoreRef.current === undefined) {
			restoreRef.current = (transaction, policy) => {
				commitManagedRestore(
					apiRef.current,
					transaction,
					validationRef.current,
					policy,
				)
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
				getForm: () => {
					const runtime = runtimeRef.current as RuntimeForm
					return {
						api: runtime.api,
						focusIssue: (target) => focusIssue(runtime, target),
						focusErrorSummaryFallback: (errors, formElement) =>
							focusErrorSummaryFallback(errors, formElement, runtime),
					}
				},
			})
		}
		const submission = submissionRef.current
		useLayoutEffect(
			() =>
				api.subscribe({
					formState: { isSubmitted: true },
					callback: ({ isSubmitted }) => {
						submittedRef.current = isSubmitted === true
					},
				}),
			[api],
		)
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
				context,
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
				resetSubmission: submission.reset,
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
			context,
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
								runtimeForm.resetSubmission()
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

	/**
	 * Selects the runtime form of `kit.Submit`. Inside `kit.Form`, the
	 * binding and the action must match the surrounding form. Outside
	 * `kit.Form`, the binding or the action selects the form.
	 */
	function resolveSubmitRuntime(
		surrounding: RuntimeForm | null,
		binding: object | undefined,
		action: { readonly form: object } | undefined,
	): RuntimeForm {
		const fromBinding =
			binding === undefined ? undefined : runtimeForms.get(binding)
		const fromAction =
			action === undefined ? undefined : runtimeForms.get(action.form)
		if (surrounding !== null) {
			if (binding !== undefined && fromBinding !== surrounding) {
				throw new Error("Submit binding must match the surrounding Form")
			}
			if (action !== undefined && fromAction !== surrounding) {
				throw new Error("Submit action must belong to the surrounding Form")
			}
			return surrounding
		}
		if (binding === undefined && action === undefined) {
			throw new Error("Submit outside Form requires a binding or an action")
		}
		const runtime = fromBinding ?? fromAction
		if (runtime === undefined) {
			throw new Error(
				"Submit binding or action is not mounted by this form kit",
			)
		}
		if (
			binding !== undefined &&
			action !== undefined &&
			fromBinding !== fromAction
		) {
			throw new Error("Submit action must belong to the Submit binding")
		}
		return runtime
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
			/**
			 * The form binding. Outside `kit.Form`, the binding selects the
			 * form. Set the native `form` attribute to the Form `id`.
			 */
			readonly binding?: FormBinding<Schema, unknown>
			readonly children?:
				| ReactNode
				| ((props: SubmitSlotProps<Schema>) => ReactNode)
		},
	) {
		const { action, binding, children, ...nativeProps } = props
		const runtime = resolveSubmitRuntime(
			useContext(FormContext),
			binding,
			action,
		)
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
			throw new TypeError(`createFormKit requires a ${key} slot`)
		}
	}
}
