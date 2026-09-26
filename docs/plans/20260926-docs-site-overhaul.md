# Docs Site: Fix Defects and Implement Top-Ranked Ideas

## Overview

- Fix the defects D1 to D12 from [docs/ideas.md](../ideas.md). D13 (the
  mascot) is an owner decision and is outside this plan.
- Implement the top-ranked ideas I04, I05, I13, I14, I16, I20, and I17, and
  the two enablers I10 and I15.
- Result:
  - The LLM files work on production.
  - The overview works on phones.
  - The docs contain no known wrong claims.
  - Readers find pages by intent.
  - Each core rule has one home.
  - Automated gates stop these defects from coming back.
- `docs/ideas.md` is the source of truth for evidence and the refined
  proposals. Read the matching section before each task.

## Context (from discovery)

- Docs site: `docs-site/`, Vocs 2.7.2, `renderStrategy: "full-static"`,
  GitHub Pages under `basePath` `/form-please`.
- Pages: `docs-site/src/pages/**/*.mdx` (33 pages). Sidebar:
  `docs-site/vocs.config.ts:87-163`. Styles: `docs-site/src/pages/_root.css`.
- Snippets: `docs-site/src/snippets/*.tsx|ts`, typechecked by
  `npm run test:docs` (`docs-site/tsconfig.docs.json`).
- Playground: `docs-site/src/lib/playground-scenarios.ts`,
  `playground-sources.ts` (its `editorSource` strips only `// @` and `// ^?`
  lines), and `docs-site/src/snippets/playground-*.tsx`.
- Postbuild: `docs-site/package.json` runs
  `node ../scripts/fix-vocs-skip-links.mjs`. It exports `normalizeBasePath`
  (`:96`), and its `isMain` guard makes the import safe.
- Tests:
  - `docs-site/tests/content.test.mjs`: source checks, run by
    `npm test --prefix docs-site`.
  - `docs-site/tests/build-output.test.mjs`: built output, run by
    `test:output`.
  - `tests/browser/docs-site.spec.ts`: Playwright, run by
    `npm run site:test:e2e`.
  - `docs-site/tests/*.mjs` and root `scripts/*.mjs` are outside the knip
    project globs.
- Full docs gate: `npm run site:verify:preview`. It runs the content tests,
  the snippet typecheck, a build with `BASE_PATH=/form-please`, the Markdown
  audit, the output tests, and e2e.
- Repository gates: `npm run check` (Biome) and `npm run knip`.
- Rules:
  - `docs-site/AGENTS.md`: builder factory only, public `form-please`
    imports only, physical snippets, no redirects, no server runtime, STE
    text, `toMarkdown` or a remark plugin for components.
  - Root `AGENTS.md`: reuse helpers before you add new ones.
- Test policy: commits 403dada and ff64b76 removed tests that restate text
  written in the same change and guards for retired names. This plan follows
  the same policy.

## Development Approach

- **Testing approach**: Regular (content and code first, then tests in the
  same task).
- Complete each task fully before moving to the next.
- Make small, focused changes.
- **CRITICAL: every task MUST include tests or state why the existing gates
  cover it.** Add a test only when it checks behavior or a derived fact:
  - e2e behavior (a user action and its visible result).
  - Derived gates (routes from files, anchors from HTML, exports from
    source, claims against the included snippet).
  - Facts read from the library source (for example i18n keys).
  - The terminology denylist.
  Do not add tests that restate text written in the same task, "heading
  exists" checks, or guards for retired names.
- **CRITICAL: update existing tests in the same task when a change moves or
  deletes text they assert.** Each task lists the known assertions.
- **CRITICAL: all tests must pass before the next task starts.** No
  exceptions.
- **CRITICAL: update this plan file when the scope changes during the
  implementation.**
- Write all new and changed prose with the `ste` skill: short sentences,
  active voice, and one term for one concept (see Task 13 for the terms).
- Move text. Do not copy it. When a rule gets a canonical home, replace the
  other copies with one sentence and a link.
- Do not change URL slugs. `docs-site/AGENTS.md` forbids redirects.
- Keep existing anchors that other pages link to, or update every link in
  the same task. The Task 5 anchor gate finds the misses.

## Testing Strategy

- **Derived gates** (Task 5, in `content.test.mjs` and
  `build-output.test.mjs`): routes, Markdown output, anchors, export
  coverage, and example claims. After Task 5 they cover each new page and
  each moved link automatically.
- **Script tests** (new `docs-site/tests/postbuild.test.mjs`): pure functions
  of the postbuild scripts, with success and edge cases.
- **Output tests**: each link in the LLM files resolves to a built file.
- **Snippet typecheck** (`npm run test:docs`): each changed or new snippet.
- **e2e** (`tests/browser/docs-site.spec.ts`): each UI change, in the same
  task as the change.
- Per-task command: `npm run site:verify:preview`, then `npm run check` and
  `npm run knip`.

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with the ➕ prefix.
- Document issues and blockers with the ⚠️ prefix.
- Update the plan if the implementation deviates from the original scope.
- Keep the plan in sync with the actual work.

## Solution Overview

The work goes in four stages. Each stage makes the next one safer.

1. **Defects first (Tasks 1 to 4).** These are small, isolated fixes.
2. **Gates (Task 5).** Add the accuracy gates (I10) before the large content
   moves. The anchor, route, export, and claim gates then protect Tasks 6
   to 14.
3. **Structure (Tasks 6 to 12).** First the navigation (I04), so that new
   pages have a place. Then Get started (I16), the single-source rules page
   (I05), Troubleshooting (I13), Localization and Accessibility (I14), and
   the task cards with next steps (I20).
4. **Language and agents (Tasks 13 and 14).** Terminology control (I17)
   runs after all new text exists, so the denylist covers it. The AI agents
   hub (I15) is last because it links to the final page set.

Key decisions:

- **I15 scope:** fix the links in the LLM files and the per-page Markdown
  with a postbuild script. Keep `showAskAi: false` on all pages until Vocs
  fixes the base-path bug upstream. Do not patch the `vocs` dependency.
- **I10 export coverage:** document the 17 undocumented exports in
  `types.mdx` in the same task, so the coverage test needs no allowlist.
- **I10 page list:** one shared module derives the page list from
  `src/pages/**/*.mdx`. Both test files use it. No route list is copied by
  hand.
- **I16:** keep `profile-form.tsx` as the Get started program. `README.md:167`
  and `content.test.mjs` refer to it. Add visible output to it. Do not merge
  it with `playground-transform.tsx`, because that file carries Twoslash
  queries and playground wiring. The two programs overlap on purpose, and
  each has its own job.
- **I14:** two small guides, "Localization" and "Accessibility". The
  accessibility contract moves out of Recipes and Form kits. It is not
  copied.

## Technical Details

### Postbuild link fix (Task 1)

- New script `scripts/fix-vocs-llms-links.mjs`. It imports
  `normalizeBasePath` from `scripts/fix-vocs-skip-links.mjs`.
- `export function prefixMarkdownLinks(markdown, basePath)` rewrites the
  root-relative Markdown links `](/path)` to `](/form-please/path)`.
  - Keep links that already start with the base path.
  - Keep absolute URLs, `//host` links, and `#anchor` links.
  - Map `](/index)` to `](/form-please/)`. Vocs writes `/index` for the
    home page (`vocs/src/internal/llms.ts:94-96`).
  - Code fences and code spans have no such links today. Skip code fences
    with a simple line state. Do not build a Markdown parser.
- It patches `dist/public/llms.txt`, `dist/public/llms-full.txt`, and
  `dist/public/assets/md/**/*.md`. It does nothing when the base path is
  `/`.
- `docs-site/package.json` `postbuild` runs both scripts.

### Accuracy gates (Task 5)

- **Shared page list:** new module `docs-site/tests/pages.mjs`.
  - It walks `docs-site/src/pages/**/*.mdx`.
  - It maps `index.mdx` to `/` and `examples/index.mdx` to `/examples`.
  - It exports the routes and the expected `assets/md` path for each route.
  - It reads the sidebar links from `vocs.config.ts` with the regex
    `link: "(\/[^"]*)"`. The config imports TS paths that Node cannot load.
- **Routes:** each route is in the sidebar, and each route has its
  `assets/md` file in the build. Assert that the route count equals the
  `.mdx` file count, so the gate is never empty.
- **Anchors:** for each `dist/public/**/index.html`, collect the `id`
  values. For each internal `href` with a `#hash`, remove the base path,
  resolve the target page, and check the id. Skip `#vocs-content`. Assert
  that the number of checked links is more than 0. A prototype on the
  current build checked 275 links and found only the 2 D8 links.
- **Exports:** in `src/**/index.ts`, collect names from:
  - `export { ... }` and `export type { ... }` lists.
  - `export function`, `export const`, `export class`, `export type`, and
    `export interface` declarations. Examples:
    `src/preset-mui/index.ts:27`, `src/preset-native/index.ts:8`.
  Each name must appear as a whole word in `api.mdx` or `types.mdx`. Assert
  that more than 100 names are found.
- **Example claims:** for each `examples/*.mdx`, collect the inline-code
  identifiers in the bullet list under "What this form demonstrates". Strip
  `()`. Each identifier must appear in the snippet that the page includes.
  A prototype found the 5 D4 pages.
- **Mutation check (manual, once):** break one anchor, one route, and one
  export in a scratch change. Confirm that each gate fails. Record the
  result in this plan. Do not commit fixture tests for this.

### Terminology (Task 13)

| Use | Do not use (exact denylist) |
|---|---|
| Form, Please | `Form Please` in prose |
| React Hook Form (RHF) at first mention on each page, then RHF | — (first-mention test) |
| managed update | `managed change` |

- The denylist ignores code fences, inline code, and import paths.
- The devtools UI label contains "Form Please Devtools"
  (`src/devtools/devtools.tsx:145`, `devtools-demo.client.tsx:95,101`).
  Quote it in inline code when the docs name it. A library rename is out of
  scope.
- Replace the editable-data synonyms ("editable input", "editable values")
  with "schema input" in a manual pass. This is not a denylist rule,
  because the meaning depends on the context.
- "Proposal" and "transaction" are public API terms (`types.mdx:227`). Keep
  them and define them in the glossary.

### Core rule locations (Task 8)

Found by the I05 verifier. Recheck with `rg` before you edit.

| Rule | Places |
|---|---|
| `required` is UI-only | `get-started.mdx:46-47`, `definitions.mdx:95`, `conditional-fields.mdx:118-119`, `validation.mdx:35-39`, `faqs.mdx:71-73`, `api.mdx:111,333` |
| Hidden fields keep their values | `arrays.mdx:141`, `recipes.mdx:206`, `conditional-fields.mdx:27-28`, `validation.mdx:96-98`, `faqs.mdx:98-111`, `api.mdx:333`, `examples/index.mdx:49`, `examples/learning-cohort.mdx:28` |
| `onSubmit` arguments | `validation.mdx:110-115`, `recipes.mdx:280-285`, `api.mdx:380,401`, `workflows.mdx:193`, `form-kits.mdx:231`, `faqs.mdx:27-28` |
| Server issues | `recipes.mdx:247-268`, `workflows.mdx:138-147`, `faqs.mdx:83-94`, `validation.mdx:135` |
| Ownership boundary | `index.mdx:171-174`, `recipes.mdx:38`, `workflows.mdx:24-30`, `examples/index.mdx:43-47`, `middleware.mdx:21`, `history.mdx:11`, `persistence.mdx:10,97`, `resources.mdx:151-153`, `faqs.mdx:162`, `examples/async-multiselect.mdx:29` |
| Schema parses once | `faqs.mdx:14-18`, `examples/mui-yup.mdx:44-45`, `examples/index.mdx:50-51` (after D6) |

- `api.mdx` is reference. Keep one line in each API entry and link to the
  rule.
- Recipes and Workflows keep their task-specific code. Only the rule prose
  moves.

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): changes in this repository:
  pages, snippets, components, CSS, config, scripts, and tests.
- **Post-Completion** (no checkboxes): owner decisions, upstream issues,
  external submissions, and checks on the deployed site.

## Implementation Steps

### Task 1: Fix base-path links in the LLM files and per-page Markdown (D1)

**Files:**
- Create: `scripts/fix-vocs-llms-links.mjs`
- Modify: `docs-site/package.json`
- Create: `docs-site/tests/postbuild.test.mjs`
- Modify: `docs-site/tests/build-output.test.mjs`
- ➕ Modify: `package.json` (`site:verify:preview` and `site:verify:production` pass `BASE_PATH=/form-please` to `test:output`, so the output test knows the base path)

- [x] create `scripts/fix-vocs-llms-links.mjs` with `prefixMarkdownLinks(markdown, basePath)` and a main entry that patches `llms.txt`, `llms-full.txt`, and `assets/md/**/*.md` (see Technical Details)
- [x] import `normalizeBasePath` from `scripts/fix-vocs-skip-links.mjs`; do not copy it
- [x] change `postbuild` in `docs-site/package.json` to run both scripts
- [x] change the `test` script in `docs-site/package.json` to run `tests/content.test.mjs` and `tests/postbuild.test.mjs`
- [x] write tests for `prefixMarkdownLinks`: a root-relative link, a nested route (`/examples/history`), and `/index`
- [x] write edge-case tests: an already-prefixed link, an absolute URL, a `#anchor` link, a link inside a code fence, and base path `/` (no change)
- [x] add an output test: when `BASE_PATH` is set, each root-relative link in `llms.txt`, `llms-full.txt`, and `assets/md/**/*.md` resolves, after the base path is removed, to an existing file in `dist/public` (`<route>/index.html` or `index.html`); assert that more than 0 links are checked
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 2

### Task 2: Make the overview hero work on phones (D2)

**Files:**
- Modify: `docs-site/src/pages/_root.css`
- Modify: `tests/browser/docs-site.spec.ts`

- [x] add a media query (`max-width: 48rem`) that sets `.form-please-overview-hero` to one column, puts the logo above or below the intro, and makes the logo smaller
- [x] check the layout at 375 px, 768 px, and 1440 px in the browser pane (checked with a Playwright script on the preview build: at 375 px the intro is 343 px wide and the logo is 112 px above it; at 768 px the intro is 720 px wide; at 1440 px the 240 px logo is next to the 748 px intro; no page overflow at any width)
- [x] add an e2e test at a 375 × 812 viewport: the hero `h1` has no horizontal overflow (`scrollWidth <= clientWidth`), and the intro is at least 300 px wide
- [x] add an e2e assertion at 1440 px: the logo stays next to the intro
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 3

### Task 3: Correct the wrong claims in the prose (D3 to D7)

**Files:**
- Modify: `docs-site/src/pages/api.mdx`
- Modify: `docs-site/src/pages/examples/research-grant.mdx`, `campaign-builder.mdx`, `learning-cohort.mdx`, `membership-ladder.mdx`, `studio-policies.mdx`
- Modify: `docs-site/src/pages/examples/index.mdx`, `examples/shadcn-valibot.mdx`
- Modify: `docs-site/src/snippets/playground-conditional.tsx`, `docs-site/src/lib/playground-scenarios.ts` (if the summary changes)
- Modify: `tests/browser/docs-site.spec.ts`

- [x] D3: remove the object-form sentence at `api.mdx:288-290`
- [x] D4: replace `useWatch` with `form.api.watch()` in the five example pages (`makerspace-launch.mdx:27` keeps `useWatch`, because its snippet calls `useWatch`)
- [x] D5: correct `examples/index.mdx:34-35`: the active stage is React state that the form reads through context
- [x] D6: change "a second time" (`examples/index.mdx:50-51`) and "twice" (`examples/shadcn-valibot.mdx:37`) to "once", to match `src/create-form-kit.tsx:803`
- [x] D7: in `playground-conditional.tsx`, require the company name for company accounts with `superRefine` (or `.check`). Do not use a discriminated union, because it can break `FieldPath` for `ui.field("companyName")`. Keep the scenario summary true.
- [x] keep the Twoslash directives in `playground-conditional.tsx` valid and run `npm run test:docs`
- [x] add an e2e test: in the "Conditional field" scenario, choose company, clear the company name, and submit; the Zod message shows and no output shows
- [x] check that `build-output.test.mjs:59` still finds `useWatch` in `llms-full.txt` (other pages use it); update it if it only matched the example claims (still passes: `makerspace-launch.mdx`, `recipes.mdx`, `faqs.mdx`, `api.mdx`, and `index.mdx` keep it; no change)
- [x] no new source test for D3 to D6: the Task 5 example-claims gate covers D4; D3, D5, and D6 are one-time text fixes
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 4

### Task 4: Fix the snippet defects (D9 to D11)

**Files:**
- Modify: `docs-site/src/snippets/history-guide.tsx`, `docs-site/src/pages/history.mdx`
- Modify: `docs-site/src/snippets/styling-guide.tsx`
- Modify: `docs-site/src/snippets/testing-guide.ts`, `docs-site/src/pages/testing.mdx` (if the text names the middleware)
- Modify: `tests/browser/docs-site.spec.ts` (only if a live demo renders the changed code)

- [x] D9: change the regions in `history-guide.tsx` so that the setup region ends at a complete statement, and a shown region calls `undo()` and `redo()`
- [x] D10: render an `accountType` field in `styling-guide.tsx`, or change the class resolver to read a rendered field; the included region shows both the resolver and the field
- [x] D11: make `normalizeTaxId` normalize the value (for example trim and uppercase it in the patch), or rename it to what it does
- [x] run `npm run test:docs` for the changed snippets
- [x] if the styling page renders `styling-guide.tsx` live, add an e2e test: choose the company account and the root gets the `company-account` class; otherwise the typecheck covers the change (the styling page only includes the code; no live render, so the typecheck covers it)
- [x] update the history e2e test if the preview behavior changed (behavior unchanged; the existing e2e test passes)
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 5
- ➕ the `managed-lifecycle` test in `testing-guide.ts` called `setValue` on a definition with no fields, so it threw when run. The managed definition now renders `kind` and `taxId`. A one-off Vitest run passed both snippet tests.

### Task 5: Add the docs accuracy gates (I10, D8, D12)

**Files:**
- Create: `docs-site/tests/pages.mjs`
- Modify: `docs-site/tests/content.test.mjs`
- Modify: `docs-site/tests/build-output.test.mjs`
- Modify: `docs-site/src/pages/examples/mui-yup.mdx`, `docs-site/src/pages/form-kits.mdx`
- Modify: `docs-site/src/pages/types.mdx`

- [x] create `docs-site/tests/pages.mjs` with the derived page list (see Technical Details)
- [x] replace the hand-written page list in `content.test.mjs:8-41` with the shared list; check each route against the sidebar links (this fixes the missing `testing.mdx`)
- [x] replace the hand-written Markdown list in `build-output.test.mjs:9-46` with the shared list (this fixes the missing `devtools.md`, `testing.md`, and `workflows.md`)
- [x] add the anchor gate to `build-output.test.mjs`
- [x] D8: change `examples/mui-yup.mdx:54` to `/api#material-ui-preset`, and `form-kits.mdx:364` to the correct `/api#native-controls` and `/api#default-slots` anchors
- [x] document the 17 undocumented exports in `types.mdx`, grouped by entry point: 8 MUI helper types, 3 native-controls types, 3 default-slots i18n types, `FormPleaseDevtoolsProps`, `UsePersistenceResult`, and `UseHistoryResult`; correct the intro at `types.mdx:9`
- [x] add the export-coverage gate (no allowlist) and the example-claims gate
- [x] add non-vacuity assertions to each gate (see Technical Details)
- [x] run the one-time mutation check and record the result under this task (each gate failed on its scratch change and passed after the revert: a broken `#native-controls` href in the built `types/index.html` failed the anchor gate; a new `mutation-check.mdx` failed the sidebar gate and the Markdown output gate; a new root export failed the export gate; a `useWatch` claim on `research-grant.mdx` failed the example-claims gate)
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 6
- ➕ the export and example-claims gates are source checks, so they live in `content.test.mjs`; the route-to-Markdown and anchor gates read the build, so they live in `build-output.test.mjs`

### Task 6: Organize the navigation by reader intent (I04)

**Files:**
- Modify: `docs-site/vocs.config.ts`
- Modify: `tests/browser/docs-site.spec.ts`

- [x] add `topNav` items:
  - Docs: `/get-started`. Its `match` is an inline function that returns true for the guide routes. Write it without outer variables, because `config-serializer.ts` serializes functions with `toString()`. (Done as an exclusion: it matches each page except `/`, `/examples/**`, `/playground`, `/api`, and `/types`, so the new pages of Tasks 8 to 13 need no config change.)
  - Examples: `/examples`, with a string `match` prefix.
  - Playground: `/playground`.
  - API: `/api`. (Its `match` also covers `/types`, the TypeScript reference.)
  - A version dropdown with the text from the root `package.json` version, linking to <https://github.com/r13v/form-please/releases>.
- [x] split the Guides group into Learn (Get started, Definitions, Form kits, Validation, Styling), Build (Conditional fields, Arrays, Recipes, Workflows, Persistence, History), and Advanced (Middleware, Resources, Devtools, Testing); keep the Start group for Overview, Playground, and AI agents
- [x] keep every existing page in the sidebar; add no page in this task
- [x] update the e2e navigation test (`docs-site.spec.ts:10`) for the new groups
- [x] add an e2e test: click each topNav item, check the URL, and check that the matching tab is active on a guide page and an example page
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 7

### Task 7: Rewrite Get started with a visible result (I16)

**Files:**
- Modify: `docs-site/src/pages/get-started.mdx`
- Modify: `docs-site/src/snippets/profile-form.tsx`
- Create: `docs-site/src/components/get-started-demo.tsx`, `docs-site/src/components/get-started-demo.client.tsx`
- Modify or delete: `docs-site/src/components/interactive-lab.tsx`, `interactive-lab.client.tsx`, and the related CSS in `_root.css`
- Modify: `docs-site/tests/content.test.mjs`
- Modify: `tests/browser/docs-site.spec.ts`

- [x] put the three steps in `:::steps`
- [x] put the install command in `:::code-group` with npm, pnpm, yarn, and bun tabs
- [x] change `profile-form.tsx` to keep the submitted value in `useState` and show it in a `<pre>`, as `playground-transform.tsx` does; keep the region names that `content.test.mjs:222-229` and `:496-509` use, or update those assertions
- [x] create `get-started-demo.tsx` and `.client.tsx` that render the exported component of `profile-form.tsx`; give the server component `toMarkdown` with the `markdown-fallback` pattern from `interactive-lab.tsx`
- [x] render the demo after step 3
- [x] remove the interactive lab from Get started and link to `/playground`; keep `lab-profile-form.tsx`, because four pages include its regions
- [x] if `InteractiveLab` has no other user, delete it and its CSS, and remove the assertions in `content.test.mjs:443-456` that read `interactive-lab.client.tsx` (Deleted. Only the lab-only CSS went: inspector, submit state, panel, and state list. `__kicker`, `__summary`, and `__actions` stay, because other demos use them. The whole FormData test went, because its subject was the lab snapshot.)
- [x] update the e2e test: submit the Get started form and see the transformed output; remove the lab assertions (`docs-site.spec.ts` about lines 305-309)
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 8

### Task 8: Add "How it works" as the single source for core rules (I05)

**Files:**
- Create: `docs-site/src/pages/how-it-works.mdx`
- Modify: `docs-site/vocs.config.ts`
- Modify: the pages in [Core rule locations](#core-rule-locations-task-8)
- Modify: `docs-site/tests/content.test.mjs`
- Modify: `docs-site/tests/build-output.test.mjs` (only if a phrase moves out of `llms-full.txt`)

- [x] write `how-it-works.mdx` with a text diagram of the flow: schema → definition → `kit.useForm` binding → React Hook Form → resolver → `onSubmit`
- [x] give each core rule one heading: `required` is UI-only, hidden fields keep their values, the schema parses once on submit, the `onSubmit` arguments (one fixed order), server issues, and ownership
- [x] resolve the ownership drift: `examples/index.mdx:45` and `index.mdx:171` must agree on who validates (the Standard Schema owns the rules; React Hook Form runs validation through the schema resolver; `examples/index.mdx` now links to the Ownership section)
- [x] move the rule answers from `faqs.mdx` to the new page; keep the FAQ questions with one sentence and a link
- [x] replace the other copies in the location table with one sentence and a link to the rule anchor (kept without a change: `resources.mdx` request ownership, the `examples/async-multiselect.mdx` layer table, the `learning-cohort.mdx` claim bullet, and `faqs.mdx:162`, because they state task-specific facts; `workflows.mdx` keeps its submitter sequence, the canonical submitter contract)
- [x] add the page to the Learn group after Get started
- [x] update the page-specific phrase assertions that the move breaks: `content.test.mjs` validation (`:143-151`), middleware (`:348-363`), workflows (`:278-289`), and persistence (`:423-431`); move each assertion to `how-it-works.mdx` or delete it if it only restated text (only the validation list broke: its `FormInput<Schema>`, `FormOutput<Schema>`, and "Server validation is still required" phrases restated moved text and were deleted; the middleware, workflows, and persistence assertions still match; a new FAQ link keeps the `[Value middleware](/middleware)` check)
- [x] check that the `llms-full.txt` phrases in `build-output.test.mjs` (for example `/Hidden fields preserve/i`, `/parses once/i`) still match (`/Hidden fields preserve/i` became `/Hidden fields keep their values/i`, because the examples overview no longer has that text; `/parses once/i` matches the new heading)
- [x] the Task 5 gates cover the new route and the new anchors; add no "heading exists" tests
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 9

### Task 9: Add a Troubleshooting page (I13)

**Files:**
- Create: `docs-site/src/pages/troubleshooting.mdx`
- Modify: `docs-site/vocs.config.ts`

- [x] give each symptom a `##` heading, so that search indexes it and it gets an anchor (Vocs search sections come from headings only, `search.ts:354`):
  - "`onSubmit` is not called"
  - "TypeScript rejects a path or control"
  - "The transformed value is missing"
  - "Middleware or history skips a change"
  - "`delayError` is ignored"
  - "Default values load too late"
- [x] under each heading, give the cause in one sentence and a link to the canonical section (`middleware.mdx`, `api.mdx`, `history.mdx`, `how-it-works.mdx`); do not copy the rules (the TypeScript entry links to `types.mdx`, and the default-values entry also links to `recipes.mdx#load-an-edit-form-baseline`, because those sections own the rules)
- [x] show the mistyped-path error from the existing `playground-typo.tsx` snippet (its `// @errors:` codes stay in sync with `tsc`) (the full file is included, because region markers would show in the playground editor source)
- [x] add the page to the Help group next to FAQs
- [x] the Task 5 gates cover the route and the links; add no text-restating tests
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 10

### Task 10: Add the Localization guide (I14, part 1)

**Files:**
- Create: `docs-site/src/pages/localization.mdx`
- Create: `docs-site/src/snippets/localization-guide.tsx`
- Modify: `docs-site/src/pages/validation.mdx`, `form-kits.mdx`, `api.mdx` (links to the guide)
- Modify: `docs-site/vocs.config.ts`
- Modify: `docs-site/tests/content.test.mjs`
- Delete: `docs-site/src/snippets/zod-error-messages.ts` (its `z.config` code moved into the `zod-messages` region)

- [x] write one typechecked snippet with named regions: `context.locale` labels, Zod `z.config` locales, Valibot `setGlobalMessage`, Yup `setLocale`, `createDefaultSlots` i18n, and `createMuiFormKit` i18n
- [x] use the builder factory and public imports only
- [x] add a table of the i18n keys for each preset, and say that the names differ (`arrayAdd` in `src/default-slots/default-slots.tsx:48`, `addItem` in `src/preset-mui/index.ts:9-15`)
- [x] replace the Zod messages section in `validation.mdx:139` with one sentence and a link; update any `content.test.mjs` validation assertion that reads that section; keep the API tables in `api.mdx` as reference and link to the guide
- [x] add the page to the Build group
- [x] run `npm run test:docs`
- [x] add a source test that reads the i18n keys from `src/default-slots/default-slots.tsx` and `src/preset-mui/index.ts` and checks that the guide table lists each key; this catches new keys in the library
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 11

### Task 11: Add the Accessibility guide (I14, part 2)

**Files:**
- Create: `docs-site/src/pages/accessibility.mdx`
- Modify: `docs-site/src/pages/recipes.mdx`, `form-kits.mdx`, `validation.mdx`
- Modify: `docs-site/src/snippets/production-recipes.tsx` (wider `accessible-control` region)
- Modify: `docs-site/vocs.config.ts`
- Modify: `docs-site/tests/content.test.mjs`

- [x] list each guarantee that the library gives (focus on the first invalid field, error association, and required and invalid state) with the source file that implements it
- [x] move the custom-control contract from `recipes.mdx:352-372` and `form-kits.mdx:118-136` into the guide, together with the `production-recipes.tsx:accessible-control` region include; leave one sentence and a link in both places (the `accessible-control` region now also includes `CurrencyProps` and `CurrencyControl`, so the included code shows the contract; the Form kits `readOnly` note moved too)
- [x] update `content.test.mjs:204`, which requires that include in `recipes.mdx`, to point at `accessibility.mdx`
- [x] keep the old Recipes anchor if another page links to it (the Task 5 anchor gate reports it) (no page linked to `#preserve-the-accessibility-contract`; the heading stays with one sentence and a link)
- [x] add the page to the Build group
- [x] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 12

### Task 12: Add task cards and "Next steps" links (I20)

**Files:**
- Modify: `docs-site/src/pages/index.mdx`, `docs-site/src/pages/_root.css` (if the card styles change)
- Modify: all guide pages in the Learn, Build, and Advanced groups
- Modify: `tests/browser/docs-site.spec.ts`

- [ ] rewrite the benefit cards at `index.mdx:98-131` as task cards ("Validate with Valibot", "Use my design system", "Save a draft", "Build a multi-step form" → `/workflows`); do not add a second card grid
- [ ] end each guide with a `## Next steps` section that has one or two task links
- [ ] set `searchPriority` in the frontmatter: higher on Get started, How it works, Definitions, Validation, and Troubleshooting; lower on the complex examples
- [ ] add an e2e test: search for "localization" and "troubleshooting", and the first result opens the matching page
- [ ] the anchor gate covers the new links; add no "section exists" tests
- [ ] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 13

### Task 13: Add the glossary and control the terms (I17)

**Files:**
- Create: `docs-site/src/pages/glossary.mdx`
- Modify: all pages that use a denied term (see Technical Details)
- Modify: `docs-site/vocs.config.ts`
- Modify: `docs-site/tests/content.test.mjs`

- [ ] write `glossary.mdx` with one heading per term: managed update, proposal, transaction, schema input, publication, and React Hook Form (RHF); give each one or two sentences and a link to the canonical section
- [ ] replace `Form Please` in prose with Form, Please; put the devtools UI label in inline code; remove quotes around Form, Please in prose
- [ ] write "React Hook Form (RHF)" at the first mention on each page
- [ ] replace "managed change" with "managed update"; keep the `middleware.mdx:105` anchor valid by updating every link to it (the anchor gate checks this)
- [ ] replace "editable input" and "editable values" with "schema input" where they mean the schema input (manual pass)
- [ ] define "node discriminator" (`definitions.mdx:12-13`) and "publication" (`recipes.mdx:147`) in the glossary, or reword them; update `content.test.mjs:357`, which asserts "raw RHF publication"
- [ ] add the page to the Reference group
- [ ] add the exact-term denylist test and the RHF first-mention test (both ignore code fences, inline code, and import paths)
- [ ] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 14

### Task 14: Make /ai-agents the agent hub (I15)

**Files:**
- Modify: `docs-site/src/pages/ai-agents.mdx`
- Modify: `docs-site/vocs.config.ts`
- Modify: `docs-site/tests/content.test.mjs`

- [ ] add one copyable prompt block that tells an agent to read `llms.txt` and follow its links
- [ ] list `llms.txt`, `llms-full.txt`, and the per-page Markdown URL pattern (`/form-please/assets/md/<page>.md`), all with the base path
- [ ] say in one sentence how the skill differs from `llms.txt`
- [ ] remove the repeated install and update commands, but keep one `--global` example and one `npx skills update form-please` command, which `content.test.mjs:77-85` asserts
- [ ] move the two LLM links from the Reference group to the AI agents page; keep `showAskAi: false`
- [ ] the Task 1 output test covers the link targets; add no text-restating tests
- [ ] run `npm run site:verify:preview`, `npm run check`, and `npm run knip`; all must pass before Task 15

### Task 15: Verify acceptance criteria

- [ ] verify that D1 to D12 are fixed; list which gate or e2e test covers each, and which were one-time text fixes
- [ ] verify that I04, I05, I13, I14, I16, I20, I17, I10, and I15 match their refined proposals in `docs/ideas.md`
- [ ] check the built site in the browser pane at 375 px and 1440 px: overview, navigation, search for "server errors" and "localization", Get started output, and the new pages
- [ ] run the full docs gate: `npm run site:verify`
- [ ] run the repository gates: `npm run verify`
- [ ] run `npm run check` and `npm run knip`

### Task 16: [Final] Update documentation

- [ ] update `docs-site/AGENTS.md` with the new rules:
  - `how-it-works.mdx` is the single home of the core rules.
  - The glossary terms and the denylist.
  - Each guide ends with `## Next steps`.
  - Routes come from `src/pages` through `tests/pages.mjs`.
  - The LLM postbuild script.
- [ ] mark the done defects and ideas in `docs/ideas.md` (a status note under each section)
- [ ] update the root `README.md` if it links to moved docs sections (`README.md:167` links to `profile-form.tsx`)
- [ ] move this plan to `docs/plans/completed/`

## Post-Completion

*Items that need a manual step or an external system. No checkboxes.*

**Owner decisions:**
- D13: decide whether to keep the Hermes Conrad mascot. If not, replace
  `docs-site/public/brand/form-please-logo.png` and the README alt text.
- Decide whether to rename the devtools UI label "Form Please Devtools" to
  "Form, Please Devtools" in the library. This is a library change.

**External actions:**
- Open an upstream Vocs issue or pull request for the Ask AI base-path bug
  (`vocs/dist/react/internal/markdown-url.js:3`, `AskAi.js:50`). After the
  fix, turn on Ask AI for guide pages (the rest of I15).
- Submit the library to Context7 (`context7.json`) after the deploy.

**Manual checks after the deploy:**
- Open `https://r13v.github.io/form-please/llms.txt` and follow three links.
  Open one per-page Markdown file and follow one link.
- Open the overview on a real phone.
- Search production for "troubleshooting", "localization", and
  "accessibility".
