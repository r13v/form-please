# ADR 0004: Type rich structural content through form kits

- Status: Accepted
- Date: 2026-07-31

## Context

Field labels and descriptions sometimes need links, tooltip triggers, badges,
or other product-specific presentation. The same need applies to section copy
and array headings. Adding a separate slot for every accessory would encode
individual use cases into the core API, while accepting arbitrary React
components in the React-free core would couple definition normalization to
React.

Structural slots also need data that is specific to the registered design
system. A tooltip-capable `Field` slot, for example, needs its tooltip text
without overloading control `props` or adding a universal tooltip property
to every form.

## Decision

The React form-kit boundary defines `ReactUiContent` as `string |
ReactElement`. Field `label` and `description`, section `title` and
`description`, and array `label` and `description` are resolvable values of
that type.

`Field`, `Section`, and `Array` slot props are generic over their own
`slotOptions` type. Definitions receive a matching resolvable `slotOptions`
property directly on each structural node. `createFormKit` infers these three
types from the registered slots and carries them through normalized
definitions, form instances, `AutoForm`, manual `Form` composition, and
`ActionForm`.

Core models this as a generic UI presentation contract. Its default remains
string-only and React-free. Presentation content and structural slot options
are opaque during normalization: core preserves their identity and does not
clone, traverse, or freeze their internals. Consumers therefore treat them as
immutable after normalization; mutating an opaque object does not notify the
form store.

When a kit replaces a structural slot through `extend`, the replacement must
accept the inherited options contract. It may add optional capabilities.
Definitions created through a base kit work in a compatible extension;
definitions using capabilities introduced by an extension do not work in the
base kit or an incompatible sibling.

## Considered Options

- Dedicated `labelAccessory`, `labelTooltip`, or link properties solve only
  named use cases and grow the definition contract for every new composition.
- Separate `Label` and `Description` slots fragment ownership of accessible
  field structure and require coordination with the existing `Field` slot.
- A single untyped options bag preserves runtime flexibility but loses the
  relationship between a node and the registered structural slot.
- Reusing control `props` mixes value-editor props with field,
  section, or array presentation and does not cover non-field nodes.

## Consequences

- Definitions may render links and composed React content without introducing
  a render node or weakening field semantics.
- Design systems can define open-ended structural capabilities while form
  definitions remain type checked.
- `slotOptions` is independent from a field control's `props`.
- `ArrayItem` and `ErrorMessage` remain unchanged because this decision covers
  definition-owned field, section, and array nodes.
- Definitions containing React elements are React-only and cannot cross a
  serializable React Server Components boundary.
- Explicitly erasing presentation generics also erases the corresponding
  compile-time compatibility protection.
