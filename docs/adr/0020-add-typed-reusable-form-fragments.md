# ADR 0020: Add typed reusable form fragments

- Status: Accepted
- Date: 2026-08-07

## Context

Applications repeat schema-shaped UI groups such as addresses, contact details,
and ranges at several object paths and inside generated arrays. Reusing only the
Standard Schema does not reuse controls, props, selectable options, slots, layout, or local UI
rules. Plain typed functions can remove object-literal duplication, but they
must manually preserve the form input, control registry, context, slot, grid,
and relative-path relationships.

A reusable group must remain part of one host form. Giving it an independent
store, validation pass, submit boundary, or lifecycle would conflict with React
Hook Form ownership and the definition's single Standard Schema validator.

## Decision

Add `kit.defineFragment(schema, { ui })`. The supplied concrete Standard Schema
is the only source of the fragment input and output types and remains available
as `fragment.schema` for composition through the application's schema library.
Do not add a separate input generic.

`fragment.fields({ at })` creates one opaque authoring placement at a relative
object path. `fragment.fields()` selects the current form or array-item scope.
The target may contain additional properties but must structurally satisfy the
fragment schema input. Optional and incompatible targets are rejected by the
type system. Placements and nested fragments must belong to the same exact
runtime kit as their host definition.

Use the existing `forContext<Context>()` type-only kit view to declare a
fragment's minimum context. A structurally wider host context is compatible.
Resolvers authored inside a fragment receive its local deeply readonly input
and required context, including when the fragment is placed inside nested
generated arrays. Ordinary host resolvers continue to receive the complete form
input.

Definition normalization expands placements into ordinary field, section,
array, and render nodes. It prefixes paths, namespaces explicit IDs by `at`
when present, and retains fragment-local resolver scope in private weak
metadata. No fragment kind or scope metadata appears in the normalized or
resolved public node tree.

## Considered Options

- Plain application functions would add no public API, but preserving all
  current type relationships makes useful generic helpers verbose and fragile.
- Passing a separate fragment input generic would be explicit, but could drift
  from the runtime schema that validation actually uses.
- A fifth runtime fragment node would make local scope traversal direct, but
  would turn an authoring convenience into another renderer and lifecycle
  concept.
- Wrapping every resolver during placement would avoid private node metadata,
  but requires a brittle list of every resolvable property and changes resolver
  function identity.
- Field mapping would support flat or differently shaped host schemas, but
  breaks the one-object relationship with `fragment.schema` and requires local
  value reconstruction. It remains deferred.

## Consequences

- Repeated object UI stays typechecked against one schema, kit, context, slot,
  control, and grid contract.
- A fragment can be nested or placed inside generated object arrays without
  creating another form boundary.
- Normalization performs the fragment expansion once per form definition;
  rendering and submission continue through the existing runtime.
- Fragment resolvers deliberately have a local first argument, unlike ordinary
  definition resolvers. Host-wide conditions must stay outside the placement.
- Fragment parameters, field mapping, and fragment-owned default factories are
  not part of this decision.
