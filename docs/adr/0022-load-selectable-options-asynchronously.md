# ADR 0022: Load selectable options asynchronously

- Status: Accepted
- Date: 2026-08-11
- Supersedes: ADR 0007 for selectable field options only

## Context

Most form UI must resolve synchronously so paths, controls, visibility, labels,
layout, and serialization remain immediate and deterministic. Selectable lists
are different: loading countries, cities, or assignees is common, and requiring
an application-owned `ResourceState` projection for every simple list adds more
API than the task needs.

The former field property named `options` also mixed two responsibilities:
control-specific configuration and selectable data. That made nested APIs such
as `options.options` necessary and obscured which controls could load a list.

## Decision

Rename control-specific field data and its corresponding `ControlProps` property
to `props`. Reserve the field and `ControlProps` property `options` for the
selectable collection. A control
declares its option item type as its fourth `ControlDefinition` type parameter;
controls without selectable data do not expose field `options`.

Selectable fields accept a static readonly array or one function:

```ts
options: async ({ values, context, signal }) =>
	fetchCities(values.country, context.locale, { signal })
```

The runtime proxies `values` and `context`, records properties read by the
function even after `await`, and reruns it only when those dependencies change.
Starting another run aborts the previous signal, and only the latest result may
replace the rendered list. The list is `[]` during the initial load, reload, or
after rejection. The selected field value is not cleared.
A successfully resolved value must be an array; a non-array value violates the
resolver contract and is surfaced through React.

The function has no built-in cache, retry, loading UI, error UI, search, or
pagination API. A developer can catch an error and return another array. More
advanced request policy remains in an application resource or custom control.

All other UI resolvers remain synchronous. `ResourceState`, `matchResource`,
and `fromResource` remain available for permissions, descriptions, whole-form
state, and selectable lists whose pending/error policy must be explicit.

## Consequences

- Static and remote lists share one memorable `options` property.
- `props` no longer contains or hides a selectable collection.
- Only controls that declare an option item type can accept field `options`.
- Dependency tracking avoids unrelated reloads without a dependency array.
- Rejections intentionally collapse to `[]`; applications needing visible
  request state must own and render that state elsewhere.
- The form runtime owns a narrow asynchronous lifecycle without making the
  normalized definition tree asynchronous.
