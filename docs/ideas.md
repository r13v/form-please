# Docs Site Improvement Ideas

Review date: 2026-09-26. Scope: every page, snippet, demo component, test, and
config file in `docs-site`, the production site at
<https://r13v.github.io/form-please/>, and the docs sites of comparable
libraries.

## How We Reviewed

1. We read all 33 pages in `docs-site/src/pages` (21 top-level pages, 11
   example pages, and the examples index). We read the 42 files in
   `docs-site/src/snippets` and the demo components that the pages render.
2. We compared the 146 names exported from the 9 `src/**/index.ts` entry
   files with `api.mdx` and `types.mdx`.
3. We opened the production site at desktop width (1440 px) and phone width
   (375 px). We tested search, the playground, examples, page navigation, and
   the LLM files.
4. We studied the docs of TanStack Form, React Hook Form, Conform, Formik,
   uniforms, the react-jsonschema-form playground, Zod, Valibot, shadcn/ui,
   Vocs, wagmi, Stripe, Tailwind CSS, Motion, Starlight, Mintlify, the Vercel
   AI SDK, and the Diátaxis framework.
5. One skeptical subagent verified each idea and the defect list against the
   repository, `docs-site/node_modules/vocs` (version 2.7.2), the production
   site, and the web. Each verifier checked every factual claim, the
   feasibility on Vocs, and the rules in `docs-site/AGENTS.md`. This document
   contains the corrected facts and the refined proposals.

## Site Snapshot

| Area | Current state |
|---|---|
| Size | About 31,000 source words. `api.mdx` has 3,930 words. `definitions.mdx` and `form-kits.mdx` have about 2,400 words each. |
| Navigation | One sidebar. "Guides" has 14 items without subgroups (`vocs.config.ts:98-117`). The header has the title, search, and socials, but no `topNav` links. Previous and next links follow the sidebar order. |
| Search | Vocs MiniSearch works on production. The query "server errors" returns 5 good hits. Vocs ranks top-level pages above `/examples/*` pages by default. |
| Strong points | Twoslash hovers, a Monaco playground with the full TypeScript service, typechecked snippets, llms.txt, many live demos, and a clear hero headline. The overview links each scenario to the playground. |
| AI actions | All 33 pages set `showAskAi: false`. The native Vocs Ask AI menu ignores `basePath`, so it breaks on `/form-please/` (see I15). |

## Defects Found During the Review

These are defects, not ideas. Fix them first. They need about one day in
total. The defect verifier confirmed each row. It rejected one defect from the
first draft: Vite replaces `process.env.NODE_ENV` in client code, so
`snippets/devtools-guide.tsx:28` is correct.

| # | Defect | Evidence |
|---|---|---|
| D1 | All 33 links in the production `llms.txt` return 404. The links are root-relative (`/get-started`) and lose the `/form-please` base path. The AI agents page tells agents to read this file. | `dist/public/llms.txt`. `https://r13v.github.io/get-started` returns 404. |
| D2 | On a 375 px screen, the hero text column is 79 px wide. The headline overflows it and shows one or two words per line. | `docs-site/src/pages/_root.css:87-92` sets a fixed two-column grid. The media queries at `:394`, `:742`, and `:1093` do not change `.form-please-overview-hero`. |
| D3 | `api.mdx` says the object form `defineForm(schema, { ui: [...] })` "remains supported". `docs-site/AGENTS.md` forbids showing the object form. | `docs-site/src/pages/api.mdx:288-290` |
| D4 | Five example pages say the code uses `useWatch`. The code uses `form.api.watch()`. | `examples/research-grant.mdx:27`, `campaign-builder.mdx:27`, `learning-cohort.mdx:25`, `membership-ladder.mdx:29`, `studio-policies.mdx:29` |
| D5 | The examples index says Makerspace keeps the active stage in form values. The page and the code keep it in React state and pass it through context. | `examples/index.mdx:34-35` vs `examples/makerspace-launch.mdx:11` and `snippets/complex-makerspace-launch.tsx:360,526,564` |
| D6 | Pages disagree on how many times a valid submit parses the schema. The code parses it once (`src/create-form-kit.tsx:803`). | "twice": `examples/index.mdx:50-51`, `examples/shadcn-valibot.mdx:37`. "once": `faqs.mdx:14-18`, `examples/mui-yup.mdx:44-45` |
| D7 | The overview scenario "Conditional field" says a required company name appears. The schema makes it optional, so a company can submit an empty name. | `docs-site/src/lib/playground-scenarios.ts:38`, `snippets/playground-conditional.tsx:9,26,41` |
| D8 | Two anchor links are broken. `checkDeadlinks` checks paths only. | `examples/mui-yup.mdx:54` → `/api#createmuiformkit`. `form-kits.mdx:364` → `/api#native-controls-and-default-slots`. The real ids are `native-controls`, `default-slots`, and `material-ui-preset`. |
| D9 | The History setup region ends inside an unclosed function body and never calls `undo()` or `redo()`. | `snippets/history-guide.tsx:21-47` |
| D10 | The styling class resolver reads `accountType`, but the definition renders no `accountType` field. The `company-account` class can never apply. | `snippets/styling-guide.tsx:18,23-40,47` |
| D11 | The middleware named `normalizeTaxId` passes values through without a change. | `snippets/testing-guide.ts:63-65` |
| D12 | Tests do not cover all pages. `testing.mdx` is missing from `tests/content.test.mjs:8-41`. `devtools.md`, `testing.md`, and `workflows.md` are missing from `tests/build-output.test.mjs:9-46`. | test files |
| D13 | The README alt text names the mascot "Hermes Conrad", a Futurama character. This can be an IP risk. Decide this as a project owner. | `README.md:4`, `docs-site/public/brand/form-please-logo.png` |

## Top 20 Ideas

Each idea has the verified problem, the refined proposal, the inspiration, the
effort, and the verification result. Effort is S (1 to 2 days), M (3 to 5
days), or L (more than 1 week). The ideas are in rank order. See
[Scores](#scores) for the method.

### I04. Organize Navigation by Reader Intent

- **Problem:** "Guides" is a flat list of 14 items. It mixes tutorials,
  how-to guides (Recipes, Workflows), concepts (`middleware.mdx:151,249`), and
  reference tables (`form-kits.mdx:108-365`). No `topNav` is configured. The
  site shows no version and no changelog link, but `CHANGELOG.md` and GitHub
  releases v1.2.0 to v1.6.0 exist.
- **Proposal:** Add a Vocs `topNav`: Docs, Examples, Playground, API, and a
  `v1.6.0` dropdown that links to GitHub releases. Split Guides into three
  groups. Keep all pages and add no new pages.
  - Learn: Get started, Definitions, Form kits, Validation, Styling.
  - Build: Conditional fields, Arrays, Recipes, Workflows, Persistence,
    History.
  - Advanced: Middleware, Resources, Devtools, Testing.
- **Inspiration:** Diátaxis, wagmi `topNav`, Tailwind CSS.
- **Effort:** S. Only `docs-site/vocs.config.ts` changes
  (`topNav` is in `vocs/src/internal/config.ts:735`).
- **Verification:** Partly confirmed. The dependency between Form kits and
  Definitions goes both ways (`form-kits.mdx:171`, `definitions.mdx:414`), so
  the order is a choice. The native `::changelog` page needs the GitHub API
  at build time. An external link is safer.

### I05. One "How It Works" Page as the Single Source for Core Rules

- **Problem:** Core rules repeat across many pages, and the copies drift
  (D6, and a second drift: `examples/index.mdx:45` gives validation to React
  Hook Form, `index.mdx:171` gives it to the Standard Schema).
  - `required` is UI-only: 7 places on 6 pages.
  - Hidden fields keep their values: 8 places.
  - The four `onSubmit` arguments: 6 pages, in two different orders.
  - Server errors: 4 pages.
  - The ownership boundary ("React Hook Form owns…, the application owns…"):
    about 10 pages.
- **Proposal:** Add one "How it works" page. Show the flow schema →
  definition → `kit.useForm` binding → React Hook Form → resolver →
  `onSubmit` in a diagram. Give each core rule one heading. Move the rule
  text from the FAQ to this page. On other pages, keep one sentence and a
  link.
- **Inspiration:** TanStack Query "Important Defaults", Diátaxis
  explanation pages.
- **Effort:** M.
- **Verification:** Partly confirmed. All counts in the first draft were too
  low. Move each rule. Do not copy it, or the page becomes one more copy.
  Land it with the anchor test from I10.

### I13. Troubleshooting Page and a Fixed FAQ

- **Problem:** There is no troubleshooting page. The FAQ has 15 questions
  organized by concept, not by symptom. Caveats are documented, but only in
  the matching guide and the API page, where a reader with a problem does not
  look:
  - `form.api.setValue` skips middleware and history
    (`middleware.mdx:137-139`, `api.mdx:522`, `history.mdx:38-39`).
  - `defaultValues` must be synchronous (`api.mdx:373`).
  - `delayError` is ignored after managed updates (`api.mdx:523-524`).
- **Proposal:** Add a Troubleshooting page with one entry for each symptom:
  "`onSubmit` is not called", "TypeScript rejects a path or control", "The
  transformed value is missing", "Middleware or history skips a change",
  "`delayError` is ignored". Each entry gives the cause in one sentence and
  links to the canonical section. Show the mistyped-path error from a
  typechecked snippet. Use `:::details` blocks.
- **Inspiration:** Next.js error pages, Vite troubleshooting.
- **Effort:** S.
- **Verification:** Partly confirmed. Do not copy the caveats. Link to
  them. Fix the FAQ parse answer (D6) at the same time.

### I14. Localization and Accessibility Guides

- **Problem:** Localization information is spread over five places:
  - `validation.mdx:139` (Zod messages).
  - `api.mdx:198-212` (default-slot i18n).
  - `api.mdx:241` (MUI i18n).
  - `form-kits.mdx:359`.
  - `context.locale` labels in `definitions.mdx:179`.
  The i18n key names differ between presets (`arrayAdd` in
  `src/default-slots/default-slots.tsx:48`, `addItem` in
  `src/preset-mui/index.ts:9-15`), and no page says so. Accessibility text
  is spread over about 10 pages. The custom-control contract exists in
  `recipes.mdx:352-372` and `form-kits.mdx:118-136`.
- **Proposal:** Add one "Localization" guide: `context.locale` labels, Zod
  `z.config`, Valibot `setGlobalMessage`, Yup `setLocale`, and the slot and
  MUI keys, with a note about the different key names. Add one
  "Accessibility" guide. Move the control contract into it and leave links
  in Recipes and Form kits.
- **Inspiration:** Valibot internationalization guide, React Aria
  accessibility pages, Conform accessibility guide.
- **Effort:** S.
- **Verification:** Partly confirmed. The first draft said no page lists the
  control contract. That was wrong: it exists, but it is hidden in Recipes.

### I16. A Get Started Page With a Visible Result

- **Problem:** The three-step form ends with `console.log`
  (`snippets/profile-form.tsx:39-42`), so step 3 has no visible result. The
  page then renders a large lab (`snippets/lab-profile-form.tsx`, 196 lines)
  with `createFormKit`, i18n, `superRefine`, `File`, and Tailwind CSS on the
  first page. The fix already exists: `snippets/playground-transform.tsx:27-45`
  is almost the same program with `useState` and a `<pre>` output.
- **Proposal:** Put the three steps in `:::steps`. Put the install command
  in `:::code-group` with npm, pnpm, yarn, and bun tabs. Show the submitted
  value in a `<pre>` and render the form live after step 3. Remove the lab
  from Get started and link to `/playground`. Keep `lab-profile-form.tsx`,
  because four other pages include its regions.
- **Inspiration:** Stripe quickstart, Tailwind CSS installation steps.
- **Effort:** S.
- **Verification:** Partly confirmed. Merge `profile-form.tsx` and
  `playground-transform.tsx`, or they will drift.

### I20. Task Cards and "Next Steps" Links

- **Problem:** Previous and next links follow the sidebar order, not the
  reader's task. Guides end without a task link (`get-started.mdx:103`,
  `definitions.mdx:475`, `persistence.mdx:142`). The overview benefit cards
  (`index.mdx:98-131`) describe features, not tasks. No page sets
  `searchPriority`.
- **Proposal:** Rewrite the overview benefit cards as task cards ("Validate
  with Valibot", "Use my design system", "Save a draft"). Do not add a
  second card grid. End each guide with a "Next steps" list of one or two
  task links. Set `searchPriority` higher on core guides and lower on complex
  examples.
- **Inspiration:** react.dev "Next steps", Stripe docs home, Vocs `Cards`.
- **Effort:** S.
- **Verification:** Partly confirmed. Vocs already ranks shallow pages
  higher (`vocs/src/internal/config.ts:971-983`). No multi-step page exists
  for a "Build a multi-step form" card; link to `/workflows`.

### I17. Glossary and One Term for One Concept

- **Problem:** Terms change from page to page:
  - Product name: "Form, Please" 58 times (26 of them in quotes) and
    "Form Please" 6 times.
  - "RHF" 74 times and "React Hook Form" 66 times. "RHF" is never
    expanded.
  - The editable data has several names: "schema input", "editable input",
    "form values", "editable values".
  - Internal words appear without definitions: "publication"
    (`recipes.mdx:147`), "node discriminator" (`definitions.mdx:12-13`).
  This breaks the STE rule "one term for one concept".
- **Proposal:** Add `/glossary` with one heading per term: managed update,
  proposal, transaction, schema input, publication, and React Hook Form
  (RHF). Write "React Hook Form (RHF)" at first use on each page. Use "Form,
  Please" only. Add a short exact-match denylist test for retired
  synonyms (for example "Form Please" and "managed change").
- **Inspiration:** Redux glossary, ASD-STE100 terminology control.
- **Effort:** S.
- **Verification:** Partly confirmed. All counts in the first draft were
  too low. "Proposal" and "transaction" are public API terms
  (`types.mdx:227`). Define them. Do not retire them.

### I01. Fix the Hero and Show Code Earlier

- **Problem:** On phones the hero breaks (D2), and code starts after several
  screens. At 1440 × 900 the playground starts at y = 629, so desktop readers
  see code on the first screen. The hero paragraph has six sentences. It
  uses "Standard Schema" without a link. The comparison table is three
  sections down (`index.mdx:137-147`).
- **Proposal:** Make the hero one column below 48 rem and make the logo
  smaller. Cut the paragraph to two sentences. Move the existing scenario
  playground up so that code and the live form show on the first screen of
  laptops and phones. Do not add a second snippet. Link "Standard Schema" to
  standardschema.dev. Use Vocs `InstallPackage` for the install command.
  Move the comparison table to directly after the playground.
- **Inspiration:** Stripe quickstart (code next to result), react.dev home.
- **Effort:** S.
- **Verification:** Partly confirmed. The first draft cited the Zod and
  Valibot home pages as code-first. They are not.

### I06. Examples Named by Technique

- **Problem:** 6 of the 11 example titles name a business domain
  ("Research grant", "Studio policies"). The title does not tell the reader
  what they learn. The 6 complex examples repeat one pattern: own kit,
  queries, a `form.api.watch()` preview, sequential mutations. The examples
  index is a text list. The Examples section has no example for async field
  `options` or `ui.render`.
- **Proposal:** Keep the URL slugs, because `docs-site/AGENTS.md` forbids
  redirects. Change the titles and sidebar labels to name the technique:
  - "Cross-row array validation" (Learning cohort).
  - "Multi-step wizard with context" (Makerspace launch).
  Make the examples index a Vocs `Cards` grid with `Badge` tags. Add a
  feature-to-example matrix that also links the guide demos. Merge the six
  complex examples into three. Add examples for async field options and
  `ui.render`.
- **Inspiration:** Vercel AI SDK templates, Motion examples gallery.
- **Effort:** M.
- **Verification:** Partly confirmed. `form.update`, middleware, and
  devtools already have live demos on their guide pages. Skip screenshots:
  nothing regenerates them.

### I09. Complete API Reference With One Entry Template

- **Problem:** `api.mdx` is one page of 3,930 words. It starts with
  `createDefinitionTester` and `useSnapshot`. The core API comes later.
  Entries do not share a structure. `createLocalStorageAdapter`,
  `createDateCodec`, and `FormPleaseDevtools` have no reference signature
  or props. 17 exported names appear on no page:
  - 8 MUI helper types.
  - 3 native-controls types.
  - 3 default-slots i18n types.
  - `FormPleaseDevtoolsProps`, `UsePersistenceResult`, and
    `UseHistoryResult`.
  `types.mdx:9` says all types import from `form-please`, but the page also
  lists subpath types.
- **Proposal:** Group the page by entry point. Put `form-please` first:
  `createFormKit`, then its kit methods `defineForm`, `useForm`, and `Form`.
  Give each runtime export the same parts: import, signature from a Twoslash
  snippet, parameters, return value, one example, and the related guide.
  Document the 17 names. Correct `types.mdx:9`. Fix D3 in the same change.
- **Inspiration:** Valibot API pages, viem reference.
- **Effort:** M.
- **Verification:** Partly confirmed. `defineForm` and `useForm` are kit
  methods, not package exports. Keep runtime detail in the guides so the
  template does not bloat the page.

### I12. Next.js App Router Guide

- **Problem:** No page covers Next.js App Router or Server Actions. The
  library omits the native `action` prop and calls `preventDefault` on
  submit (`src/create-form-kit.tsx:195-198,795-796`). Readers who expect
  Conform-style progressive enhancement need to know this. React Router is
  already covered (`workflows.mdx:110-124`).
- **Proposal:** Add one "Next.js App Router" guide. Show one typechecked
  program in a code group:
  - A shared schema.
  - A `"use server"` action that validates the input again with the same
    schema and returns issues.
  - A client form that calls the action from `onSubmit` and applies the
    issues with `setError`.
  Say that the form has no native `action` and no progressive enhancement.
  Link to the server-error sections in Recipes and Workflows.
- **Inspiration:** Conform Next.js guide, shadcn/ui forms with Server
  Actions.
- **Effort:** S.
- **Verification:** Partly confirmed. Pages for Vite and React Router would
  repeat existing content. Remove them from the proposal.

### I07. Preview and Code Side by Side, With Clean Snippets

- **Problem:** Example pages render the demo, then one full file of 470 to
  770 lines without regions. The overview already has a code-and-preview
  grid (`components/scripted-playground.client.tsx:101-115`), but no example
  uses it. 9 snippet regions contain demo-only code (`useClientReady`,
  `data-demo-client-ready`, `form-please-complex` classes), and pages
  include 7 of them. D9 hides the key call in the History region.
- **Proposal:** On example pages, show the key named regions in the
  existing code-and-preview grid. Put the full file in a `:::details` block,
  as `examples/async-multiselect.mdx:59-213` already does. Move the
  demo-only wrappers from the snippet regions into the demo client
  components. Make each region a complete unit.
- **Inspiration:** shadcn/ui Preview and Code tabs, Motion inline examples.
- **Effort:** M.
- **Verification:** Partly confirmed. Do not use Vocs `Tabs` for this: it
  renders nothing before hydration, so the static HTML and the Markdown
  output lose the content.

### I11. "Coming From React Hook Form" and a Sourced Comparison

- **Problem:** The library runs on React Hook Form, but no page maps React
  Hook Form code to Form, Please code. The overview comparison table has one
  date note (`index.mdx:151`) and no link for each row. The "28 kB" figure
  (`index.mdx:158`) has no breakdown for each entry point. No page says when
  not to use the library.
- **Proposal:** Add one page "Coming from React Hook Form". It maps
  `useForm`, `resolver`, `register`, `Controller`, `useFieldArray`, and
  `watch` to the builder-factory equivalents in typechecked snippets, and
  links to the FAQ and Recipes. Generate a gzip size table for each entry
  point with a pre-build script. Add source links to each comparison
  column. Add a short "When not to use it" section to the overview.
- **Inspiration:** Valibot "Migrate from Zod".
- **Effort:** M.
- **Verification:** Partly confirmed. Keep it a map with links. Do not
  repeat `faqs.mdx:157-183` or `recipes.mdx:41`.

### I08. Turn "Recipes" Into a Task Index

- **Problem:** `recipes.mdx` has 2,038 words and 16 production tasks. Its
  index table has one page link and no anchor links (`:19-36`). The
  middleware section (`:120-160`) and the resources section (`:315-334`)
  repeat their guides. The page has four React Hook Form version notes
  (`:101,164,184,203`).
- **Proposal:** Keep `/recipes` as one page, because other pages link to its
  anchors (`faqs.mdx:48,92,94,171,206`, `api.mdx:642`). Replace the table
  with Vocs `Cards` that link to section anchors, grouped by task: edit
  records, submit, server errors, remote data, custom controls, tests. Cut
  the middleware and resources sections to one paragraph and a link. Show
  the version minimum once. Add a "Dependent selects" recipe.
- **Inspiration:** Vercel AI SDK cookbook.
- **Effort:** M.
- **Verification:** Partly confirmed. The accessibility and testing
  sections are not duplicates; they have no other home yet (see I14).

### I15. Fix the LLM Files and Turn On Page Actions

- **Problem:** The production `llms.txt` links are broken (D1). All 33 pages
  set `showAskAi: false`. The native Vocs Ask AI menu cannot simply be turned
  on: it builds `/assets/md/...` and page URLs without the base path
  (`vocs/dist/react/internal/markdown-url.js:3`, `AskAi.js:50`), so every
  action would fail on `/form-please/`. The LLM links sit in the Reference
  group. Context7 does not list the library.
- **Proposal:** Fix the base path in the `llms.txt` links. Fix the Vocs
  base-path bug through a patch or an upstream pull request. Then remove
  `showAskAi: false` from guide pages, and keep it on the playground and demo
  pages, where the floating bar covers the demos. On `/ai-agents`, add one
  copyable prompt and the `llms.txt`, `llms-full.txt`, and per-page Markdown
  URLs. Submit the library to Context7. Do not add an MCP server while the
  site is full-static.
- **Inspiration:** Mintlify contextual menu, Vercel AI SDK "Copy markdown",
  Motion AI Kit.
- **Effort:** S.
- **Verification:** Partly confirmed. The first draft said 10 pages; the
  real count is 33. The base-path bug is the real blocker. The skill
  content is described on `ai-agents.mdx:9-11`.

### I10. Automated Docs Accuracy Gates

- **Problem:** Tests check that phrases exist, not that the docs are
  accurate. Nothing checks that exports are documented or that anchors
  resolve. The route list is copied in three places (`vocs.config.ts`,
  `tests/content.test.mjs`, `tests/build-output.test.mjs`), and the copies
  already differ (D12).
- **Proposal:** Add four tests to the existing `node:test` setup:
  1. Each name exported from `src/**/index.ts` appears on `api.mdx` or
     `types.mdx`. Land it with I09.
  2. Each internal `#anchor` in `dist/public` matches an id on its target
     page.
  3. The page list comes from `src/pages/**/*.mdx` and is checked against
     the sidebar and `assets/md`.
  4. Each API name in the bullets of an example page appears in its snippet.
- **Inspiration:** Starlight links validator, TypeDoc validation.
- **Effort:** S.
- **Verification:** Partly confirmed. A prototype of test 1 works and
  reports the 17 missing names. Test 4 catches D4. Tests 1 to 3 do not catch
  D4 or D6.

### I03. Share Links for the Playground

- **Problem:** Playground edits are lost on reload. A reader cannot send an
  edited form to a colleague or attach a reproduction to an issue. The
  scenario choice already persists in `?scenario=`.
- **Proposal:** Encode the editor source in the URL hash with the browser
  `CompressionStream` API. Add a "Copy link" button. Add "Open in
  playground" only to the full-file snippets that use the modules the
  runtime exposes (`profile-form`, `lab-profile-form`, `form-kits-control`,
  `workflow-review`, `workflow-server-issues`).
- **Inspiration:** TypeScript playground, Valibot playground.
- **Effort:** S for the share link, M with the buttons.
- **Verification:** Partly confirmed. Example snippets import MUI, Yup,
  Valibot, and TanStack Query, which `src/lib/playground-runtime.ts` does not
  expose. Buttons on all examples are not possible without a much larger
  runtime.

### I02. Kit and Schema Switcher in the Playground

- **Problem:** The overview says the library works with any Standard Schema
  and with your design system (`index.mdx:106-115`). No page shows one
  definition in several kits in one view. The playground exposes only the
  native kit and Zod.
- **Proposal:** Add a "Portable definition" playground scenario with two
  selects: kit (native, shadcn, MUI) and schema (Zod, Valibot, Yup). Each
  combination is one typechecked snippet file. All combinations use the same
  definition with the shared controls. Load kit modules and types only when
  the reader selects that kit. Show a diff of the changed lines.
- **Inspiration:** uniforms playground, react-jsonschema-form playground.
- **Effort:** L.
- **Verification:** Partly confirmed. This has the highest "wow" score, but
  it costs the most. The shadcn kit is local docs code, not a package.
  `@mui/material` ships 614 `.d.ts` files for Monaco. Only the shared
  controls (text, textarea, select, checkbox, number, date, time, file) are
  portable.

### I18. Inspect Panel on Live Demos

- **Problem:** Only the Get started lab shows live values, errors, and dirty
  and touched state (`components/interactive-lab.client.tsx:105-150`).
  Example demos hide the state while the reader types.
- **Proposal:** Move the lab inspector into a shared, collapsed "Inspect"
  panel. Add it to each example demo. Show the last managed update from a
  docs-only observer middleware. Keep the wiring outside the included
  snippet regions. Link to `/devtools` for the full view.
- **Inspiration:** react-jsonschema-form live form data pane, XState
  visualizer.
- **Effort:** M.
- **Verification:** Partly confirmed. `FormPleaseDevtools` cannot be reused
  in a card: it is a fixed-position portal launcher with only `form` and
  `name` props (`src/devtools/devtools.tsx:47-53`).

### I19. "Start From My Schema" Instead of a Visual Builder

- **Problem:** The first draft proposed a visual form builder. The
  verification showed that readers already edit live forms on the overview
  and in the playground, and that the minimal definition is two `ui.field`
  calls (`snippets/playground-basic.tsx:12-20`). A builder would mirror every
  Zod check and control without a typecheck gate.
- **Proposal:** Do not build a visual builder. After I03, add a "Start from
  my schema" playground scenario: the reader pastes a Zod object, and the
  page writes `kit.defineForm` with one `ui.field` for each key and opens it
  in the editor.
- **Inspiration:** shadcn form builder (shadcn-form.com), React Hook Form
  Form Builder.
- **Effort:** M after I03. L for the original builder.
- **Verification:** Partly confirmed. The original idea has high
  maintenance cost and overlaps the playground.

## Scores

Each verifier scored its idea from 1 to 5 for **wow**, **findability**, and
**completeness without bloat**, and gave the effort. The script computed the
score:

```text
raw   = 0.30 × wow + 0.25 × findability + 0.20 × completeness + 0.25 × ease
ease  = 5 for S, 3 for M, 1 for L
score = raw / 5 × 100 × validity
validity = 1.0 (confirmed), 0.85 (partly), 0.4 (rejected)
```

All 20 ideas got the verdict "partly": each problem is real, but each first
draft had wrong counts, line numbers, or proposal details. The sections above
contain the corrections.

| Rank | Idea | Wow | Find | Complete | Effort | Score |
|---:|---|---:|---:|---:|:---:|---:|
| 1 | I04 Navigation by reader intent | 2 | 4 | 4 | S | 62 |
| 2 | I05 "How it works" single source | 3 | 4 | 4 | M | 59 |
| 3 | I13 Troubleshooting and FAQ | 2 | 4 | 3 | S | 59 |
| 4 | I14 Localization and accessibility | 2 | 4 | 3 | S | 59 |
| 5 | I16 Get started with a visible result | 3 | 2 | 4 | S | 59 |
| 6 | I20 Task cards and next steps | 2 | 4 | 3 | S | 59 |
| 7 | I17 Glossary and term control | 2 | 3 | 4 | S | 58 |
| 8 | I01 Hero fix and earlier code | 3 | 2 | 3 | S | 55 |
| 9 | I06 Examples named by technique | 3 | 4 | 3 | M | 55 |
| 10 | I09 Complete API reference | 2 | 4 | 4 | M | 54 |
| 11 | I12 Next.js App Router guide | 2 | 3 | 3 | S | 54 |
| 12 | I07 Preview and code, clean snippets | 3 | 3 | 3 | M | 51 |
| 13 | I11 Coming from React Hook Form | 3 | 3 | 3 | M | 51 |
| 14 | I08 Recipes task index | 2 | 4 | 3 | M | 50 |
| 15 | I15 LLM files and page actions | 2 | 2 | 3 | S | 50 |
| 16 | I10 Docs accuracy gates | 1 | 2 | 4 | S | 48 |
| 17 | I03 Playground share links | 3 | 2 | 3 | M | 47 |
| 18 | I02 Kit and schema switcher | 4 | 2 | 3 | L | 43 |
| 19 | I18 Inspect panel on demos | 3 | 1 | 3 | M | 43 |
| 20 | I19 Start from my schema | 3 | 1 | 2 | L | 31 |

### How to Read the Scores

The formula rewards low effort, so the top of the list is mostly
findability and completeness work. The strongest "wow" ideas (I02, I03,
I18) rank low only because they cost more. Two ideas rank lower than their
real value:

- **I10** has a low reader score, but it prevents defects D1 to D12 from
  coming back. Treat it as a requirement for I05, I09, and I17.
- **I15** looks small, but D1 breaks every `llms.txt` link today, and
  the AI agents page depends on that file.

## Recommended Order

1. **Defects (about 1 day):** D1 to D12. Decide D13.
2. **Findability (about 1 week):** I04, I20, I16, I01, I15, I10.
3. **Complete and not bloated (about 2 weeks):** I05, I09, I13, I14, I17,
   I08. Each one moves text. None of them copies text.
4. **Wow (about 2 to 3 weeks):** I06, I07, I03, I18, I02, then I11 and I12.
5. **Optional:** I19 after I03.
