# Form persistence

`form-please/persistence` is an optional managed feature that keeps a persisted form draft. `managed-features.md` owns the shared feature contract. The implementation is `src/persistence/persistence.ts`; the envelope format is in `src/persistence/encoding.ts`. ADR `docs/adr/0019-add-form-persistence-middleware.md` explains the decision. The site page `docs-site/src/pages/persistence.mdx` owns the draft content, the restore results, autosave, the adapter, versions, codecs and the feature boundaries.

## Restore

- A persistence restore goes through the managed pipeline with `keepFormState: false`, not through raw `form.api.reset`, so the middleware policies of the form apply to it. `managed-updates.md` § Restores owns the restore commit.
- A restore that finds changed live input after the load or decode reports a conflict and does not merge, because a merge could overwrite a newer user edit.
- The feature does not validate the migration result or the restored draft against the Standard Schema, because a draft is editable input and can be temporarily invalid.
- History treats a persistence restore as a boundary; see `history.md` § Boundaries.

## Autosave

Autosave subscribes to every React Hook Form value publication, not to managed transactions. A save of managed transactions only would miss raw `form.api` changes, resets and application-owned array operations.

- `usePersistence` releases the subscription after its last hook instance unmounts. While a restore is pending, the feature keeps the subscription until the restore settles, because conflict detection needs live edits.
- When the subscription starts again, the feature compares the live input with the last observed input, so edits made without a subscription count as one revision.

The autosave guarantees for users: `docs-site/src/pages/persistence.mdx`.
