# ADR 0028: Create one form runtime per useForm call

- Status: Accepted
- Date: 2026-11-21
- Amends: [ADR 0015](0015-replace-tanstack-form-with-react-hook-form.md)

## Context

`kit.useForm` initialized about ten refs lazily and rebuilt the form binding in `useMemo` when `disabled`, `readOnly`, `errorDisplay` or the context changed. One hook lifetime therefore produced several binding objects. Three mechanisms hid the changing identity: a `form` getter on each submit action, a kit-wide map from each binding object to a private `RuntimeForm`, and `RuntimeForm` itself, which copied every binding field and added the private state. Generated components received the changing options through the identity of that copy.

The hook also wrote shared objects during render: the latest options, the runtime map and several refs. `ResolvedFields` wrote the resolved definition to the private form inside `useMemo`. React can discard a render, so these writes could leave state from a render that never committed.

`kit.Submit` subscribed to all form values in every case, because the slot props contained `values`.

## Decision

- One `kit.useForm` call creates one form runtime in a lazy `useState` initializer (`createFormRuntime` in `src/form-runtime.ts`). The runtime owns the coordinator, the issue store, the submission runtime, the focus refs and the latest options. It creates the binding once, and the binding keeps its identity for the hook lifetime.
- The options that can change and that generated UI reads (`context`, `disabled`, `readOnly`, `errorDisplay`) live in a settings store on the runtime with a `useSyncExternalStore`-compatible interface. `kit.Form`, `kit.Fields`, the generated nodes, `kit.Submit` and devtools subscribe to it. `form.context` is a getter that reads the store.
- `useForm` writes no shared state that a discarded render could leave wrong. A layout effect passes the options of each committed render to the runtime, and the generated fields publish the resolved definition in a layout effect. The one write during render is in the lazy `useState` initializer: it registers the new runtime in the kit map. The key is the binding that the same initializer creates, so a discarded render leaves only an entry that nothing reaches and that the garbage collector removes.
- Submit actions hold the binding as a plain property. The kit map from binding to runtime stays, because it is the exact-kit ownership check, and the `useState` initializer registers the binding once at creation.
- The `Submit` slot props do not contain `values`. Only the render function of `kit.Submit` receives `values` (`SubmitRenderProps`), and only a render function subscribes to all values.

## Considered options

- Keep the changing binding and document it. Applications that list `form` in effect dependencies would keep running effects on unrelated option changes, and the three hiding mechanisms would stay.
- Keep the binding stable and pass the changing options as React props through the generated tree. This works for generated fields, but devtools, `kit.Submit` outside `kit.Form` and the coordinator would each need a second path to the current options.
- Put the changing options on the binding as mutable fields. A mutation does not notify React, so generated UI would not update.
- Keep `values` in the slot props and subscribe only when the slot reads them. The kit cannot know which props a slot component reads.

## Consequences

- An effect or a memo that depends on `form` does not run again when an option changes. This is a breaking change for applications that relied on it; the upgrade page names the fix.
- A change of the options reaches generated UI one layout effect after the hook render, before paint. The coordinator reads the new context after that commit.
- A submit slot that shows values must move to a `kit.Submit` render function. A `kit.Submit` with static children no longer renders its slot on each value change.
- The private runtime type no longer copies binding fields, so a new binding field does not need a second declaration.
