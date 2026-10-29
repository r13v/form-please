import { z } from "zod"

import type {
	ArrayFieldPath,
	ControlOptionOf,
	ControlOwnPropsOf,
	ControlValueOf,
	DeepReadonly,
	FieldPath,
	FormInput,
	FormOutput,
	PathValue,
	ValueTransaction,
	ValueTransactionSource,
} from "../../src/index.js"
import { defineControl } from "../../src/index.js"

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
