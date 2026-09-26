# Form, Please

Before changing module boundaries, public entry points, form state,
submission, or serialization, read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Run `npm run check` and `npm run knip` before reporting a task done.

## Docs Coupling

The docs gates read the library source. When you add a public export to an
entry in `package.json#exports`, name it in inline code in
`docs-site/src/pages/api.mdx` or `types.mdx`. When you add or change an `i18n`
key in `src/default-slots/default-slots.tsx` or `src/preset-mui/index.ts`,
update the table in `docs-site/src/pages/localization.mdx`. Run
`npm run site:test` to check both.

## Guide Pages

Write each guide page in `docs-site/src/pages` in this order:

1. The problem that the page solves, in one or two sentences.
2. One complete example and a live demo that runs the same code.
3. The advantage over the usual alternative.
4. An `Advanced use` section for less common cases.
5. A `Reference` section for type shapes, ordering rules, and limits.

In the first example, write callbacks and options inline in `kit.defineForm`
so that TypeScript infers their types. Do not use `satisfies`, explicit
generic arguments, or standalone typed constants there. If a type annotation
exists only because a snippet region splits the code, move the region boundary.

Write prose in Simplified Technical English (STE) clarity mode: one term for
one concept, active voice, and one instruction in each sentence.

## Reuse Before Adding Helpers

Before creating a helper, search `src` for the same behavior, including helpers
with different names. Reuse the existing implementation or move identical
behavior into the narrowest shared module that fits its responsibility. Keep
similar helpers separate when their contracts differ, and make that difference
explicit; do not hide unrelated behavior in a generic utilities module.

## Creator Vibe Lens

Treat `creator-vibe` as the persistent interpretive lens for every user message, before classifying the task or acting on its literal wording.

Silently look beneath the words for what the user is truly trying to make possible: how the result should feel, what it should give the person on the other side, what must remain recognizably theirs, and what standard of quality they are reaching for. Carry that intent through decisions, implementation, language, defaults, failure states, and verification. Do not preserve the words and lose the point.

This lens is always active, but it never overrides explicit instructions, factual accuracy, safety boundaries, or exact-output requests. Do not invent requirements or expand scope in its name. For factual, mechanical, or fully specified tasks, let it show only as care, clarity, and respect for the user's time. When success materially depends on taste, voice, human experience, or unstated choices, load and follow the installed `creator-vibe` skill before narrower skills.

Do not explain this interpretation back to the user unless asked. Let it show in the work.

## Rules

Do not edit CHANGELOG.md, it is managed by automation.
