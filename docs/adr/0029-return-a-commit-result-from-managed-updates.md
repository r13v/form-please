# ADR 0029: Return a commit result from managed updates

- Status: Accepted
- Date: 2026-11-23
- Amends: [ADR 0016](0016-coordinate-managed-value-updates-before-react-hook-form.md)

## Context

`form.update`, the middleware `api.update` and `form.array(path).reconcile` returned the value of the outermost middleware, typed as `unknown`. The terminal returns the committed transaction, but any middleware can replace that value. A caller could therefore not tell a committed update from a cancelled one: a cancelled update, an update with a no-op recipe and a middleware that returns nothing all gave `undefined`. The coordinator already knows whether the terminal committed, because it holds the committed transaction of the active dispatch.

A middleware can start post-commit work and return its Promise. Some applications use that return value to wait for the work.

## Decision

- `form.update`, `api.update` and `reconcile` return `FormUpdateResult` (`src/value-middleware.ts`): `{ committed: true, transaction, result }` or `{ committed: false, result }`.
- The coordinator sets `committed` and `transaction` from its own record of the terminal commit, not from the middleware return value.
- `result` carries the value that the middleware chain returned, unchanged, in both variants. It is `undefined` when the chain did not run or returned nothing. A middleware that passes a Promise to the caller returns it, and the caller reads it from `result`. A middleware that cancels after an asynchronous check can return its Promise too; without `result` on the not-committed variant, a rejection of that Promise would be unhandled and the caller could not reach it.
- `FormMiddlewareNext` keeps the return type `unknown`, because a middleware can still replace the value that `next` returns.

## Considered options

- Keep `unknown` and document a convention that middleware returns the transaction. One middleware that does not follow the convention breaks every caller, and TypeScript cannot check it.
- Return a boolean. The caller then cannot read the final transaction or a Promise of post-commit work.
- Return the transaction or `undefined`. This hides the middleware return value, and a middleware can no longer pass a Promise to the caller.
- Make `next` return a typed result and forbid a replacement. This changes the Redux-shaped middleware contract of ADR 0016 for every middleware.

## Consequences

- A caller reads `committed` to know whether values changed, with a type narrowing to `transaction`.
- A caller that read or awaited the middleware return value reads or awaits `result`. This is a breaking change; the upgrade page names the fix.
- The definition tester already returns `committed`, `transaction` and `result` for a managed operation, so the tester and the binding report one shape.
