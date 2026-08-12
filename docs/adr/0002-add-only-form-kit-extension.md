# ADR 0002: Extend form kits with add-only snapshots

- Status: Accepted
- Date: 2026-07-30
- Amended by: [ADR 0009](0009-explicit-react-form-lifetimes.md), [ADR 0011](0011-kit-owned-grid-scale.md)

## Context

Applications may share one product form kit while a single form needs an
additional control or local structural slot. Rebuilding the complete kit
manually is possible, but it does not express compatibility or prevent a local
extension from silently replacing an existing contract.

## Decision

Every form kit exposes `extend`, which creates an independent snapshot by
adding controls and partially replacing resolved slots.
Control names are add-only and collisions fail in TypeScript and at runtime.
Definitions retain the complete structural registry requirement of the kit
that created them, so a base definition works with an extension while an
extended definition does not work with its base or a sibling missing a required
control name. Siblings with the same complete registry contract remain
compatible.

Forms created through `kit.createForm` carry the exact creating kit snapshot's
runtime identity. `kit.useCreateForm` follows the same definition-compatibility
rules as `kit.createForm`, and its retained form carries the invoking kit's
exact snapshot. `kit.useBindForm` accepts only forms created by that same
snapshot and rejects forms from a base, extension, sibling, or structurally
equal kit.

## Considered Options

- Reassembling a kit with `createFormKit` and object spreads provides no
  explicit compatibility boundary or collision protection.
- Last-write-wins control replacement can silently reinterpret field props,
  rendering, and `FormData` serialization in an existing definition.
- Structural comparison of controls and slots cannot reliably prove that an
  existing form has the runtime identity expected by a kit.
- Tracking only the controls actually used by each definition would improve
  portability but substantially complicate inference and public types.

## Consequences

- Extensions may be chained and may change slots, controls, or both.
- `extend({})` is invalid, while inherited resolved slots remain unchanged
  unless explicitly replaced.
- A definition that must remain portable is created by the lowest common base
  kit.
- A form instance is intentionally less portable than a definition: bound kit
  hooks require the exact kit that created it. Every public form instance is
  created and bound through that exact kit; there is no global binding escape
  hatch.
- TypeScript cannot generate a fresh nominal identity for each `extend` call;
  compatibility follows the complete known registry contract instead.
- Widening a registry to `ControlDefinitionRegistry` erases known-name
  protection, so runtime collision and unknown-control checks become
  authoritative.
- Explicitly erasing a definition or form instance's registry type also erases
  this compile-time protection; runtime unknown-control checks remain.
