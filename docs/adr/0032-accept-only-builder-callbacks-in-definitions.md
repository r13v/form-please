# ADR 0032: Accept only builder callbacks in definitions

- Status: Accepted
- Date: 2026-11-23
- Amends: [ADR 0020](0020-add-typed-reusable-form-fragments.md), [ADR 0021](0021-add-schema-bound-ui-builders.md), [ADR 0026](0026-accept-only-helper-created-nodes-in-builder-lists.md)

## Context

ADR 0021 added schema-bound builders and kept the `{ ui }` object source fully supported for generated definitions and explicit node composition. ADR 0020 specified `defineFragment` with the object source. ADR 0026 typed builder lists as helper-created nodes only, because a check against the full node union dominated type-check time, and kept object nodes valid in `{ ui }` sources.

Two authoring forms then described the same tree. The object source needed the full node union at every list position and the exported node types `UiNode`, `FieldNode`, `SectionNode`, `ArrayNode` and `RenderNode`. These types are the most expensive types of the package: each one maps every schema path to every compatible control. The site and `README.md` already authored with builders only. A builder can create nodes from data with a loop, so the object source covered no case that a builder cannot.

The type brand of ADR 0026 also did not exist at runtime. Untyped code could return hand-written node objects from a builder, and normalization accepted them, so the object form stayed reachable through the builder.

## Decision

- `defineForm` and `defineFragment` accept only a builder callback. Another value throws `FP141`.
- The helpers record each node that they create. Normalization accepts only these nodes and fragment placements. Another object throws `FP119`, which already documented a node that no helper created.
- The helpers return an opaque node type that carries only the scope brand of ADR 0026. The package exports no node type, and the private node unions that only the object source used are removed.
- `FP110` and `FP111` (a source without a `ui` array) are removed, because no source can reach them.

## Considered options

- Keep the object source and deprecate it. This keeps the node unions and their type-check cost in every application, and keeps two forms to document and test.
- Keep the object source as an internal or untyped entry. A second entry for generated definitions duplicates what a builder loop already does.
- Remove the object source from the types only. Untyped code could still pass object nodes, so the runtime keeps two contracts.
- Freeze helper nodes instead of recording them. Freezing does not tell a helper node from a frozen hand-written object.

## Consequences

- The type instantiation count of the project fell from 1,040,800 to 814,847. The count includes the bag of ADR 0031 and the conversion of the tests to builders. The budget in `scripts/check-type-budget.mjs` stays the same.
- An application with an object source, or with a hand-written node in a builder list, must change. The upgrade page names the fix.
- A helper node is an ordinary object. A copy of a helper node, such as a spread, is not recorded and throws `FP119`.
- Devtools, `form-please/testing` and the renderer read normalized definitions only, so they do not change.
