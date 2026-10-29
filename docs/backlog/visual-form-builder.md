---
worth: later
added: 2026-10-30
source: docs/BACKLOG.md product backlog, main @ 79b5882
---

# Visual form builder

**Idea.** Add a drag-and-drop builder that shortens form creation. Choose one direction first: a code-generating visual editor that renders the application's real form kit and exports an editable `defineForm` definition, or a runtime no-code platform that stores and runs serializable definitions for non-developer authors.

**Why it matters.** A product developer or a non-developer author could build a form faster. Without a chosen direction, one blended implementation hides a product and architecture decision.

**Evidence.** Today a definition is TypeScript code: builder callbacks, resolvers and render nodes are functions, so they cannot be stored as data (`src/definition.ts`). The runtime direction needs a new source of truth, versioned serialization, migrations, safe expression or plugin boundaries, and an answer for code-only resolvers and render nodes. The editor direction keeps TypeScript as the source of truth.

**Why it was deferred.** The primary author is unknown: a product developer, a designer, an operations specialist or another role. Before any drag-and-drop work, prove with the application's real controls and slots that the chosen source of truth and the generated result make a real product form faster to ship and maintain, and that custom logic keeps a clear escape hatch. The runtime direction needs a separate architecture proposal.
