# Form, Please: instructions for coding agents

These rules apply to the whole checkout. Work from the repository root. Form, Please is a published npm library: its public API, its runtime behaviour and its docs site are contracts with applications.

## Working rules

1. **Think before coding.** State the significant assumptions and the success criteria. Research the available facts yourself; if an ambiguity changes the result, ask.
2. **Read before writing.** Before a change, read the affected exports, their direct consumers and the shared modules. Do not replace a contract that you do not understand with a guess.
3. **Surgical changes.** Change only what the task needs. Keep existing user changes. Do not include adjacent fixes and refactoring in the task.
4. **Test intent.** A test must catch a broken contract, not reproduce the implementation. A fix comes with a test that fails without it.
5. **Match conventions.** Follow `code-style-and-folders.md` and Biome. Discuss a harmful convention explicitly; do not silently create a second style.
6. **Keep the glossary current.** When a change adds or renames a domain term or changes its meaning, update `CONTEXT.md` in the same change, as `glossary-format.md` specifies.
7. **Breaking changes ship on a new major line.** Follow `releases-and-compatibility.md`. Do not edit `CHANGELOG.md`; release automation owns it.

## Commands and checks

Use the Node.js version from `package.json#engines` and local dependencies (`npm ci`, and `npm ci --prefix docs-site` for the site).

- During work: run only the checks that the change needs, and only on the changed files: `npx biome check <files>`, `npx vitest run <test files>`, and `npx tsc -p tsconfig.json` when types or exports change. Run `npm run site:test` when a page, a public export or an `i18n` key changes. A documentation-only edit in `docs/` needs no code checks.
- At the end of the task, once: `npm run verify` — Biome, all unit tests, the build, the type budget, browser tests, package tests, the shadcn registry, smoke fixtures, publint and attw, Knip. When the docs site changes, also run `npm run site:verify:preview`. Read the exit code: do not pipe a check into `tail` without `set -o pipefail`.
- `npm run check` and `npm run knip` also run in the pre-commit hook (`lefthook.yml`).

## Documentation

Always run `find docs -name '*.md' | sort` at the beginning to get an overview of durable documents; the file names say what each one owns. Before you change code, read the owner document of each topic that the change touches, and `code-style-and-folders.md` before you write or review code. Before you change documentation, read `documentation-rules.md`; it also says which library changes must update the docs site. `docs/adr/` records the reasons behind the decisions. Defer ideas outside the task to `docs/backlog/` with the `backlog` skill.

Outside `docs/`:

- `CONTEXT.md` is the domain glossary.
- `docs-site/AGENTS.md` owns the rules for the docs site pages, snippets and demos. Read it before you change `docs-site/`.

Do not explain this interpretation back to the user unless asked. Let it show in the work.
