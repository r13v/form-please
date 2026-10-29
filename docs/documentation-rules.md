# Documentation rules

These rules apply to the files in `docs/`, `AGENTS.md`, `CONTEXT.md` and code comments. `docs-site/AGENTS.md` owns the rules for writing the site pages.

## The site and docs/

Form, Please has two readers, and each one has one source of truth.

- **The site (`docs-site/src/pages`) is the source of truth for the library user**: an application developer who installs the package. It owns everything that the user can observe or rely on: the public API, options and defaults, types, runtime behaviour, error types and messages, ordering and lifecycle guarantees, limits, compatibility, and how-to guidance.
- **`docs/` is for the maintainer** of this repository. It owns what a user cannot observe: invariants between internal modules, package-private capabilities, how a public guarantee is implemented and enforced, the reasons for a design and the alternatives it rules out, assumptions about dependency behaviour (React Hook Form (RHF), Immer), bundle and entry boundaries, release and compatibility mechanics, and the test strategy.

Rules:

- A change that a library user can observe updates the site in the same change. It does not need a `docs/` change unless an internal contract also changes.
- `docs/` does not describe user-facing behaviour. When an internal contract exists to keep a public guarantee, state the internal contract and name the site page that states the guarantee: "The row count guarantee for users: `docs-site/src/pages/arrays.mdx`."
- Test a `docs/` sentence: if an application developer could observe it through the public API, it belongs on the site. Move it there if the site does not state it, then delete it from `docs/`.
- `CONTEXT.md` keeps domain terms for both readers; the site glossary `docs-site/src/pages/glossary.mdx` uses the same terms.

## General

- Document only what would surprise an experienced engineer who knows TypeScript, React, React Hook Form (RHF), Standard Schema, Immer, Vitest and how a published npm library is built. Contracts and reasons, not a retelling of the code.
- When you update `docs/` or comments, bring them in sync with the project: remove stale and obvious text, update the surprises.
- Each topic has one owner document; the file name says which. Other documents refer to it and do not repeat it. A number or a limit lives in one place: the owner or the code.
- Describe the current state only. No history ("was", "used to", "previously", "no longer", "Done"), no dates, no commit hashes. Support for an old format is a current contract, not history.
- Plans live only in `docs/backlog/`. An item that is done or dropped is deleted; the owner documents describe what is in effect. Do not describe an unimplemented item as working.
- `docs/adr/` keeps the architecture decision records. An ADR records a decision, its context and the rejected alternatives at the time of the decision; the history rules do not apply to it. Do not edit an accepted ADR except its status line. The owner document states the current rule and names the ADR that explains it.
- A contract change updates its owner document in the same change.
- Give descriptive kebab-case file names: `find docs -name '*.md'` shows only the names.
- Assume the reader can grep and follow a path. Mention an npm script, a file or a function by name instead of retelling it.

## Code is the source of truth

A document keeps what the code cannot show. Keep:

- Contracts and invariants between internal parts: who may write RHF state and through which call, which module enforces a public guarantee, how optional entries reach the core, what stays out of the root bundle.
- The reason for a choice that an experienced engineer would not expect, and the alternative it rules out.
- Behaviour that spans several files and that no single file shows.
- An assumption about RHF behaviour, with the contract test that pins it.
- One pointer per topic to the file or function that implements it.

Remove:

- A step-by-step narration of what a function does.
- Lists of fields, option names, union members, constants, defaults, limits and caps. Point to the symbol instead: "limits: `maxUpdates` in `src/devtools/store.ts`".
- Directory listings, module tables, test inventories and lists of files that `find` or `ls` shows.
- User-facing behaviour, options, errors and guidance. The site owns them; a document names the page.

Test a sentence: if a change of the code would make it false without a change of a contract, it retells the code. A paragraph of more than about six sentences usually retells the code; split it into the contract and a pointer. When in doubt whether a sentence is a contract, keep it short rather than delete it.

## Docs site coupling

A library change that a user can observe updates the site in the same change. The site gates in `docs-site/tests/content.test.mjs` read the library source; run `npm run site:test` to check them.

- A new public export of an entry in `package.json#exports` is named in inline code in `docs-site/src/pages/api.mdx` or `types.mdx`.
- A new or changed `i18n` key in `src/array-actions-i18n.ts` or `src/preset-mui/controls.tsx` updates the table in `docs-site/src/pages/localization.mdx`.
- A breaking change adds a row to `docs-site/src/pages/upgrade-to-v2.mdx` while the 2.x line is current.
- A change of observable behaviour can make a page stale. Search `docs-site/src/pages` for the old behaviour and update each page that describes it.

## Changes

- A rename of a domain term or a module updates every document in the same change: grep `docs/`, `CONTEXT.md`, `AGENTS.md` and `docs-site/src/pages` for the old word.
- When you rewrite or merge a section, read the diff for removed headings and paragraphs. Text that still describes working code moves to its owner; it does not disappear with an unrelated change.
- Write every document in English, in Simplified Technical English clarity mode: one term for one concept, active voice, short sentences. Use the terms of `CONTEXT.md`; `glossary-format.md` says when to update it.
- Refer to a document by its file name in backticks when the name is unambiguous, for example `managed-updates.md`; refer to its section as `managed-updates.md` § Restores. Refer to any other file by its repo-root path without a leading slash, for example `src/value-middleware.ts`. Do not use Markdown links or `../` paths for repository files in `docs/` and `AGENTS.md`. External URLs stay links. `README.md` is for people on GitHub and keeps Markdown links.
- Every path exists and has no line number.
- No manual wrapping of lines in Markdown files.
- No tables unless asked: use lists.
- `AGENTS.md` stays minimal: working rules, commands, invariants and the pointers that the file list of `docs/` cannot show.

## Before you commit a documentation edit

- Every referenced path exists: ``grep -ohE '`(docs|src|scripts|tests|docs-site)/[^`]+`' AGENTS.md docs/*.md | tr -d '`' | sed 's/ §.*//' | sort -u | while read p; do ls -d "$p" >/dev/null 2>&1 || echo "missing: $p"; done``.
- Every `name.md` § Heading reference finds its heading: ``grep -ohE '[a-z-]+\.md` § [A-Z][^`.,;)]*' AGENTS.md docs/*.md | sort -u | while IFS= read -r l; do f=${l%%\`*}; s=${l#*§ }; d=$(find docs -name "$f" | head -1); grep -qE "^#+ $s\$" "$d" 2>/dev/null || echo "bad: $l"; done``; a hit that ends mid-sentence is a false alarm.
- No history: `grep -nE 'previously|used to|was changed|migrated|no longer|Done|Implemented|20[0-9]{2}-[0-9]{2}-[0-9]{2}' AGENTS.md README.md CONTEXT.md docs/*.md` finds nothing new.
- No duplicates: grep all documents for the topic and keep the text only in its owner.
- `git diff --check`.
