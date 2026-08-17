# ADR 0017: Add managed update hooks around middleware

- Status: Accepted
- Date: 2026-08-05
- Amends: [ADR 0016](0016-coordinate-managed-value-updates-before-react-hook-form.md)
- Amended by: [ADR 0025](0025-move-managed-update-policy-to-form-definitions.md)

## Context

ADR 0016 added Redux-shaped middleware for composing reusable managed-value
policies. Application code also needs a smaller form-local API for one policy:
adjust or cancel a proposal before commit, and observe the final committed
transaction afterward. Requiring a three-stage middleware function for this
single-callback case makes the common operation harder to express, while
restoring the previous store-wide hooks would contradict the current React Hook
Form boundary.

## Decision

Add one optional `beforeUpdate` callback and one optional `afterUpdate` callback
to `kit.useForm`. Both apply only to managed value updates; initial values,
reset, direct `form.api` mutations, and application-owned field-array operations
continue to bypass the coordinator. The callbacks use their latest React render
versions, while the ordered middleware list remains fixed for the form lifetime.

`beforeUpdate(draft, transaction)` runs before middleware. Its Immer draft starts
from the proposed `nextValues`; mutating the draft adjusts the proposal, returning
`false` cancels it, and returning nothing accepts it. Middleware receives the
effective patches from `previousValues` to the adjusted values. If those values
produce no effective Immer patches relative to `previousValues`, the operation
is a no-op and neither middleware nor `afterUpdate` runs.

After a successful synchronous value commit and the synchronous middleware
unwind, `afterUpdate(transaction)` receives the final `ValueTransaction`,
including downstream patch changes. It also runs when middleware throws after a
commit, because the committed update must remain observable. It does not imply
that React rendering or asynchronous validation has finished.

Both callbacks are synchronous and cannot start a nested managed update. A
Promise or exception from `beforeUpdate` prevents commit. A Promise or exception
from `afterUpdate` propagates without rollback. When post-commit middleware and
`afterUpdate` both fail, dispatch throws an `AggregateError` containing both
failures.

Transactions retain the ADR 0016 semantics: values and context are readonly
views rather than archival clones, the initiating source never changes, and
`form.update` still returns `unknown` because middleware may replace the dispatch
result. Do not add separate callback or event exports; the hooks use the existing
`ValueTransaction` type through `UseFormOptions`.

## Considered Options

- Middleware alone keeps one extension mechanism but leaves simple
  application-level adjustment and cancellation unnecessarily ceremonial.
- Restoring the old hooks exactly would include reset and other operations that
  the unchanged React Hook Form API deliberately keeps outside the coordinator.
- Arrays of hooks would create a second middleware chain with competing ordering
  rules.
- Asynchronous pre-commit hooks would make control changes asynchronous and
  introduce races between edits.
- `beforeManagedUpdate` and `afterManagedUpdate` are more explicit, but the
  shorter established names are easier at the application call site. Their
  managed-only scope is part of the canonical term and documentation.

## Consequences

- Application code can express one managed-update guard or adjustment without
  adopting Redux-shaped middleware.
- Reusable independent policies still compose only through middleware, which
  retains the final say over a proposal changed by `beforeUpdate`.
- The word `update` names both the hooks' whole managed lifecycle and the
  `form.update` source variant; documentation must distinguish those meanings.
- Exceptions after commit remain observable but cannot restore previous values.
