# ADR 0016: Coordinate managed value updates before React Hook Form

- Status: Accepted
- Date: 2026-08-04
- Amended by: [ADR 0017](0017-add-managed-update-hooks-around-middleware.md), [ADR 0018](0018-add-managed-value-history.md), [ADR 0019](0019-add-form-persistence-middleware.md), [ADR 0025](0025-move-managed-update-policy-to-form-definitions.md)
- Amends: [ADR 0015](0015-replace-tanstack-form-with-react-hook-form.md)
- Supersedes: [ADR 0008](0008-reducer-core-and-open-middleware.md)

## Context

Applications need to derive one field from another, cancel proposed changes,
and run work after a committed value change. React Hook Form subscriptions can
observe only after a value has already committed, so they cannot make a source
change and its dependent changes atomic. Intercepting every raw React Hook Form
mutation would require Form, Please to own a second store or replace the exposed
React Hook Form API, contradicting ADR 0015.

React Hook Form `setValues` provides one whole-form value publication, but the
usable boundary is narrower than every form operation. Generated field-array
operations must continue through `useFieldArray` to preserve row identities,
and their dependent updates cannot share one raw React Hook Form publication.
`setValues` also requires Form, Please to schedule validation explicitly rather
than relying on React Hook Form's field `onChange` handler.

The previous middleware architecture in ADR 0008 owned an immutable reducer
document, stable array identities, validation transactions, reset, restore,
history, persistence, and runtime commands. That architecture no longer exists
after ADR 0015. Reusing its full transaction model would reintroduce the second
form runtime that the React Hook Form migration removed.

## Decision

Add a narrow, form-local middleware coordinator for managed value updates. It
does not own form state: React Hook Form remains the only editable-value store.
`kit.useForm` accepts one ordered middleware list, fixed for the hook lifetime,
and `FormBinding` adds `form.update(recipe)`. The coordinator handles generated
control updates, generated `append`, `remove`, and `move` actions, and
`form.update`. Initial values, reset, and direct mutations through the unchanged
`form.api` bypass it.

Every managed update uses the coordinator, including forms with an empty
middleware list. This keeps managed-update behavior independent of whether an
application happens to configure middleware, at the cost of changing raw React
Hook Form notification details for all generated controls.

### Value proposals

Use a package-owned Immer instance with patches enabled and `autoFreeze: false`.
`form.update` accepts a synchronous Immer recipe that may mutate its draft or
return a replacement, but not both. A recipe producing no patches produces no
transaction. Form, Please does not add another patch-construction helper.

Immer patches are the authoritative change representation. Patch paths are
segment arrays rather than React Hook Form dot paths. Applying the patches to
`previousValues` derives `nextValues`; middleware cannot supply a contradictory
snapshot. Transaction objects and values are deeply readonly TypeScript views
but are not frozen or cloned into archival snapshots at runtime.

A value transaction contains:

- `previousValues` and derived `nextValues`;
- the current Immer patches;
- the current runtime context;
- a discriminated source for a generated control path, a generated array path
  and action, or `form.update`.

### Middleware contract

Middleware keeps the Redux shape `api => next => transaction`. Its form-local
API contains `getValues` and `update`. `getValues` returns a deeply readonly
view for synchronous use without creating an independent deep clone. Calling
`update` during an active transaction is an error; a later call begins another
transaction.

Middleware forwards or replaces a proposal with `next(patches)`. It may call
`next` synchronously at most once. Returning without calling `next` cancels the
proposal. Dispatch is one ordered pass: there is no nested dispatch, fixed-point
iteration, or automatic rerun when middleware adds dependent patches.

The terminal returns the committed `ValueTransaction`, which already contains
the final `nextValues`. Redux return semantics remain open: any middleware may
replace that result, so `form.update` and a general middleware dispatch result
are typed as `unknown`. Middleware may return a Promise after calling `next`
synchronously. An exception before `next` prevents a commit; an exception after
`next` propagates without rolling the committed values back.

### Commit and validation boundary

Generated control changes and `form.update` commit their final values through
one `setValues` call. The value commit completes before code after `next` runs.
Validation continues to follow the configured `mode` and `reValidateMode`, but
may finish after the value transaction because React Hook Form validation can
be asynchronous. Code that needs validation completion must observe React Hook
Form validation state rather than treating middleware completion as a validated
transaction.

RHF `isDirty` compares the complete current value with defaults, while
`dirtyFields` is guaranteed only for mounted patched paths. Touched state
changes only for a real control blur. For validation scheduling, `form.update`
behaves as a change event. Managed validation uses one public `trigger` call,
so it does not preserve `delayError` timing.

Reject a transaction that removes a top-level key because RHF `setValues`
shallow-merges roots and cannot represent that result exactly. Applications
must assign `undefined` instead when their schema permits it. Nested removal is
supported because the coordinator commits the complete affected root.

Generated structural array actions pass through middleware so applications can
observe, cancel, and add dependent value patches. Middleware may change row
field values and non-structural values outside the array, but it cannot change
the source array length or order beyond the source `append`, `remove`, or
`move`. It also must not change another generated array's structure. The source
operation continues through `useFieldArray` to preserve its row IDs, and
dependent updates join the same final React render. Raw React Hook Form
subscribers may observe an intermediate array state; this is explicitly
render-level rather than raw-store atomicity.

`form.update` and generated control transactions can change fields inside a
generated row, but they must not change generated array length or order. RHF
`setValues` cannot synchronize the private `useFieldArray` row IDs. Structural
changes to each generated array must use that array's generated action, or a
raw application-owned `useFieldArray` operation that deliberately bypasses
middleware.

Raise the React Hook Form peer minimum to `^7.76.1`. Although `setValues` first
appeared in 7.74, later 7.76 and 7.76.1 fixes are required for mounted
controllers, validation options, and whole-form notifications. Ship the
coordinator in the next major release because replacing field-specific generated
control notifications with whole-form `setValues` notifications is observable
through the public raw React Hook Form API. Release automation owns the exact
package version; this implementation does not edit it manually.

## Considered Options

- A React Hook Form subscription could derive dependent values after commit,
  but subscribers would observe the source-only intermediate state.
- Intercepting every `form.api` mutation would provide a universal guarantee,
  but only by hiding or replacing the unchanged React Hook Form API or by
  restoring a second Form, Please store.
- Reusing ADR 0008's reducer, command, and event model would make reset,
  validation, history, persistence, and row identity Form, Please concerns
  again. The requested value middleware does not justify that runtime.
- Bypassing the coordinator when no middleware is configured would preserve
  current React Hook Form notifications and reduce work, but would make the
  semantics of generated controls depend on a configuration detail.
- Keeping Immer auto-freezing and cloning before the React Hook Form boundary
  would provide runtime-immutable transaction snapshots, but would add full
  value-tree cloning to every managed update. Globally disabling auto-freezing
  would also mutate application-owned Immer configuration.
- A custom diff or a partial-object patch format would duplicate Immer's patch
  machinery and create another source of truth for `nextValues`.
- Allowing middleware to arbitrarily replace array structure would require
  `useFieldArray.replace`, remount rows, and discard the identity guarantee of
  the source operation. Inferring arbitrary patches back into stable array
  operations is ambiguous without schema-owned row IDs.
- Awaiting validation inside `next` would make the value pipeline asynchronous
  without making validation failures rollback-safe.
- Supporting React Hook Form 7.74 would admit versions where `setValues` did not
  yet update mounted controllers or forward the notification and validation
  behavior required by this coordinator.

## Consequences

- Applications can derive, cancel, and observe managed value updates without a
  second form store.
- Atomicity is explicit and scoped: generated controls and `form.update` have
  one raw value publication, while structural arrays promise only one final
  React render.
- Direct React Hook Form mutations remain a deliberate escape hatch and can
  violate invariants that application middleware enforces for managed updates.
- Middleware order and cancellation affect application behavior, while nested
  dispatch and automatic dependency convergence are deliberately unavailable.
- Middleware completion means values committed, not validation settled, effects
  completed, or rollback available.
- Immer becomes a root runtime dependency, and generated updates pay the
  coordinator and patch-production cost even when middleware is empty.
- Raw React Hook Form subscribers observe different generated-control
  notification metadata, requiring a major release and migration notes.
