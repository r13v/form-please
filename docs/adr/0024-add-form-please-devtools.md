# ADR 0024: Add Form Please Devtools

- Status: Accepted
- Date: 2026-08-15

## Context

React Hook Form DevTools already inspects registered fields and RHF form state.
It cannot explain Form Please definition resolution, issue routing, managed
update stages, async option dependencies, or optional history and persistence
state.

The existing `FormBinding` is the canonical identity for one form. Adding a
public diagnostic ID, store, or middleware would duplicate that identity and
make diagnostics part of form configuration. Deep-importing RHF DevTools UI
would also couple Form Please to private upstream modules.

## Decision

Add the explicit client entry `form-please/devtools`. It exports
`FormPleaseDevtools` and its props. The component requires one current
`FormBinding` and accepts an optional readable `name`. It does not accept or
require a separate ID.

Make `@hookform/devtools` a direct dependency. The component mounts its public
`DevTool` with `form.api.control` and keeps the RHF overlay as a separate
top-right surface. Form Please renders its own bottom drawer with UI, Updates,
Options, and Features views.

Expose package-private runtime capabilities on the exact binding and
coordinator capability. The root runtime can publish resolved definitions,
focus outcomes, managed update stages, and async option outcomes through a
dormant observer bridge. History and persistence register read-only diagnostic
adapters when they are configured. The optional entry attaches the observer,
RHF value subscription, bounded journal, and UI only while mounted.

Keep all actions read-only. Retain at most 100 update events and 20 transitions
per optional feature. Show raw local development values, context, patches, and
errors, but do not serialize, export, or forward them.

## Considered options

- A devtools middleware would fit the managed update chain but would miss raw
  RHF changes, definition resolution, focus, and option requests. It would also
  require fixed form configuration for an observational UI.
- A separate form ID would help browser-extension routing but would duplicate
  the exact form binding identity. RHF's public page overlay does not require
  it.
- One combined shell would require private RHF UI imports or a reimplementation
  of generic RHF inspection.
- Redux DevTools would provide an event transport but would add another
  protocol and still need Form Please-specific UI for resolved definitions and
  async options.
- A sanitizer and export protocol would reduce support friction but would
  complicate the first local-only development tool before a transport exists.

## Consequences

- One component provides both RHF and Form Please diagnostics for the supplied
  binding.
- Root and preset imports do not load the devtools UI or allocate a journal.
- Core runtime boundaries contain small guarded diagnostic publications and
  private capabilities.
- Raw diagnostics can contain sensitive application data. Applications must
  mount the component only in trusted development environments.
- Inline styles make the optional component self-contained but can require a
  development CSP allowance for inline style elements.
- The current `@hookform/devtools` dependency transitively uses `uuid@8.3.2`.
  npm reports a moderate buffer-bounds advisory for that version. The upstream
  dependency must be reviewed when a fixed release becomes available.
