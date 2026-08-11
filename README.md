# Form, Please

<p align="center">
  <img src="docs-site/public/brand/form-please-logo.png" alt="Form, Please logo: Hermes Conrad holding a 'Form, Please' coffee mug" width="220" />
</p>

Form, Please turns a Standard Schema and a typed UI definition into a React
form. React Hook Form owns state, validation, subscriptions, and array updates.
Your controls and slots own the rendered design system.

React 18 and React 19 are supported.

## Install

```sh
npm install form-please react-hook-form zod
```

Form, Please accepts any Standard Schema implementation. This example uses Zod.

## Create a form

```tsx
import { nativeFormKit as kit } from "form-please/preset-native"
import { z } from "zod"

const contactSchema = z
	.object({
		email: z.string().email("Enter a valid email"),
	})
	.transform((input) => ({ ...input, normalizedEmail: input.email.trim() }))

const contactForm = kit.defineForm(contactSchema, (ui) => [
	ui.field("email", {
		control: "text",
		label: "Email",
		options: { type: "email" },
	}),
])

export function ContactForm() {
	const form = kit.useForm(contactForm, {
		defaultValues: { email: "" },
		onSubmit({ value }) {
			console.log(value.normalizedEmail)
		},
	})

	return (
		<kit.AutoForm form={form}>
			<kit.Submit>Send</kit.Submit>
		</kit.AutoForm>
	)
}
```

Render submit content with live typed values and state by passing a function to
`kit.Submit`. The required `binding` types the values and must match the
surrounding form; the button is yours:

```tsx
<kit.Submit binding={form}>
	{({ buttonProps, values, isDirty, canSubmit }) => (
		<button {...buttonProps} disabled={!canSubmit || !isDirty}>
			Save {values.name}
		</button>
	)}
</kit.Submit>
```

Reuse a schema-owned group of fields at compatible object paths:

```tsx
const addressSchema = z.object({
	street: z.string(),
	city: z.string(),
})

const addressFragment = kit.defineFragment(addressSchema, (ui) => [
	ui.field("street", { control: "text", label: "Street" }),
	ui.field("city", { control: "text", label: "City" }),
])

const checkoutSchema = z.object({
	shippingAddress: addressFragment.schema,
	billingAddress: addressFragment.schema,
})

const checkoutForm = kit.defineForm(checkoutSchema, () => [
	addressFragment.fields({ at: "shippingAddress" }),
	addressFragment.fields({ at: "billingAddress" }),
])
```

Fragment resolvers receive the local fragment input. The host form still owns
all state, validation, context, and lifecycle.

Use RHF `register`, `Controller`, `useWatch`, `useFormState`, `useFieldArray`,
and the unchanged `form.api` for direct composition. `kit.Form` supplies
`FormProvider`.

## Runtime behavior

- The Standard Schema validates on submit, then on change after the first
  submit.
- The RHF resolver parses the Standard Schema once and returns transformed
  output while the submit wrapper preserves the editable input snapshot.
- Ordinary UI resolvers receive the complete deeply readonly schema input and
  runtime context. They must be synchronous.
- Fragment resolvers receive their local deeply readonly fragment input and
  minimum context.
- Use `beforeUpdate` and `afterUpdate` for one form-local managed update rule.
  Use value middleware and `form.update` when independent policies or dependent
  changes must compose atomically. Direct `form.api` changes bypass both.
- Hidden fields preserve their values.
- Array paths use RHF dot notation and rows use stable RHF keys.
- RHF focuses the first registered invalid field. A focusable error summary is
  the fallback when no invalid field receives focus.
- A definition is fixed for the `useForm` hook lifetime. Use a React `key` to
  remount with another definition.

## Package entries

| Import | Purpose |
| --- | --- |
| `form-please` | Form-kit construction, controls, resources, and shared types |
| `form-please/default-slots` | Accessible structural slots and localization types |
| `form-please/history` | Optional managed value history, navigation, and journal transfer |
| `form-please/native-controls` | Native HTML controls and option types |
| `form-please/persistence` | Optional draft restore, autosave, migration, and storage adapters |
| `form-please/preset-native` | Ready-to-use native form kit |
| `form-please/preset-mui` | Material UI 9 form-kit factory |
| `form-please/layout.css` | Optional structural grid and spacing CSS |

The main JavaScript entry does not import CSS.

```ts
import "form-please/layout.css"
```

The Material UI preset requires `@mui/material`, `@emotion/react`, and
`@emotion/styled`.

## Resources

`ResourceState`, `matchResource`, and `fromResource` map application-owned
request state into synchronous form UI. Form, Please does not own fetching,
caching, cancellation, or retries.

## Documentation

- [Get started](https://r13v.github.io/form-please/get-started)
- [Value middleware](https://r13v.github.io/form-please/middleware)
- [Managed value history](https://r13v.github.io/form-please/history)
- [Form persistence](https://r13v.github.io/form-please/persistence)
- [API reference](https://r13v.github.io/form-please/api)
- [Shadcn registry adapter](https://r13v.github.io/form-please/examples/shadcn-valibot)
- [Architecture map](docs/ARCHITECTURE.md)
- [LLM documentation index](https://r13v.github.io/form-please/llms.txt)
- [Full documentation for LLMs](https://r13v.github.io/form-please/llms-full.txt)

The physical, typechecked example lives in
[`profile-form.tsx`](docs-site/src/snippets/profile-form.tsx).

## Kudos

Kudos to [Evgeniy Ivaha](https://github.com/ivahaev) for the idea and the
example implementation.
