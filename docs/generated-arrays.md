# Generated arrays

A generated array renders rows with RHF `useFieldArray`. Field paths contain the current numeric row indexes; each React row key is the RHF `field.id`. The array rendering is in `src/generated-nodes.tsx`; row operations and `reconcile` are in `src/array-reconcile.ts`. ADR: `docs/adr/0016-coordinate-managed-value-updates-before-react-hook-form.md`. User guidance: `docs-site/src/pages/arrays.mdx` and `docs-site/src/pages/reconcile.mdx`.

## Row identity

An add, remove or move action is a managed update with an `array` source. Middleware and `beforeUpdate` can cancel it or add dependent value patches. The commit then calls the native `append`, `remove` or `move` of `useFieldArray`, so RHF keeps the row IDs. A write of the array through `setValues` would regenerate the row IDs; see `managed-updates.md` § Commit to RHF.

- Middleware cannot change the length or order of the source array beyond the proposed action. A violation is a `TypeError`.
- The transaction must not change the row count of another mounted generated array. See `managed-updates.md` § Row-count guard.
- Dependent values join the same final React render. Raw RHF subscribers can see the native row operation before the value commit, because the public RHF API cannot publish both as one state change.
- The item default is cloned before each insertion.
- RHF row IDs live only in one form instance. When row identity must survive serialization or a new form instance, the schema must own a row ID.

## Issues follow their rows

Remove, move and `reconcile` move each issue with its row. Issues of a removed row are dropped. Three kinds of issues move:

- Schema issues in RHF errors. RHF native operations move only error branches that are arrays (pinned in `src/rhf-contract.test.tsx`). A schema can report the array-level error before the row errors; then the error branch of the array is an object with numeric keys, and RHF does not move it. `commitRowOperation` moves these object-branch row errors itself and keeps the array-level error.
- The original schema issue paths that the resolver attaches to errors, so the public issues report the new index.
- Stored action and external issues. See `form-binding-and-submission.md` § Stored issues.

## Action semantics

`applyArrayAction` in `src/generated-array.ts` applies one action to the row list. The React runtime and the headless tester in `src/testing/definition-tester.ts` share it, so both reject the same indexes: an index outside the array is a `RangeError`.

## Reconcile

`form.array(path).reconcile(keys, { key, create })` sets the rows to the selected keys in the given order. It keeps each row whose key is selected, removes the other rows and calls `create` for each new key. One managed transaction with the `reconcile` action carries the change; native `remove`, `append` and `move` then apply it, so kept rows keep their row IDs.

The contract:

- The array must be mounted. The generated array registers its native operations on mount, and `reconcile` throws when no generated array at that path is mounted.
- Selected keys and current keys are unique strings or numbers. `create` returns an object whose `key` equals the requested key.
- When the rows already match the keys in order, no transaction starts.
- Middleware cannot change the selected keys, their order, the arrays inside the rows, or the row count of another mounted generated array. A violation is a `TypeError` at commit.

## Restores

A feature restore does not use the native row operations. It resets the complete RHF value tree, so every restored array structure synchronizes; RHF can generate new row IDs. See `managed-updates.md` § Restores.
