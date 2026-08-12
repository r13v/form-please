# ADR 0007: Project application resources synchronously

- Status: Superseded by ADR 0022
- Date: 2026-07-31

## Context

Remote options, permissions, and section data may affect derived form UI while
they load. Letting UI resolvers return promises would make Form, Please own pending
results, stale-result races, cancellation boundaries, and fallback values; an
async definition node would additionally defer path, control, metadata, and
serialization topology. Applications already have data layers that own those
lifecycles.

## Decision

Applications own resource loading, caching, cancellation, retry, and the
choice of whether stale data remains usable. Form, Please represents only the current
application-supplied availability state through a minimal discriminated
`ResourceState<Value, Error>` union with `pending`, `success`, and `error`
branches.

Core will expose two synchronous, exhaustive matchers. `matchResource` maps an
immediate resource state to a result. `fromResource` maps a synchronous UI
resolver that selects a resource to a normal UI resolver. Every branch is a
required function and receives its narrowed resource branch plus the original
resolver values and details, so additional form-path reads remain tracked.
Neither helper starts work, stores state, catches mapper exceptions as resource
errors, or accepts a promise-producing UI resolver.

Definitions retain synchronous topology. Fields and sections project resource
state through their existing resolvable properties and typed `slotOptions`;
forms use `matchResource` in application composition. Form, Please does not infer a
global pending state, suspend `valuePolicy`, or block submission because a
resource is pending. Those policies remain explicit in each mapping or at the
form boundary.

TanStack Query and other data libraries integrate through documented adapters,
not public Form, Please dependencies. An adapter may structurally extend a successful
resource branch with a nested discriminated refresh state, preserving states
such as idle, pending, paused, and failed refresh without independently
constructible boolean flags.

## Considered Options

- Promise-valued and async UI resolvers offer concise authoring but require a
  second asynchronous lifecycle in the form store and weaken synchronous
  dependency tracking and pure `resolveUi` evaluation.
- Promise-valued definition nodes defer normalized IDs, paths, controls,
  metadata, value policies, and serialization and turn Form, Please toward a remote UI
  language.
- Direct TanStack Query support would couple the React-free core and public
  compatibility surface to one application data layer.
- Documentation without shared matchers preserves the existing boundary but
  repeats exhaustive resource projection across definitions and applications.
- A node-level resource state machine removes repetition but adds inherited
  loading, rendering, and submission semantics that existing resolvable
  properties and slots can express.
- A first-party resource-combination DSL is deferred until repeated real-world
  composition demonstrates one stable policy for mixed pending and error
  states.

## Consequences

- UI resolution, definition normalization, SSR snapshots, and value-policy
  convergence remain synchronous and deterministic.
- Applications must map pending and error visibility safely: a temporary
  `visible: false` remains authoritative and can trigger `valuePolicy: "unset"`.
- Resources that affect the whole form block editing or submission only when
  the application derives form-level `disabled` state through
  `matchResource`.
- Resource mappings may repeat one selector across several node properties,
  and replacing a runtime context reference still invalidates all
  context-dependent resolver cache entries.
