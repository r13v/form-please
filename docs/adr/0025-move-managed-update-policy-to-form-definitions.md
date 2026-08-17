# ADR 0025: Move managed-update policy to form definitions

- Status: Accepted
- Date: 2026-08-16
- Amends: [ADR 0016](0016-coordinate-managed-value-updates-before-react-hook-form.md), [ADR 0017](0017-add-managed-update-hooks-around-middleware.md), [ADR 0018](0018-add-managed-value-history.md), [ADR 0019](0019-add-form-persistence-middleware.md)

## Context

Managed-update behavior was configured when `kit.useForm` or
`createDefinitionTester` created one runtime. A reusable definition therefore
did not carry the rules that governed its generated edits. Every consumer had
to repeat the same `beforeUpdate`, middleware, and `afterUpdate` configuration,
and a forgotten option silently produced a form or test with different
behavior.

The split also gave the three stages different React lifetimes. Middleware was
fixed for a binding, while the two callbacks followed the latest render. This
made a definition reusable under different policies, but prevented it from
being an autonomous schema, UI, and managed-behavior contract.

## Decision

`kit.defineForm(schema, source, options?)` accepts the complete managed-update
policy in its optional third argument. The supported options are
`beforeUpdate`, an ordered `middleware` list, and `afterUpdate`.

The normalized `FormDefinition` exposes those three values as readonly
properties. Definition creation copies and freezes the middleware list. The
callbacks and list are fixed with the definition; `kit.useForm` and
`createDefinitionTester` no longer accept or merge another policy.

Every form binding and definition tester initializes its own middleware chain
from the definition. Stateful middleware is therefore isolated per runtime even
when several runtimes use the same definition. The callbacks are also fixed,
but each transaction contains the runtime's current context. Binding-specific
data must enter through `transaction.context` rather than a React render
closure.

`DefinitionTesterOptions` retains initial values, context, and interaction
flags. Tester rerenders can replace context and flags, but not definition-owned
callbacks. History and persistence features must appear in the definition's
middleware list before their exact-form handles can be retrieved. When feature
configuration is instance-specific, the application creates the feature and
definition together in a factory.

This is a breaking API change. No compatibility overload, deprecated
`useForm` options, or policy-merging order is retained.

## Considered Options

- Keeping runtime-owned policy would preserve reuse under different rules, but
  would also preserve duplicate configuration and allow a consumer to omit a
  definition's required behavior.
- Treating definition policy as defaults and appending runtime middleware would
  require precedence, ordering, replacement, and cancellation rules for two
  competing chains.
- Storing policy in private metadata would keep `FormDefinition` smaller, but
  would make observable behavior invisible on the object that owns it.
- Replacing `defineForm` with a single configuration object would group every
  input, but would unnecessarily rewrite the established schema and builder
  call shape.

## Consequences

- Importing one definition brings its schema, generated UI, and managed-update
  behavior together.
- Mounted and headless tests cannot accidentally exercise different policy.
- One definition cannot be used with a different middleware list or callbacks;
  applications create another definition or a definition factory instead.
- React rerenders cannot replace callback closures. Current runtime data must be
  represented by context.
- Optional stateful middleware remains isolated because chains initialize per
  binding or tester rather than during definition creation.
