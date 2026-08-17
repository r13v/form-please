# ADR 0019: Add form persistence as optional middleware

- Status: Accepted
- Date: 2026-08-06
- Amends: [ADR 0016](0016-coordinate-managed-value-updates-before-react-hook-form.md)
- Amended by: [ADR 0023](0023-add-react-feature-hooks.md), [ADR 0025](0025-move-managed-update-policy-to-form-definitions.md)

## Context

Applications need editable form drafts to survive remounts, navigation, and
storage round trips. The earlier persistence feature depended on the retired
Form Please reducer document, event journal, and stable array-row identities.
The current runtime instead exposes React Hook Form unchanged as the only live
form store and limits Form Please middleware to managed value updates.

Persistence needs to observe every committed value change, including raw React
Hook Form operations, while restoring a draft through the policies that govern
managed changes. Reintroducing the old document runtime or hiding the React
Hook Form API would contradict the current ownership boundary.

## Decision

Add `form-please/persistence` as an optional React-free entry. It exports
`createPersistenceMiddleware(options)`, which returns a reusable middleware
feature with exact-form `handle(form)` lookup. A form can configure one
persistence feature in its fixed middleware list. The handle exposes explicit
`restore`, `start`, `flush`, and `clear` operations plus a React-compatible
snapshot subscription.

Persistence retains only the current editable Standard Schema input. It does
not retain managed history, React Hook Form metadata, runtime context, or the
default-value baseline. After `restore()` or `start()` activates persistence, a
React Hook Form subscription observes every committed value change. Saving is a
trailing debounce, defaults to 500 milliseconds, coalesces the latest input,
and serializes adapter writes.

Persistence restore enters the managed pipeline with source
`{ type: "persistence", action: "restore" }`. Hooks and middleware can cancel
or transform it. A commit replaces the complete input, preserves the original
default-value baseline, recalculates dirty state, clears stale interaction and
submission metadata, and does not run validation automatically. Editable
schema-invalid drafts are allowed. If live values change while an asynchronous
load is pending, restore reports a conflict and does not overwrite them.

The package owns a new JSON-safe protocol envelope, application versioning,
decoded-value migration, and tagged asynchronous codecs. The structural encoder
supports JSON primitives, finite numbers, `undefined`, arrays, and plain object
graphs. `Date` has an opt-in first-party codec; files and other opaque values
require application codecs. No compatibility is provided for the retired
persistence protocol.

Applications own the keyed asynchronous storage adapter. The first-party
local-storage adapter acquires `Storage` lazily and only translates envelopes
to and from JSON. The core does not add history persistence, external storage
synchronization, automatic retries, page-unload behavior, or multiple
persistence owners. Storage failures never roll back form values.

## Considered Options

- A React hook or `useForm` option would automate setup but hide asynchronous
  restore conflicts and place an optional storage concern in the React root.
- Saving only managed transactions would miss direct React Hook Form updates,
  resets, and application-owned array operations.
- Restoring through raw `form.api.reset` would bypass the middleware policies
  that the application explicitly configured.
- Persisting history or React Hook Form metadata would enlarge the protocol and
  blur the boundary between a durable draft and in-memory navigation state.
- Adapter-owned encoding would keep the package smaller but duplicate protocol,
  migration, and codec behavior across local, URL, and server transports.
- Multiple persistence middleware would create competing restore authorities;
  applications that need several write destinations can compose one adapter.

## Consequences

- React Hook Form remains the only live form store, and the optional entry adds
  no React runtime dependency.
- The root transaction type knows about persistence restore without importing
  the optional implementation.
- Restored drafts remain dirty relative to the original defaults and may remain
  temporarily invalid.
- Query-string transports remain application adapters. The documentation uses
  `nuqs` for the live example and keeps localStorage and server transports as
  copyable alternatives.
