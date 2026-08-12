import type { StandardSchemaV1 } from "@standard-schema/spec"

import {
	createFormKit,
	defineControl,
	type FormKitSlots,
	type OptionValue,
} from "../../src/index.js"
import { createMuiFormKit } from "../../src/preset-mui/index.js"
import { nativeFormKit } from "../../src/preset-native/index.js"

type OptionInput = {
	readonly role: "admin" | "member"
	readonly optionalRole?: "admin" | "member"
	readonly roles: readonly ("admin" | "member")[]
	readonly label: string
}

const schema: StandardSchemaV1<OptionInput> = {
	"~standard": {
		version: 1,
		vendor: "option-values-test",
		validate: (value) => ({ value: value as OptionInput }),
	},
}

nativeFormKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			// A field may intentionally expose only part of its schema union.
			options: [{ value: "admin", label: "Administrator" }],
		},
		{
			kind: "field",
			path: "optionalRole",
			control: "select",
			props: { emptyOption: { label: "No role" } },
			options: [
				{
					// @ts-expect-error Optional absence uses the dedicated empty option.
					value: undefined,
					label: "Invalid absence",
				},
			],
		},
		{
			kind: "field",
			path: "label",
			control: "select",
			// A plain string schema intentionally keeps arbitrary string options.
			options: [{ value: "anything", label: "Any string" }],
		},
	],
})

nativeFormKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		options: [{ value: "admin", label: "Administrator" }],
	}),
])

nativeFormKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		options: [
			{
				// @ts-expect-error Builder option values retain the field union.
				value: "owner",
				label: "Owner",
			},
		],
	}),
])

nativeFormKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			options: [
				{
					// @ts-expect-error Option values must belong to the schema field union.
					value: "owner",
					label: "Owner",
				},
			],
		},
	],
})

type OptionContext = {
	readonly exact: readonly {
		readonly value: "admin" | "member"
		readonly label: string
	}[]
	readonly broad: readonly {
		readonly value: string
		readonly label: string
	}[]
}

const contextualKit = nativeFormKit.forContext<OptionContext>()
contextualKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			options: ({ context }) => context.exact,
		},
	],
})

contextualKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		options: ({ context }) => context.exact,
	}),
])

contextualKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		options: async ({ values, context, signal }) => {
			values.role satisfies "admin" | "member"
			signal.throwIfAborted()
			await Promise.resolve()
			return context.exact
		},
	}),
])

contextualKit.defineForm(schema, (ui) => [
	ui.field("role", {
		control: "select",
		// @ts-expect-error Builder resolver data retains the schema field union.
		options: ({ context }) => context.broad,
	}),
])

contextualKit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "role",
			control: "select",
			// @ts-expect-error Resolver data must retain the schema field union.
			options: ({ context }) => context.broad,
		},
	],
})

type CustomOption = {
	readonly id: OptionValue<string>
	readonly label: string
}

const customKit = createFormKit({
	controls: {
		single: defineControl<
			string | undefined,
			Record<string, never>,
			unknown,
			CustomOption
		>({
			component: () => null,
		}),
		multiple: defineControl<
			readonly string[],
			Record<string, never>,
			unknown,
			CustomOption
		>({
			component: () => null,
		}),
		unmarked: defineControl<
			string | undefined,
			Record<string, never>,
			unknown,
			{ readonly id: string; readonly label: string }
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
			options: [{ id: "member", label: "Member" }],
		},
		{
			kind: "field",
			path: "roles",
			control: "multiple",
			options: [
				{ id: "admin", label: "Administrator" },
				{
					// @ts-expect-error Multi-option values use the array element union.
					id: "owner",
					label: "Owner",
				},
			],
		},
		{
			kind: "field",
			path: "role",
			control: "unmarked",
			// Values remain broad unless the control author opts in with OptionValue.
			options: [{ id: "owner", label: "Owner" }],
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
			options: [
				{
					// @ts-expect-error MUI select options use the scalar field union.
					value: "owner",
					label: "Owner",
				},
			],
		},
		{
			kind: "field",
			path: "roles",
			control: "select-multiple",
			options: [
				{
					// @ts-expect-error MUI multi-select options use the element union.
					value: "owner",
					label: "Owner",
				},
			],
		},
		{
			kind: "field",
			path: "role",
			control: "radio",
			options: [
				{
					// @ts-expect-error MUI radio options use the scalar field union.
					value: "owner",
					label: "Owner",
				},
			],
		},
		{
			kind: "field",
			path: "role",
			control: "autocomplete",
			options: [
				// @ts-expect-error MUI autocomplete options use the scalar field union.
				"owner",
			],
		},
		{
			kind: "field",
			path: "roles",
			control: "autocomplete-multiple",
			options: [
				// @ts-expect-error MUI autocomplete options use the element union.
				"owner",
			],
		},
	],
})
