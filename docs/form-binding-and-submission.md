# Form binding and submission

`kit.useForm` returns a thin form binding over one RHF `useForm` instance, and `form.api` is that instance unchanged. The binding and its form runtime are created in `src/form-runtime.ts`; submission is in `src/form-submission.ts`; stored issues are in `src/form-issues.ts`; error focus is in `src/form-focus.ts`; the Standard Schema resolver is in `src/standard-schema-resolver.ts`. The user guarantees: `docs-site/src/pages/validation.mdx`, `docs-site/src/pages/workflows.mdx` and `docs-site/src/pages/api.mdx`.

## Binding lifetime

`kit.useForm` captures the definition and `defaultValues` on the first render and never replaces them. ADRs: `docs/adr/0015-replace-tanstack-form-with-react-hook-form.md` (one binding per hook lifetime) and `docs/adr/0009-explicit-react-form-lifetimes.md` (explicit lifetimes, superseded by 0015). The guarantee for users: `docs-site/src/pages/definitions.mdx` and `docs-site/src/pages/api.mdx`.

## Form runtime

`kit.useForm` creates one form runtime (`createFormRuntime` in `src/form-runtime.ts`) in a lazy `useState` initializer. The runtime owns the coordinator, the issue store, the submission runtime, the focus refs and the latest options. The binding is a stable view of the runtime: its identity does not change for the life of the hook. `docs/adr/0028-create-one-form-runtime-per-use-form-call.md` gives the reason.

- The options that can change and that generated UI reads (`FormSettings`: context, `disabled`, `readOnly`, `errorDisplay`) live in the settings store of the runtime. `kit.Form`, `kit.Fields`, the generated nodes, `kit.Submit` and devtools subscribe to it with `useSnapshot`. Do not read these options through the binding identity or pass them as copies on another object.
- `useForm` writes no shared state that a discarded render could leave wrong. A layout effect passes the options of each committed render to `runtime.update`, which notifies subscribers only when a setting changes. The context is compared by its own entries (`hasEqualResolvedValue` in `src/definition.ts`), so an inline context object does not notify and the snapshot keeps the first object. The one write during render is in the lazy `useState` initializer, which registers the new runtime in the kit map `runtimeForms`. Its key is the binding that the same initializer creates, so a discarded render leaves only an entry that nothing reaches and that the garbage collector removes.
- `form.context` and `form.fieldPaths()` read the settings snapshot, so they give the committed state that generated UI uses, not the options of the current render. The user contract: `docs-site/src/pages/api.mdx` § `FormBinding`.
- The coordinator reads the context from the settings store, and the submission runtime reads the action handlers from the latest committed options. Callbacks that run inside a managed update read the current context from `transaction.context`.
- One resolution serves every `kit.Fields` of a form; `definitions-and-resolution.md` § Resolution owns it. `runtime.resolved` and the devtools `definition` event change only in a layout effect, so a render that React discards does not reach devtools.
- `kit.Submit` subscribes to all values only for a render function (`SubmitRender` in `src/create-form-kit.tsx`). RHF `useFormState` renders `kit.Submit` again on each value change while `isDirty` is read, so `kit.Submit` memoizes the slot element on its props.

## Exact-kit binding

`kit.useForm`, `kit.Form` and `kit.Submit` check that a definition, a binding or an action belongs to their kit through the registries of `definitions-and-resolution.md` § Form kit ownership. `kit.Submit` also checks that its action belongs to the surrounding `kit.Form`. `kit.Submit` finds its runtime only from the surrounding `kit.Form` or from its action (`resolveSubmitRuntime` in `src/create-form-kit.tsx`). Each binding has at least one action, `actions.submit` for the `onSubmit` shorthand, so an action always identifies its form and `kit.Submit` needs no binding prop. The guarantee for users: `docs-site/src/pages/api.mdx`.

## Resolver ownership

The binding owns these RHF options, and `UseFormOptions` does not expose them. The user list: `docs-site/src/pages/api.mdx`.

- The resolver. The definition Standard Schema is the only form-level validator. The resolver also merges stored issues into each validation result. A caller-supplied resolver would drop both.
- `criteriaMode: "all"`. It matches the resolver, which reports every issue of a path in `types`.
- `shouldUnregister: false`. A field that must change its value when it hides uses `whenHidden`; see `managed-updates.md` § whenHidden.
- `shouldFocusError: true`. RHF owns the focus order; see `form-binding-and-submission.md` § Error focus.

## Submit wrapper

`kit.Form`, `kit.Submit` and `form.submit` submit through one wrapper per binding (`submitAction` in `src/form-submission.ts`), which resolves with the `FormSubmitResult`. The `onSubmit` shorthand is one implicit `submit` action. The user contract of actions, Enter, `submission.error` and the result: `docs-site/src/pages/api.mdx`.

- The wrapper owns the `disabled` and pending checks, so a native submit and `form.submit` reject the same cases with the same result.
- The wrapper sets the running action synchronously, before any asynchronous work, so a second submit event or call in the same task sees the lock.
- The wrapper does not need the form element. RHF `handleSubmit` validates the current values, and the focus fallback reads the owner document of the mounted form or the global document. `form.submit` therefore works while nothing is mounted.
- With named `actions`, `kit.Form` handles Enter in single-line inputs itself, because the native implicit submission uses the first submit button as the submitter and can select the wrong action.
- A direct `form.api.handleSubmit` call is raw RHF behaviour and does not run the wrapper.

The wrapper catches only a rejection of the action `onSubmit`. It throws a private truthy marker (`SubmitHandlerRejection`) through RHF `handleSubmit`, because RHF tests the rethrown value by truthiness and a falsy rejection would otherwise count as success. RHF sets `isSubmitSuccessful` to `false` and rethrows (pinned in `src/rhf-contract.test.tsx`). The wrapper then unwraps the marker into `submission.error`.

## Stored issues

Action issues from `validate` and external issues from `setIssues` live in a private issue store beside the schema errors. The store writes them to RHF errors under their own `types` keys, so schema messages at the same path stay. The resolver merges them into each validation result while the value at their path is unchanged: the store compares with the value at the time the issue was stored (`clearChanged`). Array actions move or drop the issues of their rows; see `generated-arrays.md` § Issues follow their rows. The clearing rules for users: `docs-site/src/pages/api.mdx`.

## The root path

RHF reserves the top-level `errors.root` key for its own errors. The resolver copies a schema issue for an input path under `root` to an internal pathless branch, so the error summary can show it with its original path. The store rejects an action or external issue under `root`, because it has no such branch to keep it apart from RHF root errors. The guarantee for users: `docs-site/src/pages/validation.mdx`.

## Error focus

RHF focuses the first registered invalid field after an invalid submit, also an application-owned field, so RHF owns the focus order. `focusErrorSummaryFallback` runs after RHF's attempt and moves focus to the summary only when focus is not on an invalid field. The summary is the private `ErrorSummary` in `src/generated-nodes.tsx`, which `kit.AutoForm` and `kit.ErrorSummary` render; it registers its first item in the runtime `errorSummaryRef`.

For action issues and for `setIssues` with `focus: true`, Form, Please walks RHF registration order (`control._names.mount`, pinned in `src/rhf-contract.test.tsx`). The focus behaviour for users: `docs-site/src/pages/validation.mdx` and `docs-site/src/pages/api.mdx`.
