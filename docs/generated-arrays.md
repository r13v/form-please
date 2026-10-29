# Generated arrays

A generated array renders rows with RHF `useFieldArray`. The array rendering is in `src/generated-nodes.tsx`; row operations and `reconcile` are in `src/array-reconcile.ts`. ADR: `docs/adr/0016-coordinate-managed-value-updates-before-react-hook-form.md`. The guarantees for users: `docs-site/src/pages/arrays.mdx` and `docs-site/src/pages/reconcile.mdx`.

## Row identity

An add, remove or move action is a managed update with an `array` source. After middleware, the commit calls the native `append`, `remove` or `move` of `useFieldArray`, so RHF keeps the row IDs. A write of the array through `setValues` would regenerate the row IDs; see `managed-updates.md` § Commit to RHF.

- The coordinator compares the length and order patches of the source array with the proposed action; see `managed-updates.md` § Source policies.
- Other mounted generated arrays go through `managed-updates.md` § Row-count guard.
- The native row operation and the value commit are two RHF publications, because the public RHF API cannot publish both as one state change. They join one React render.

## Issues follow their rows

Remove, move and `reconcile` move each issue with its row. Three kinds of issues move:

- Schema issues in RHF errors. RHF native operations move only error branches that are arrays (pinned in `src/rhf-contract.test.tsx`). A schema can report the array-level error before the row errors; then the error branch of the array is an object with numeric keys, and RHF does not move it. `commitRowOperation` moves these object-branch row errors itself and keeps the array-level error.
- The original schema issue paths that the resolver attaches to errors, so the public issues report the new index.
- Stored action and external issues. See `form-binding-and-submission.md` § Stored issues.

## Action semantics

`applyArrayAction` in `src/generated-array.ts` applies one action to the row list. The React runtime and the headless tester in `src/testing/definition-tester.ts` share it, so both reject the same indexes.

## Reconcile

`form.array(path).reconcile` carries the change in one managed transaction with the `reconcile` action; native `remove`, `append` and `move` then apply it, so kept rows keep their row IDs. It needs the native operations that the generated array registers on mount, so it requires a mounted array. The checks of selected keys, nested arrays and other mounted arrays run at commit, before the first native operation.

## Restores

A feature restore does not use the native row operations; see `managed-updates.md` § Restores.
