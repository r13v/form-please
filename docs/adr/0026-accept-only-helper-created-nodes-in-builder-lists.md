# ADR 0026: Accept only helper-created nodes in builder lists

- Status: Accepted
- Date: 2026-09-26
- Amends: [ADR 0021](0021-add-schema-bound-ui-builders.md)

## Context

ADR 0021 typed each builder list as the full union of UI nodes in its scope.
That union contains one member for each path and compatible control, plus
sections, arrays, render nodes, and fragment placements. TypeScript compared
every helper result with this union again, after the helper had already checked
its own options.

The comparison dominated type-checking time. In the docs project, 61 relations
against the union took about 4.7 seconds, and the complete check took 21
seconds. The same cost repeats in twoslash code blocks during the docs build.

The union also accepted some nodes from the wrong scope. A root `ui.render`
node, or a root `ui.field` node whose path also exists in the item, passed
inside `array.children` without an error.

## Decision

Mark every node that a builder helper returns with a phantom scope brand. The
brand is invariant in the root, scope, controls, context, slot options, and
grid of the builder that created the node.

Type the root builder result, section `children` in a builder, and the array
`children` callback result as a list of branded nodes and fragment placements
for that scope. Keep full option checks on each helper call.

Do not change the runtime. The brand is a type-only property, and
materialization still receives the same ordinary authoring objects. Object
nodes remain fully supported in `{ ui }` sources.

## Considered Options

- Keep the full union and add branded nodes to it. Measured check time stayed
  at 21.9 seconds, because TypeScript still compares each element with the
  large union.
- Type builder lists as `readonly unknown[]`. Check time fell to 3.7 seconds,
  but lists accepted any value and lost scope checks.
- Cache twoslash output in CI. This shortens only repeated docs builds and
  leaves editor and `tsc` cost unchanged.

## Consequences

- The docs type check fell from 21.1 to 3.9 seconds, and the first docs build
  stage fell from 75 to 27 seconds on the same machine.
- Path, control, option, props, and resolver inference on helper calls is
  unchanged.
- A node from another builder scope is a type error.
- An object node inside a builder list is a type error. Applications that mix
  object nodes into builder callbacks must use helpers or the `{ ui }` form.
