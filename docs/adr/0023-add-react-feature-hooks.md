# ADR 0023: Add React hooks for optional form features

- Status: Accepted
- Date: 2026-08-12
- Amends: [ADR 0018](0018-add-managed-value-history.md), [ADR 0019](0019-add-form-persistence-middleware.md)

## Context

History and persistence expose stable form-specific handles with the external
store contract. React applications must still call `feature.handle(form)` and
adapt that handle with the root `useSnapshot` hook. Persistence also requires a
mount effect that starts `restore()` and handles its rejected Promise.

These steps are individually small but form the standard React integration for
both optional features. Repeating them in application code makes the primary
workflow harder to discover and gives persistence error handling inconsistent
defaults.

ADR 0019 kept persistence React-free because a hook could hide asynchronous
restore conflicts and put optional storage behavior in the root entry. The
feature snapshot now exposes restoring, failed, and conflict phases directly,
and the convenience hook can remain in the optional entry instead of the root.

## Decision

Export `useHistory(form, feature)` directly from `form-please/history`. It
resolves the exact configured handle, subscribes through `useSnapshot`, and
returns the handle operations with a reactive `snapshot` property.

Export `usePersistence(form, feature)` directly from
`form-please/persistence`. It returns the same combined handle and snapshot and
starts `restore()` in a React effect. The effect handles the rejected Promise;
the error remains observable through the failed snapshot and the feature's
`onError` callback. The hook does not retry automatically. Applications can call
the returned `restore()` operation to retry or `start()` to resolve a conflict.

Concurrent mount effects, including React Strict Mode effect replay, continue to
share the persistence core's one in-flight restore Promise. A successful or
empty restore remains idempotent.

Keep `feature.handle(form)` and the root `useSnapshot` adapter public. They
remain the lower-level integration for non-React consumers and for persistence
workflows that must start without loading.

The history and persistence entries become client modules with a React runtime
dependency. The root entry still does not import either optional feature.

## Considered Options

- Separate `form-please/history/react` and `form-please/persistence/react`
  entries would preserve React-free core entries, but would add public package
  paths and split each feature's normal imports across variants.
- Root `useHistory` and `usePersistence` exports would keep one React import but
  would make the root surface aware of optional implementations.
- A generic feature hook would preserve one abstraction but could not express
  persistence restore lifecycle without feature-specific options or branching.
- Adding optional features to `kit.useForm` would remove more application code
  but would blur form binding, storage, and navigation ownership.
- Keeping only `feature.handle(form)` and `useSnapshot` would preserve the
  smallest package surface but retain the repeated primary workflow.

## Consequences

- Both optional features have symmetric, discoverable React APIs.
- Existing handle-based integrations remain source-compatible.
- Importing either optional entry now loads React, even when only its core
  factory or adapter is used.
- Persistence's automatic restore is explicit in the hook contract while
  conflicts, failures, and retries remain application-visible.
