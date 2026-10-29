# Managed features

A managed feature is an optional form middleware that keeps per-form state and exposes it through `feature.handle(form)`. History and persistence are the managed features of the package. This document owns the contract that all managed features share. `history.md` and `persistence.md` own the rules of each feature.

## Feature definition

`defineManagedFeature` in `src/managed-feature.ts` creates the middleware and its `handle` lookup. It is package-private. The public entries export only the features that it creates.

- A feature keeps separate state for each form binding, keyed by the package-private coordinator capability of that binding. The feature does not add a field to `FormBinding`.
- The kind is the `name` argument. `claimFeature` in `src/value-middleware.ts` claims one slot for each kind on the capability when the binding builds its chain, and `handle(form)` compares the claim with its own feature object. A form binding can therefore not read the state of a feature that it did not configure.
- `handle(form)` gives the feature the binding through the optional `attach` callback. A feature that needs the React Hook Form API, such as the persistence subscription, gets it there, because the coordinator capability does not expose it.

The one-feature-per-kind and `handle` errors for users: `docs-site/src/pages/history.mdx` and `docs-site/src/pages/persistence.mdx`.

## Commit observation

The feature middleware forwards the patches with `next` and then calls `observeCommit` in a `finally` block. A post-commit error does not roll values back, so the feature must observe the commit also when a later middleware or `next` throws.

`observeCommit` reads the terminal committed transaction from the capability, not the transaction that the feature forwarded, so a middleware after the feature cannot hide the final values from it. The guarantee for users: `docs-site/src/pages/history.mdx`.

## Feature restore

A feature that replaces the complete schema input calls `restore` on the coordinator capability with a `RestorePolicy` from `src/value-middleware.ts`. The feature chooses the policy; the core does not branch on feature names. A feature restore enters `beforeUpdate`, middleware and `afterUpdate` like any other managed value update. `managed-updates.md` § Restores owns what a restore keeps and which update steps it skips.

Another feature in the chain sees the restore through `isRestoring()` on the capability; `managed-updates.md` § Restores owns that rule.

## Diagnostic adapter

A feature registers one read-only adapter with `registerFormDiagnosticFeature` in `src/diagnostics.ts` when its state is created. The adapter has a `kind`, a `label`, a snapshot, internal details and a subscription. One form registers each kind once. The devtools Features view lists the registered adapters under their labels, so a new feature needs no devtools change. `devtools.md` owns the devtools contract.

## Add a feature

A new managed feature plugs in without edits to the coordinator, the form binding or devtools:

- Create the middleware with `defineManagedFeature` and a new kind name.
- Register a diagnostic adapter with that kind and a readable label.
- Restore complete values through the capability with the `RestorePolicy` that fits the feature.
- Give React access through `useSnapshot` from the root entry, as `useHistory` and `usePersistence` do. ADR `docs/adr/0023-add-react-feature-hooks.md` explains the hook shape.

The capability `restore` accepts only the `history` and `persistence` source types. A feature with its own restore source adds a member to `ValueTransactionSource` and an entry to `sourcePolicies` in `src/value-middleware.ts`. TypeScript requires the entry. The new member is a change of the public `ValueTransactionSource` type.
