# Form binding and submission

`kit.useForm` returns a thin form binding over one RHF `useForm` instance, and `form.api` is that instance unchanged. The binding is created in `src/create-form-kit.tsx`; submission is in `src/form-submission.ts`; stored issues are in `src/form-issues.ts`; error focus is in `src/form-focus.ts`; the Standard Schema resolver is in `src/standard-schema-resolver.ts`. The user guarantees: `docs-site/src/pages/validation.mdx`, `docs-site/src/pages/workflows.mdx` and `docs-site/src/pages/api.mdx`.

## Binding lifetime

`kit.useForm` captures the definition and `defaultValues` on the first render and never replaces them. ADRs: `docs/adr/0015-replace-tanstack-form-with-react-hook-form.md` (one binding per hook lifetime) and `docs/adr/0009-explicit-react-form-lifetimes.md` (explicit lifetimes, superseded by 0015). The guarantee for users: `docs-site/src/pages/definitions.mdx`.

The binding compares a new context with the previous one by its own entries (`hasEqualResolvedValue` in `src/definition.ts`), so an inline context object does not create a new binding object. Callbacks that run inside a managed update read the current context from `transaction.context`.

## Exact-kit binding

`kit.useForm`, `kit.Form` and `kit.Submit` check that a definition, a binding or an action belongs to their kit through the registries of `definitions-and-resolution.md` § Form kit ownership. `kit.Submit` also checks that its binding or action belongs to the surrounding `kit.Form`. The guarantee for users: `docs-site/src/pages/api.mdx`.

## Resolver ownership

The binding owns these RHF options, and `UseFormOptions` does not expose them. The user list: `docs-site/src/pages/api.mdx`.

- The resolver. The definition Standard Schema is the only form-level validator. The resolver also merges stored issues into each validation result. A caller-supplied resolver would drop both.
- `criteriaMode: "all"`. It matches the resolver, which reports every issue of a path in `types`.
- `shouldUnregister: false`. A field that must change its value when it hides uses `whenHidden`; see `managed-updates.md` § whenHidden.
- `shouldFocusError: true`. RHF owns the focus order; see `form-binding-and-submission.md` § Error focus.

## Submit wrapper

`kit.Form` and `kit.Submit` submit through one wrapper per binding. The `onSubmit` shorthand is one implicit `submit` action. The user contract of actions, Enter and `submission.error`: `docs-site/src/pages/api.mdx`.

- The wrapper sets the running action synchronously, before any asynchronous work, so a second submit event in the same task sees the lock.
- With named `actions`, `kit.Form` handles Enter in single-line inputs itself, because the native implicit submission uses the first submit button as the submitter and can select the wrong action.
- A direct `form.api.handleSubmit` call is raw RHF behaviour and does not run the wrapper.

The wrapper catches only a rejection of the action `onSubmit`. It throws a private truthy marker (`SubmitHandlerRejection`) through RHF `handleSubmit`, because RHF tests the rethrown value by truthiness and a falsy rejection would otherwise count as success. RHF sets `isSubmitSuccessful` to `false` and rethrows (pinned in `src/rhf-contract.test.tsx`). The wrapper then unwraps the marker into `submission.error`.

## Stored issues

Action issues from `validate` and external issues from `setIssues` live in a private issue store beside the schema errors. The store writes them to RHF errors under their own `types` keys, so schema messages at the same path stay. The resolver merges them into each validation result while the value at their path is unchanged: the store compares with the value at the time the issue was stored (`clearChanged`). Array actions move or drop the issues of their rows; see `generated-arrays.md` § Issues follow their rows. The clearing rules for users: `docs-site/src/pages/api.mdx`.

## The root path

RHF reserves the top-level `errors.root` key for its own errors. The resolver copies a schema issue for an input path under `root` to an internal pathless branch, so the error summary can show it with its original path. The store rejects an action or external issue under `root`, because it has no such branch to keep it apart from RHF root errors. The guarantee for users: `docs-site/src/pages/validation.mdx`.

## Error focus

RHF focuses the first registered invalid field after an invalid submit, also an application-owned field, so RHF owns the focus order. `focusErrorSummaryFallback` runs after RHF's attempt and moves focus to the summary only when focus is not on an invalid field.

For action issues and for `setIssues` with `focus: true`, Form, Please walks RHF registration order (`control._names.mount`, pinned in `src/rhf-contract.test.tsx`). The focus behaviour for users: `docs-site/src/pages/validation.mdx` and `docs-site/src/pages/api.mdx`.
