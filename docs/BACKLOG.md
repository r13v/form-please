# Product backlog

This document records product directions that are worth investigating. It is
not a release commitment or an implementation plan. Any change to public entry
points, form state, submission, serialization, or module boundaries must first
be reconciled with [ARCHITECTURE.md](ARCHITECTURE.md).

## Visual form builder

**Status:** Discovery candidate, not committed.

A full drag-and-drop/no-code builder could materially shorten form creation,
but it introduces a product and architecture decision that must not be hidden
inside one blended implementation.

Choose one direction before implementation:

1. **Code-generating visual editor.** It renders the application's real form
   kit and exports an editable TypeScript `defineForm` definition. TypeScript
   remains the source of truth, which fits the current code-first architecture.
2. **Runtime no-code platform.** It stores and executes serializable form
   definitions for non-developer authors. This requires a new source of truth,
   versioned serialization, migrations, safe expression or plugin boundaries,
   and a deliberate answer for code-only resolvers and render nodes.

- [ ] Identify the primary author: product developer, designer, operations
      specialist, or another non-developer role.
- [ ] Decide whether the output is TypeScript code or a durable runtime format.
- [ ] Prototype authoring with the application's actual controls and slots,
      rather than a parallel generic component library.
- [ ] Test whether custom product logic retains a clear escape hatch without
      making the common path depend on handwritten React.
- [ ] Write a separate architecture proposal before committing to the runtime
      no-code direction.

Do not begin with drag-and-drop mechanics. First prove that the chosen source
of truth, ownership model, and generated result make a real product form faster
to ship and maintain.
