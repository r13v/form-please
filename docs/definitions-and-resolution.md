# Definitions and resolution

This document owns the internal contracts of the form kit, the form definition model, definition resolution and the resource helpers. The user guarantees: `docs-site/src/pages/definitions.mdx`, `docs-site/src/pages/form-kits.mdx` and `docs-site/src/pages/api.mdx`.

## Form kit ownership

Each kit checks identity, not structure. `createFormKit` in `src/create-form-kit.tsx` keeps private registries of the definitions, fragments and form runtimes that it created (`definitions`, `fragments` and `runtimeForms`, keyed by binding). Normalization asks the kit through `OwnsFragment` in `src/definition.ts` before it expands a fragment placement. A structural check would accept a definition that a hot reload left behind with an old registry. The guarantee for users: `docs-site/src/pages/faqs.mdx`.

`forContext<Context>()` returns the same runtime kit object; the context type exists only in TypeScript.

## Definition model

A form definition contains a Standard Schema, a recursive UI tree and a managed-update policy that is fixed at definition creation. `managed-updates.md` owns the policy contract.

The UI tree has four node kinds: field, section, array and render. `nodeKindTraits` in `src/definition.ts` states the structural traits of each kind, and normalization reads these traits instead of kind names. To add a node kind, add it to `nodeKindTraits` first.

The path types delegate to the RHF path types.

## Builder authoring

`defineForm` and `defineFragment` accept only the schema-bound builder. `docs/adr/0032-accept-only-builder-callbacks-in-definitions.md` gives the decision.

- The helpers record each node that they create in `builtNodes` in `src/definition.ts`. Normalization accepts only these nodes and fragment placements, so untyped code cannot pass a hand-written node through a builder. A fragment snapshot of a helper node is recorded too. Do not add a second way to create a node.
- Builder lists accept only nodes that a helper of the same builder scope created, and fragment placements. The helpers return an opaque branded type, and each helper call checks its own options, so the type check of a long list stays small. `docs/adr/0026-accept-only-helper-created-nodes-in-builder-lists.md` gives the reason.
- A builder callback is not a value resolver and adds no node kind. `docs/adr/0021-add-schema-bound-ui-builders.md` gives the decision.

## Kit type bag

Every public type that depends on kit contracts takes one bag, `FormKitTypes` in `src/types.ts`. `docs/adr/0031-name-kit-contracts-with-one-type-bag.md` gives the decision. The user guarantees: `docs-site/src/pages/types.mdx`.

- `createFormKit` infers one type parameter per contract and builds the bag in its return type. TypeScript does not infer a type parameter through `Kit["controls"]`.
- `FormKitTypesOf` reads the bag from a type-only property of `FormKit` in `src/form-kit-types.ts`.
- `FormFragmentPlacement` in `src/types.ts` keeps the contracts as separate parameters. The context is contravariant there and the other contracts are covariant; a bag parameter would make the whole bag invariant and reject a host with a wider context. Do not wrap it in an alias that takes the bag.
- `CreateFormKitOptions` passes `FormKitSlots` a bag with the three slot options only. TypeScript infers through the type arguments of an alias, so a full bag would let `kit.slots` of another kit add its controls to the inference of `createFormKit`.

## Fragments

A fragment placement is opaque. Normalization expands each placement: it adds the prefix to paths and, when `at` is present, adds `at` to the `idPrefix` of explicit IDs. The normalized definition contains only field, section, array and render nodes, so the runtime, devtools and `form-please/testing` never see a fragment. `docs/adr/0020-add-typed-reusable-form-fragments.md` gives the decision.

## Resolution

`kit.Form` watches the complete RHF value once (`WatchedValues` in `src/create-form-kit.tsx`) and passes it to every `kit.Fields` by context. RHF gives each `useWatch` hook its own copy of the values, so only one hook gives all `kit.Fields` of a form the same values object. `resolveForRender` in `src/generated-nodes.tsx` keeps one resolution per runtime, keyed by that values object and the settings snapshot, so all `kit.Fields` of one render share one resolution and the user resolvers run once per change. A render that React discards leaves an entry that is correct for its own inputs. `publishResolution` sets `runtime.resolved` and publishes the devtools `definition` event once per new resolution, in a layout effect. Resolution uses the committed `runtime.resolved` as its previous result, so devtools compares the nodes of one chain. A form without `kit.Fields` resolves nothing.

Resolution keeps the references of unchanged nodes and child lists, so React skips the generated branches that did not change. Do not add a dependency graph between resolvers or a cache of the results of single resolvers. The guarantee for users: `docs-site/src/pages/definitions.mdx`.

Resolution reuses the previous result of a static node without a visit. Normalization adds a node to `staticNodes` in `src/definition.ts` when the node, its ancestors and its descendants have no resolver function and the subtree has no array, because the row count of an array comes from the values. An array is always visited, but the static nodes in its rows are reused by row index. The reuse applies only when `resolveInputs` shows that the previous result came from the same definition, the same context object and the same `disabled` and `readOnly` flags. A new input of resolution other than the values must join `resolveInputs`, and a new node property that holds a function that resolution does not call must join `unresolvedFunctionKeys`; without it the node is only visited, never resolved wrongly. `npm run bench:resolve` measures the cost of a value change with and without the previous result. On its definition, the reuse makes a resolve about five times faster: about ten microseconds instead of tens of microseconds.

`kit.Fields node` renders one node of the same complete resolution, so a `visible` resolver of an ancestor still applies. `form.fieldPaths` resolves the definition on demand from `form.api.getValues()` and the settings store, without the generated UI, so it works while nothing is mounted. Both select the node with `findResolvedNode`, and `form.fieldPaths` collects the paths with `visibleFieldPaths`; both functions are in `src/definition.ts`, are pure and can serve `form-please/testing`.

## Node IDs

A resolved node ID is unique in the form. Normalization makes an ID unique in its array scope, and resolution adds the absolute array-item path and a dot for each node in a row, once: the row prefix of a nested row is its absolute path, which already contains the outer row. Devtools, the snapshots of `form-please/testing` and the public node selection read the same ID. The rule for users: `docs-site/src/pages/api.mdx`.

## Field connection

A generated field and `kit.useField` connect a path to RHF and the coordinator through one hook, `useFieldControl` in `src/generated-nodes.tsx`. A change in registration, issue display, focus bookkeeping or the `control` dispatch source therefore reaches both. The hook returns no `aria-describedby`: the field slot renders the description and the issues of a generated field, so only `GeneratedField` adds their IDs.

## Synchronous resolvers

Every ordinary resolver returns synchronously; `resolveValue` in `src/definition.ts` rejects a Promise-like result. An asynchronous resolver would make Form, Please own pending results, stale-result races, cancellation and fallback values. Application data layers already own these lifecycles. `docs/adr/0007-project-application-resources-synchronously.md` records this reason.

## Field options: the asynchronous boundary

The `options` property of a selectable field is the only asynchronous resolver. `docs/adr/0022-load-selectable-options-asynchronously.md` gives the decision. `src/field-options.ts` holds the executor that the React runtime and `form-please/testing` share. It tracks dependencies through deep proxies of `values` and `context`, so a read after `await` is also a dependency.

The boundary owns only per-field execution, dependency tracking, cancellation and the order of results. Do not add a loading or error state, a cache, retries, search or pagination: an application that needs them keeps its own resource state or writes a custom control. The user contract: `docs-site/src/pages/definitions.mdx`.

## Visibility and whenHidden

A hidden field keeps its RHF value because the binding sets `shouldUnregister: false`; see `form-binding-and-submission.md` § Resolver ownership. The owner of the `whenHidden` contract is `managed-updates.md` § whenHidden.

## Resource helpers

`ResourceState`, `matchResource` and `fromResource` in `src/resource.ts` turn application-owned data into synchronous resolvers. They keep no state. The user guidance: `docs-site/src/pages/resources.mdx`.
