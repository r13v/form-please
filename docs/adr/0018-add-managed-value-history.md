# ADR 0018: Add managed value history without another form store

- Status: Accepted
- Date: 2026-08-05
- Amends: [ADR 0016](0016-coordinate-managed-value-updates-before-react-hook-form.md), [ADR 0017](0017-add-managed-update-hooks-around-middleware.md)
- Amended by: [ADR 0023](0023-add-react-feature-hooks.md), [ADR 0025](0025-move-managed-update-policy-to-form-definitions.md)

## Context

ADR 0016 deliberately limited Form Please middleware to managed value updates
and removed the previous reducer document, event journal, stable row-identity
model, and history runtime. Applications still need user-directed undo, redo,
and navigation, but restoring the old reducer core would contradict React Hook
Form ownership and recreate a second live form store.

## Decision

Add optional managed value history through `form-please/history`. React Hook
Form remains the only live form store. History retains independent, complete
schema-input snapshots only after successful managed value updates. It does not
retain validation, errors, touched state, submission state, focus, context, the
default-value baseline, or React Hook Form's private array-row identities.

`createHistoryMiddleware()` returns a reusable feature. The exact feature
reference must appear in a form's fixed middleware list before
`feature.handle(form)` can return that form's stable history handle. One feature
can serve multiple forms, but one form can configure only one history feature.
The handle exposes navigation state, subscription, `undo`, `redo`, `seek`,
`clear`, `export`, and `import`.

Consecutive generated-control transactions for one schema input path share a
history group within a configurable window of 750 milliseconds. Zero disables
grouping. Other managed sources and paths close the group. Retention defaults to
100 groups. Editing after undo truncates redo.

History navigation is a managed restore with a public `history` transaction
source and an `undo`, `redo`, `seek`, or `import` action. It passes through
`beforeUpdate`, ordered middleware, commit, and `afterUpdate`. Middleware can
cancel or transform the target. Navigation reports `applied`, `unavailable`,
`cancelled`, or `transformed`; its Promise also preserves asynchronous
post-commit middleware failures. A transformed target becomes a new history
group, and an error after commit does not roll back values or history.

The restore terminal uses React Hook Form reset behavior to synchronize complete
values and generated arrays while preserving the original default-value
baseline and current ephemeral form state. Dirty state is recalculated against
the original defaults. React Hook Form may assign new private row IDs, so array
rows may remount.

Initial values, reset, direct `form.api` mutations, and application-owned field
array operations remain outside managed history. When live values diverge from
the retained position, the next managed update or history operation discards the
old navigation branches and adopts the current values as a new starting point.
The raw change itself is not undoable.

`HistoryJournal<Input>` version 1 is an in-memory sequence of complete input
snapshots plus a numeric current index. Import validates the journal protocol,
index, entry count, and object-root input shape, rejects journals beyond the
configured limit, and does not require Standard Schema success because editable
history can contain invalid intermediate input. The journal is not an event log,
audit trail, JSON persistence protocol, or compatibility format for the earlier
unreleased `FormJournal` prototype.

## Considered Options

- Restoring the old reducer document and event journal would preserve its exact
  behavior, but would also restore a second state runtime and stable row identity
  ownership that ADR 0016 removed.
- Observing every React Hook Form mutation would cover raw escape hatches, but
  only after commit and without reliable source, grouping, cancellation, or
  transformation semantics.
- Applying undo and redo directly through the raw React Hook Form API would be
  smaller, but would bypass the middleware policies that govern managed values.
- Retaining patches or document events would reduce repeated snapshot data, but
  would add replay, checkpoint, cursor, sequence, and migration protocols that
  the navigation workflow does not need.
- Adding history to every `FormBinding` would simplify discovery but would put
  an optional stateful feature in the root runtime and package graph.

## Consequences

- Forms pay no history retention cost unless they import and configure the
  optional feature.
- The root transaction type knows about managed history restores, while the root
  runtime does not import the optional history implementation.
- Snapshot retention is intentionally simpler than event sourcing but can use
  more memory for large form inputs.
- Raw React Hook Form escape hatches remain possible and explicitly create a
  non-undoable history boundary.
- Restoring array values is correct, but component-local state inside generated
  rows may be lost when React Hook Form regenerates private row IDs.
