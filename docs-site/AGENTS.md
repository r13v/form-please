# Form, Please Docs Site

- This is an English-only Vocs site with clean path routes for static GitHub Pages.
- Use STE skill
- Keep authored pages in `src/pages` and let Vocs own navigation, search,
  syntax highlighting, Markdown output, and static rendering.
- Complete copyable TypeScript programs live as physical snippets under
  `src/snippets` once the snippet migration task creates them.
- Use `ts` or `tsx` fences for TypeScript examples. Never downgrade code to
  `text` or use `// ---cut---` to hide setup; move that setup to a typechecked
  physical snippet under `src/snippets` and include only its named region.
  Reserve `text` fences for non-code diagrams, formulas, and plain output.
- Docs examples and interactive components must use public package imports from
  `form-please`, not source imports or mocked APIs.
- Author every definition and fragment with the builder factory
  (`defineForm(schema, (ui) => [ui.field(...)])`). Never show the object form
  (`{ ui: [...] }` with `kind` nodes) in pages, snippets, or components. Share
  repeated UI with `defineFragment`, not with separate node lists.
- Do not add an OpenAI Sites worker, `.openai/hosting.json`, redirects, a custom
  domain, analytics, API routes, or a server runtime.
- The overview and `/playground` share the scenario programs in
  `src/snippets/playground-*.tsx`. Each file is one complete, self-contained
  program that exports a component; the overview renders it, Twoslash displays
  it, and the live editor loads it through `?raw`. Lines that start with `// @`
  or `// ^?` are Twoslash directives and are stripped from the editor source.
  `playground-typo.tsx` fails on purpose and is excluded in
  `tsconfig.docs.json`; keep its `// @errors:` codes in sync with `tsc`.
- `vocs markdown-audit` loads every MDX component with `tsx` in Node. Modules
  that a page component imports statically must not use Vite-only syntax such
  as `?raw`, `?worker`, or `import.meta.glob`; load those lazily from client
  code (see `src/lib/playground-sources.ts`). Components with children cannot
  use `toMarkdown`; give them a Markdown representation through
  `markdown.outputRemarkPlugins` in `vocs.config.ts` instead.
- The live playground evaluates editor code in the browser with Sucrase and
  exposes only the modules listed in `src/lib/playground-runtime.ts`. The
  editor is Monaco; `src/lib/playground-monaco.ts` configures it with the
  declaration files collected in `src/lib/playground-types.ts` through
  `import.meta.glob(..., { exhaustive: true })`. Add a `paths` entry there
  when a new package must resolve.
- `src/pages/how-it-works.mdx` is the single home of the core rules:
  the React Hook Form API, `required` is UI-only, hidden fields keep their
  values, the kit grid, the schema parses once on submit, the `onSubmit`
  values, server issues, and ownership. Other
  pages keep one sentence and a link to the rule anchor. Move text; do not
  copy it.
- `src/pages/accessibility.mdx` owns the custom control and slot accessibility
  contract (the `production-recipes.tsx:accessible-control` region).
  `src/pages/localization.mdx` owns label, schema-message, and kit `i18n`
  guidance. `src/pages/validation.mdx#focus-the-first-issue` owns the focus and
  error-summary behavior. Other pages link to them.
- Use the terms in `src/pages/glossary.mdx`. Write "Form, Please" without
  quotes, "React Hook Form (RHF)" at the first mention on each page, and
  "managed update". `tests/content.test.mjs` denies "Form Please" and
  "managed change" in prose (code, inline code, imports, and link targets are
  ignored). Quote the devtools UI label `Form Please Devtools` in inline code.
- End each guide page (Learn, Build, Advanced, and Troubleshooting) with a
  `## Next steps` list of one or two task links. Reference pages have none.
- Give each troubleshooting symptom its own `##` heading, not a `:::details`
  block, because Vocs search indexes headings only.
- Routes come from `src/pages/**/*.{md,mdx}` through `tests/pages.mjs`. Do
  not copy a route list into a test. A new page must be in the sidebar; the
  route, Markdown-output, anchor, export-coverage, and example-claims gates
  then cover it. Document each new public export in inline code in `api.mdx`
  or `types.mdx`.
- In `vocs.config.ts`, Vocs serializes each topNav `match` function with
  `toString()`, so it must not read outer variables. The Docs tab matches by
  exclusion: add a page of the Examples or API tab to the Docs regex too. The
  config is bundled into `dist/server`, so import data (such as the root
  `package.json` version) and do not read files at run time. Use
  `searchPriority: 2` on core pages and `0.5` on the complex examples.
- Run `npm run site:verify:preview` from the repository root as the full docs
  gate: the content and postbuild tests, the snippet typecheck, the snippet
  Vitest tests (`vitest.docs.config.ts` runs each snippet that imports
  `vitest`), a `BASE_PATH=/form-please` build, the Markdown audit, the output
  tests, and e2e. To run `test:output` alone, set the same `BASE_PATH` as the
  build.
- `postbuild` runs `scripts/fix-vocs-skip-links.mjs` and
  `scripts/fix-vocs-llms-links.mjs`. The second script adds the base path to
  root-relative links in `llms.txt`, `llms-full.txt`, and
  `assets/md/**/*.md`, outside code, and replaces the
  `import.meta.env.BASE_URL` templates that MDX JSX leaves there. Keep `showAskAi: false` on all pages until Vocs fixes
  its Ask AI base-path bug. Do not patch the `vocs` dependency.
