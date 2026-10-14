# ADR 0009: Expose explicit React form lifetimes

- Status: Superseded by [ADR 0015](0015-replace-tanstack-form-with-react-hook-form.md)
- Date: 2026-08-02
- Amends: [ADR 0002](0002-add-only-form-kit-extension.md), [ADR 0008](0008-reducer-core-and-open-middleware.md)

## Context

Component-local forms repeatedly used lazy React state around
`kit.createForm`. The pattern appeared throughout the public documentation,
examples, and integration fixtures. Requiring each application to reproduce it
made the supported React lifetime look incidental rather than intentional.

The existing `kit.useForm` name described neither creation nor kit ownership.
The form already belongs permanently to the exact kit snapshot that created it;
the hook temporarily binds mounted React runtime options such as context,
disabled state, validation policy, and callbacks. Using `useForm` for that
narrow operation made it easy to confuse creation with binding.

React Strict Mode may call render-time initialization twice in development and
discard one result. Redux DevTools must therefore activate only after React
retains and binds an instance. Effect cleanup also runs an extra development
cycle, so it cannot represent irreversible form disposal.

## Decision

Every form kit exposes three explicit lifetime operations:

- `kit.createForm` immediately creates an application-owned instance.
- `kit.useCreateForm` creates and retains a component-local instance with lazy
  React state.
- `kit.useBindForm` temporarily binds reactive runtime options to an existing
  instance created by the exact same kit snapshot.

`kit.useCreateForm` has the same definition and creation-option contract as
`kit.createForm`. It retains the first result. Later definition,
`defaultValues`, middleware, or other creation-option arguments do not replace
the instance or discard in-progress values. Applications cross a logical
document boundary with an explicit reset or by remounting the owner with a new
key.

Creation and binding stay separate. `kit.useCreateForm` does not bind runtime
options, because `kit.AutoForm` and `ActionForm` already own that binding.
Manual or headless composition can bind an externally owned instance with
`kit.useBindForm`.

The public `kit.useForm` name is removed without a compatibility alias. The
internal binding hook remains shared by `kit.useBindForm`, `kit.AutoForm`, and
`ActionForm`.

First-party binding finalizers remain deferred until an instance receives its
first retained binding. `kit.useCreateForm` does not disconnect or dispose the
form during effect cleanup. Redux DevTools therefore connects only for the
retained-and-bound Strict Mode instance, and its explicit handle remains the
authority for permanent disconnection.

## Considered Options

- Continuing to document lazy `useState` would avoid one kit method but keep a
  pervasive lifecycle convention in application code.
- Using `useRef` would add nullable initialization and mutable storage without
  preventing Strict Mode from creating a discarded instance.
- Overloading `kit.useForm` for both definitions and instances would hide two
  different option lifecycles behind one name.
- Making `kit.useCreateForm` also bind runtime options would conflict with the
  binding already owned by `kit.AutoForm` and `ActionForm`.
- Disconnecting features in hook cleanup would mistake the Strict Mode
  setup-cleanup-setup probe for permanent disposal.

## Consequences

- The common component-local path no longer imports React state solely to own a
  form instance.
- Application-owned and React-owned form lifetimes remain explicit and use the
  same construction boundary.
- Runtime binding remains available for module-level, shared, manual, and
  headless forms without implying that it establishes kit ownership.
- A form can still have only one active React runtime binding.
- Strict Mode may initialize a discarded isolated form, so middleware
  initialization must not activate external resources before binding.
- The rename is intentionally breaking and does not retain two competing hook
  names.

## Supersession

[ADR 0015](0015-replace-tanstack-form-with-react-hook-form.md) replaced the three lifetime operations. `kit.useForm` creates one
`FormBinding` for the component lifetime. `kit.createForm`,
`kit.useCreateForm`, and `kit.useBindForm` do not exist. The public
`kit.useForm` name returned with this new meaning.
