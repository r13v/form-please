# Headless definition testing

`form-please/testing` exports `createDefinitionTester`. It creates one stateful tester for a form definition without React or React Hook Form. The implementation is `src/testing/definition-tester.ts`. The site page `docs-site/src/pages/testing.mdx` owns the tester API, blocked edits, the chain state and what the tester does not emulate.

## Shared production code

The tester does not reimplement form behaviour. It calls the same functions as a mounted form:

- `resolveDefinition` in `src/definition.ts` for every inspection.
- `createFieldOptionsResolution` in `src/field-options.ts` for selectable options, the same executor that `useFieldOptions` uses.
- `createValueCoordinator` in `src/value-middleware.ts` for control, array and imperative proposals, with the `beforeUpdate`, middleware, `afterUpdate` and `whenHidden` writes of the definition.
- `applyArrayAction` in `src/generated-array.ts` for append, remove and move.

Inspections expose stable observable node properties. They do not export the private `ResolvedDefinition` graph, so tests do not depend on resolver internals.

The tester mounts no arrays, so the row count check of `managed-updates.md` § Row-count guard does not run in it.

## Parity

Two test files compare the tester with a mounted form and keep the shared contract true:

- `src/testing/definition-parity-table.test.tsx` runs the same user steps on the tester and on a rendered form and compares the values after each step.
- `src/testing/definition-render-parity.test.tsx` compares observable field state across context changes, the managed update lifecycle and array actions.

A change that makes the tester and a mounted form differ must fail one of these tests. Add a scenario there when you add tester behaviour.
