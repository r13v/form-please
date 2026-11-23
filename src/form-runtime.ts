import type { RefObject } from "react"
import type { FieldValues, UseFormReturn } from "react-hook-form"
import {
	assertMountedArrayStructures,
	mountedArrayRoots,
	reconcileGeneratedArray,
} from "./array-reconcile.js"
import {
	hasEqualResolvedValue,
	hasWhenHidden,
	type ResolvedDefinition,
	resolveDefinition,
	resolveHiddenFieldWrites,
	visibleFieldPaths,
} from "./definition.js"
import { attachFormDiagnosticsRuntime } from "./diagnostics.js"
import { focusErrorSummaryFallback, focusIssue } from "./form-focus.js"
import { createFormIssueStore, type FormIssueStore } from "./form-issues.js"
import type {
	AnyFormSchema,
	FormBinding,
	ManagedValidationOptions,
	UseFormOptions,
} from "./form-kit-types.js"
import {
	createFormSubmissionRuntime,
	type FormSubmissionRuntime,
} from "./form-submission.js"
import {
	commitManagedRestore,
	commitManagedTransaction,
} from "./managed-commit.js"
import { createListenerSet } from "./managed-feature.js"
import type { ErrorDisplay, FormDefinition } from "./types.js"
import {
	attachValueCoordinatorCapability,
	createValueCoordinator,
	getValueCoordinatorCapability,
	type ValueCoordinator,
	type ValueTransactionCommit,
} from "./value-middleware.js"

/** The `useForm` options that can change during one hook lifetime and that generated UI reads. */
export type FormSettings = Readonly<{
	/** Application data supplied to controls and resolvers. */
	context: unknown
	/** Whether all generated controls are disabled. */
	disabled: boolean
	/** The error display used by nodes without their own value. */
	errorDisplay: ErrorDisplay
	/** Whether all generated controls are read-only. */
	readOnly: boolean
}>

/** A `useSyncExternalStore`-compatible store of the current form settings. */
type FormSettingsStore = Readonly<{
	getSnapshot(): FormSettings
	subscribe(listener: () => void): () => void
}>

/** The private state of one `kit.useForm` call, created once for the hook lifetime. */
export type FormRuntime = {
	/** The public binding; its identity is stable for the runtime lifetime. */
	readonly binding: FormBinding
	/** The React Hook Form API with erased public type parameters. */
	readonly api: UseFormReturn<FieldValues, unknown, unknown>
	/** The normalized definition fixed for this form. */
	readonly definition: FormDefinition
	/** Canonical coordinator capability used by optional diagnostics. */
	readonly diagnosticTarget: object
	/** Dispatches a generated managed update through middleware. */
	readonly dispatch: ValueCoordinator<FieldValues, unknown>["dispatch"]
	/** Commits one terminal transaction to React Hook Form. */
	readonly commit: ValueTransactionCommit<FieldValues, unknown>
	/** The current settings; generated UI subscribes to it. */
	readonly settings: FormSettingsStore
	/** Focusable generated inputs indexed by absolute path. */
	readonly inputRefs: Map<string, HTMLElement>
	/** The first summary issue used as a focus fallback. */
	readonly errorSummaryRef: RefObject<HTMLElement | null>
	/** The mounted native form element, when one exists. */
	formElement: HTMLFormElement | null
	/** Action and external issues stored beside schema errors. */
	readonly issues: FormIssueStore
	/** The submit actions, the submission store and the submit entry point. */
	readonly submission: FormSubmissionRuntime
	/** The latest resolved UI committed by the generated fields. */
	resolved?: ResolvedDefinition
	/** Takes the options of the latest committed render; call it from a layout effect. */
	update(options: UseFormOptions<AnyFormSchema>, settings: FormSettings): void
	/** Subscribes to React Hook Form state; call it from a layout effect and return its cleanup. */
	connect(): () => void
}

/** Reads the settings of one `useForm` render without side effects. */
export function readFormSettings(
	options: UseFormOptions<AnyFormSchema>,
	errorDisplay: ErrorDisplay,
): FormSettings {
	return {
		context: options.context,
		disabled: options.disabled === true,
		errorDisplay,
		readOnly: options.readOnly === true,
	}
}

/** Tests whether two settings would render the same generated UI. */
function hasEqualSettings(left: FormSettings, right: FormSettings): boolean {
	return (
		left.disabled === right.disabled &&
		left.readOnly === right.readOnly &&
		left.errorDisplay === right.errorDisplay &&
		// An inline context object with the same entries keeps the snapshot.
		hasEqualResolvedValue(left.context, right.context)
	)
}

/** Creates the runtime and the stable binding of one `useForm` call. */
export function createFormRuntime({
	api,
	defaultValues,
	definition,
	options,
	settings,
}: {
	readonly api: UseFormReturn<FieldValues, unknown, unknown>
	readonly defaultValues: FieldValues
	readonly definition: FormBinding["definition"]
	readonly options: UseFormOptions<AnyFormSchema>
	readonly settings: FormSettings
}): FormRuntime {
	let latestOptions = options
	let snapshot = settings
	let submitted = false
	const listeners = createListenerSet("Form settings")
	const validation = (): ManagedValidationOptions => ({
		isSubmitted: () => submitted,
		mode: latestOptions.mode ?? "onSubmit",
		reValidateMode: latestOptions.reValidateMode ?? "onChange",
	})
	const commit: ValueTransactionCommit<FieldValues, unknown> = (
		transaction,
	) => {
		// Array sources check before their native row operations run.
		if (transaction.source.type !== "array") {
			assertMountedArrayStructures(api.control, transaction)
		}
		commitManagedTransaction(
			api,
			transaction,
			validation(),
			mountedArrayRoots(api.control),
		)
	}
	const coordinator = createValueCoordinator<FieldValues, unknown>({
		afterUpdate: definition.afterUpdate,
		beforeUpdate: definition.beforeUpdate,
		commit,
		getContext: () => snapshot.context,
		getValues: () => api.getValues(),
		middleware: definition.middleware,
		resolveHiddenFieldWrites: hasWhenHidden(definition)
			? (transaction) =>
					resolveHiddenFieldWrites(definition, transaction, defaultValues)
			: undefined,
		restore: (transaction, policy) =>
			commitManagedRestore(api, transaction, validation(), policy),
	})
	const issues = createFormIssueStore(() => api)
	const partialBinding = {
		api,
		definition,
		get context() {
			return snapshot.context
		},
		update: coordinator.update,
		array: (path: string) => ({
			reconcile: (
				keys: readonly (string | number)[],
				reconcileOptions: Parameters<typeof reconcileGeneratedArray>[3],
			) => reconcileGeneratedArray(runtime, path, keys, reconcileOptions),
		}),
	}
	const binding = partialBinding as unknown as FormBinding
	const submission = createFormSubmissionRuntime({
		binding,
		form: {
			api,
			focusIssue: (target) => focusIssue(runtime, target),
			focusErrorSummaryFallback: (errors) =>
				focusErrorSummaryFallback(errors, runtime),
			isDisabled: () => snapshot.disabled,
		},
		getOptions: () => latestOptions,
		issues,
		options,
	})
	Object.assign(partialBinding, {
		actions: submission.actions,
		submission: submission.store,
		setIssues: submission.setIssues,
		submit: submission.submit,
		fieldPaths: (nodeId?: string) =>
			visibleFieldPaths(
				resolveDefinition(definition, api.getValues(), snapshot.context, {
					disabled: snapshot.disabled,
					readOnly: snapshot.readOnly,
				}),
				nodeId,
			),
	})
	attachValueCoordinatorCapability(binding, coordinator)
	const runtime: FormRuntime = {
		binding,
		api,
		definition,
		diagnosticTarget: getValueCoordinatorCapability(coordinator),
		dispatch: coordinator.dispatch,
		commit,
		settings: {
			getSnapshot: () => snapshot,
			subscribe: listeners.subscribe,
		},
		inputRefs: new Map(),
		errorSummaryRef: { current: null },
		formElement: null,
		issues,
		submission,
		update(nextOptions, nextSettings) {
			latestOptions = nextOptions
			if (hasEqualSettings(snapshot, nextSettings)) return
			snapshot = nextSettings
			listeners.notify()
		},
		connect() {
			const releaseSubmitted = api.subscribe({
				formState: { isSubmitted: true },
				callback: ({ isSubmitted }) => {
					submitted = isSubmitted === true
				},
			})
			const releaseValues = api.subscribe({
				formState: { values: true },
				callback: () => issues.clearChanged(api.getValues()),
			})
			return () => {
				releaseSubmitted()
				releaseValues()
			}
		},
	}
	attachFormDiagnosticsRuntime(binding, runtime)

	return runtime
}
