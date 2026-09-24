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
