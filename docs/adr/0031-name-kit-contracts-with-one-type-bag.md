# ADR 0031: Name kit contracts with one type bag

- Status: Accepted
- Date: 2026-11-23

## Context

A form kit has six type contracts: the controls, the context, the field, section and array slot options, and the grid. The public types that depend on a kit took these contracts as positional type parameters, and the order was different between types. `FormKit` took `Controls, FieldOptions, SectionOptions, ArrayOptions, Context, Grid`. `FormDefinition`, `FormFragment` and the node types took `Schema, Controls, Context, FieldOptions, SectionOptions, ArrayOptions, Grid`. An application that named one of these types had to remember two orders and up to eight positions. The internal builder types already used one private bag, `KitTypes`, and converted the positional parameters to it.

## Decision

- Publish the bag as `FormKitTypes` in `src/types.ts`. It is an object type with the properties `controls`, `context`, `fieldOptions`, `sectionOptions`, `arrayOptions` and `grid`.
- Each public type that depends on kit contracts takes the bag as one parameter: `FormKit<Kit>`, `FormDefinition<Schema, Kit>`, `FormFragment<Schema, Kit>`, `CreateFormKitOptions<Kit>` and `FormKitSlots<Kit>`. No positional form stays. `CreateFormKitOptions` takes a bag without `context`, and `FormKitSlots` takes a bag with the three slot options only, so slots can be typed before a kit exists.
- `FormKitTypesOf<typeof kit>` reads the bag of a kit from a type-only property of `FormKit`.
- `createFormKit` keeps one inferred type parameter per contract and builds the bag in its return type. TypeScript cannot infer a type parameter through an indexed access such as `Kit["controls"]`, so a single bag parameter would not infer from the options object.
- The private fragment placement type keeps the contracts as separate parameters. TypeScript measures the variance of a type parameter as a whole. The context is contravariant in a placement and the other contracts are covariant, so a bag parameter would be invariant and would reject a host form with a wider context.
- Types that depend on the context only, such as `FormBinding<Schema, Context>` and `FormMiddleware<Input, Context>`, keep their parameters. A binding does not depend on the controls, slots or grid of its kit.

## Considered options

- Keep the positional parameters and make their order the same in all types. The number of positions stays, and the change still breaks every hand-written type.
- Publish a helper that builds a bag from positional parameters. This keeps a second form of the same contract.
- Give each bag property a default, so that a partial bag is valid. A partial bag then hides a wrong contract as a default value, for example a missing `controls` that becomes the widest registry.
- Change `FormBinding` and the other context-only types to the bag. A binding would then carry contracts that it does not use, and each binding type would change for no gain.

## Consequences

- An application names a kit type with `FormKitTypesOf<typeof kit>` and passes the result to `FormDefinition`, `FormFragment` and `FormKit`.
- A hand-written bag names all six contracts. This is longer than the positional form for a kit with few contracts, but each contract has a name.
- Each hand-written kit type is a breaking change. The upgrade page names the fix.
