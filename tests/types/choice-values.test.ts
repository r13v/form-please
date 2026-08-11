import type { StandardSchemaV1 } from "@standard-schema/spec"

import {
	type ChoiceValue,
	createFormKit,
	defineControl,
	type FormKitSlots,
} from "../../src/index.js"
import { createMuiFormKit } from "../../src/preset-mui/index.js"
import { nativeFormKit } from "../../src/preset-native/index.js"

type ChoiceInput = {
	readonly role: "admin" | "member"
	readonly optionalRole?: "admin" | "member"
	readonly roles: readonly ("admin" | "member")[]
	readonly label: string
}

const schema: StandardSchemaV1<ChoiceInput> = {
	"~standard": {
		version: 1,
		vendor: "choice-values-test",
		validate: (value) => ({ value: value as ChoiceInput }),
	},
}

nativeFormKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			options: {
				// A field may intentionally expose only part of its schema union.
				options: [{ value: "admin", label: "Administrator" }],
			},
		},
		{
			kind: "field",
			path: "optionalRole",
			control: "select",
			options: {
				emptyOption: { label: "No role" },
				options: [
					{
						// @ts-expect-error Optional absence uses the dedicated empty option.
						value: undefined,
						label: "Invalid absence",
					},
				],
			},
		},
		{
			kind: "field",
			path: "label",
			control: "select",
			options: {
				// A plain string schema intentionally keeps arbitrary string choices.
				options: [{ value: "anything", label: "Any string" }],
			},
		},
	],
})

nativeFormKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		options: {
			options: [{ value: "admin", label: "Administrator" }],
		},
	}),
])

nativeFormKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		options: {
			options: [
				{
					// @ts-expect-error Builder choice values retain the field union.
					value: "owner",
					label: "Owner",
				},
			],
		},
	}),
])

nativeFormKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			options: {
				options: [
					{
						// @ts-expect-error Choice values must belong to the schema field union.
						value: "owner",
						label: "Owner",
					},
				],
			},
		},
	],
})

type ChoiceContext = {
	readonly exact: readonly {
		readonly value: "admin" | "member"
		readonly label: string
	}[]
	readonly broad: readonly {
		readonly value: string
		readonly label: string
	}[]
}

const contextualKit = nativeFormKit.forContext<ChoiceContext>()
contextualKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			options: (_values, { context }) => ({ options: context.exact }),
		},
	],
})

contextualKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		options: (_values, { context }) => ({ options: context.exact }),
	}),
])

contextualKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		// @ts-expect-error Builder resolver data retains the schema field union.
		options: (_values, { context }) => ({ options: context.broad }),
	}),
])

contextualKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			// @ts-expect-error Resolver data must retain the schema field union.
			options: (_values, { context }) => ({ options: context.broad }),
		},
	],
})

type CustomChoiceOptions = {
	readonly items: readonly {
		readonly id: ChoiceValue<string>
		readonly label: string
	}[]
}

const customKit = createFormKit({
	controls: {
		single: defineControl<string | undefined, CustomChoiceOptions>({
			component: () => null,
		}),
		multiple: defineControl<readonly string[], CustomChoiceOptions>({
			component: () => null,
		}),
		unmarked: defineControl<
			string | undefined,
			{ readonly items: readonly string[] }
		>({ component: () => null }),
	},
	slots: {} as FormKitSlots,
})

customKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "single",
			options: { items: [{ id: "member", label: "Member" }] },
		},
		{
			kind: "field",
			path: "roles",
			control: "multiple",
			options: {
				items: [
					{ id: "admin", label: "Administrator" },
					{
						// @ts-expect-error Multi-choice values use the array element union.
						id: "owner",
						label: "Owner",
					},
				],
			},
		},
		{
			kind: "field",
			path: "role",
			control: "unmarked",
			// Arrays remain broad unless the control author opts in with ChoiceValue.
			options: { items: ["owner"] },
		},
	],
})

const muiKit = createMuiFormKit()
muiKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			options: {
				choices: [
					{
						// @ts-expect-error MUI select choices use the scalar field union.
						value: "owner",
						label: "Owner",
					},
				],
			},
		},
		{
			kind: "field",
			path: "roles",
			control: "select-multiple",
			options: {
				choices: [
					{
						// @ts-expect-error MUI multi-select choices use the element union.
						value: "owner",
						label: "Owner",
					},
				],
			},
		},
		{
			kind: "field",
			path: "role",
			control: "radio",
			options: {
				choices: [
					{
						// @ts-expect-error MUI radio choices use the scalar field union.
						value: "owner",
						label: "Owner",
					},
				],
			},
		},
		{
			kind: "field",
			path: "role",
			control: "autocomplete",
			options: {
				options: [
					// @ts-expect-error MUI autocomplete options use the scalar field union.
					"owner",
				],
			},
		},
		{
			kind: "field",
			path: "roles",
			control: "autocomplete-multiple",
			options: {
				options: [
					// @ts-expect-error MUI autocomplete options use the element union.
					"owner",
				],
			},
		},
	],
})
