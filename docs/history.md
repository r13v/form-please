# Managed value history

`form-please/history` is an optional managed feature. `managed-features.md` owns the shared feature contract. The implementation is `src/history/history.ts`. ADR `docs/adr/0018-add-managed-value-history.md` explains the decision. The site page `docs-site/src/pages/history.mdx` owns what history records, grouping, limits, operations and the journal.

## Boundaries

A boundary replaces all positions with the current values as one position.

- Raw divergence: history does not subscribe to React Hook Form. It finds a direct `form.api` change later, when the next managed update compares its previous values with the current position, or at the next history operation.
- A restore from another feature: history checks `isRestoring()` on the coordinator capability and adopts the restored values as a boundary, so the restored values act like initial values.

The boundary guarantee for users: `docs-site/src/pages/history.mdx`.

## History restores

Undo, redo, seek and import dispatch a restore through the coordinator capability with a `history` source and `keepFormState: true`. `managed-updates.md` § Restores owns the restore commit and its effect on row IDs. History recognizes its own restore in `observeCommit` by the source type and records a transformed result as a new position.

## History journal

The journal is an in-memory navigation artifact, not an event log or a persistence format. Persistence does not store history, and the journal has no codecs or migration. `import()` does not validate entries against the Standard Schema, because history positions are editable input.
