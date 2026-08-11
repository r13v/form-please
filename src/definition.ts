import type {
	ControlDefinitionRegistry,
	FormDefinition,
	FormInput,
	NormalizedNode,
	ReactUiContent,
	RenderNodeComponent,
	StandardSchema,
} from "./types.js"

/** A supported UI node discriminator. */
type NodeKind = "array" | "field" | "render" | "section"
/** A normalized node used by the definition resolver. */
type RuntimeNode = NormalizedNode & {
	/** Preserves normalized node properties without widening their contracts. */
	readonly [key: string]: unknown
	/** The node category used by resolution. */
	readonly kind: NodeKind
	/** Normalized child templates for sections and arrays. */
	readonly children?: readonly RuntimeNode[]
}
/** Runtime shape of schema-bound node helpers after their generic types erase. */
type RuntimeUiBuilder = {
	readonly field: (path: unknown, options: unknown) => object
	readonly section: (id: unknown, options: unknown) => object
	readonly array: (path: unknown, options: unknown) => object
	readonly render: (id: unknown, options: unknown) => object
}
/** Private symbol that stores a fragment's immutable authoring template. */
const fragmentSource = Symbol("form-please.fragment-source")
/** Private symbol that identifies an opaque fragment placement. */
const fragmentPlacement = Symbol("form-please.fragment-placement")
/** Tests whether one fragment belongs to the form kit doing normalization. */
type OwnsFragment = (fragment: object) => boolean
/** Private source data retained by a reusable fragment. */
type RuntimeFragment = {
	/** The exact Standard Schema exposed by the fragment. */
	readonly schema: StandardSchema
	/** Creates one opaque source placement for this fragment. */
	readonly fields: (options?: unknown) => object
	/** The immutable application-authored UI template. */
	readonly [fragmentSource]: readonly unknown[]
}
/** Runtime data stored inside one opaque fragment placement. */
type RuntimeFragmentPlacement = {
	/** The fragment whose source nodes must be expanded. */
	readonly fragment: RuntimeFragment
	/** The relative object path, or the current scope when absent. */
	readonly at?: string
}
/** Locates the local value passed to resolvers authored by one fragment. */
type ResolverScope = {
	/** The path appended after leaving fragment-local array scopes. */
	readonly appendPath: string
	/** The number of path segments contributed by local arrays and indexes. */
	readonly trimSegments: number
}
/** Additional normalization state for fragment expansion. */
type NormalizeOptions = {
	/** Prefix added to field and array paths before the next array boundary. */
	readonly pathPrefix: string
	/** Namespace added to explicit IDs from placed fragments. */
	readonly idPrefix: string
	/** Local resolver scope inherited by ordinary fragment nodes. */
	readonly resolverScope?: ResolverScope
}
/** Shared state for one form or fragment normalization pass. */
type NormalizeState = {
	/** Controls available to field nodes. */
	readonly controls: ControlDefinitionRegistry
	/** Scoped IDs already claimed by normalized nodes. */
	readonly ids: Set<string>
	/** Tests exact runtime form-kit ownership for nested fragments. */
	readonly ownsFragment: OwnsFragment
	/** Flat destination for normalized nodes. */
	readonly nodes: RuntimeNode[]
}
/** Fragment-local resolver scopes without observable normalized-node metadata. */
const resolverScopes = new WeakMap<RuntimeNode, ResolverScope>()
/** Properties shared by every normalized UI node after resolution. */
type ResolvedNodeBase<Kind extends NodeKind> = {
	/** Preserves non-renderer properties from the normalized definition. */
	readonly [key: string]: unknown
	/** The unique runtime ID, including any array item prefix. */
	readonly id: string
	/** The node category used by the renderer. */
	readonly kind: Kind
	/** The containing section or array node ID, when one exists. */
	readonly parentId?: string
	/** The array path that contains relative field paths for this node. */
	readonly scopePath: string
	/** Whether the renderer includes this node. */
	readonly visible: boolean
	/** Whether user interaction with this node is disabled. */
	readonly disabled: boolean
	/** Whether value changes in this node are read-only. */
	readonly readOnly: boolean
	/** The runtime context supplied to controls and render nodes. */
	readonly context: unknown
	/** The resolved class name, when the definition supplies one. */
	readonly className: unknown
	/** The validated span in the parent grid. */
	readonly span: number | "full" | undefined
}

/** A resolved field node ready for control and field-slot rendering. */
export type ResolvedFieldNode = ResolvedNodeBase<"field"> & {
	/** The absolute React Hook Form path for the field. */
	readonly path: string
	/** The registered control name. */
	readonly control: string
	/** The resolved field label. */
	readonly label: ReactUiContent | undefined
	/** The resolved field description. */
	readonly description: ReactUiContent | undefined
	/** The resolved field-slot configuration. */
	readonly slotOptions: unknown
	/** The resolved control configuration. */
	readonly options: unknown
	/** Whether the definition marks the field as required. */
	readonly required: boolean
}

/** A resolved section node ready for structural rendering. */
type ResolvedSectionNode = ResolvedNodeBase<"section"> & {
	/** The validated number of grid columns. */
	readonly columns: number
	/** The resolved section title. */
	readonly title: ReactUiContent | undefined
	/** The resolved section description. */
	readonly description: ReactUiContent | undefined
	/** The resolved section-slot configuration. */
	readonly slotOptions: unknown
	/** The resolved child nodes. */
	readonly children: readonly ResolvedNode[]
}

/** A resolved array node ready for field-array rendering. */
export type ResolvedArrayNode = ResolvedNodeBase<"array"> & {
	/** The absolute React Hook Form path for the array. */
	readonly path: string
	/** The item value or factory used by append actions. */
	readonly itemDefault: unknown
	/** The resolved array label. */
	readonly label: ReactUiContent | undefined
	/** The resolved array description. */
	readonly description: ReactUiContent | undefined
	/** The resolved array-slot configuration. */
	readonly slotOptions: unknown
	/** Resolved child nodes for each current array item. */
	readonly itemChildren: readonly (readonly ResolvedNode[])[]
}

/** A resolved custom render node ready for component rendering. */
type ResolvedRenderNode = ResolvedNodeBase<"render"> & {
	/** The React component inserted into the generated form tree. */
	readonly component: RenderNodeComponent
}

/** A normalized UI node with all dynamic properties resolved. */
export type ResolvedNode =
	| ResolvedArrayNode
	| ResolvedFieldNode
	| ResolvedRenderNode
	| ResolvedSectionNode

/** The root UI tree and flat index produced by definition resolution. */
export type ResolvedDefinition = {
	/** Resolved root nodes in render order. */
	readonly ui: readonly ResolvedNode[]
	/** All resolved nodes in depth-first order. */
	readonly nodes: readonly ResolvedNode[]
}

/** The default column and span scale for a form kit. */
const defaultGrid = Object.freeze([1, 2, 3, 4])
/** Path segments rejected to prevent prototype traversal. */
const reservedSegments = new Set(["__proto__", "constructor", "prototype"])

/** Stateless node helpers shared by every schema-bound definition builder. */
const uiBuilder: RuntimeUiBuilder = Object.freeze({
	field(path: unknown, options: unknown): object {
		return {
			...readBuilderOptions("Field", options),
			kind: "field",
			path,
		}
	},
	section(id: unknown, options: unknown): object {
		return {
			...readBuilderOptions("Section", options),
			id,
			kind: "section",
		}
	},
	array(path: unknown, options: unknown): object {
		const { children: buildChildren, ...nodeOptions } = readBuilderOptions(
			"Array",
			options,
		)
		if (typeof buildChildren !== "function") {
			throw new TypeError("Array builder children must be a function")
		}
		const children = buildChildren(uiBuilder) as unknown
		if (!Array.isArray(children)) {
			throw new TypeError("Array builder children must return a ui array")
		}
		return {
			...nodeOptions,
			children,
			kind: "array",
			path,
		}
	},
	render(id: unknown, options: unknown): object {
		return {
			...readBuilderOptions("Render", options),
			id,
			kind: "render",
		}
	},
})

/** Validates, sorts, and freezes a form kit grid scale. */
export function normalizeGrid(
	grid: readonly unknown[] | undefined,
	owner: "createFormKit",
): readonly number[] {
	if (grid === undefined) {
		return defaultGrid
	}
	if (!Array.isArray(grid) || grid.length === 0) {
		throw new TypeError(`${owner} grid must be a non-empty array`)
	}

	const unique = new Set<number>()
	for (const value of grid) {
		if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
			throw new TypeError(`${owner} grid values must be positive integers`)
		}
		if (unique.has(value)) {
			throw new TypeError(`${owner} grid cannot contain duplicate ${value}`)
		}
		unique.add(value)
	}
	if (!unique.has(1)) {
		throw new TypeError(`${owner} grid must include 1`)
	}

	return Object.freeze([...unique].sort((left, right) => left - right))
}

/** Resolves object or schema-bound builder authoring into one source object. */
function materializeDefinitionSource(
	source: unknown,
	owner: "Form" | "Fragment",
): unknown {
	if (typeof source !== "function") {
		return source
	}
	const ui = (source as (builder: RuntimeUiBuilder) => unknown)(uiBuilder)
	if (!Array.isArray(ui)) {
		throw new TypeError(`${owner} definition builder must return a ui array`)
	}
	return { ui }
}

/** Validates the configuration object supplied to one node helper. */
function readBuilderOptions(
	owner: "Array" | "Field" | "Render" | "Section",
	options: unknown,
): Record<string, unknown> {
	if (!isRecord(options)) {
		throw new TypeError(`${owner} builder options must be an object`)
	}
	return options
}

/** Validates and freezes one reusable schema-owned UI fragment. */
export function createFormFragment(
	schema: StandardSchema,
	source: unknown,
	controls: ControlDefinitionRegistry,
	ownsFragment: OwnsFragment,
): object {
	assertStandardSchema(schema, "Fragment")
	const materializedSource = materializeDefinitionSource(source, "Fragment")
	if (!isRecord(materializedSource) || !Array.isArray(materializedSource.ui)) {
		throw new TypeError("Fragment definition must contain a ui array")
	}

	const ui = snapshotSourceNodes(materializedSource.ui)
	normalizeNodes(
		ui,
		{
			controls,
			ids: new Set<string>(),
			nodes: [],
			ownsFragment,
		},
		"",
		undefined,
		{
			idPrefix: "",
			pathPrefix: "",
			resolverScope: { appendPath: "", trimSegments: 0 },
		},
	)

	let fragment: RuntimeFragment
	const fields = (options?: unknown): object => {
		const at = normalizeFragmentPlacementOptions(options)
		const placement = Object.freeze({
			fragment,
			...(at === undefined ? {} : { at }),
		})
		return Object.freeze({ [fragmentPlacement]: placement })
	}
	fragment = Object.freeze({
		fields,
		schema,
		[fragmentSource]: ui,
	})
	return fragment
}

/** Validates and freezes a user-authored form definition. */
export function normalizeDefinition<Schema extends StandardSchema>(
	schema: Schema,
	source: unknown,
	controls: ControlDefinitionRegistry,
	grid: readonly number[],
	ownsFragment: OwnsFragment = () => false,
): FormDefinition<Schema> {
	assertStandardSchema(schema, "Form")
	const materializedSource = materializeDefinitionSource(source, "Form")
	if (!isRecord(materializedSource) || !Array.isArray(materializedSource.ui)) {
		throw new TypeError("Form definition must contain a ui array")
	}

	const state = {
		controls,
		ids: new Set<string>(),
		ownsFragment,
		nodes: [] as RuntimeNode[],
	}
	const ui = normalizeNodes(materializedSource.ui, state, "", undefined, {
		idPrefix: "",
		pathPrefix: "",
	})

	return Object.freeze({
		schema,
		grid,
		ui,
		nodes: Object.freeze([...state.nodes]),
	}) as FormDefinition<Schema>
}

/** Validates and normalizes one nested list of UI nodes. */
function normalizeNodes(
	source: readonly unknown[],
	state: NormalizeState,
	scopePath: string,
	parentId: string | undefined,
	options: NormalizeOptions,
): readonly RuntimeNode[] {
	const normalized: RuntimeNode[] = []
	for (const candidate of source) {
		if (!isRecord(candidate)) {
			throw new TypeError("UI nodes must be objects")
		}

		const placement = readFragmentPlacement(candidate)
		if (placement !== undefined) {
			if (!state.ownsFragment(placement.fragment)) {
				throw new TypeError(
					"Fragment placement must come from this exact form kit",
				)
			}
			const at = placement.at ?? ""
			const pathPrefix = joinPath(options.pathPrefix, at)
			const idPrefix =
				placement.at === undefined
					? options.idPrefix
					: joinId(options.idPrefix, placement.at)
			normalized.push(
				...normalizeNodes(
					placement.fragment[fragmentSource],
					state,
					scopePath,
					parentId,
					{
						idPrefix,
						pathPrefix,
						resolverScope: { appendPath: pathPrefix, trimSegments: 0 },
					},
				),
			)
			continue
		}

		const kind = candidate.kind
		if (
			kind !== "array" &&
			kind !== "field" &&
			kind !== "render" &&
			kind !== "section"
		) {
			throw new TypeError(`Unknown UI node kind "${String(kind)}"`)
		}

		const path =
			kind === "field" || kind === "array"
				? joinPath(options.pathPrefix, normalizePath(candidate.path))
				: undefined
		if (kind === "field") {
			if (
				typeof candidate.control !== "string" ||
				!Object.hasOwn(state.controls, candidate.control)
			) {
				throw new TypeError(`Unknown control "${String(candidate.control)}"`)
			}
		}
		if (kind === "array" && !("itemDefault" in candidate)) {
			throw new TypeError(`Array "${path}" requires itemDefault`)
		}

		const fallbackId =
			path === undefined ? `${kind}:${state.nodes.length}` : `${kind}:${path}`
		const localId = normalizeId(candidate.id ?? fallbackId)
		const id =
			candidate.id === undefined ? localId : joinId(options.idPrefix, localId)
		const scopedId = scopePath.length === 0 ? id : `${scopePath}:${id}`
		if (state.ids.has(scopedId)) {
			throw new TypeError(`Duplicate UI node id "${id}"`)
		}
		state.ids.add(scopedId)

		const rawChildren = candidate.children
		if (
			(kind === "array" || kind === "section") &&
			!Array.isArray(rawChildren)
		) {
			throw new TypeError(`${kind} node "${id}" requires children`)
		}
		const childScope =
			kind === "array" && path !== undefined
				? joinPath(scopePath, path)
				: scopePath
		const childOptions =
			kind === "array" && path !== undefined
				? {
						idPrefix: options.idPrefix,
						pathPrefix: "",
						...(options.resolverScope === undefined
							? {}
							: {
									resolverScope: {
										appendPath: options.resolverScope.appendPath,
										trimSegments:
											options.resolverScope.trimSegments +
											path.split(".").length +
											1,
									},
								}),
					}
				: options
		const children = Array.isArray(rawChildren)
			? normalizeNodes(rawChildren, state, childScope, id, childOptions)
			: undefined
		const node = Object.freeze({
			...candidate,
			id,
			kind,
			...(path === undefined ? {} : { path }),
			...(parentId === undefined ? {} : { parentId }),
			scopePath,
			...(children === undefined ? {} : { children }),
		}) as RuntimeNode
		if (options.resolverScope !== undefined) {
			resolverScopes.set(node, options.resolverScope)
		}
		state.nodes.push(node)
		normalized.push(node)
	}
	return Object.freeze(normalized)
}

/** Retains one immutable shallow snapshot of fragment-authored source nodes. */
function snapshotSourceNodes(source: readonly unknown[]): readonly unknown[] {
	return Object.freeze(
		source.map((candidate) => {
			if (
				!isRecord(candidate) ||
				readFragmentPlacement(candidate) !== undefined
			) {
				return candidate
			}
			return Object.freeze({
				...candidate,
				...(Array.isArray(candidate.children)
					? { children: snapshotSourceNodes(candidate.children) }
					: {}),
			})
		}),
	)
}

/** Reads private runtime data from an opaque fragment placement. */
function readFragmentPlacement(
	candidate: Record<string, unknown>,
): RuntimeFragmentPlacement | undefined {
	const placement = (candidate as Record<PropertyKey, unknown>)[
		fragmentPlacement
	]
	if (placement === undefined) {
		return undefined
	}
	if (!isRecord(placement) || !isRecord(placement.fragment)) {
		throw new TypeError("Fragment placement is invalid")
	}
	return placement as RuntimeFragmentPlacement
}

/** Validates the optional object path supplied to `fragment.fields`. */
function normalizeFragmentPlacementOptions(
	options: unknown,
): string | undefined {
	if (options === undefined) {
		return undefined
	}
	if (!isRecord(options) || !("at" in options)) {
		throw new TypeError("Fragment placement options must contain an at path")
	}
	return normalizePath(options.at)
}

/** Resolves all dynamic definition values for the current input and context. */
export function resolveDefinition<Schema extends StandardSchema, Context>(
	definition: FormDefinition<Schema>,
	values: FormInput<Schema>,
	context: Context,
	options: {
		/** Disables all nodes in the resolved definition. */
		readonly disabled?: boolean
		/** Makes all nodes in the resolved definition read-only. */
		readonly readOnly?: boolean
	},
	previous?: ResolvedDefinition,
): ResolvedDefinition {
	const resolvedNodes: ResolvedNode[] = []
	const resolveNodes = (
		nodes: readonly RuntimeNode[],
		pathPrefix: string,
		idPrefix: string,
		parent: {
			/** Whether the parent is visible. */
			readonly visible: boolean
			/** Whether the parent is disabled. */
			readonly disabled: boolean
			/** Whether the parent is read-only. */
			readonly readOnly: boolean
			/** The parent grid column count, when it defines a grid. */
			readonly columns?: number
		},
		previousNodes?: readonly ResolvedNode[],
	): readonly ResolvedNode[] => {
		const nextNodes = nodes.map((node, index) => {
			const { children: _templateChildren, ...nodeShell } = node
			const resolverValues = getResolverValues(node, values, pathPrefix)
			const id = idPrefix.length === 0 ? node.id : `${idPrefix}.${node.id}`
			const previousCandidate = previousNodes?.[index]
			const previousNode =
				previousCandidate?.id === id && previousCandidate.kind === node.kind
					? previousCandidate
					: undefined
			const visible =
				parent.visible &&
				resolveValue(node.visible, true, resolverValues, pathPrefix, context)
			const disabled =
				parent.disabled ||
				resolveValue(node.disabled, false, resolverValues, pathPrefix, context)
			const readOnly =
				parent.readOnly ||
				resolveValue(node.readOnly, false, resolverValues, pathPrefix, context)
			const common = {
				...nodeShell,
				id,
				visible,
				disabled,
				readOnly,
				context,
				className: resolveOptional(
					node.className,
					resolverValues,
					pathPrefix,
					context,
				),
				span: validateSpan(
					resolveOptional(node.span, resolverValues, pathPrefix, context),
					definition.grid,
					parent.columns,
				),
			}

			let resolved: ResolvedNode
			switch (node.kind) {
				case "field": {
					const path = joinPath(pathPrefix, String(node.path))
					resolved = Object.freeze({
						...common,
						kind: "field",
						path,
						control: String(node.control),
						label: resolveOptional<ReactUiContent | undefined>(
							node.label,
							resolverValues,
							pathPrefix,
							context,
						),
						description: resolveOptional<ReactUiContent | undefined>(
							node.description,
							resolverValues,
							pathPrefix,
							context,
						),
						slotOptions: resolveOptional(
							node.slotOptions,
							resolverValues,
							pathPrefix,
							context,
						),
						required: resolveValue(
							node.required,
							false,
							resolverValues,
							pathPrefix,
							context,
						),
						options: resolveOptional(
							node.options,
							resolverValues,
							pathPrefix,
							context,
						),
					})
					break
				}
				case "section": {
					const previousSection =
						previousNode?.kind === "section" ? previousNode : undefined
					const columns = validateColumns(
						resolveValue(node.columns, 1, resolverValues, pathPrefix, context),
						definition.grid,
					)
					const children = resolveNodes(
						node.children ?? [],
						pathPrefix,
						idPrefix,
						{ visible, disabled, readOnly, columns },
						previousSection?.children,
					)
					resolved = Object.freeze({
						...common,
						kind: "section",
						columns,
						title: resolveOptional<ReactUiContent | undefined>(
							node.title,
							resolverValues,
							pathPrefix,
							context,
						),
						description: resolveOptional<ReactUiContent | undefined>(
							node.description,
							resolverValues,
							pathPrefix,
							context,
						),
						slotOptions: resolveOptional(
							node.slotOptions,
							resolverValues,
							pathPrefix,
							context,
						),
						children,
					})
					break
				}
				case "array": {
					const previousArray =
						previousNode?.kind === "array" ? previousNode : undefined
					const path = joinPath(pathPrefix, String(node.path))
					const arrayValue = getPathValue(values, path)
					const itemChildren = Array.isArray(arrayValue)
						? reuseResolvedItems(
								previousArray?.itemChildren,
								arrayValue.map((_item, index) =>
									resolveNodes(
										node.children ?? [],
										`${path}.${index}`,
										`${idPrefix}${idPrefix.length === 0 ? "" : "."}${path}.${index}`,
										{ visible, disabled, readOnly },
										previousArray?.itemChildren[index],
									),
								),
							)
						: reuseResolvedItems(previousArray?.itemChildren, [])
					resolved = Object.freeze({
						...common,
						kind: "array",
						path,
						itemDefault: node.itemDefault,
						label: resolveOptional<ReactUiContent | undefined>(
							node.label,
							resolverValues,
							pathPrefix,
							context,
						),
						description: resolveOptional<ReactUiContent | undefined>(
							node.description,
							resolverValues,
							pathPrefix,
							context,
						),
						slotOptions: resolveOptional(
							node.slotOptions,
							resolverValues,
							pathPrefix,
							context,
						),
						itemChildren,
					})
					break
				}
				case "render":
					resolved = Object.freeze({
						...common,
						kind: "render",
						component: node.component as RenderNodeComponent,
					})
					break
			}
			if (
				previousNode !== undefined &&
				hasEqualResolvedProperties(previousNode, resolved)
			) {
				resolved = previousNode
			}
			resolvedNodes.push(resolved)
			return resolved
		})
		return reuseResolvedItems(previousNodes, nextNodes)
	}

	const ui = resolveNodes(
		definition.ui as readonly RuntimeNode[],
		"",
		"",
		{
			visible: true,
			disabled: options.disabled === true,
			readOnly: options.readOnly === true,
		},
		previous?.ui,
	)
	const nodes = reuseResolvedItems(previous?.nodes, resolvedNodes)
	return previous !== undefined &&
		ui === previous.ui &&
		nodes === previous.nodes
		? previous
		: Object.freeze({ ui, nodes })
}

/** Reuses a frozen resolved list when each item retains its reference. */
function reuseResolvedItems<Value>(
	previous: readonly Value[] | undefined,
	next: Value[],
): readonly Value[] {
	return previous !== undefined &&
		previous.length === next.length &&
		next.every((item, index) => Object.is(item, previous[index]))
		? previous
		: Object.freeze(next)
}

/** Compares one resolved node after its child lists have been reconciled. */
function hasEqualResolvedProperties(
	previous: ResolvedNode,
	next: ResolvedNode,
): boolean {
	const keys = Object.keys(next)
	return (
		Object.keys(previous).length === keys.length &&
		keys.every((key) => hasEqualResolvedValue(previous[key], next[key]))
	)
}

/** Compares opaque resolved values without traversing nested configuration. */
function hasEqualResolvedValue(previous: unknown, next: unknown): boolean {
	if (Object.is(previous, next)) return true
	if (previous === null || next === null) return false
	if (typeof previous !== "object" || typeof next !== "object") return false

	const prototype = Object.getPrototypeOf(next)
	if (
		prototype !== Object.getPrototypeOf(previous) ||
		(prototype !== null &&
			prototype !== Object.prototype &&
			prototype !== Array.prototype)
	) {
		return false
	}
	const keys = Reflect.ownKeys(next)
	return (
		Reflect.ownKeys(previous).length === keys.length &&
		keys.every(
			(key) =>
				Object.hasOwn(previous, key) &&
				Object.is(
					(previous as Record<PropertyKey, unknown>)[key],
					(next as Record<PropertyKey, unknown>)[key],
				),
		)
	)
}

/** Selects the local value for fragment resolvers or the complete form input. */
function getResolverValues(
	node: RuntimeNode,
	values: unknown,
	pathPrefix: string,
): unknown {
	const scope = resolverScopes.get(node)
	if (scope === undefined) {
		return values
	}
	const prefixSegments = pathPrefix.length === 0 ? [] : pathPrefix.split(".")
	if (scope.trimSegments > prefixSegments.length) {
		throw new TypeError("Fragment resolver scope is invalid")
	}
	const basePath = prefixSegments
		.slice(0, prefixSegments.length - scope.trimSegments)
		.join(".")
	const localPath = joinPath(basePath, scope.appendPath)
	return localPath.length === 0 ? values : getPathValue(values, localPath)
}

/** Resolves a value or uses its default when it is absent. */
function resolveValue<Value, Context>(
	value: unknown,
	fallback: Value,
	values: unknown,
	pathPrefix: string,
	context: Context,
): Value {
	return value === undefined
		? fallback
		: resolveOptional<Value>(value, values, pathPrefix, context)
}

/** Resolves a synchronous UI value when it is a function. */
function resolveOptional<Value = unknown, Context = unknown>(
	value: unknown,
	values: unknown,
	_pathPrefix: string,
	context: Context,
): Value {
	if (typeof value !== "function") {
		return value as Value
	}
	const result = (
		value as (
			resolverValues: unknown,
			details: {
				/** The readonly runtime context for the resolver. */
				readonly context: Readonly<Context>
			},
		) => unknown
	)(values, { context })
	if (
		result !== null &&
		(typeof result === "object" || typeof result === "function") &&
		"then" in result &&
		typeof result.then === "function"
	) {
		throw new TypeError("UI resolvers must be synchronous")
	}
	return result as Value
}

/** Reads a value from an object by a validated dot path. */
function getPathValue(value: unknown, path: string): unknown {
	if (path.length === 0) {
		return value
	}
	let current = value
	for (const segment of path.split(".")) {
		if (current === null || typeof current !== "object") {
			return undefined
		}
		current = (current as Record<string, unknown>)[segment]
	}
	return current
}

/** Validates a relative field or array path. */
function normalizePath(value: unknown): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new TypeError("Field and array paths must be non-empty strings")
	}
	if (!/^[^.[\]]+(?:\.[^.[\]]+)*$/.test(value)) {
		throw new TypeError(`Path "${value}" uses invalid React Hook Form syntax`)
	}
	const segments = value.split(".")
	for (const [index, segment] of segments.entries()) {
		if (segment.length === 0 || reservedSegments.has(segment)) {
			throw new TypeError(`Path "${value}" contains an invalid segment`)
		}
		if (index === 0 && /^\d+$/.test(segment)) {
			throw new TypeError(`Path "${value}" starts with an array index`)
		}
	}
	return value
}

/** Validates a non-empty UI node ID. */
function normalizeId(value: unknown): string {
	if (typeof value !== "string" || value.length === 0) {
		throw new TypeError("UI node ids must be non-empty strings")
	}
	return value
}

/** Joins a path scope and relative path. */
function joinPath(prefix: string, path: string): string {
	if (prefix.length === 0) {
		return path
	}
	if (path.length === 0) {
		return prefix
	}
	return `${prefix}.${path}`
}

/** Joins deterministic fragment placement and explicit node ID namespaces. */
function joinId(prefix: string, id: string): string {
	if (prefix.length === 0) {
		return id
	}
	if (id.length === 0) {
		return prefix
	}
	return `${prefix}:${id}`
}

/** Validates a section column count against the kit grid. */
function validateColumns(value: unknown, grid: readonly number[]): number {
	if (typeof value !== "number" || !grid.includes(value)) {
		throw new TypeError(`Section layout columns must use the kit grid`)
	}
	return value
}

/** Validates a node span against the kit grid and its parent grid. */
function validateSpan(
	value: unknown,
	grid: readonly number[],
	parentColumns?: number,
): number | "full" | undefined {
	if (value === undefined || value === "full") {
		return value
	}
	if (
		typeof value !== "number" ||
		!grid.includes(value) ||
		(parentColumns !== undefined && value > parentColumns)
	) {
		throw new TypeError("Layout span must use the kit grid")
	}
	return value
}

/** Asserts that a value implements the Standard Schema validation contract. */
function assertStandardSchema(
	value: unknown,
	owner: "Form" | "Fragment",
): asserts value is StandardSchema {
	if (
		!isRecord(value) ||
		!isRecord(value["~standard"]) ||
		typeof value["~standard"].validate !== "function"
	) {
		throw new TypeError(
			`${owner} schema must implement Standard Schema validate`,
		)
	}
}

/** Tests whether a value is a non-array object record. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value)
}
