# Definitions and resolution

This document owns the form kit, the form definition model, definition resolution and the resource helpers. The docs site page `docs-site/src/pages/definitions.mdx` owns the user guidance.

## Form kit ownership

`createFormKit` freezes one snapshot of controls, slots and grid. A form definition, a fragment placement and a form binding belong to the exact kit that created them. Another kit rejects them with an error, even when the two kits have the same registries. This check also finds a definition that a hot reload left behind.

The kit has no runtime extension. Build one complete controls and slots registry before you call `createFormKit`.

`forContext<Context>()` is a type-only view and returns the same runtime kit. When `Context` is concrete, `useForm` requires a context value. A fragment can use a narrower view to state its minimum context; the host context can have more properties.

## Definition model

A form definition contains a Standard Schema, a recursive UI tree and a fixed managed-update policy. `defineForm` copies and freezes the middleware list, so the policy cannot change after definition creation. `managed-updates.md` owns the policy contract.

The UI tree has four node kinds: field, section, array and render. `nodeKindTraits` in `src/definition.ts` states the structural traits of each kind, and normalization reads these traits instead of kind names. To add a node kind, add it to `nodeKindTraits` first.

Paths use RHF dot notation, and the path types delegate to the RHF path types. A generated array selects a non-nullable array of objects. For an array of primitives, or an array that can be `null` or `undefined`, use an application-owned control.

## Builder and object sources

An application writes the UI tree as a `{ ui }` object or with the schema-bound builder of `defineForm` and `defineFragment`. Both sources produce the same plain node objects, and normalization treats them the same.

- Builder lists accept only nodes that a helper of the same builder scope created, and fragment placements. Each helper call then checks its own options, and the type check of a long list stays small. Plain object nodes belong in `{ ui }` sources. `docs/adr/0026-accept-only-helper-created-nodes-in-builder-lists.md` gives the reason.
- The array helper supplies a nested builder bound to the item scope.
- A builder callback runs once and synchronously during definition creation. It is not a value resolver and adds no node kind. `docs/adr/0021-add-schema-bound-ui-builders.md` gives the decision.

## Fragments

`defineFragment` keeps the exact Standard Schema that it receives as `fragment.schema`. `fragment.fields({ at })` creates an opaque placement.

- Without `at`, the placement uses the current form scope or array item scope.
- The object at the placement can have more properties, but it must satisfy the fragment schema input.
- Normalization expands each placement. It adds the prefix to paths and, when `at` is present, adds `at` as a namespace to explicit IDs. The normalized definition contains only field, section, array and render nodes.
- A fragment has no validation pass, state or lifecycle of its own. The form schema validates the complete input.

`docs/adr/0020-add-typed-reusable-form-fragments.md` gives the decision.

## Resolution

`kit.Fields` watches the complete RHF value and resolves the complete UI tree after each change. There is no dependency graph between resolvers: every dynamic resolver runs again after each value change. Resolution keeps the references of unchanged nodes and child lists, so React skips the generated branches that did not change. Resolution compares plain object and array results shallowly. Treat resolved configuration as immutable, and replace a nested value when it changes.

A resolver on an ordinary node receives the complete schema input and the runtime context. A resolver inside a fragment receives the value at the fragment placement and the minimum context of the fragment. This local value stays the fragment root inside nested arrays of the fragment. Put a condition that reads the host form on an ordinary node around the placement.

Resolver input is deeply readonly in TypeScript only. The runtime does not clone, freeze or proxy it. Do not write to it.

## Synchronous resolvers

Every ordinary resolver, including control `props`, returns synchronously. A Promise-like result causes a `TypeError`. An asynchronous resolver would make Form, Please own pending results, stale-result races, cancellation and fallback values. Application data layers already own these lifecycles. `docs/adr/0007-project-application-resources-synchronously.md` records this reason.

## Field options: the asynchronous boundary

The `options` property of a selectable field is the only asynchronous resolver. It accepts a static readonly array or a function that receives `{ values, context, signal }`. `docs/adr/0022-load-selectable-options-asynchronously.md` gives the decision.

- The `values` and `context` inputs are deep proxies. Each property read, also after `await`, becomes a dependency. The function runs again only when one of these values changes.
- A new run aborts the signal of the previous run, and the runtime ignores a stale result.
- The rendered collection is empty while the current run is pending and after it rejects. The form value does not change, even when the selected value is not in the collection.
- A resolved value that is not an array is a contract error, and React surfaces it.

The boundary owns only per-field execution, dependency tracking, cancellation and the order of results. It exposes no loading or error state and has no cache, retry, search or pagination. An application that needs these keeps its own resource state or writes a custom control. `src/field-options.ts` holds the executor that the React runtime and `form-please/testing` share.

## Visibility and whenHidden

Visibility changes rendering only. A hidden field keeps its RHF value, because the runtime disables unregistration. A field `whenHidden` action can write a value when a managed update hides the field. The owner of that contract is `managed-updates.md` § whenHidden.

## Resource helpers

`ResourceState`, `matchResource` and `fromResource` in `src/resource.ts` turn application-owned data into synchronous resolvers. They do not fetch, cache, retry, cancel or keep data. The application loads the data and gives its state to the form, for example through the runtime context. `docs-site/src/pages/resources.mdx` owns the user guidance.
