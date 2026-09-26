# ADR 0027: Reset hidden field values in managed updates

- Status: Accepted
- Date: 2026-09-27
- Amends: [ADR 0017](0017-add-managed-update-hooks-around-middleware.md)

## Context

Form, Please sets React Hook Form `shouldUnregister: false`. A hidden field
keeps its value, and the Standard Schema still receives that value. RHF
applications that use `shouldUnregister: true` get three behaviors from one
global flag:

1. The submitted output does not contain the hidden value.
2. Validation ignores the hidden value.
3. The field is empty when it becomes visible again.

A schema transform provides the first behavior. A schema that branches on the
visibility condition provides the second behavior. The third behavior needs a
`beforeUpdate` hook or middleware that repeats the `visible` condition of the
field and of every ancestor section or array. The two conditions can diverge.

RHF implements the third behavior when a React component unmounts. That
removal bypasses managed transactions, so middleware, history, and persistence
do not observe it. It also removes a key that the inferred `Input` type
declares.

The first custom runtime had `valuePolicy: "unset"`. It also committed value
changes when the runtime context changed. [ADR 0007](0007-project-application-resources-synchronously.md)
records the risk: a temporary `visible: false` during a pending resource can
remove a value permanently. [ADR 0014](0014-add-experimental-tanstack-form-runtime.md)
rejected the policy, and the RHF runtime did not restore it.

## Decision

A field node accepts an optional `whenHidden` property:

```ts
type WhenHidden<Value> = "keep" | "reset" | { readonly value: Value }

readonly whenHidden?: Resolvable<WhenHidden<PathValue<Scope, Path>>, Root, Context>
```

- `"keep"` is the default. The field keeps its value.
- `"reset"` writes the value at the same path in the initial form values. When
  that path is absent, the field receives `undefined`. A field in an array
  item that is absent from the initial values has no initial value, so
  `"reset"` throws a `TypeError` for it.
- `{ value }` writes the explicit value. The object wrapper keeps the strings
  `"keep"` and `"reset"` available as field values.

The coordinator applies `whenHidden` after `beforeUpdate` and before the first
middleware. For each field that is visible with `previousValues` and hidden
with `nextValues`, the coordinator resolves `whenHidden` with `nextValues` and
the transaction context. It adds the resulting writes to the same transaction
and keeps the original `source`. A write can hide another field, so the step
repeats until no new field becomes hidden. Each field receives at most one
write in one transaction.

The step does not run for these cases:

- A field that is hidden in the initial values.
- A field that was already hidden before the transaction.
- A change of the runtime context. Only a managed transaction starts the step.
  The application calls `form.update` where it changes the context.
- A `history` or `persistence` restore.
- A transaction that `beforeUpdate` cancels.
- A field inside the array that an `array` source changes. Array paths use
  item positions, and a structural change moves items between positions.

`whenHidden` does not change submission or validation. The key stays in the
values, and the schema still validates it. The global `shouldUnregister: false`
setting does not change.

## Considered Options

- A global or per-field `shouldUnregister` option would repeat the RHF
  behavior. It would bypass managed transactions, break the `Input` type, and
  promise submission and validation behavior that a reset does not provide.
- A reset when the context changes would need a transaction that no user
  action started. It cannot tell a temporary context from a final context. It
  would add an undo step that the user did not make, and it would run in a
  React effect after the first render and after SSR hydration.
- A reset in a React effect after a render would add a render and show the old
  value for one frame. History would record the reset as a separate entry.
- A static `resetWhenHidden: boolean` would differ from the other field
  properties, which are all resolvable. It also cannot describe a third
  behavior.
- Exported symbols or factory functions for the actions would need an import
  for two constants. The public API uses strings for actions, such as
  `control: "radio"` and `mode: "onSubmit"`.
- Helpers in the resolver arguments would change the `UiResolver` signature
  that all node properties share.

## Consequences

- The visibility condition stays in one place. `whenHidden` does not repeat
  the `visible` condition of the field or its ancestors.
- One user action produces one transaction and one history entry, including
  its resets. Middleware observes the resets as ordinary patches.
- `ValueTransactionSource` does not get a new variant, so exhaustive checks
  in application middleware do not break.
- A form without `whenHidden` does no additional work. A form with
  `whenHidden` resolves field visibility at least twice for each transaction.
- An application that hides a field through the context must write the reset
  itself.
- A `form.update` recipe that reorders array items can move a reset to a
  different item, because the step compares fields by path.
