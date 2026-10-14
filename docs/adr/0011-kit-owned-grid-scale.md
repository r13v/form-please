# ADR 0011: Let form kits own the finite grid scale

- Status: Accepted
- Date: 2026-08-02
- Amended by: [Form-kit ownership](../ARCHITECTURE.md#form-kit-ownership)

Design systems use different layout vocabularies, so the fixed `1 | 2 | 3 | 4`
scale made otherwise portable definitions depend on Form, Please's shipped CSS.
Each form kit now owns one finite numeric grid scale shared by section
`columns` and numeric `span`; `[1, 2, 3, 4]` remains the default and `"full"`
remains a universal span outside the scale.

The scale must contain unique positive integers and include `1`.
`kit.extend({ grid: [...] })` adds values but cannot remove or replace inherited
values. A normalized definition retains its complete authoring scale, and a kit
can use that definition only when its scale is a superset. This preserves the
same directional compatibility already used for add-only controls.

The runtime stores normalized node columns and spans as broad numbers and
validates static and resolved values against the definition scale. This avoids
threading literal unions through rendering state while preserving exact
authoring and kit-compatibility types.

The optional `form-please/layout.css` continues to implement only the default
scale. Custom values are interpreted by application-owned CSS or structural
slots, keeping responsive policy and design-system styling outside core.

## Amendment

The `kit.extend({ grid: [...] })` part of this decision is stale, and so is
definition use in a kit with a superset scale. `createFormKit` receives the
complete grid scale once, and a definition works only with its exact kit. See
[Form-kit ownership](../ARCHITECTURE.md#form-kit-ownership). The kit-owned finite scale, its validation, and the `"full"` span
remain valid.
