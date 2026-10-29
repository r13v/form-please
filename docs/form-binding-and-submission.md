# Form binding and submission

`kit.useForm` returns a thin form binding over one RHF `useForm` instance. `form.api` is the unchanged typed RHF API. Form, Please keeps no other form store. The binding is created in `src/create-form-kit.tsx`; submission is in `src/form-submission.ts`; stored issues are in `src/form-issues.ts`; error focus is in `src/form-focus.ts`; the Standard Schema resolver is in `src/standard-schema-resolver.ts`. User guidance: `docs-site/src/pages/validation.mdx` and `docs-site/src/pages/workflows.mdx`.

## Binding lifetime

The definition and `defaultValues` are fixed for the hook lifetime. A later render with another definition does not replace it. To create another form, change the React `key` of the component that calls `kit.useForm`, so React remounts it. Each binding initializes its own middleware chain from the definition. ADRs: `docs/adr/0015-replace-tanstack-form-with-react-hook-form.md` (one binding per hook lifetime) and `docs/adr/0009-explicit-react-form-lifetimes.md` (explicit lifetimes, superseded by 0015).

An inline `context` object keeps the binding stable. The binding compares a new context with the previous one by its own entries (`hasEqualResolvedValue` in `src/definition.ts`), so a new object with the same entries does not create a new binding object. Callbacks that run inside a managed update read the current context from `transaction.context`.

## Exact-kit binding

A definition and a binding belong to the exact kit that created them:

- `kit.useForm` rejects a definition from another kit. After a hot reload, the error asks for a page reload or a remount.
- `kit.Form` rejects a binding from another kit before it renders.
- `kit.Submit` rejects a binding or an action that does not belong to the surrounding `kit.Form`.

## Resolver ownership

The binding owns these RHF options, and `UseFormOptions` does not expose them:

- The resolver. The definition Standard Schema is the only form-level validator. The resolver also merges stored issues into each validation result. A caller-supplied resolver would drop both.
- `criteriaMode: "all"`. It matches the resolver, which reports every issue of a path in `types`.
- `shouldUnregister: false`. A hidden field keeps its value. A field that must change its value when it hides uses `whenHidden`; see `managed-updates.md` § whenHidden.
- `shouldFocusError: true`. RHF owns the focus order; see `form-binding-and-submission.md` § Error focus.

A caller chooses `mode`, `reValidateMode` and `delayError`. Public issues contain only `message` and an optional `path`.

## Submit wrapper

`kit.Form` and `kit.Submit` submit through one wrapper per binding. `onSubmit` is the shorthand for one implicit `submit` action; named `actions` replace it. `kit.Submit` marks its button with the action name, and the native submit handler runs that action.

- The wrapper locks the form synchronously before any asynchronous work. A submit while an action runs is ignored.
- The action `validate` runs only after the schema passes. Its issues become stored action issues, and `onSubmit` does not run.
- With named `actions`, `kit.Form` handles Enter in single-line inputs itself, so the native first-button submitter cannot select the wrong action. The `onSubmit` shorthand keeps native implicit submission and its `submitter`.
- A direct `form.api.handleSubmit` call is raw RHF behaviour and does not run the wrapper.

The wrapper catches only a rejection of the action `onSubmit`. It throws a private truthy marker through RHF `handleSubmit`, because RHF tests the rethrown value by truthiness and a falsy rejection would otherwise count as success. RHF sets `isSubmitSuccessful` to `false` and rethrows (pinned in `src/rhf-contract.test.tsx`). The wrapper then publishes `submission.error = { value }`. An accepted submit and `setIssues` set `submission.error` to `null`.

Errors from the schema, from `validate` and from the runtime are not caught. `kit.Form` starts the submit without awaiting it, so these errors surface as unhandled promise rejections.

## Stored issues

Action issues from `validate` and external issues from `setIssues` live in a private issue store beside the schema errors. The store writes them to RHF errors under their own `types` keys, so schema messages at the same path stay. The resolver merges them into each validation result while the value at their path is unchanged. Generated fields show stored issues without touched or submit state.

A stored issue clears when:

- The value at its path changes. The store compares with the value at the time the issue was stored.
- A submit starts. The wrapper clears action and external issues before validation.
- `setIssues` replaces the external issues. Action issues stay.
- The native form reset of `kit.Form` runs.
- An array action removes its row. See `generated-arrays.md` § Issues follow their rows.

## The root path

RHF reserves the top-level `errors.root` key for its own errors. A schema issue for an input path under `root` is copied to an internal pathless branch and shows in the error summary with its original path. An action or external issue cannot use a path under `root`; the store rejects it with a `TypeError`.

## Error focus

RHF focuses the first registered invalid field after an invalid submit, also an application-owned field, so RHF owns the focus order. After RHF's attempt, Form, Please focuses the error summary only when focus is not on an invalid field. Issues without a path and issues of disabled generated controls stay in the summary.

For action issues and for `setIssues` with `focus: true`, Form, Please focuses the first registered field with an error, in RHF registration order (`control._names.mount`, pinned in `src/rhf-contract.test.tsx`), that can take focus. A disabled or unmounted field is skipped. When no field takes focus, the error summary takes it.
