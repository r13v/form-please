# ADR 0021: Add schema-bound UI builders

- Status: Accepted
- Date: 2026-08-11

## Context

Ordinary definition objects repeat a `kind` discriminator for every field,
section, array, and render node. The discriminator is useful to normalization
and rendering, but it adds authoring noise to forms with many fields.

Helpers attached directly to a form kit cannot independently know the schema
root or the current array-item scope. A plain `kit.field(path, options)` factory
would therefore lose contextual resolver types or require fragile inference
from its eventual placement inside `defineForm`.

The existing object syntax is also useful for generated definitions, explicit
node composition, and backward compatibility. Authoring convenience must not
create a second normalized model or renderer.

## Decision

Allow `defineForm` and `defineFragment` to accept a schema-bound builder
callback in addition to the existing `{ ui }` source:

```ts
kit.defineForm(schema, (ui) => [
	ui.field("name", { control: "text", label: "Name" }),
	ui.array("speakers", {
		itemDefault: { name: "" },
		children: (item) => [
			item.field("name", { control: "text", label: "Speaker" }),
		],
	}),
])
```

The root builder derives its root and path scope from the Standard Schema. The
array `children` callback receives another builder whose path scope is the
selected item type while its resolvers retain the definition root and context.
Sections keep the current scope.

Builder helpers create ordinary authoring objects with the existing `kind`,
path or ID, and options. Definition materialization then enters the same
validation, fragment expansion, normalization, ownership checks, and freezing
path as an object source. Configuration cannot override helper-owned `kind`,
path, or ID properties.

Builder and array-child callbacks execute synchronously once during definition
creation. They must return UI arrays. They are authoring callbacks rather than
value resolvers and never run once per render or array item.

Keep `{ ui }` fully supported. Do not export a standalone builder type from the
package root, add builder methods to the runtime kit, add a node kind, or change
the normalized definition format.

## Considered Options

- Add `kit.field`, `kit.section`, `kit.array`, and `kit.render`. The kit knows
  controls and context but not the selected schema or nested item scope, so the
  helpers cannot preserve the current inference contract on their own.
- Infer a node kind from its properties. This removes an explicit discriminator
  but makes malformed and future node shapes ambiguous at runtime.
- Put builder behavior in a new module. The runtime behavior is small and
  belongs to the existing definition materialization boundary, so another
  canonical module would not carry an independent responsibility.
- Replace object authoring. This would break generated definitions and existing
  applications without changing the normalized runtime model.

## Consequences

- Common definitions omit authored discriminators while retaining path,
  control, option, context, slot, grid, and resolver inference.
- Nested array builders make relative item paths explicit in the authoring
  structure.
- Object and builder sources remain interchangeable after materialization and
  require one renderer and validation path.
- The public definition methods accept two authoring forms, so documentation
  must identify builder callbacks as the recommended handwritten style and
  retain object syntax as a supported data-oriented style.
