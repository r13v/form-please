# Definitions and resolution

This document owns the internal contracts of the form kit, the form definition model, definition resolution and the resource helpers. The user guarantees: `docs-site/src/pages/definitions.mdx`, `docs-site/src/pages/form-kits.mdx` and `docs-site/src/pages/api.mdx`.

## Form kit ownership

Each kit checks identity, not structure. `createFormKit` in `src/create-form-kit.tsx` keeps private registries of the definitions, fragments and mounted bindings that it created (`definitions`, `fragments` and `runtimeForms`). Normalization asks the kit through `OwnsFragment` in `src/definition.ts` before it expands a fragment placement. A structural check would accept a definition that a hot reload left behind with an old registry. The guarantee for users: `docs-site/src/pages/faqs.mdx`.

`forContext<Context>()` returns the same runtime kit object; the context type exists only in TypeScript.

## Definition model

A form definition contains a Standard Schema, a recursive UI tree and a managed-update policy that is fixed at definition creation. `managed-updates.md` owns the policy contract.

The UI tree has four node kinds: field, section, array and render. `nodeKindTraits` in `src/definition.ts` states the structural traits of each kind, and normalization reads these traits instead of kind names. To add a node kind, add it to `nodeKindTraits` first.

The path types delegate to the RHF path types.

## Builder and object sources

An application writes the UI tree as a `{ ui }` object or with the schema-bound builder of `defineForm` and `defineFragment`. Both sources produce the same plain node objects, and normalization treats them the same. The site shows only the builder form; `docs-site/AGENTS.md` owns that rule.

- Builder lists accept only nodes that a helper of the same builder scope created, and fragment placements. Each helper call then checks its own options, so the type check of a long list stays small. `docs/adr/0026-accept-only-helper-created-nodes-in-builder-lists.md` gives the reason.
- A builder callback is not a value resolver and adds no node kind. `docs/adr/0021-add-schema-bound-ui-builders.md` gives the decision.

## Fragments

A fragment placement is opaque. Normalization expands each placement: it adds the prefix to paths and, when `at` is present, adds `at` to the `idPrefix` of explicit IDs. The normalized definition contains only field, section, array and render nodes, so the runtime, devtools and `form-please/testing` never see a fragment. `docs/adr/0020-add-typed-reusable-form-fragments.md` gives the decision.

## Resolution

`kit.Fields` watches the complete RHF value and resolves the complete UI tree after each change. Resolution keeps the references of unchanged nodes and child lists, so React skips the generated branches that did not change. Do not add a dependency graph between resolvers or a cache of resolver results; the shallow comparison of results is the only reuse. The guarantee for users: `docs-site/src/pages/definitions.mdx`.

## Synchronous resolvers

Every ordinary resolver returns synchronously; `resolveValue` in `src/definition.ts` rejects a Promise-like result. An asynchronous resolver would make Form, Please own pending results, stale-result races, cancellation and fallback values. Application data layers already own these lifecycles. `docs/adr/0007-project-application-resources-synchronously.md` records this reason.

## Field options: the asynchronous boundary

The `options` property of a selectable field is the only asynchronous resolver. `docs/adr/0022-load-selectable-options-asynchronously.md` gives the decision. `src/field-options.ts` holds the executor that the React runtime and `form-please/testing` share. It tracks dependencies through deep proxies of `values` and `context`, so a read after `await` is also a dependency.

The boundary owns only per-field execution, dependency tracking, cancellation and the order of results. Do not add a loading or error state, a cache, retries, search or pagination: an application that needs them keeps its own resource state or writes a custom control. The user contract: `docs-site/src/pages/definitions.mdx`.

## Visibility and whenHidden

A hidden field keeps its RHF value because the binding sets `shouldUnregister: false`; see `form-binding-and-submission.md` § Resolver ownership. The owner of the `whenHidden` contract is `managed-updates.md` § whenHidden.

## Resource helpers

`ResourceState`, `matchResource` and `fromResource` in `src/resource.ts` turn application-owned data into synchronous resolvers. They keep no state. The user guidance: `docs-site/src/pages/resources.mdx`.
