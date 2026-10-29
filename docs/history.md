# Managed value history

`form-please/history` is an optional managed feature. `managed-features.md` owns the shared feature contract. The implementation is `src/history/history.ts`. ADR `docs/adr/0018-add-managed-value-history.md` explains the decision. The site page `docs-site/src/pages/history.mdx` owns user guidance.

## What history records

History retains complete, independent schema input positions. It records a position only after a successful managed value update that changes values. A cancelled update and a commit with equal previous and next values add no position.

History does not record:

- Initial values and `form.api.reset`.
- Direct mutations through `form.api`, including application-owned `useFieldArray` operations.
- React Hook Form metadata: errors, touched, dirty and submit state.
- Runtime context.

Control updates on one path can share one history group within the group window. Every other managed source creates its own group. An edit after undo removes the redo positions. The defaults of the limit and the group window are in `normalizeLimit` and `normalizeGroupWindow` in `src/history/history.ts`.

## Boundaries

A boundary replaces all positions with the current values as one position. Undo cannot go past a boundary.

- Raw divergence: a direct `form.api` change makes the live values differ from the current position. History does not observe React Hook Form, so it finds the divergence later: at the next managed update, which compares its previous values with the current position, or at the next history operation.
- A restore from another feature, such as a persistence restore: history checks `isRestoring()` on the coordinator capability and adopts the restored values as a boundary. A restored draft acts like initial values.

## History restores

Undo, redo, seek and import are history restores with a `history` source. They enter the current `beforeUpdate`, middleware and `afterUpdate` like other managed value updates.

- A history restore uses `keepFormState: true`: it keeps errors, touched and submit state and revalidates. `managed-updates.md` § Restores owns the restore commit and its effect on row IDs.
- Rows of field arrays can remount after undo or redo, because React Hook Form can regenerate their row IDs. Do not key application state on those IDs across a history restore.
- When middleware or `beforeUpdate` changes the restored values, history records the result as a new position and reports `transformed`. When they cancel it, the position does not move.

## History journal

`export()` returns a `HistoryJournal`. The journal is an in-memory navigation artifact. It is not an event log and not a persistence format: the persistence feature does not store history, and the journal has no codecs or migration.

`import()` checks the journal version, the shape of the entries and the configured limit. It does not validate the entries against the Standard Schema, because history positions are editable input.
