# Form persistence

`form-please/persistence` is an optional managed feature that keeps a persisted form draft. `managed-features.md` owns the shared feature contract. The implementation is `src/persistence/persistence.ts`; the envelope format is in `src/persistence/encoding.ts`. ADR `docs/adr/0019-add-form-persistence-middleware.md` explains the decision. The site page `docs-site/src/pages/persistence.mdx` owns user guidance.

## Ownership

Form, Please owns the persistence envelope: its protocol version, the application version and the tagged codecs for values that JSON cannot represent. The application owns the persistence adapter, the storage, authorization, cross-client coordination and retention. The adapter transports envelopes by key and does not interpret them.

The draft contains only the complete editable schema input. It does not contain React Hook Form metadata, runtime context, default values or managed value history.

A persistence migration receives decoded, untrusted values from an older application version. The feature does not validate the migration result or the restored draft against the Standard Schema, because a draft is editable input and can be temporarily invalid.

## Restore

`restore()` loads the draft once through the adapter and dispatches a persistence restore with a `persistence` source. Middleware can cancel or transform the restored input. `usePersistence` calls `restore()` in an effect, so the restore starts only after the client mounts.

- A persistence restore uses `keepFormState: false`: it clears errors, touched and submit state and does not validate. `managed-updates.md` § Restores owns the restore commit. The restored draft stays dirty relative to the original defaults.
- The restore goes through the managed pipeline, not through raw `form.api.reset`, so the middleware policies of the form apply to it.
- When live input changes while the load or decode is pending, the restore reports a persistence restore conflict and does not apply the draft. The feature does not merge, because a merge could overwrite a newer user edit.
- When middleware transforms the restored input or a persistence migration changes it, the feature saves the result at once, so storage holds the current shape.
- History treats a persistence restore as a boundary; see `history.md` § Boundaries.

## Autosave

Autosave starts after a restore or after an explicit `start()`. It observes every React Hook Form value publication through a subscription, including raw `form.api` changes that bypass middleware. A save of managed transactions only would miss direct React Hook Form updates, resets and application-owned array operations.

- Edits made while no subscription exists, for example while no `usePersistence` hook is mounted, count as one new revision when the subscription starts again.
- `usePersistence` releases the subscription after its last hook instance unmounts. While a restore is pending, the feature keeps the subscription until the restore settles, because conflict detection needs live edits.
- A save that is scheduled or in flight finishes with the last observed input after unmount, so unmount does not discard an accepted edit.
- A storage failure does not roll values back. The feature retries only after another edit or an explicit operation.

## One key per mounted form

A feature has one key. All forms that configure the same feature save to that key. Mount at most one form for each key at a time; give each simultaneously mounted form its own feature with its own key.

## Not provided

The feature does not provide tab synchronization, unload guarantees, background retry or several write destinations. An application that needs several destinations composes them in one adapter.
