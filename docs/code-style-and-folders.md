# Code style

Priorities: readability, simplicity, maintainability. Biome (`biome.json`) checks formatting, file names and the lint rules; review checks the other rules.

## Readability

1. **Separate steps with a blank line.** A guard clause, a computation and a result are separate paragraphs. Put a blank line before the final `return`, except in a block with a single statement.
2. **Name the result.** Assign a multi-line expression to a variable with a domain name, then return the variable.
3. **Keep ternaries short.** The condition is a variable or a call; the branches are simple values. Biome rejects a nested ternary.
4. **Use early return.** Remove unsuitable cases before the main scenario.
5. **Destructure a repeated path.** Instead of `transaction.source.type` and `transaction.source.path`, write `const { source } = transaction`.

## Simplicity

6. **Access data directly.** For the last N items, use `slice(-N)`; for the last item, use `at(-1)`. Do not compute an array of indexes to iterate over them.
7. **Do not nest callbacks deeper than one level.** Move a callback with several steps or with its own callback to a named function.
8. **Do not create abstractions for the future.** Extract a function or a constant for reuse or to name a non-obvious step. Do not add wrappers for future flexibility.
9. **Reuse before you add a helper.** Search `src` for the same behaviour, including helpers with other names. Reuse it, or move identical behaviour to the narrowest shared module that fits its responsibility. Keep similar helpers separate when their contracts differ, and make the difference explicit. Do not create a generic utilities module.

## Maintainability

10. **Name complex conditions.** For example, `isFormValueObject` in `src/form-value.ts` names a check for a plain object.
11. **Name non-obvious literals.** A limit, a window and a key get a constant near their use.
12. **End a branch over a closed union with an exhaustive check.** Use `assertNever` from `src/assert-never.ts`, or a `satisfies Record<Union, …>` table such as `sourcePolicies` in `src/value-middleware.ts`, so that a new member fails the type check at each place that must handle it.
13. **Give the extension of a relative import.** Write `.js` for a TypeScript source file, because the package is ESM and `tsdown` keeps the specifiers.
14. **Update dependencies deliberately.** Choose current stable versions, check compatibility and update the lockfile. A change of the React Hook Form (RHF) peer range follows `releases-and-compatibility.md`.

## Code structure

- The core runtime lives in the root of `src`. Each optional entry of `package.json#exports` has its own folder with an `index.ts` that is the public entry and only re-exports its folder. The list of entries lives in `package.json#exports`; `scripts/package-entries.mjs` derives the build and check lists from it.
- An optional entry imports the core through package-private capabilities, such as `getValueCoordinatorCapability` in `src/value-middleware.ts`. The root entry never imports an optional entry; `tests/package/build-output.test.ts` checks the bundle graph.
- A module with React hooks or components starts with `"use client"`. `src/testing` stays server-compatible: no React import.
- A test lives next to its module as `<module>.test.ts` or `<module>.test.tsx`. Type tests live in `tests/types`, package contract tests in `tests/package`, browser tests in `tests/browser`.
- File names are kebab-case; Biome enforces it.

## Comments

This section owns the rules for code comments and JSDoc. Check them within the scope of the task. Do not extend the cleanup to adjacent code.

Every top-level declaration has a one-line JSDoc that states its purpose or contract. Keep it short; do not let it restate the name.

Keep information that the code, names and types do not show:

- the reason for a decision, an external constraint or a workaround, such as an RHF behaviour with the contract test that pins it;
- an invariant, an order of actions or a lifecycle condition;
- a format or an API contract.

Remove retelling of the code or the signature, history and development steps, commented-out code, empty separators, and done or ownerless TODOs.

Keep directives (`biome-ignore`, `@ts-expect-error`, `"use client"`), `/* @__PURE__ */` annotations and executable examples. Do not change the syntax of directives.

If a comment contradicts the code, fix it when the requirements are confirmed. If they are uncertain, report the conflict and do not guess.

## Review checks

The diff review checks these points in addition to the rules above:

- **A test fails without its fix.** A test of a fix or a new invariant must fail when the rule is broken. Break the rule once (revert the fix, or apply a one-line mutation) and see the test fail. A fix at several places needs a test that reaches each place, or one table-driven test over them.
- **A guard has tests on both sides.** A new runtime guard rejects one kind of input. Add a test for each rejected case and a test for each nearby case that the guard must accept, for example a value edit inside a row next to a row count change.
- **An RHF assumption has a contract test.** Code that relies on an RHF behaviour that the RHF documentation does not promise adds a test to `src/rhf-contract.test.tsx`.
- **Owner documents and the site follow the change.** A contract change updates its owner document in `docs/`, and a change of observable behaviour follows `documentation-rules.md` § Docs site coupling.

## Example

A guard clause, named intermediate values and direct access to the last items:

```ts
const RECENT_UPDATES = 3

/** Lists the source types of the latest managed updates. */
function recentSourceTypes(updates: readonly ManagedUpdate[]): string[] {
	if (updates.length === 0) return []

	const recent = updates.slice(-RECENT_UPDATES)

	return recent.map(({ transaction }) => transaction.source.type)
}
```
