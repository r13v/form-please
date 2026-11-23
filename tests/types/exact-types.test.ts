import type { ReactNode } from "react"
import { z } from "zod"

import type {
	ArrayFieldPath,
	ControlOptionOf,
	ControlOwnPropsOf,
	ControlValueOf,
	DeepReadonly,
	FieldPath,
	FormBinding,
	FormDefinition,
	FormInput,
	FormKit,
	FormKitSlots,
	FormKitTypes,
	FormKitTypesOf,
	FormOutput,
	FormSubmitResult,
	FormUpdateResult,
	PathValue,
	UseFieldResult,
	ValueTransaction,
	ValueTransactionSource,
} from "../../src/index.js"
import { createFormKit, defineControl } from "../../src/index.js"

// Exact equality catches a type that widens to `any`; plain assignment does not.
type Equal<Left, Right> =
	(<Value>() => Value extends Left ? 1 : 2) extends <
		Value,
	>() => Value extends Right ? 1 : 2
		? true
		: false
type Expect<Condition extends true> = Condition

const schema = z.object({
	name: z.string(),
	age: z.number().optional(),
	tags: z.array(z.string()),
	speakers: z.array(
		z.object({
			name: z.string(),
			talks: z.array(z.object({ title: z.string() })),
		}),
	),
	maybeRows: z.array(z.object({ id: z.string() })).optional(),
	joined: z.string().transform((value) => new Date(value)),
})
type Input = FormInput<typeof schema>

export type ExactTypes = [
	Expect<Equal<Input["joined"], string>>,
	Expect<Equal<FormOutput<typeof schema>["joined"], Date>>,
	Expect<Equal<PathValue<Input, "speakers.0.name">, string>>,
	Expect<Equal<PathValue<Input, "age">, number | undefined>>,
	Expect<Equal<PathValue<Input, "speakers.0.talks">, { title: string }[]>>,
	Expect<Equal<ArrayFieldPath<Input>, "speakers" | `speakers.${number}.talks`>>,
	Expect<Equal<"tags.0" extends FieldPath<Input> ? true : false, true>>,
	Expect<Equal<"missing" extends FieldPath<Input> ? true : false, false>>,
	Expect<
		Equal<
			DeepReadonly<{ rows: { name: string }[] }>,
			{ readonly rows: readonly { readonly name: string }[] }
		>
	>,
	Expect<
		Equal<
			ValueTransactionSource<Input>["type"],
			"control" | "array" | "update" | "history" | "persistence"
		>
	>,
	Expect<
		Equal<
			Extract<ValueTransactionSource<Input>, { type: "array" }>["action"],
			"append" | "remove" | "move" | "reconcile"
		>
	>,
	Expect<Equal<ValueTransaction<Input>["nextValues"], DeepReadonly<Input>>>,
]

const select = defineControl<
	string | undefined,
	{ readonly placeholder: string },
	unknown,
	string
>({
	component: () => null,
})

export type ExactControlTypes = [
	Expect<Equal<ControlValueOf<typeof select>, string | undefined>>,
	Expect<
		Equal<ControlOwnPropsOf<typeof select>, { readonly placeholder: string }>
	>,
	Expect<Equal<ControlOptionOf<typeof select>, string>>,
]

type FieldTone = { readonly tone: "quiet" | "strong" }
const slots = {} as FormKitSlots<{
	readonly fieldOptions: FieldTone
	readonly sectionOptions: never
	readonly arrayOptions: never
}>
const inferredKit = createFormKit({ controls: { select }, slots, grid: [1, 2] })
const localeKit = inferredKit.forContext<{ readonly locale: string }>()
type LocaleKit = FormKitTypesOf<typeof localeKit>

// The error summary renders nothing when there is no summary issue.
export type ExactComponentReturnTypes = [
	Expect<Equal<ReturnType<typeof localeKit.ErrorSummary>, ReactNode>>,
]

export type ExactKitTypeBags = [
	Expect<
		Equal<
			FormKitTypesOf<typeof inferredKit>,
			{
				readonly controls: { select: typeof select }
				readonly context: unknown
				readonly fieldOptions: FieldTone
				readonly sectionOptions: never
				readonly arrayOptions: never
				readonly grid: 1 | 2
			}
		>
	>,
	Expect<Equal<LocaleKit["context"], { readonly locale: string }>>,
	Expect<Equal<LocaleKit["controls"], { select: typeof select }>>,
	Expect<Equal<typeof localeKit, FormKit<LocaleKit>>>,
	Expect<Equal<LocaleKit extends FormKitTypes ? true : false, true>>,
]

const localeDefinition = localeKit.defineForm(schema, (ui) => [
	ui.field("name", {
		control: "select",
		props: { placeholder: "Name" },
		options: ["Ada"],
		slotOptions: { tone: "quiet" },
	}),
])
/** A definition type named by hand with the schema and the kit type bag. */
type LocaleDefinition = FormDefinition<typeof schema, LocaleKit>

export type ExactDefinitionTypes = [
	Expect<Equal<typeof localeDefinition, LocaleDefinition>>,
]

/** Type-only hook call with a hand-typed definition; the function never runs. */
export function useNamedDefinition(definition: LocaleDefinition) {
	return localeKit.useForm(definition, {
		context: { locale: "en" },
		defaultValues: {} as Input,
	})
}

type LocaleControls = LocaleKit["controls"]
type LocaleContext = LocaleKit["context"]
// @ts-expect-error The kit contracts are one type bag, not positional parameters.
type Positional = FormDefinition<typeof schema, LocaleControls, LocaleContext>
export type PositionalDefinition = Positional
// @ts-expect-error A kit takes one type bag, not positional parameters.
export type PositionalKit = FormKit<LocaleKit["controls"], FieldTone>
// @ts-expect-error A kit type bag names every contract.
export type PartialBag = FormKit<{ readonly controls: LocaleKit["controls"] }>

type EmptyKit = {
	readonly controls: Record<string, never>
	readonly context: unknown
	readonly fieldOptions: never
	readonly sectionOptions: never
	readonly arrayOptions: never
	readonly grid: 1 | 2 | 3 | 4
}
declare const kit: FormKit<EmptyKit>
type Binding = FormBinding<typeof schema, unknown, "publish" | "archive">
type ShorthandBinding = FormBinding<typeof schema, unknown, "submit">
type FieldOf<Path extends FieldPath<Input>> = ReturnType<
	typeof kit.useField<typeof schema, Path>
>

export type ExactFormSurfaceTypes = [
	Expect<Equal<FieldOf<"speakers.0.name">, UseFieldResult<string>>>,
	Expect<Equal<FieldOf<"age">["value"], number | undefined>>,
	Expect<Equal<Parameters<FieldOf<"tags">["setValue"]>, [value: string[]]>>,
	Expect<
		Equal<
			ReturnType<typeof kit.useFormContext<typeof schema>>,
			FormBinding<typeof schema>
		>
	>,
	Expect<Equal<ReturnType<Binding["fieldPaths"]>, FieldPath<Input>[]>>,
	Expect<
		Equal<
			Awaited<ReturnType<Binding["submit"]>>,
			FormSubmitResult<"publish" | "archive">
		>
	>,
	Expect<
		Equal<
			Awaited<ReturnType<ShorthandBinding["submit"]>>,
			FormSubmitResult<"submit">
		>
	>,
	Expect<Equal<[] extends Parameters<Binding["submit"]> ? true : false, false>>,
	Expect<
		Equal<
			[] extends Parameters<ShorthandBinding["submit"]> ? true : false,
			true
		>
	>,
	Expect<
		Equal<
			Extract<
				FormSubmitResult,
				{ reason: "invalid" }
			>["issues"][number]["path"],
			string | undefined
		>
	>,
	Expect<
		Equal<Extract<FormSubmitResult, { reason: "failed" }>["error"], unknown>
	>,
]

// @ts-expect-error A path outside the binding schema is a type error.
export type MissingField = FieldOf<"missing">

type UpdateResult = ReturnType<Binding["update"]>

export type ExactUpdateResultTypes = [
	Expect<Equal<UpdateResult, FormUpdateResult<Input, unknown>>>,
	Expect<Equal<UpdateResult["committed"], boolean>>,
	Expect<
		Equal<
			Extract<UpdateResult, { committed: true }>["transaction"],
			ValueTransaction<Input, unknown>
		>
	>,
	Expect<Equal<UpdateResult["result"], unknown>>,
	Expect<
		Equal<
			keyof Extract<UpdateResult, { committed: false }>,
			"committed" | "result"
		>
	>,
]

declare const shorthand: ShorthandBinding

/** Type-only `kit.Submit` calls; the function never runs. */
export function submitProps(): void {
	kit.Submit({ action: shorthand.actions.submit, children: "Save" })
	kit.Submit({ children: "Save" })
	kit.Submit({
		action: shorthand.actions.submit,
		children: ({ values }) => {
			const name: string = values.name
			return name
		},
	})
	// @ts-expect-error `kit.Submit` has no binding prop; `action` selects the form.
	kit.Submit({ binding: shorthand, children: "Save" })
	// @ts-expect-error A render function requires an action, which types `values`.
	kit.Submit({ children: () => "Save" })
}
