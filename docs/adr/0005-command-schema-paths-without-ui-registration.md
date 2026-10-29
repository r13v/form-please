# ADR 0005: Command schema paths without UI registration

- Status: Accepted
- Date: 2026-07-31
- Amended by: [ADR 0015](0015-replace-tanstack-form-with-react-hook-form.md), [ADR 0016](0016-coordinate-managed-value-updates-before-react-hook-form.md)

## Context

Imperative value commands are typed from the schema input. Direct `setValue`,
`setValues`, and `unsetValue` already accept schema paths without UI
registration, but path validation and replacement changes returned by
`beforeUpdate` still pass through the registered-field gate. Bespoke UI can
therefore command a value directly and then see the equivalent dependent
transaction or validation rejected. The runtime boundary is inconsistent.

## Decision

Value commands accept every canonical schema path independently of UI
registration. UI registration continues to determine generated rendering,
field and array metadata, and `FormData` serialization; it does not determine
which schema-owned values application code may change or validate.

Array structure commands still require an array node because Form, Please needs its
`itemDefault` and stable row metadata. An unrendered value that must cross a
React 19 Action boundary still requires a field with a serializing control.

## Considered Options

- Headless field nodes would preserve the registration gate but add a fifth
  data/UI concept solely to authorize commands.
- A render node `commandPaths` declaration would make command reachability
  explicit but duplicate schema path information and leave schema-typed
  commands broader than their runtime permission.
- Carrying every definition's registered-path union through form instances
  would align compile-time and runtime permission, but would substantially
  complicate contextual definition inference and composition.

## Consequences

- Bespoke UI can update workflow or integration values without fake controls.
- TypeScript continues to reject paths and values outside the schema input;
  runtime callers still receive canonical path grammar checks.
- Generated metadata and native serialization remain opt-in through field and
  array nodes rather than being inferred from imperative access.

## Amendment

The `FormData` serialization and React 19 Action parts of this decision are
stale. [ADR 0015](0015-replace-tanstack-form-with-react-hook-form.md) made React Hook Form values the submitted values. Controls have no
browser serialization mode, and `onSubmit` receives the editable input and the
schema output. See [Submit wrapper](../form-binding-and-submission.md#submit-wrapper).

The command API and the registered-field gate are also stale. The form has no
`setValue`, `setValues`, or `unsetValue` commands and no runtime path check for
them. [ADR 0016](0016-coordinate-managed-value-updates-before-react-hook-form.md)
replaced them: application code changes values through the raw React Hook Form
API in `form.api` or through the managed `form.update` recipe. The raw API
bypasses managed hooks and middleware. TypeScript still types both entry points
from the schema input.

The main decision remains valid: application code can change any schema input
value without a fake UI field.
