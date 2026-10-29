# Headless definition testing

`form-please/testing` exports `createDefinitionTester`. It creates one stateful tester for a form definition without React or React Hook Form. The implementation is `src/testing/definition-tester.ts`. The site page `docs-site/src/pages/testing.mdx` owns user guidance.

## Shared production code

The tester does not reimplement form behaviour. It calls the same functions as a mounted form:

- `resolveDefinition` in `src/definition.ts` for every inspection.
- `createFieldOptionsResolution` in `src/field-options.ts` for selectable options, the same executor that `useFieldOptions` uses.
- `createValueCoordinator` in `src/value-middleware.ts` for control, array and imperative proposals, with the `beforeUpdate`, middleware, `afterUpdate` and `whenHidden` writes of the definition.
- `applyArrayAction` in `src/generated-array.ts` for append, remove and move.

The tester builds its middleware chain once. The chain keeps its state across tester operations, as for one form binding, and shares no state with a mounted binding. A context or form-level interaction change re-resolves the definition without a managed value update; definition callbacks receive the new context on the next managed proposal.

Inspections expose stable observable node properties. They do not export the private `ResolvedDefinition` graph, so tests do not depend on resolver internals.

## Blocked edits

A control or array action on a disabled, read-only or hidden node does not change values and returns a transition with `committed: false`. The UI cannot make that edit, so the tester does not make it either. The transaction is absent from such a transition.

## Not emulated

The tester does not emulate:

- React Hook Form validation.
- React Hook Form metadata: errors, dirty, touched and submit state.
- Submission and error focus.
- Field-array row IDs.
- The row count check of mounted generated arrays, because the tester mounts no arrays. `managed-updates.md` § Row-count guard owns that check.

Test those behaviours with a mounted form.

## Parity

Two test files compare the tester with a mounted form and keep the shared contract true:

- `src/testing/definition-parity-table.test.tsx` runs the same user steps on the tester and on a rendered form and compares the values after each step.
- `src/testing/definition-render-parity.test.tsx` compares observable field state across context changes, the managed update lifecycle and array actions.

A change that makes the tester and a mounted form differ must fail one of these tests. Add a scenario there when you add tester behaviour.
