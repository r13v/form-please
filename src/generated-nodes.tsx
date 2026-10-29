"use client"

import {
	type ComponentType,
	createElement,
	memo,
	type ReactNode,
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
import { useFormId, useRuntimeForm } from "./form-context.js"
import type {
	RuntimeForm,
	RuntimeSlotOptions,
	RuntimeSlots,
} from "./form-kit-types.js"
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
} from "./types.js"
import { useFieldOptions } from "./use-field-options.js"
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
		default:
			return assertNever(node, "Unsupported resolved node")
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
	slots,
}: {
	/** Structural components used for issue messages. */
	readonly slots: RuntimeSlots
}) {
	const form = useRuntimeForm()
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
	form: RuntimeForm,
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
