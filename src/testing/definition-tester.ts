import { type FieldValues, set } from "react-hook-form"

import {
	type ResolvedArrayNode,
	type ResolvedDefinition,
	type ResolvedFieldNode,
	type ResolvedNode,
	resolveDefinition,
} from "../definition.js"
import { createFieldOptionsResolution } from "../field-options.js"
import { cloneFormValue } from "../form-value.js"
import {
	cloneItemDefault,
	fieldPathSegments,
	getMutableArrayValue,
} from "../generated-array.js"
import type {
	ArrayFieldPath,
	ControlOptionOf,
	ControlOwnPropsOf,
	DeepReadonly,
	FieldPath,
	FormDefinition,
	FormInput,
	PathValue,
	ReactUiContent,
} from "../types.js"
import {
	type AfterUpdate,
	type BeforeUpdate,
	createValueCoordinator,
	type FormMiddleware,
	type FormUpdateRecipe,
	type ValueTransaction,
} from "../value-middleware.js"

type DefinitionTypeData<Definition extends FormDefinition> =
	Definition extends FormDefinition<
		infer Schema,
		infer Controls,
		infer Context,
		infer FieldOptions,
		infer SectionOptions,
		infer ArrayOptions,
		infer Grid
	>
		? {
				readonly arrayOptions: ArrayOptions
				readonly context: Context
				readonly controls: Controls
				readonly fieldOptions: FieldOptions
				readonly grid: Grid
				readonly schema: Schema
				readonly sectionOptions: SectionOptions
			}
		: never

/** Editable values accepted by one concrete definition. */
export type DefinitionTestValues<Definition extends FormDefinition> = Extract<
	FormInput<DefinitionTypeData<Definition>["schema"]>,
	FieldValues
>

/** Runtime context required by one concrete definition. */
export type DefinitionTestContext<Definition extends FormDefinition> =
	DefinitionTypeData<Definition>["context"]

/** Selectable option values available across one definition's controls. */
export type DefinitionTestOption<Definition extends FormDefinition> =
	ControlOptionOf<
		DefinitionTypeData<Definition>["controls"][keyof DefinitionTypeData<Definition>["controls"]]
	>

type DefinitionContextOption<Definition extends FormDefinition> =
	unknown extends DefinitionTestContext<Definition>
		? {
				/** Application data supplied to definition and option resolvers. */
				readonly context?: DefinitionTestContext<Definition>
			}
		: {
				/** Application data supplied to definition and option resolvers. */
				readonly context: DefinitionTestContext<Definition>
			}

/** Configuration for one stateful production-backed definition tester. */
export type DefinitionTesterOptions<Definition extends FormDefinition> =
	DefinitionContextOption<Definition> & {
		/** Disables all nodes during definition resolution. */
		readonly disabled?: boolean
		/** Makes all nodes read-only during definition resolution. */
		readonly readOnly?: boolean
		/** Complete editable form input used for the initial resolution. */
		readonly values: DefinitionTestValues<Definition>
	}

/** Runtime inputs that can change without proposing a value update. */
export type DefinitionTesterRerenderOptions<Definition extends FormDefinition> =
	{
		/** Replaces the application context when this property is present. */
		readonly context?: DefinitionTestContext<Definition>
		/** Replaces form-level disabled state when this property is present. */
		readonly disabled?: boolean
		/** Replaces form-level read-only state when this property is present. */
		readonly readOnly?: boolean
	}

type DefinitionNodeKind = "array" | "field" | "render" | "section"

type DefinitionNodeSnapshotBase<Kind extends DefinitionNodeKind> = {
	/** The resolved node ID, including an array-item prefix when applicable. */
	readonly id: string
	/** The resolved node category. */
	readonly kind: Kind
	/** The normalized parent ID when the node is nested. */
	readonly parentId?: string
	/** The array scope containing this node. */
	readonly scopePath: string
	/** The resolved class name supplied to the structural slot. */
	readonly className: string | undefined
	/** Whether user interaction with this node is disabled. */
	readonly disabled: boolean
	/** Whether value changes through this node are read-only. */
	readonly readOnly: boolean
	/** The resolved grid span. */
	readonly span: number | "full" | undefined
	/** Whether the renderer includes this node. */
	readonly visible: boolean
}

/** Stable testing projection of one resolved field node. */
export type DefinitionFieldSnapshot<Definition extends FormDefinition> =
	DefinitionNodeSnapshotBase<"field"> & {
		/** The registered control name. */
		readonly control: Extract<
			keyof DefinitionTypeData<Definition>["controls"],
			string
		>
		/** The resolved supporting content. */
		readonly description: ReactUiContent | undefined
		/** The resolved field label. */
		readonly label: ReactUiContent | undefined
		/** The absolute React Hook Form field path. */
		readonly path: string
		/** The resolved application-owned control props. */
		readonly props:
			| ControlOwnPropsOf<
					DefinitionTypeData<Definition>["controls"][keyof DefinitionTypeData<Definition>["controls"]]
			  >
			| undefined
		/** Whether the definition marks the field as required. */
		readonly required: boolean
		/** The resolved field-slot configuration. */
		readonly slotOptions:
			| DefinitionTypeData<Definition>["fieldOptions"]
			| undefined
	}

/** Stable testing projection of one resolved section node. */
export type DefinitionSectionSnapshot<Definition extends FormDefinition> =
	DefinitionNodeSnapshotBase<"section"> & {
		/** The resolved number of grid columns. */
		readonly columns: number
		/** The resolved supporting content. */
		readonly description: ReactUiContent | undefined
		/** The resolved section-slot configuration. */
		readonly slotOptions:
			| DefinitionTypeData<Definition>["sectionOptions"]
			| undefined
		/** The resolved section title. */
		readonly title: ReactUiContent | undefined
	}

/** Stable testing projection of one resolved generated array node. */
export type DefinitionArraySnapshot<Definition extends FormDefinition> =
	DefinitionNodeSnapshotBase<"array"> & {
		/** The resolved supporting content. */
		readonly description: ReactUiContent | undefined
		/** The item value or factory used by generated append actions. */
		readonly itemDefault: unknown
		/** The resolved array label. */
		readonly label: ReactUiContent | undefined
		/** The absolute React Hook Form array path. */
		readonly path: string
		/** The resolved array-slot configuration. */
		readonly slotOptions:
			| DefinitionTypeData<Definition>["arrayOptions"]
			| undefined
	}

/** Stable testing projection of one resolved custom render node. */
export type DefinitionRenderSnapshot = DefinitionNodeSnapshotBase<"render">

/** One stable public testing projection of a resolved definition node. */
export type DefinitionNodeSnapshot<Definition extends FormDefinition> =
	| DefinitionArraySnapshot<Definition>
	| DefinitionFieldSnapshot<Definition>
	| DefinitionRenderSnapshot
	| DefinitionSectionSnapshot<Definition>

/** One changed property within a resolved node. */
export type DefinitionPropertyChange = {
	/** The previous resolved value. */
	readonly before: unknown
	/** The next resolved value. */
	readonly after: unknown
	/** Dot-and-index path within the public node snapshot. */
	readonly property: string
}

/** Exact structural or property change caused by one tester operation. */
export type DefinitionChange<Definition extends FormDefinition> =
	| {
			readonly type: "added"
			readonly node: DefinitionNodeSnapshot<Definition>
	  }
	| {
			readonly type: "removed"
			readonly node: DefinitionNodeSnapshot<Definition>
	  }
	| {
			readonly type: "changed"
			readonly changes: readonly DefinitionPropertyChange[]
			readonly kind: DefinitionNodeKind
			readonly nodeId: string
			readonly path?: string
	  }

/** An immutable resolution with strict node selectors. */
export type DefinitionInspection<Definition extends FormDefinition> = {
	/** All resolved nodes in depth-first render order. */
	readonly nodes: readonly DefinitionNodeSnapshot<Definition>[]
	/** IDs of the resolved root nodes in render order. */
	readonly rootIds: readonly string[]
	/** Complete editable values used for this resolution. */
	readonly values: DeepReadonly<DefinitionTestValues<Definition>>
	/** Selects the only resolved generated array at an absolute path. */
	array<Path extends ArrayFieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
	): DefinitionArraySnapshot<Definition>
	/** Selects the only resolved field at an absolute path. */
	field<Path extends FieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
	): DefinitionFieldSnapshot<Definition>
	/** Selects one resolved node by its exact runtime ID. */
	node(id: string): DefinitionNodeSnapshot<Definition>
	/** Resolves one field's static or asynchronous selectable options. */
	resolveOptions<Path extends FieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
	): Promise<readonly DefinitionTestOption<Definition>[]>
}

/** Definition changes between two immutable inspections. */
export type DefinitionTransition<Definition extends FormDefinition> = {
	/** Resolution after the tester operation. */
	readonly after: DefinitionInspection<Definition>
	/** Resolution before the tester operation. */
	readonly before: DefinitionInspection<Definition>
	/** Exact public node changes caused by the operation. */
	readonly changes: readonly DefinitionChange<Definition>[]
}

/** A managed transition that either committed once or left values unchanged. */
export type ManagedDefinitionTransition<Definition extends FormDefinition> =
	DefinitionTransition<Definition> &
		(
			| {
					readonly committed: true
					readonly transaction: ValueTransaction<
						DefinitionTestValues<Definition>,
						DefinitionTestContext<Definition>
					>
			  }
			| {
					readonly committed: false
					readonly transaction: undefined
			  }
		) & {
			/** The value returned by the configured middleware chain. */
			readonly result: unknown
		}

/** Stateful, production-backed harness for testing one form definition. */
export type DefinitionTester<Definition extends FormDefinition> = {
	/** Current immutable definition resolution. */
	readonly current: DefinitionInspection<Definition>
	/** Current complete editable values. */
	readonly values: DeepReadonly<DefinitionTestValues<Definition>>
	/** Selects the current generated array at an absolute path. */
	array<Path extends ArrayFieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
	): DefinitionArraySnapshot<Definition>
	/** Proposes one generated append action through hooks and middleware. */
	append<Path extends ArrayFieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
	): ManagedDefinitionTransition<Definition>
	/** Selects the current field at an absolute path. */
	field<Path extends FieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
	): DefinitionFieldSnapshot<Definition>
	/** Selects a current node by its exact runtime ID. */
	node(id: string): DefinitionNodeSnapshot<Definition>
	/** Proposes one generated move action through hooks and middleware. */
	move<Path extends ArrayFieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
		fromIndex: number,
		toIndex: number,
	): ManagedDefinitionTransition<Definition>
	/** Proposes one generated remove action through hooks and middleware. */
	remove<Path extends ArrayFieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
		index: number,
	): ManagedDefinitionTransition<Definition>
	/** Applies current context and flags without middleware. */
	rerender(
		options: DefinitionTesterRerenderOptions<Definition>,
	): DefinitionTransition<Definition>
	/** Resolves one current field's selectable options. */
	resolveOptions<Path extends FieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
	): Promise<readonly DefinitionTestOption<Definition>[]>
	/** Replaces the current context and re-resolves the definition. */
	setContext(
		context: DefinitionTestContext<Definition>,
	): DefinitionTransition<Definition>
	/** Replaces form-level disabled state and re-resolves the definition. */
	setDisabled(disabled: boolean): DefinitionTransition<Definition>
	/** Proposes one generated control change through hooks and middleware. */
	setValue<Path extends FieldPath<DefinitionTestValues<Definition>>>(
		path: Path,
		value: PathValue<DefinitionTestValues<Definition>, Path>,
	): ManagedDefinitionTransition<Definition>
	/** Replaces form-level read-only state and re-resolves the definition. */
	setReadOnly(readOnly: boolean): DefinitionTransition<Definition>
	/** Proposes one imperative managed update through hooks and middleware. */
	update(
		recipe: FormUpdateRecipe<DefinitionTestValues<Definition>>,
	): ManagedDefinitionTransition<Definition>
}

type RuntimeDefinitionState<Definition extends FormDefinition> = {
	context: DefinitionTestContext<Definition>
	disabled: boolean
	readonly definition: Definition
	inspection: DefinitionInspection<Definition>
	readOnly: boolean
	resolved: ResolvedDefinition
	values: DefinitionTestValues<Definition>
}

type DefinitionUpdatePolicy<Definition extends FormDefinition> = {
	readonly afterUpdate?: AfterUpdate<
		DefinitionTestValues<Definition>,
		DefinitionTestContext<Definition>
	>
	readonly beforeUpdate?: BeforeUpdate<
		DefinitionTestValues<Definition>,
		DefinitionTestContext<Definition>
	>
	readonly middleware: readonly FormMiddleware<
		DefinitionTestValues<Definition>,
		DefinitionTestContext<Definition>
	>[]
}

/** Creates one stateful tester backed by the production resolver and coordinator. */
export function createDefinitionTester<Definition extends FormDefinition>(
	definition: Definition,
	options: DefinitionTesterOptions<Definition>,
): DefinitionTester<Definition> {
	if (!isFieldValues(options.values)) {
		throw new TypeError("Definition tester values must be an object")
	}
	const initialValues = cloneFormValue(options.values)
	const initialContext = (
		"context" in options ? options.context : undefined
	) as DefinitionTestContext<Definition>
	const initialResolved = resolveDefinition(
		definition,
		initialValues,
		initialContext,
		{
			disabled: options.disabled,
			readOnly: options.readOnly,
		},
	)
	const state: RuntimeDefinitionState<Definition> = {
		context: initialContext,
		definition,
		disabled: options.disabled === true,
		inspection: undefined as unknown as DefinitionInspection<Definition>,
		readOnly: options.readOnly === true,
		resolved: initialResolved,
		values: initialValues,
	}
	const updates = definition as Definition & DefinitionUpdatePolicy<Definition>
	state.inspection = createInspection(state.values, state.resolved)

	let activeCommit:
		| {
				transaction?: ValueTransaction<
					DefinitionTestValues<Definition>,
					DefinitionTestContext<Definition>
				>
		  }
		| undefined
	const refresh = (): void => {
		const nextResolved = resolveDefinition(
			state.definition,
			state.values,
			state.context,
			{ disabled: state.disabled, readOnly: state.readOnly },
			state.resolved,
		)
		state.resolved = nextResolved
		state.inspection = createInspection(state.values, nextResolved)
	}
	const coordinator = createValueCoordinator({
		afterUpdate: updates.afterUpdate,
		beforeUpdate: updates.beforeUpdate,
		commit: (transaction) => {
			state.values = transaction.nextValues as DefinitionTestValues<Definition>
			if (activeCommit !== undefined) activeCommit.transaction = transaction
			refresh()
		},
		getContext: () => state.context,
		getValues: () => state.values,
		middleware: updates.middleware,
	})

	const createTransition = (
		before: DefinitionInspection<Definition>,
	): DefinitionTransition<Definition> =>
		Object.freeze({
			after: state.inspection,
			before,
			changes: diffInspections(before, state.inspection),
		})
	const rerender = (
		next: DefinitionTesterRerenderOptions<Definition>,
	): DefinitionTransition<Definition> => {
		const before = state.inspection
		if ("context" in next) {
			state.context = next.context as DefinitionTestContext<Definition>
		}
		if ("disabled" in next) state.disabled = next.disabled === true
		if ("readOnly" in next) state.readOnly = next.readOnly === true
		refresh()
		return createTransition(before)
	}
	const runManaged = (
		dispatch: () => unknown,
	): ManagedDefinitionTransition<Definition> => {
		const before = state.inspection
		const commit: NonNullable<typeof activeCommit> = {}
		activeCommit = commit
		try {
			const result = dispatch()
			const transition = createTransition(before)
			return Object.freeze({
				...transition,
				...(commit.transaction === undefined
					? { committed: false as const, transaction: undefined }
					: { committed: true as const, transaction: commit.transaction }),
				result,
			})
		} finally {
			activeCommit = undefined
		}
	}
	const arrayAction = <
		Path extends ArrayFieldPath<DefinitionTestValues<Definition>>,
	>(
		path: Path,
		recipe: (items: unknown[]) => void,
		source:
			| { readonly action: "append"; readonly index: number }
			| { readonly action: "remove"; readonly index: number }
			| {
					readonly action: "move"
					readonly fromIndex: number
					readonly toIndex: number
			  },
	): ManagedDefinitionTransition<Definition> => {
		const array = state.inspection.array(path)
		if (array.disabled || array.readOnly) {
			const transition = createTransition(state.inspection)
			return Object.freeze({
				...transition,
				committed: false,
				result: undefined,
				transaction: undefined,
			})
		}
		const arrayPath = fieldPathSegments(state.values, path)
		return runManaged(() =>
			coordinator.dispatch(
				(draft) => {
					recipe(getMutableArrayValue(draft, path))
				},
				{ ...source, path, type: "array" },
				{ arrayPath },
			),
		)
	}
	const tester: DefinitionTester<Definition> = {
		get current() {
			return state.inspection
		},
		get values() {
			return state.values as DeepReadonly<DefinitionTestValues<Definition>>
		},
		array: (path) => state.inspection.array(path),
		append: (path) => {
			const array = state.inspection.array(path)
			const index = getMutableArrayValue(state.values, path).length
			return arrayAction(
				path,
				(items) => items.push(cloneItemDefault(array.itemDefault)),
				{ action: "append", index },
			)
		},
		field: (path) => state.inspection.field(path),
		move: (path, fromIndex, toIndex) => {
			const items = getMutableArrayValue(state.values, path)
			assertArrayIndex(path, fromIndex, items.length, "fromIndex")
			assertArrayIndex(path, toIndex, items.length, "toIndex")
			return arrayAction(
				path,
				(draftItems) => {
					const [item] = draftItems.splice(fromIndex, 1)
					draftItems.splice(toIndex, 0, item)
				},
				{ action: "move", fromIndex, toIndex },
			)
		},
		node: (id) => state.inspection.node(id),
		remove: (path, index) => {
			const items = getMutableArrayValue(state.values, path)
			assertArrayIndex(path, index, items.length, "index")
			return arrayAction(
				path,
				(draftItems) => {
					draftItems.splice(index, 1)
				},
				{ action: "remove", index },
			)
		},
		rerender,
		resolveOptions: (path) => state.inspection.resolveOptions(path),
		setContext: (context) => rerender({ context }),
		setDisabled: (disabled) => rerender({ disabled }),
		setReadOnly: (readOnly) => rerender({ readOnly }),
		setValue: (path, value) => {
			state.inspection.field(path)
			return runManaged(() =>
				coordinator.dispatch((draft) => set(draft, path, value), {
					path,
					type: "control",
				}),
			)
		},
		update: (recipe) => runManaged(() => coordinator.update(recipe)),
	}
	return Object.freeze(tester)
}

/** Validates an index that must identify one current generated array item. */
function assertArrayIndex(
	path: string,
	index: number,
	length: number,
	name: "fromIndex" | "index" | "toIndex",
): void {
	if (Number.isSafeInteger(index) && index >= 0 && index < length) return
	throw new TypeError(
		`Generated array ${name} for "${path}" must be between 0 and ${Math.max(
			length - 1,
			0,
		)}`,
	)
}

/** Creates one immutable public projection around a private resolution. */
function createInspection<Definition extends FormDefinition>(
	values: DefinitionTestValues<Definition>,
	resolved: ResolvedDefinition,
): DefinitionInspection<Definition> {
	const snapshots = Object.freeze(
		resolved.nodes.map((node) => snapshotNode<Definition>(node)),
	)
	const byId = new Map(snapshots.map((node) => [node.id, node]))
	const fields = resolved.nodes.filter(
		(node): node is ResolvedFieldNode => node.kind === "field",
	)
	const arrays = resolved.nodes.filter(
		(node): node is ResolvedArrayNode => node.kind === "array",
	)
	const selectField = (path: string): ResolvedFieldNode =>
		selectPathNode("field", path, fields)
	const inspection: DefinitionInspection<Definition> = {
		nodes: snapshots,
		rootIds: Object.freeze(resolved.ui.map((node) => node.id)),
		values: values as DeepReadonly<DefinitionTestValues<Definition>>,
		array: (path) =>
			snapshotNode<Definition>(
				selectPathNode("array", path, arrays),
			) as DefinitionArraySnapshot<Definition>,
		field: (path) =>
			snapshotNode<Definition>(
				selectField(path),
			) as DefinitionFieldSnapshot<Definition>,
		node: (id) => {
			const node = byId.get(id)
			if (node !== undefined) return node
			throw new TypeError(
				`No resolved node with id "${id}". Available node ids: ${availableValues(
					snapshots.map((candidate) => candidate.id),
				)}`,
			)
		},
		resolveOptions: async (path) => {
			const field = selectField(path)
			if (field.options === undefined) {
				throw new TypeError(`Resolved field "${path}" does not define options`)
			}
			if (Array.isArray(field.options)) {
				return field.options as readonly DefinitionTestOption<Definition>[]
			}
			const controller = new AbortController()
			const run = createFieldOptionsResolution(
				field.options,
				field.optionValues,
				field.context,
				controller.signal,
			)
			return (await run.resolve()) as readonly DefinitionTestOption<Definition>[]
		},
	}
	return Object.freeze(inspection)
}

/** Projects only stable, observable definition behavior. */
function snapshotNode<Definition extends FormDefinition>(
	node: ResolvedNode,
): DefinitionNodeSnapshot<Definition> {
	const common = {
		className: typeof node.className === "string" ? node.className : undefined,
		disabled: node.disabled,
		id: node.id,
		kind: node.kind,
		...(node.parentId === undefined ? {} : { parentId: node.parentId }),
		readOnly: node.readOnly,
		scopePath: node.scopePath,
		span: node.span,
		visible: node.visible,
	}
	switch (node.kind) {
		case "field":
			return Object.freeze({
				...common,
				control: node.control,
				description: node.description,
				kind: "field",
				label: node.label,
				path: node.path,
				props: node.props,
				required: node.required,
				slotOptions: node.slotOptions,
			}) as DefinitionFieldSnapshot<Definition>
		case "section":
			return Object.freeze({
				...common,
				columns: node.columns,
				description: node.description,
				kind: "section",
				slotOptions: node.slotOptions,
				title: node.title,
			}) as DefinitionSectionSnapshot<Definition>
		case "array":
			return Object.freeze({
				...common,
				description: node.description,
				itemDefault: node.itemDefault,
				kind: "array",
				label: node.label,
				path: node.path,
				slotOptions: node.slotOptions,
			}) as DefinitionArraySnapshot<Definition>
		case "render":
			return Object.freeze({
				...common,
				kind: "render",
			}) as DefinitionRenderSnapshot
	}
}

/** Selects exactly one path-bound node and reports useful candidates. */
function selectPathNode<
	Node extends { readonly id: string; readonly path: string },
>(kind: "array" | "field", path: string, nodes: readonly Node[]): Node {
	const matches = nodes.filter((node) => node.path === path)
	if (matches.length === 1) return matches[0] as Node
	if (matches.length > 1) {
		throw new TypeError(
			`Multiple resolved ${kind} nodes use path "${path}". Select one by id: ${availableValues(
				matches.map((node) => node.id),
			)}`,
		)
	}
	throw new TypeError(
		`No resolved ${kind} at path "${path}". Available ${kind} paths: ${availableValues(
			nodes.map((node) => node.path),
		)}`,
	)
}

/** Formats a deterministic candidate list for selector errors. */
function availableValues(values: readonly string[]): string {
	return values.length === 0
		? "none"
		: values.map((value) => `"${value}"`).join(", ")
}

/** Computes exact added, removed, and changed public node projections. */
function diffInspections<Definition extends FormDefinition>(
	before: DefinitionInspection<Definition>,
	after: DefinitionInspection<Definition>,
): readonly DefinitionChange<Definition>[] {
	const beforeById = new Map(before.nodes.map((node) => [node.id, node]))
	const afterById = new Map(after.nodes.map((node) => [node.id, node]))
	const changes: DefinitionChange<Definition>[] = []
	for (const node of before.nodes) {
		const next = afterById.get(node.id)
		if (next === undefined || next.kind !== node.kind) {
			changes.push({ node, type: "removed" })
		}
	}
	for (const node of after.nodes) {
		const previous = beforeById.get(node.id)
		if (previous === undefined || previous.kind !== node.kind) {
			changes.push({ node, type: "added" })
			continue
		}
		const propertyChanges = diffNodeProperties(previous, node)
		if (propertyChanges.length === 0) continue
		changes.push({
			changes: propertyChanges,
			kind: node.kind,
			nodeId: node.id,
			...("path" in node ? { path: node.path } : {}),
			type: "changed",
		})
	}
	return Object.freeze(changes)
}

/** Computes granular public property changes for one stable node identity. */
function diffNodeProperties(
	before: Readonly<Record<string, unknown>>,
	after: Readonly<Record<string, unknown>>,
): readonly DefinitionPropertyChange[] {
	const changes: DefinitionPropertyChange[] = []
	const keys = new Set([...Object.keys(before), ...Object.keys(after)])
	for (const key of keys) {
		if (key === "id" || key === "kind") continue
		diffValue(before[key], after[key], key, changes)
	}
	return Object.freeze(changes)
}

/** Recursively compares plain configuration while treating opaque values atomically. */
function diffValue(
	before: unknown,
	after: unknown,
	property: string,
	changes: DefinitionPropertyChange[],
	seen = new WeakMap<object, WeakSet<object>>(),
): void {
	if (Object.is(before, after)) return
	if (!isDiffContainer(before) || !isDiffContainer(after)) {
		changes.push(Object.freeze({ after, before, property }))
		return
	}
	if (Array.isArray(before) !== Array.isArray(after)) {
		changes.push(Object.freeze({ after, before, property }))
		return
	}
	const seenAfter = seen.get(before)
	if (seenAfter?.has(after) === true) return
	const nextSeenAfter = seenAfter ?? new WeakSet<object>()
	nextSeenAfter.add(after)
	seen.set(before, nextSeenAfter)
	const keys = new Set([...Object.keys(before), ...Object.keys(after)])
	const beforeRecord = before as Readonly<Record<string, unknown>>
	const afterRecord = after as Readonly<Record<string, unknown>>
	for (const key of keys) {
		const childProperty = Array.isArray(after)
			? `${property}[${key}]`
			: `${property}.${key}`
		if (Object.hasOwn(before, key) !== Object.hasOwn(after, key)) {
			changes.push(
				Object.freeze({
					after: afterRecord[key],
					before: beforeRecord[key],
					property: childProperty,
				}),
			)
			continue
		}
		diffValue(beforeRecord[key], afterRecord[key], childProperty, changes, seen)
	}
}

/** Tests whether a resolved value is safe and useful to diff recursively. */
function isDiffContainer(
	value: unknown,
): value is Readonly<Record<string, unknown>> | readonly unknown[] {
	if (value === null || typeof value !== "object") return false
	if (Object.hasOwn(value, "$$typeof")) return false
	const prototype = Object.getPrototypeOf(value)
	return (
		prototype === null ||
		prototype === Object.prototype ||
		prototype === Array.prototype
	)
}

/** Tests whether a value can serve as React Hook Form field values. */
function isFieldValues(value: unknown): value is FieldValues {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}
