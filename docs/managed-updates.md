# Managed updates

A managed value update is a value change that Form, Please processes before it reaches React Hook Form (RHF). Generated control changes, generated array actions, `form.update(recipe)`, `form.array(path).reconcile` and feature restores are managed updates. Every managed update goes through the form-local coordinator, also when the form has no middleware. The coordinator does not keep live values; RHF stays the only owner of form state. The coordinator is `createValueCoordinator` in `src/value-middleware.ts`; the RHF commit is in `src/managed-commit.ts`.

ADRs: `docs/adr/0016-coordinate-managed-value-updates-before-react-hook-form.md` (coordinator before RHF), `docs/adr/0017-add-managed-update-hooks-around-middleware.md` (hooks), `docs/adr/0025-move-managed-update-policy-to-form-definitions.md` (policy in the definition), `docs/adr/0027-reset-hidden-field-values-in-managed-updates.md` (`whenHidden`).

## Lifecycle order

One managed update runs these steps in this order:

1. The Immer recipe produces patches. An empty patch list produces no transaction and no other step runs.
2. `beforeUpdate` receives an Immer draft of the proposed values. It can adjust the proposal or cancel it with `false`.
3. `whenHidden` actions add writes for the fields that the transaction hides. See `managed-updates.md` § whenHidden.
4. The middleware chain runs in definition order. Each middleware forwards patches with `next`.
5. The terminal `next` commits the transaction to RHF.
6. After the synchronous middleware unwind, `afterUpdate` receives the final committed transaction. It does not run when the update was cancelled.

The policy (middleware, `beforeUpdate`, `afterUpdate`) belongs to the form definition and is fixed for the binding lifetime. Each binding initializes an independent middleware chain. A callback reads binding-specific data from `transaction.context`, not from a React closure.

## Rules for next

- `next` commits before it returns. Code after `next` is post-commit work.
- A middleware calls `next` at most once. A second call is a `TypeError`.
- A middleware that returns without a call to `next` cancels the transaction.
- A middleware can append patches or replace them. The coordinator derives `nextValues` from the forwarded patches; middleware cannot supply values that the patches do not produce.
- A middleware controls the dispatch return value, so `form.update` returns `unknown`.
- An error after the commit does not roll back the values. When middleware and `afterUpdate` both fail, the caller receives an `AggregateError`.

## Synchronous rules

- The recipe, `beforeUpdate` and `afterUpdate` are synchronous. A Promise result is a `TypeError`.
- `next` must be called synchronously. A call after the middleware frame returns is a `TypeError`.
- A managed update cannot start while another managed update is active. A nested `update` call is a `TypeError`.
- A middleware can return a Promise after a synchronous commit. An update that starts after that asynchronous work is an independent transaction.

## What bypasses the coordinator

Direct calls through `form.api`, initial values and reset do not go through middleware, `beforeUpdate`, `afterUpdate` or `whenHidden`. This is deliberate: `form.api` is the unchanged RHF API, and an application uses it when it wants raw RHF behaviour. Managed value history does not record these changes.

## Commit to RHF

The commit writes each changed top-level key of the input:

- A top-level key that does not contain a mounted generated array goes through one `setValues` call.
- A top-level key that contains a mounted generated array goes through one `setValue` call for each changed leaf. RHF 7.91 regenerates the row IDs of each field array that `setValues` covers, also an unchanged one. `src/rhf-contract.test.tsx` pins that a leaf `setValue` keeps the row IDs.

A managed update cannot remove a top-level key, because `setValues` shallow-merges top-level keys (pinned in `src/rhf-contract.test.tsx`). Assign `undefined` when the schema permits it. Feature restores are exempt, because they reset the complete value tree.

## Revalidation

After the commit, one RHF `trigger` call validates the patched paths when RHF would validate the same change: by `mode` before the first submit and by `reValidateMode` after it. `src/rhf-contract.test.tsx` pins the `isSubmitted` subscription that this check reads. Managed validation does not keep the `delayError` timing of RHF. `isDirty` is the RHF comparison of the complete value; `dirtyFields` is correct only for mounted patched paths.

## Source policies

`sourcePolicies` in `src/value-middleware.ts` holds the fixed coordinator rules for each transaction source type. TypeScript requires one entry for each source type, so a new source type cannot skip a decision.

The rule `reshapesSourceArray` exists because an `array` source changes the rows of its array:

- The coordinator keeps every proposed patch of that source. Other sources keep only the patches that still change a value. The structural array check compares the length and order patches of the source array, so they must stay as proposed.
- `whenHidden` skips the fields in the source array, because field paths use row indexes and the action moves rows.

## whenHidden

After `beforeUpdate`, the coordinator applies the field `whenHidden` actions. It resolves field visibility for `previousValues` and `nextValues` with the transaction context. For each field that the transaction hides, it adds the resolved write to the same transaction, which keeps its source. The step repeats until no other field becomes hidden; each field receives at most one write. The writes are visible to middleware, `afterUpdate` and managed value history as part of the transaction.

`whenHidden` does not apply in these cases:

- A feature restore. It brings back complete values, and a hidden field keeps its restored value.
- A context change. A context change is not a managed update.
- A field in the array of a source that reshapes its array. See `managed-updates.md` § Source policies.

Without a `whenHidden` action, a hidden field keeps its value, because the binding sets `shouldUnregister: false`. The resolver is `resolveHiddenFieldWrites` in `src/definition.ts`.

## Restores

A feature restore is a managed update in which a managed feature replaces the complete schema input. The feature dispatches it through the package-private coordinator capability with a `RestorePolicy` (`src/value-middleware.ts`). The feature chooses the policy; the core does not branch on feature names:

- `keepFormState: true` keeps RHF errors, touched and submit state, and revalidates by the form mode. History navigation uses it.
- `keepFormState: false` clears that state and does not validate. A persistence restore uses it.

A restore resets the complete RHF value tree with `keepDefaultValues`, so the default-value baseline stays (pinned in `src/rhf-contract.test.tsx`). The reset synchronizes every restored array structure. The array values are exact, but RHF can generate new row IDs. A restore skips `whenHidden` and the row-count guard.

Another feature reads `isRestoring()` on the capability during the transaction. History uses it to treat a restore from another feature as a boundary that undo cannot pass.

## Row-count guard

A managed update must not change the number of rows of a mounted generated array, because `setValues` and leaf `setValue` cannot update the row state of `useFieldArray`. The only exception is the array of the transaction's own `array` source; its native operation changes the rows. An array inside a row of the source array is compared with the same row after the action. A value change that keeps the row count is allowed. A violation is a `TypeError` that names the array path. The guard is `assertMountedArrayStructures` in `src/array-reconcile.ts`. To change rows, use the generated array actions or `form.array(path).reconcile`; see `generated-arrays.md`.
