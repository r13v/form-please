import type { StandardSchemaV1 } from "@standard-schema/spec"
import type {
	ComponentPropsWithoutRef,
	ComponentType,
	CSSProperties,
	HTMLAttributes,
	LabelHTMLAttributes,
	ReactElement,
	ReactNode,
} from "react"
import type {
	FieldArrayPathValue,
	FieldPathValue,
	FieldValues,
	FieldArrayPath as RhfFieldArrayPath,
	FieldPath as RhfFieldPath,
} from "react-hook-form"

/** A Standard Schema validator used by a form definition. */
export type StandardSchema<Input = unknown, Output = Input> = StandardSchemaV1<
	Input,
	Output
>
/** The editable input value accepted by a form schema. */
export type FormInput<Schema extends StandardSchemaV1> =
	StandardSchemaV1.InferInput<Schema>
/** The validated and possibly transformed value produced by a form schema. */
export type FormOutput<Schema extends StandardSchemaV1> =
	StandardSchemaV1.InferOutput<Schema>

/** A value that recursive readonly conversion must preserve. */
type Primitive = bigint | boolean | null | number | string | symbol | undefined
/** A browser or language object that recursive readonly conversion must preserve. */
type NativeLeaf = Blob | Date | File | RegExp
/** A terminal value in a recursively readonly data structure. */
type Leaf = ((...args: never[]) => unknown) | NativeLeaf | Primitive

/** Makes nested objects and arrays readonly while preserving leaf values. */
export type DeepReadonly<Value> = Value extends Leaf
	? Value
	: Value extends readonly (infer Item)[]
		? readonly DeepReadonly<Item>[]
		: Value extends object
			? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
			: Value

/** A React Hook Form dot path that selects a field in `Value`. */
export type FieldPath<Value> = Value extends FieldValues
	? RhfFieldPath<Value>
	: never
/** The value selected from `Value` by a React Hook Form dot path. */
export type PathValue<
	Value,
	Path extends FieldPath<Value>,
> = Value extends FieldValues
	? FieldPathValue<Value, Extract<Path, RhfFieldPath<Value>>>
	: never

/** Marks one control option value for narrowing to a field's schema input union. */
declare const choiceValue: unique symbol
export type ChoiceValue<Value> = Value & {
	readonly [choiceValue]?: Value
}
/** A React Hook Form dot path that selects an object array in `Value`. */
export type ArrayFieldPath<Value> = Value extends FieldValues
	? RhfFieldArrayPath<Value>
	: never

/** A validation problem that the form can display. */
export type FormIssue = {
	/** The user-facing validation message. */
	readonly message: string
	/** The input path related to the issue, when one exists. */
	readonly path?: string
}

/** Values, metadata, and actions supplied to a registered control component. */
export type ControlProps<
	Value,
	Options = Record<string, never>,
	Context = unknown,
> = {
	/** The absolute React Hook Form path for this control. */
	readonly path: string
	/** The current field value. */
	readonly value: Value
	/** Replaces the current field value. */
	setValue(value: Value): void
	/** Marks the field as touched through its blur handler. */
	blur(): void
	/** Native input attributes and the registration reference. */
	readonly input: {
		/** The unique DOM ID for the generated input. */
		readonly id: string
		/** The input name used by React Hook Form. */
		readonly name: string
		/** Connects a focusable input element to React Hook Form. */
		ref(element: HTMLElement | null): void
		/** IDs of elements that describe the input. */
		readonly "aria-describedby"?: string
	}
	/** Validation and interaction state for the field. */
	readonly meta: {
		/** Whether the current value differs from its default value. */
		readonly dirty: boolean
		/** Whether the user has blurred the field. */
		readonly touched: boolean
		/** Whether React Hook Form is validating the field. */
		readonly validating: boolean
		/** All current validation issues for the field. */
		readonly errors: readonly FormIssue[]
		/** Validation issues that the UI should show now. */
		readonly displayErrors: readonly FormIssue[]
		/** Whether the field has at least one validation issue. */
		readonly invalid: boolean
	}
	/** Control-specific options from the field definition. */
	readonly options: Readonly<Options>
	/** The deeply readonly runtime context for the form. */
	readonly context: DeepReadonly<Context>
	/** Whether the control must reject user input. */
	readonly disabled: boolean
	/** Whether the control must prevent value changes while remaining interactive. */
	readonly readOnly: boolean
	/** Whether the definition marks the field as required. */
	readonly required: boolean
}

/** A private key that carries control type information without runtime data. */
declare const controlTypes: unique symbol
/** Type information retained by a control definition for inference. */
type ControlTypes<Value, Options, Context> = {
	/** The field value accepted by the control. */
	readonly value: Value
	/** The configuration accepted by the control. */
	readonly options: Options
	/** The runtime context required by the control. */
	readonly context: Context
	/** Field-dependent choice options derived from the declared options type. */
	readonly choiceOptions: ChoiceOptionsTypeFor<Options>
}

/** A registered control component and its inferred type contract. */
export type ControlDefinition<
	Value,
	Options = Record<string, never>,
	Context = unknown,
> = {
	/** The React component that renders the control. */
	readonly component: ComponentType<ControlProps<Value, Options, Context>>
	/** Phantom type data used to infer the control contract. */
	readonly [controlTypes]?: ControlTypes<Value, Options, Context>
}
/** A control definition with an unknown contract. */
export type AnyControlDefinition = {
	/** The registered control component. */
	readonly component: unknown
	/** Phantom type data used to infer the control contract. */
	readonly [controlTypes]?: {
		readonly value: unknown
		readonly options: unknown
		readonly context: unknown
		readonly choiceOptions: unknown
	}
}
/** A readonly registry of named control definitions. */
export type ControlDefinitionRegistry = Readonly<
	Record<string, AnyControlDefinition>
>
/** Extracts the field value accepted by a control definition. */
export type ControlValueOf<Control> = Control extends {
	/** Phantom type data retained by a control definition. */
	readonly [controlTypes]?: { readonly value: infer Value }
}
	? Value
	: never
/** Extracts the configuration accepted by a control definition. */
export type ControlOptionsOf<Control> = Control extends {
	/** Phantom type data retained by a control definition. */
	readonly [controlTypes]?: { readonly options: infer Options }
}
	? Options
	: never

/** Extracts the selectable member type from a scalar or array field value. */
type FieldChoiceValue<Value> = Value extends readonly (infer Item)[]
	? Item
	: Exclude<Value, undefined>

/** Replaces one marked choice value with its compatible field member union. */
type ResolveChoiceValue<Value, FieldValue> =
	IsChoiceValue<Value> extends true
		? Value extends { readonly [choiceValue]?: infer Allowed }
			? Extract<FieldChoiceValue<FieldValue>, Allowed>
			: never
		: Value

/** Resolves a scalar choice or marked properties on one structured choice. */
type ResolveChoiceItem<Item, FieldValue> =
	IsChoiceValue<Item> extends true
		? ResolveChoiceValue<Item, FieldValue>
		: Item extends object
			? {
					readonly [Key in keyof Item]: ResolveChoiceValue<
						Item[Key],
						FieldValue
					>
				}
			: Item

/** Resolves marked items in one immediate control-options collection. */
type ResolveChoiceCollection<Value, FieldValue> =
	Value extends readonly (infer Item)[]
		? readonly ResolveChoiceItem<Item, FieldValue>[]
		: Value

/** Tests whether one value carries the choice marker. */
type IsChoiceValue<Value> =
	IsAny<Value> extends true
		? false
		: IsNever<Value> extends true
			? false
			: typeof choiceValue extends keyof Value
				? true
				: false

/** Tests whether a collection item contains a marked choice value. */
type IsChoiceItem<Item> =
	IsChoiceValue<Item> extends true
		? true
		: Item extends object
			? true extends {
					[Key in keyof Item]: IsChoiceValue<Item[Key]>
				}[keyof Item]
				? true
				: false
			: false

/** Tests whether one options property is a marked choice collection. */
type IsChoiceCollection<Value> = Value extends readonly (infer Item)[]
	? IsChoiceItem<Item>
	: false

/** Finds immediate options properties that contain marked choices. */
type ChoiceCollectionKeyOf<Options> = {
	[Key in keyof Options]-?: true extends IsChoiceCollection<Options[Key]>
		? Key
		: never
}[keyof Options]
type ChoiceCollectionKey<Options> = Options extends unknown
	? ChoiceCollectionKeyOf<Options>
	: never

/** Applies marked choice collections to a field value supplied later. */
interface ChoiceOptionsType {
	readonly fieldValue: unknown
	readonly type: object
}

/** Replaces marked collections without collapsing an options union. */
type ResolveChoiceOptions<
	Options,
	Keys extends PropertyKey,
	FieldValue,
> = Options extends unknown
	? Omit<Options, Extract<Keys, keyof Options>> & {
			readonly [Key in Extract<Keys, keyof Options>]: ResolveChoiceCollection<
				Options[Key],
				FieldValue
			>
		}
	: never

/** Retains one options type for later field specialization. */
interface ResolveChoiceOptionsType<Options, Keys extends PropertyKey>
	extends ChoiceOptionsType {
	readonly type: ResolveChoiceOptions<Options, Keys, this["fieldValue"]>
}

/** Derives an optional specialization contract once per control options type. */
type ChoiceOptionsTypeFor<Options> = [ChoiceCollectionKey<Options>] extends [
	never,
]
	? undefined
	: ResolveChoiceOptionsType<Options, ChoiceCollectionKey<Options>>

/** Reads the cached specialization contract from a control definition. */
type ChoiceOptionsTypeOf<Control> = Control extends {
	readonly [controlTypes]?: { readonly choiceOptions: infer OptionsType }
}
	? OptionsType
	: undefined

/** Specializes the declared control options for one schema field path. */
type ControlOptionsFor<Control, FieldValue> =
	ChoiceOptionsTypeOf<Control> extends infer OptionsType extends
		ChoiceOptionsType
		? (OptionsType & { readonly fieldValue: FieldValue })["type"]
		: ControlOptionsOf<Control>
/** Extracts the runtime context required by a control definition. */
export type ControlContextOf<Control> = Control extends {
	/** Phantom type data retained by a control definition. */
	readonly [controlTypes]?: { readonly context: infer Context }
}
	? Context
	: never

/** A column count or span in the default form grid. */
export type DefaultGridValue = 1 | 2 | 3 | 4
/** The deeply readonly form input supplied to a UI resolver. */
export type UiResolverValues<Input> = DeepReadonly<Input>
/** Additional runtime data supplied to a UI resolver. */
export type UiResolverDetails<Context = unknown> = {
	/** The deeply readonly context for the current form. */
	readonly context: DeepReadonly<Context>
}
/** Computes UI configuration from the current form input and context. */
export type UiResolver<Result, Input = unknown, Context = unknown> = (
	values: UiResolverValues<Input>,
	details: UiResolverDetails<Context>,
) => Result
/** A fixed value or a synchronous resolver that computes the value. */
export type Resolvable<Value, Input, Context> =
	| (Value extends (...args: never[]) => unknown ? never : Value)
	| UiResolver<Value, Input, Context>
/** Content that a form definition can place in labels and descriptions. */
export type ReactUiContent = ReactElement | string
/** Interaction state supplied to a custom render node. */
export type RenderNodeProps = {
	/** Whether an ancestor or the form disables this node. */
	readonly disabled: boolean
	/** Whether an ancestor or the form makes this node read-only. */
	readonly readOnly: boolean
}
/** A component inserted directly into the generated form tree. */
export type RenderNodeComponent = ComponentType<RenderNodeProps>

/** Detects the TypeScript `any` type. */
type IsAny<Value> = 0 extends 1 & Value ? true : false
/** Detects the TypeScript `never` type. */
type IsNever<Value> = [Value] extends [never] ? true : false
/** Detects the TypeScript `unknown` type without matching `any`. */
type IsUnknown<Value> =
	IsAny<Value> extends true
		? false
		: unknown extends Value
			? [Value] extends [unknown]
				? true
				: false
			: false
/** Detects a missing or unresolved type contract. */
type IsUntyped<Value> = IsNever<Value> extends true ? true : IsUnknown<Value>
/** Tests whether a kit context satisfies a control context requirement. */
type ContextMatches<Context, Requirement> =
	IsUntyped<Requirement> extends true
		? true
		: [Context] extends [Requirement]
			? true
			: false
/** Extracts string keys from a control registry. */
type ControlName<Controls extends ControlDefinitionRegistry> = Extract<
	keyof Controls,
	string
>
/** Selects controls whose value and context contracts match a field path. */
type CompatibleControlName<
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	Path extends FieldPath<Scope>,
> = {
	[Name in ControlName<Controls>]: IsAny<
		ControlValueOf<Controls[Name]>
	> extends true
		? never
		: IsUntyped<ControlValueOf<Controls[Name]>> extends true
			? never
			: [PathValue<Scope, Path>] extends [ControlValueOf<Controls[Name]>]
				? ContextMatches<Context, ControlContextOf<Controls[Name]>> extends true
					? Name
					: never
				: never
}[ControlName<Controls>]

/** Properties shared by all field nodes before path and control selection. */
type FieldNodeBase<Root, Context, FieldOptions, Grid extends number> = {
	/** Identifies this node as a field. */
	readonly kind: "field"
	/** Overrides the stable node ID derived from the path. */
	readonly id?: string
	/** Provides the field label or a resolver that computes it. */
	readonly label?: Resolvable<ReactUiContent, Root, Context>
	/** Provides supporting content below the field label. */
	readonly description?: Resolvable<ReactUiContent, Root, Context>
	/** Configures the registered field slot. */
	readonly slotOptions?: Resolvable<FieldOptions, Root, Context>
	/** Marks the field as required for presentation and accessibility. */
	readonly required?: Resolvable<boolean, Root, Context>
	/** Prevents user interaction with the control. */
	readonly disabled?: Resolvable<boolean, Root, Context>
	/** Prevents value changes without disabling the control. */
	readonly readOnly?: Resolvable<boolean, Root, Context>
	/** Controls whether the field is rendered. Hidden values remain registered. */
	readonly visible?: Resolvable<boolean, Root, Context>
	/** Adds a class to the field slot root. */
	readonly className?: Resolvable<string, Root, Context>
	/** Sets the field span in its parent grid. */
	readonly span?: Resolvable<Grid | "full", Root, Context>
}
/** Builds a field node for one path and its compatible controls. */
type FieldNodeForPath<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	Path extends FieldPath<Scope>,
	Grid extends number,
> = FieldNodeBase<Root, Context, FieldOptions, Grid> & {
	/** The field path relative to the current array scope. */
	readonly path: Path
} & {
		[Name in CompatibleControlName<Scope, Controls, Context, Path>]: {
			/** The registered control used to edit this field. */
			readonly control: Name
			// biome-ignore lint/complexity/noBannedTypes: This conditional detects whether the options type has required properties.
		} & ({} extends ControlOptionsFor<Controls[Name], PathValue<Scope, Path>>
			? {
					/** Configures the selected control. */
					readonly options?: Resolvable<
						ControlOptionsFor<Controls[Name], PathValue<Scope, Path>>,
						Root,
						Context
					>
				}
			: {
					/** Configures the selected control. */
					readonly options: Resolvable<
						ControlOptionsFor<Controls[Name], PathValue<Scope, Path>>,
						Root,
						Context
					>
				})
	}[CompatibleControlName<Scope, Controls, Context, Path>]

/** Creates the union of valid field nodes in the current scope. */
type FieldNodeInScope<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	Grid extends number,
> = {
	[Path in FieldPath<Scope>]: FieldNodeForPath<
		Root,
		Scope,
		Controls,
		Context,
		FieldOptions,
		Path,
		Grid
	>
}[FieldPath<Scope>]

/** A typed field node at the form root. */
export type FieldNode<
	Input,
	Controls extends ControlDefinitionRegistry,
	Context = unknown,
	FieldOptions = never,
	Grid extends number = DefaultGridValue,
> = FieldNodeInScope<Input, Input, Controls, Context, FieldOptions, Grid>

/** A section that groups child nodes in the current path scope. */
type SectionNodeInScope<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
	AllowFragments extends boolean = false,
> = {
	/** Identifies this node as a section. */
	readonly kind: "section"
	/** A stable ID that is unique within the current scope. */
	readonly id: string
	/** Provides the section heading or a resolver that computes it. */
	readonly title?: Resolvable<ReactUiContent, Root, Context>
	/** Provides supporting content for the section. */
	readonly description?: Resolvable<ReactUiContent, Root, Context>
	/** Configures the registered section slot. */
	readonly slotOptions?: Resolvable<SectionOptions, Root, Context>
	/** Controls whether the section and its children are rendered. */
	readonly visible?: Resolvable<boolean, Root, Context>
	/** Disables controls in this section. */
	readonly disabled?: Resolvable<boolean, Root, Context>
	/** Makes controls in this section read-only. */
	readonly readOnly?: Resolvable<boolean, Root, Context>
	/** Adds a class to the section slot root. */
	readonly className?: Resolvable<string, Root, Context>
	/** Sets the number of columns in the section grid. */
	readonly columns?: Resolvable<Grid, Root, Context>
	/** Sets the section span in its parent grid. */
	readonly span?: Resolvable<Grid | "full", Root, Context>
	/** Nodes rendered inside the section. */
	readonly children: readonly (AllowFragments extends true
		? UiSourceNodeInScope<
				Root,
				Scope,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid
			>
		: UiNodeInScope<
				Root,
				Scope,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid
			>)[]
}

/** A typed section node at the form root. */
export type SectionNode<
	Input,
	Controls extends ControlDefinitionRegistry,
	Context = unknown,
	FieldOptions = never,
	SectionOptions = never,
	ArrayOptions = never,
	Grid extends number = DefaultGridValue,
> = SectionNodeInScope<
	Input,
	Input,
	Controls,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid
>

/** Extracts the item type from an object-array path. */
type ArrayItem<
	Scope,
	Path extends ArrayFieldPath<Scope>,
> = Scope extends FieldValues
	? NonNullable<
			FieldArrayPathValue<Scope, Extract<Path, RhfFieldArrayPath<Scope>>>
		> extends readonly (infer Item)[]
		? Item
		: never
	: never
/** Builds an array node for one path and its item scope. */
type ArrayNodeForPath<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
	Path extends ArrayFieldPath<Scope>,
	AllowFragments extends boolean,
> = {
	/** Identifies this node as an array. */
	readonly kind: "array"
	/** Overrides the stable node ID derived from the path. */
	readonly id?: string
	/** The object-array path relative to the current array scope. */
	readonly path: Path
	/** Provides the array label or a resolver that computes it. */
	readonly label?: Resolvable<ReactUiContent, Root, Context>
	/** Provides supporting content for the array. */
	readonly description?: Resolvable<ReactUiContent, Root, Context>
	/** Configures the registered array slot. */
	readonly slotOptions?: Resolvable<ArrayOptions, Root, Context>
	/** Controls whether the array and its items are rendered. */
	readonly visible?: Resolvable<boolean, Root, Context>
	/** Prevents changes to this array and its controls. */
	readonly disabled?: Resolvable<boolean, Root, Context>
	/** Prevents value changes without disabling the array controls. */
	readonly readOnly?: Resolvable<boolean, Root, Context>
	/** Adds a class to the array slot root. */
	readonly className?: Resolvable<string, Root, Context>
	/** Sets the array span in its parent grid. */
	readonly span?: Resolvable<Grid | "full", Root, Context>
	/** A new item value or a factory that creates one for each append action. */
	readonly itemDefault: ArrayItem<Scope, Path> | (() => ArrayItem<Scope, Path>)
	/** Nodes rendered for each array item. */
	readonly children: readonly (AllowFragments extends true
		? UiSourceNodeInScope<
				Root,
				ArrayItem<Scope, Path>,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid
			>
		: UiNodeInScope<
				Root,
				ArrayItem<Scope, Path>,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid
			>)[]
}

/** Creates the union of valid array nodes in the current scope. */
type ArrayNodeInScope<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
	AllowFragments extends boolean = false,
> = {
	[Path in ArrayFieldPath<Scope>]: ArrayNodeForPath<
		Root,
		Scope,
		Controls,
		Context,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Grid,
		Path,
		AllowFragments
	>
}[ArrayFieldPath<Scope>]

/** A typed object-array node at the form root. */
export type ArrayNode<
	Input,
	Controls extends ControlDefinitionRegistry,
	Context = unknown,
	FieldOptions = never,
	SectionOptions = never,
	ArrayOptions = never,
	Grid extends number = DefaultGridValue,
> = ArrayNodeInScope<
	Input,
	Input,
	Controls,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid
>

/** A custom component node in the generated form tree. */
export type RenderNode<Input, Context = unknown> = {
	/** Identifies this node as custom rendered content. */
	readonly kind: "render"
	/** A stable ID that is unique within the current scope. */
	readonly id: string
	/** The React component rendered for this node. */
	readonly component: RenderNodeComponent
	/** Controls whether the component is rendered. */
	readonly visible?: Resolvable<boolean, Input, Context>
	/** Supplies disabled state to the component and its descendants. */
	readonly disabled?: Resolvable<boolean, Input, Context>
	/** Supplies read-only state to the component and its descendants. */
	readonly readOnly?: Resolvable<boolean, Input, Context>
}

/** A private key that carries fragment placement type information. */
declare const fragmentPlacementTypes: unique symbol
/** An opaque fragment placement accepted only in a compatible path scope. */
type FormFragmentPlacement<
	Input,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
	At extends string | undefined,
> = {
	/** Keeps ordinary node discriminants contextually typed and diagnostic. */
	readonly kind?: never
	readonly [fragmentPlacementTypes]: {
		/** The relative object path selected by this placement. */
		readonly at: At
		/** Makes a fragment input contravariant for structural host compatibility. */
		readonly acceptsInput: (input: Input) => void
		/** Makes a required context contravariant so hosts may provide more data. */
		readonly acceptsContext: (context: Context) => void
		/** Retains the owning form-kit control contract. */
		readonly controls: Controls
		/** Retains the owning form-kit field-slot contract. */
		readonly fieldOptions: FieldOptions
		/** Retains the owning form-kit section-slot contract. */
		readonly sectionOptions: SectionOptions
		/** Retains the owning form-kit array-slot contract. */
		readonly arrayOptions: ArrayOptions
		/** Retains the owning form-kit grid contract. */
		readonly grid: Grid
	}
}

/** Paths whose values are non-array objects that can host a fragment. */
type FragmentObjectPath<Scope> = {
	[Path in FieldPath<Scope>]: IsAny<PathValue<Scope, Path>> extends true
		? never
		: PathValue<Scope, Path> extends readonly unknown[]
			? never
			: PathValue<Scope, Path> extends FieldValues
				? Path
				: never
}[FieldPath<Scope>]

/** Fragment placements compatible with the current form or array-item scope. */
type FragmentPlacementInScope<
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
> =
	| FormFragmentPlacement<
			Scope,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid,
			undefined
	  >
	| {
			[Path in FragmentObjectPath<Scope>]: FormFragmentPlacement<
				PathValue<Scope, Path>,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid,
				Path
			>
	  }[FragmentObjectPath<Scope>]

/** A valid UI node in a form or nested array scope. */
type UiNodeInScope<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
> =
	| ArrayNodeInScope<
			Root,
			Scope,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid
	  >
	| FieldNodeInScope<Root, Scope, Controls, Context, FieldOptions, Grid>
	| RenderNode<Root, Context>
	| SectionNodeInScope<
			Root,
			Scope,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid
	  >

/** An ordinary UI node or opaque fragment placement accepted while authoring. */
type UiSourceNodeInScope<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
> =
	| FragmentPlacementInScope<
			Scope,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid
	  >
	| ArrayNodeInScope<
			Root,
			Scope,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid,
			true
	  >
	| FieldNodeInScope<Root, Scope, Controls, Context, FieldOptions, Grid>
	| RenderNode<Root, Context>
	| SectionNodeInScope<
			Root,
			Scope,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid,
			true
	  >

/** Removes authoring keys from every member of a node union. */
type OmitNodeKeys<Node, Keys extends PropertyKey> = Node extends unknown
	? Omit<Node, Keys>
	: never

/** Schema-bound helpers that create UI nodes in one path scope. */
type UiBuilder<
	Root,
	Scope,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
> = {
	/** Creates a field node at a compatible path. */
	readonly field: <const Path extends FieldPath<Scope>>(
		path: Path,
		options: OmitNodeKeys<
			FieldNodeForPath<
				Root,
				Scope,
				Controls,
				Context,
				FieldOptions,
				Path,
				Grid
			>,
			"kind" | "path"
		>,
	) => FieldNodeForPath<
		Root,
		Scope,
		Controls,
		Context,
		FieldOptions,
		Path,
		Grid
	>
	/** Creates a section node whose children stay in the current path scope. */
	readonly section: (
		id: string,
		options: OmitNodeKeys<
			SectionNodeInScope<
				Root,
				Scope,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid,
				true
			>,
			"id" | "kind"
		>,
	) => SectionNodeInScope<
		Root,
		Scope,
		Controls,
		Context,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Grid,
		true
	>
	/** Creates an array node and supplies helpers bound to its item scope. */
	readonly array: <const Path extends ArrayFieldPath<Scope>>(
		path: Path,
		options: OmitNodeKeys<
			ArrayNodeForPath<
				Root,
				Scope,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid,
				Path,
				true
			>,
			"children" | "kind" | "path"
		> & {
			/** Builds the nodes rendered for each array item. */
			readonly children: (
				item: UiBuilder<
					Root,
					ArrayItem<Scope, Path>,
					Controls,
					Context,
					FieldOptions,
					SectionOptions,
					ArrayOptions,
					Grid
				>,
			) => readonly UiSourceNodeInScope<
				Root,
				ArrayItem<Scope, Path>,
				Controls,
				Context,
				FieldOptions,
				SectionOptions,
				ArrayOptions,
				Grid
			>[]
		},
	) => ArrayNodeForPath<
		Root,
		Scope,
		Controls,
		Context,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Grid,
		Path,
		true
	>
	/** Creates a custom render node. */
	readonly render: (
		id: string,
		options: OmitNodeKeys<RenderNode<Root, Context>, "id" | "kind">,
	) => RenderNode<Root, Context>
}

/** Builds schema-owned UI content with helpers bound to the root path scope. */
export type FormDefinitionBuilder<
	Schema extends StandardSchema,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
> = (
	ui: UiBuilder<
		FormInput<Schema>,
		FormInput<Schema>,
		Controls,
		Context,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Grid
	>,
) => readonly UiSourceNodeInScope<
	FormInput<Schema>,
	FormInput<Schema>,
	Controls,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid
>[]

/** Any typed node that a form definition can contain at its root. */
export type UiNode<
	Input,
	Controls extends ControlDefinitionRegistry,
	Context = unknown,
	FieldOptions = never,
	SectionOptions = never,
	ArrayOptions = never,
	Grid extends number = DefaultGridValue,
> = UiNodeInScope<
	Input,
	Input,
	Controls,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid
>

/** User-authored UI content accepted by `defineForm` and `defineFragment`. */
export type FormDefinitionSource<
	Schema extends StandardSchema,
	Controls extends ControlDefinitionRegistry,
	Context,
	FieldOptions,
	SectionOptions,
	ArrayOptions,
	Grid extends number,
> = {
	/** The ordered nodes rendered by `Fields` and `AutoForm`. */
	readonly ui: readonly UiSourceNodeInScope<
		FormInput<Schema>,
		FormInput<Schema>,
		Controls,
		Context,
		FieldOptions,
		SectionOptions,
		ArrayOptions,
		Grid
	>[]
}

/** A reusable schema-owned UI tree created by one exact form kit. */
export type FormFragment<
	Schema extends StandardSchema = StandardSchema,
	Controls extends ControlDefinitionRegistry = ControlDefinitionRegistry,
	Context = unknown,
	FieldOptions = unknown,
	SectionOptions = unknown,
	ArrayOptions = unknown,
	Grid extends number = number,
> = {
	/** The original concrete schema used to type and compose this fragment. */
	readonly schema: Schema
	/** Creates an opaque placement in the current scope or at one object path. */
	readonly fields: {
		(): FormFragmentPlacement<
			FormInput<Schema>,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid,
			undefined
		>
		<const At extends string>(options: {
			/** The object path relative to the current form or array-item scope. */
			readonly at: At
		}): FormFragmentPlacement<
			FormInput<Schema>,
			Controls,
			Context,
			FieldOptions,
			SectionOptions,
			ArrayOptions,
			Grid,
			At
		>
	}
}

/** A validated UI node with stable ownership and scope metadata. */
export type NormalizedNode = Readonly<Record<string, unknown>> & {
	/** The node ID, unique within its definition. */
	readonly id: string
	/** The node category used by the renderer. */
	readonly kind: "array" | "field" | "render" | "section"
	/** The containing section or array node ID, when one exists. */
	readonly parentId?: string
	/** The array path that contains relative field paths for this node. */
	readonly scopePath: string
}

/** A private key that carries definition type information without runtime data. */
declare const definitionTypes: unique symbol
/** A schema and normalized UI tree owned by one form kit. */
export type FormDefinition<
	Schema extends StandardSchema = StandardSchema,
	Controls extends ControlDefinitionRegistry = ControlDefinitionRegistry,
	Context = unknown,
	FieldOptions = unknown,
	SectionOptions = unknown,
	ArrayOptions = unknown,
	Grid extends number = number,
> = {
	/** The Standard Schema validator for form input and submit output. */
	readonly schema: Schema
	/** The allowed column counts and spans for this definition. */
	readonly grid: readonly Grid[]
	/** The normalized root UI nodes in render order. */
	readonly ui: readonly NormalizedNode[]
	/** All normalized nodes in depth-first order. */
	readonly nodes: readonly NormalizedNode[]
	/** Phantom type data used to preserve the owning kit contract. */
	readonly [definitionTypes]?: {
		/** The control registry that accepts this definition. */
		readonly controls: Controls
		/** The runtime context required by this definition. */
		readonly context: Context
		/** The field slot configuration type. */
		readonly fieldOptions: FieldOptions
		/** The section slot configuration type. */
		readonly sectionOptions: SectionOptions
		/** The array slot configuration type. */
		readonly arrayOptions: ArrayOptions
	}
}

/** A structural element that receives Form Please data attributes. */
export type StructuralNodeName =
	| "array"
	| "array-item"
	| "error-message"
	| "field"
	| "section"
/** CSS properties for Form Please structural elements and layout variables. */
export type FormPleaseStyle = CSSProperties &
	Partial<
		Record<
			| "--fp-array-item-gap"
			| "--fp-column-gap"
			| "--fp-row-gap"
			| "--fp-stack-gap",
			string
		>
	>
/** DOM props for the root element of a structural slot. */
export type StructuralRootProps = Omit<HTMLAttributes<HTMLElement>, "style"> & {
	/** Identifies the structural role for styling and diagnostics. */
	readonly "data-fp-node": StructuralNodeName
	/** Connects the structural element to runtime focus handling. */
	ref?(element: HTMLElement | null): void
	/** Standard CSS plus Form Please layout variables. */
	readonly style?: FormPleaseStyle
}
/** Content and behavior supplied to a field slot component. */
export type FieldSlotProps<Options = never> = {
	/** Props for the field wrapper element. */
	readonly rootProps: StructuralRootProps
	/** The resolved field label. */
	readonly label?: ReactNode
	/** Props that connect the label to the control. */
	readonly labelProps: LabelHTMLAttributes<HTMLLabelElement>
	/** The resolved supporting content. */
	readonly description?: ReactNode
	/** Props for the supporting-content element. */
	readonly descriptionProps: HTMLAttributes<HTMLElement>
	/** Resolved field-slot configuration from the definition. */
	readonly slotOptions?: Readonly<Options>
	/** The rendered registered control. */
	readonly control: ReactNode
	/** Rendered validation messages for the field. */
	readonly errors: readonly ReactNode[]
	/** Whether user interaction with the control is disabled. */
	readonly disabled: boolean
	/** Whether the control prevents value changes without being disabled. */
	readonly readOnly: boolean
	/** Whether the definition marks the field as required. */
	readonly required: boolean
}
/** Content and layout props supplied to a section slot component. */
export type SectionSlotProps<Options = never> = {
	/** Props for the section wrapper element. */
	readonly rootProps: StructuralRootProps
	/** Props for the section grid element. */
	readonly layoutProps: HTMLAttributes<HTMLElement> & {
		/** Identifies the element as a Form Please grid. */
		readonly "data-fp-layout": "grid"
		/** The resolved number of grid columns. */
		readonly "data-fp-columns": number
	}
	/** The resolved section heading. */
	readonly title?: ReactNode
	/** The resolved supporting content. */
	readonly description?: ReactNode
	/** Resolved section-slot configuration from the definition. */
	readonly slotOptions?: Readonly<Options>
	/** The rendered child nodes. */
	readonly children: ReactNode
}
/** Content and actions supplied to an array slot component. */
export type ArraySlotProps<Options = never> = {
	/** Props for the array wrapper element. */
	readonly rootProps: StructuralRootProps
	/** The resolved array label. */
	readonly label?: ReactNode
	/** Props for the array label element. */
	readonly labelProps: HTMLAttributes<HTMLElement>
	/** The resolved supporting content. */
	readonly description?: ReactNode
	/** Props for the supporting-content element. */
	readonly descriptionProps: HTMLAttributes<HTMLElement>
	/** Resolved array-slot configuration from the definition. */
	readonly slotOptions?: Readonly<Options>
	/** Rendered validation messages for the array. */
	readonly errors: readonly ReactNode[]
	/** Whether the array has at least one visible validation issue. */
	readonly invalid: boolean
	/** Whether the user can append an item. */
	readonly canAdd: boolean
	/** Appends a cloned item default to the array. */
	add(): void
	/** The rendered array items. */
	readonly children: ReactNode
}
/** State and actions supplied to an array-item slot component. */
export type ArrayItemSlotProps = {
	/** Props for the item wrapper element. */
	readonly rootProps: StructuralRootProps
	/** The zero-based position of the item. */
	readonly index: number
	/** Whether changes to this item are disabled. */
	readonly disabled: boolean
	/** Whether value changes to this item are read-only. */
	readonly readOnly: boolean
	/** Whether the item can move one position toward the start. */
	readonly canMoveUp: boolean
	/** Whether the item can move one position toward the end. */
	readonly canMoveDown: boolean
	/** Removes this item from the array. */
	remove(): void
	/** Moves this item to a zero-based array position. */
	move(toIndex: number): void
	/** The rendered nodes for this array item. */
	readonly children: ReactNode
}
/** A validation issue supplied to an error-message slot component. */
export type ErrorMessageSlotProps = {
	/** Props for the error message element. */
	readonly rootProps: StructuralRootProps
	/** The validation issue to display. */
	readonly issue: FormIssue
}
/** Native button props owned by the runtime submit state. */
type SubmitButtonProps = Omit<
	ComponentPropsWithoutRef<"button">,
	"disabled" | "type"
> & {
	/** Whether the runtime prevents submission. */
	readonly disabled: boolean
	/** The runtime-owned native button type. */
	readonly type: "submit"
}
/** Live form state and button props supplied to a submit slot or render function. */
export type SubmitSlotProps<
	Schema extends StandardSchema = StandardSchema<Record<string, unknown>>,
> = {
	/** Native button props with runtime-owned submit and disabled values. */
	readonly buttonProps: SubmitButtonProps
	/** The current deeply readonly editable form values. */
	readonly values: DeepReadonly<FormInput<Schema>>
	/** Whether the form is running its submit handler. */
	readonly isSubmitting: boolean
	/** Whether the editable values differ from the default baseline. */
	readonly isDirty: boolean
	/** Whether the form can submit now: not validating and not submitting. */
	readonly canSubmit: boolean
}
/** Structural components used by a form kit. */
export type FormKitSlots<
	FieldOptions = never,
	SectionOptions = never,
	ArrayOptions = never,
> = {
	/** Renders the wrapper, label, description, control, and errors for a field. */
	readonly Field: ComponentType<FieldSlotProps<FieldOptions>>
	/** Renders a section and its child layout. */
	readonly Section: ComponentType<SectionSlotProps<SectionOptions>>
	/** Renders an object array and its append action. */
	readonly Array: ComponentType<ArraySlotProps<ArrayOptions>>
	/** Renders one object-array item and its item actions. */
	readonly ArrayItem: ComponentType<ArrayItemSlotProps>
	/** Renders one validation issue. */
	readonly ErrorMessage: ComponentType<ErrorMessageSlotProps>
	/** Renders the form submit button. */
	readonly Submit: ComponentType<SubmitSlotProps>
}
