# Managed updates

Every managed update goes through the form-local coordinator, also when the form has no middleware. The coordinator does not keep live values; RHF stays the only owner of form state. The coordinator is `createValueCoordinator` in `src/value-middleware.ts`; the RHF commit is in `src/managed-commit.ts`. The guarantees for users (sources, lifecycle order, `next` rules, errors, validation timing): `docs-site/src/pages/middleware.mdx`.

ADRs: `docs/adr/0016-coordinate-managed-value-updates-before-react-hook-form.md` (coordinator before RHF), `docs/adr/0017-add-managed-update-hooks-around-middleware.md` (hooks), `docs/adr/0025-move-managed-update-policy-to-form-definitions.md` (policy in the definition), `docs/adr/0027-reset-hidden-field-values-in-managed-updates.md` (`whenHidden`).

## Coordinator rules

- The policy (middleware, `beforeUpdate`, `afterUpdate`) is fixed with the definition, and each binding initializes its own middleware chain. Callbacks therefore read binding data from `transaction.context`, never from a React closure.
- The coordinator derives `nextValues` from the forwarded patches, so middleware cannot commit values that the patches do not produce.
- `form.api`, initial values and reset bypass the coordinator on purpose: `form.api` is the unchanged RHF API, for the cases in which an application wants raw RHF behaviour.

## Commit to RHF

The commit writes each changed top-level key of the input:

- A top-level key that does not contain a mounted generated array goes through one `setValues` call.
- A top-level key that contains a mounted generated array goes through one `setValue` call for each changed leaf. RHF 7.91 regenerates the row IDs of each field array that `setValues` covers, also an unchanged one. `src/rhf-contract.test.tsx` pins that a leaf `setValue` keeps the row IDs.

`setValues` shallow-merges top-level keys (pinned in `src/rhf-contract.test.tsx`), so the coordinator rejects the removal of a top-level key. Feature restores pass `allowTopLevelRemoval`, because they reset the complete value tree.

## Revalidation

After the commit, one RHF `trigger` call validates the patched paths. `shouldValidateManagedTransaction` in `src/managed-commit.ts` mirrors the RHF decision by `mode` and `reValidateMode`; `src/rhf-contract.test.tsx` pins the `isSubmitted` subscription that it reads. The guarantee for users: `docs-site/src/pages/middleware.mdx`.

## Source policies

`sourcePolicies` in `src/value-middleware.ts` holds the fixed coordinator rules for each transaction source type. TypeScript requires one entry for each source type, so a new source type cannot skip a decision.

The rule `reshapesSourceArray` exists because an `array` source changes the rows of its array:

- The coordinator keeps every proposed patch of that source. Other sources keep only the patches that still change a value. The structural array check compares the length and order patches of the source array, so they must stay as proposed.
- `whenHidden` skips the fields in the source array, because field paths use row indexes and the action moves rows.

## whenHidden

`applyHiddenFieldWrites` in `src/value-middleware.ts` runs after `beforeUpdate` and before middleware. `resolveHiddenFieldWrites` in `src/definition.ts` resolves field visibility for `previousValues` and `nextValues` with the transaction context. The writes extend the same transaction and keep its source. The loop ends because each field receives at most one write. The coordinator skips the step for a restore and, through `reshapesSourceArray`, for the source array; see `managed-updates.md` § Source policies. A definition without a `whenHidden` action gets no resolver, so the step costs nothing. The guarantee for users: `docs-site/src/pages/conditional-fields.mdx`.

## Restores

A feature restore is a managed update in which a managed feature replaces the complete schema input. The feature dispatches it through the package-private coordinator capability with a `RestorePolicy` (`src/value-middleware.ts`). The feature chooses the policy; the core does not branch on feature names. `keepFormState: true` keeps RHF metadata and revalidates (history); `keepFormState: false` clears it and does not validate (persistence).

A restore resets the complete RHF value tree with `keepDefaultValues`, so the default-value baseline stays (pinned in `src/rhf-contract.test.tsx`). The reset synchronizes every restored array structure, so a restore skips the row-count guard; RHF can generate new row IDs. A restore also skips `whenHidden`, because it brings back complete values.

Another feature reads `isRestoring()` on the capability during the transaction. History uses it to treat a restore from another feature as a boundary that undo cannot pass.

The guarantees for users: `docs-site/src/pages/history.mdx` and `docs-site/src/pages/persistence.mdx`.

## Row-count guard

`setValues` and leaf `setValue` cannot update the row state of `useFieldArray`, so `assertMountedArrayStructures` in `src/array-reconcile.ts` rejects a managed update that changes the row count of a mounted generated array. The array of the transaction's own `array` source is exempt, because its native operation changes the rows. The guard maps an array inside a kept row of the source array to the new index of that row. The guarantee for users: `docs-site/src/pages/middleware.mdx`. Row operations: `generated-arrays.md`.
