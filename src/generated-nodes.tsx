"use client"

import {
	type ComponentType,
	createElement,
	memo,
	type ReactNode,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
} from "react"
import {
	type FieldError,
	type FieldValues,
	set,
	useController,
	useFieldArray,
	useFormState,
} from "react-hook-form"
import {
	assertMountedArrayStructures,
	commitRowOperation,
	registerGeneratedArray,
} from "./array-reconcile.js"
import { assertNever } from "./assert-never.js"
import {
	findResolvedNode,
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
import { useFormId } from "./form-context.js"
import type { RuntimeSlotOptions, RuntimeSlots } from "./form-kit-types.js"
import type { FormRuntime, FormSettings } from "./form-runtime.js"
import {
	type ArrayAction,
	applyArrayAction,
	cloneItemDefault,
	fieldPathSegments,
	getMutableArrayValue,
} from "./generated-array.js"
import {
	fieldErrorsToIssues,
	fieldErrorToIssues,
} from "./standard-schema-resolver.js"
import type {
	ArraySlotProps,
	ControlDefinitionRegistry,
	ControlProps,
	ErrorDisplay,
	FieldSlotProps,
	FormInput,
	FormIssue,
	SectionSlotProps,
	StandardSchema,
	StructuralNodeName,
	StructuralRootProps,
	UseFieldResult,
} from "./types.js"
import { useFieldOptions } from "./use-field-options.js"
import { useSnapshot } from "./use-snapshot.js"
import type {
	ValueTransaction,
	ValueTransactionSource,
} from "./value-middleware.js"

/** Resolves the current definition and renders its root nodes. */
export function ResolvedFields({
	form,
	controls,
	slots,
	values,
	node,
	children,
}: {
	readonly form: FormRuntime
	readonly controls: ControlDefinitionRegistry
	readonly slots: RuntimeSlots
	/** Current React Hook Form input values. */
	readonly values: unknown
	/** The ID of the one node to render; all root nodes render without it. */
	readonly node?: string
	/** Content rendered after the generated fields. */
	readonly children?: ReactNode
}) {
	const settings = useSnapshot(form.settings)
	const resolution = resolveForRender(form, values, settings)
	useLayoutEffect(() => publishResolution(form, resolution), [form, resolution])
	const { resolved } = resolution
	const rendered =
		node === undefined ? resolved.ui : [findResolvedNode(resolved, node)]

	return (
		<>
			{rendered.map((child) => (
				<MemoizedGeneratedNode
					controls={controls}
					form={form}
					key={child.id}
					node={child}
					slots={slots}
				/>
			))}
			{children}
		</>
	)
}

/** One resolution of the definition for its exact inputs. */
type Resolution = {
	readonly values: unknown
	readonly settings: FormSettings
	readonly resolved: ResolvedDefinition
	readonly duration: number | undefined
}

/**
 * The latest resolution of each runtime. Every `kit.Fields` of a form receives
 * the same values object, so one entry serves all of them. A render that React
 * discards leaves an entry that is still correct for its own inputs.
 */
const latestResolutions = new WeakMap<FormRuntime, Resolution>()

/** Returns the resolution for the values and settings of this render. */
function resolveForRender(
	form: FormRuntime,
	values: unknown,
	settings: FormSettings,
): Resolution {
	const cached = latestResolutions.get(form)
	const isCurrent =
		cached !== undefined &&
		cached.values === values &&
		cached.settings === settings
	if (isCurrent) return cached

	const observed = hasFormDiagnosticSink(form.diagnosticTarget)
	const startedAt = observed ? formDiagnosticNow() : undefined
	// The committed result only lends references to unchanged nodes.
	const resolved = resolveDefinition(
		form.definition,
		values as FormInput<StandardSchema>,
		settings.context,
		{ disabled: settings.disabled, readOnly: settings.readOnly },
		form.resolved,
	)
	const resolution = {
		values,
		settings,
		resolved,
		duration:
			startedAt === undefined ? undefined : formDiagnosticNow() - startedAt,
	}
	latestResolutions.set(form, resolution)

	return resolution
}

/** Commits one resolution to the runtime and devtools once; call it from a layout effect. */
function publishResolution(
	form: FormRuntime,
	{ duration, resolved }: Resolution,
): void {
	if (form.resolved === resolved) return

	form.resolved = resolved
	if (!hasFormDiagnosticSink(form.diagnosticTarget)) return
	publishFormDiagnosticEvent(form.diagnosticTarget, {
		...(duration === undefined ? {} : { duration }),
		kind: "definition",
		resolved,
		time: formDiagnosticNow(),
	})
}

/** Selects and renders the component for one resolved node. */
function GeneratedNode({
	form,
	controls,
	slots,
	node,
}: {
	readonly form: FormRuntime
	readonly controls: ControlDefinitionRegistry
	readonly slots: RuntimeSlots
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
				pathPrefix: node.itemPath,
			})
		default:
			return assertNever(node, "Unsupported resolved node")
	}
}

const MemoizedGeneratedNode = memo(GeneratedNode)

/** The managed field contract and the issue IDs of one field path. */
type FieldControl = {
	/** The props that `kit.useField` returns and that a generated control receives. */
	readonly control: UseFieldResult<unknown>
	/** The DOM ID of the input. */
	readonly inputId: string
	/** The DOM IDs of the displayed issues, in display order. */
	readonly errorIds: readonly string[]
}

/**
 * Connects one field path to React Hook Form and the coordinator. Generated
 * fields and `kit.useField` share it, so a custom field registers, reads
 * issues and dispatches managed updates exactly like a generated control. The
 * input has no `aria-describedby`: only the caller knows which elements it renders.
 */
export function useFieldControl(
	form: FormRuntime,
	path: string,
	nodeErrorDisplay?: ErrorDisplay,
): FieldControl {
	const inputId = createDomId(useFormId(), path)
	const { errorDisplay } = useSnapshot(form.settings)
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
		nodeErrorDisplay ?? errorDisplay,
	)
	const blurRef = useRef(field.onBlur)
	useLayoutEffect(() => {
		blurRef.current = field.onBlur
	})
	const blur = useRef(() => blurRef.current()).current
	const { ref: fieldRef, value } = field
	const input = useMemo(
		() => ({
			id: inputId,
			name: path,
			ref(element: HTMLElement | null) {
				fieldRef(element)
				if (element === null) {
					form.inputRefs.delete(path)
				} else {
					form.inputRefs.set(path, element)
				}
			},
		}),
		[fieldRef, form, inputId, path],
	)
	const meta = useMemo(
		() => ({
			dirty,
			touched,
			validating,
			errors,
			displayErrors,
			invalid: displayErrors.length > 0,
		}),
		[dirty, displayErrors, errors, touched, validating],
	)
	const setValue = useCallback(
		(nextValue: unknown) =>
			form.dispatch((draft) => set(draft, path, nextValue), {
				path,
				type: "control",
			}),
		[form, path],
	)
	const control = useMemo(
		() => ({ path, value, setValue, blur, input, meta }),
		[blur, input, meta, path, setValue, value],
	)

	return { control, inputId, errorIds }
}

/** Connects one resolved field node to its control and structural slot. */
function GeneratedField({
	form,
	controls,
	slots,
	node,
}: {
	readonly form: FormRuntime
	readonly controls: ControlDefinitionRegistry
	readonly slots: RuntimeSlots
	readonly node: ResolvedFieldNode
}) {
	const path = node.path
	const domId = createDomId(useFormId(), path)
	const descriptionId =
		node.description === undefined ? undefined : `${domId}-description`
	const Slot = slots.Field as ComponentType<FieldSlotProps<unknown>>
	const { context } = useSnapshot(form.settings)
	const { control, inputId, errorIds } = useFieldControl(
		form,
		path,
		node.errorDisplay,
	)
	// The field slot renders the description and the issues, so only a
	// generated control references their IDs.
	const describedBy = useMemo(
		() => joinIds([descriptionId, ...errorIds]),
		[descriptionId, errorIds],
	)
	const resolvedOptions = useFieldOptions(
		node.options,
		node.optionValues,
		context,
		{ path, target: form.diagnosticTarget },
	)
	const Control = controls[String(node.control)].component as ComponentType<
		ControlProps<unknown, unknown, unknown> & {
			readonly options?: readonly unknown[]
		}
	>

	return useMemo(() => {
		const { meta } = control

		return (
			<Slot
				control={
					<Control
						{...control}
						input={
							describedBy === undefined
								? control.input
								: { ...control.input, "aria-describedby": describedBy }
						}
						props={node.props ?? {}}
						context={context}
						disabled={node.disabled}
						{...(node.options === undefined
							? {}
							: { options: resolvedOptions })}
						readOnly={node.readOnly}
						required={node.required === true}
					/>
				}
				description={node.description}
				descriptionProps={
					descriptionId === undefined ? {} : { id: descriptionId }
				}
				disabled={node.disabled}
				errors={renderErrors(meta.displayErrors, errorIds, slots, path)}
				label={node.label}
				labelProps={{ htmlFor: inputId, id: `${inputId}-label` }}
				readOnly={node.readOnly}
				required={node.required === true}
				rootProps={structuralProps("field", {
					...node,
					path,
					invalid: meta.invalid,
					dirty: meta.dirty,
					touched: meta.touched,
					validating: meta.validating,
				})}
				slotOptions={node.slotOptions as RuntimeSlotOptions}
			/>
		)
	}, [
		Control,
		Slot,
		context,
		control,
		describedBy,
		descriptionId,
		errorIds,
		inputId,
		node,
		path,
		resolvedOptions,
		slots,
	])
}

/** Connects one resolved array node to React Hook Form array operations. */
function GeneratedArray({
	form,
	controls,
	slots,
	node,
}: {
	readonly form: FormRuntime
	readonly controls: ControlDefinitionRegistry
	readonly slots: RuntimeSlots
	readonly node: ResolvedArrayNode
}) {
	const path = node.path
	getMutableArrayValue(form.api.getValues(), path)
	const arrayId = createDomId(useFormId(), path)
	const Slot = slots.Array as ComponentType<ArraySlotProps<unknown>>
	const Item = slots.ArrayItem
	const { errorDisplay } = useSnapshot(form.settings)
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
		return result
	}, [fields])
	useLayoutEffect(() => {
		previousFieldIds.current = fieldIds
	}, [fieldIds])
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
		node.errorDisplay ?? errorDisplay,
	)
	const canAdd = !node.disabled && !node.readOnly
	return useMemo(
		() => (
			<Slot
				add={() => {
					if (!canAdd) return
					const index = fieldIds.length
					dispatchArrayAction(
						form,
						path,
						{ action: "append", index },
						(transaction) => {
							append(getMutableArrayValue(transaction.nextValues, path)[index])
						},
						cloneItemDefault(node.itemDefault),
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
							if (!canAdd) return
							dispatchArrayAction(
								form,
								path,
								{ action: "move", fromIndex: index, toIndex },
								() => move(index, toIndex),
							)
						}}
						readOnly={node.readOnly}
						remove={() => {
							if (!canAdd) return
							dispatchArrayAction(form, path, { action: "remove", index }, () =>
								remove(index),
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
export function ErrorSummary({
	form,
	slots,
}: {
	readonly form: FormRuntime
	readonly slots: RuntimeSlots
}) {
	const formId = useFormId()
	// Read errors before the early return: the RHF proxy subscribes only to read keys.
	const { errors, submitCount } = useFormState({ control: form.api.control })
	const Slot = slots.ErrorMessage
	if (submitCount === 0 && form.issues.list().length === 0) return null

	const summaryIssues = fieldErrorsToIssues(errors).filter((issue) => {
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
	form: FormRuntime,
	path: string,
	action: ArrayAction,
	commitArray: (transaction: ValueTransaction<FieldValues, unknown>) => void,
	item?: unknown,
): unknown {
	const arrayPath = fieldPathSegments(form.api.getValues(), path)
	return form.dispatch(
		(draft) =>
			applyArrayAction(getMutableArrayValue(draft, path), path, action, item),
		{ ...action, path, type: "array" } as ValueTransactionSource<FieldValues>,
		{
			arrayPath,
			commit: (transaction) => {
				// The action applied to old row indexes maps each kept row to its new index.
				const rows = getMutableArrayValue(form.api.getValues(), path).map(
					(_, index) => index,
				)
				if (action.action !== "append") applyArrayAction(rows, path, action)
				const indexes = new Map(
					rows.map((oldIndex, newIndex) => [oldIndex, newIndex]),
				)
				assertMountedArrayStructures(form.api.control, transaction, {
					path,
					indexes,
				})
				if (action.action === "append") {
					commitArray(transaction)
					return form.commit(transaction)
				}
				commitRowOperation(form, path, indexes, transaction, () =>
					commitArray(transaction),
				)
			},
		},
	)
}

/** Creates a DOM-safe ID for an input path within a form. */
function createDomId(prefix: string, value: string): string {
	return `${prefix}-${encodeURIComponent(value).replaceAll(".", "%2E")}`
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
export function booleanData(value: boolean): "" | undefined {
	return value ? "" : undefined
}

/** Joins defined accessibility IDs into one attribute value. */
function joinIds(values: readonly (string | undefined)[]): string | undefined {
	const joined = values.filter((value) => value !== undefined).join(" ")
	return joined.length === 0 ? undefined : joined
}
