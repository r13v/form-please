# Releases and compatibility

This document owns the version policy, the supported React Hook Form (RHF) range and the checks that protect the published package.

## Versions

- The version policy and the supported React and RHF versions for users: `docs-site/src/pages/get-started.mdx`.
- release-please owns the package version and `CHANGELOG.md` (`.github/workflows/publish.yml`). Do not set the version by hand and do not edit `CHANGELOG.md`. `tests/package/package-metadata.test.ts` makes sure that `package.json` has no `version` script.
- Mark a breaking change with `!` after the commit type and a `BREAKING CHANGE:` footer. release-please reads them to select the next major version.
- Squash-merge a PR with a conventional PR title. GitHub uses the title as the subject of the squash commit, and release-please parses only that subject and its footers, not the messages of the branch commits. `.github/workflows/pr-title.yml` rejects a title that is not a conventional commit header. When a merged PR needs other release notes or several entries, add a `BEGIN_COMMIT_OVERRIDE` … `END_COMMIT_OVERRIDE` block to its description and rerun the latest Publish run on `main`; release-please reads the block in place of the subject.
- A breaking change also adds an entry to `docs-site/src/pages/upgrade-to-v2.mdx` while the 2.x line is current. The owner of this rule is `documentation-rules.md` § Docs site coupling.

## React Hook Form range

RHF is a required peer with a caret range in `package.json#peerDependencies`. The range is the source of the minimum version. Site pages state the minimum for users, starting with `docs-site/src/pages/get-started.mdx`. A change of the range updates each site page that names the old minimum; grep `docs-site/src/pages` for it.

- The minimum is the lowest RHF version on which the complete unit suite passes. Older versions break generated array validation, external issues and `whenHidden` resets. Raise the minimum when `npm run rhf:minimum` followed by `npm test` fails and the fix needs a newer RHF.
- The runtime depends on specific RHF behaviour, for example how `setValues` merges top-level keys and which calls keep `useFieldArray` row IDs. `src/rhf-contract.test.tsx` pins each assumption in one test, and each test name says which part of Form, Please depends on it. When an RHF upgrade fails one of these tests, revisit that part.
- The `react-hook-form-range` job in `.github/workflows/ci.yml` runs the unit tests twice: on the lowest and on the highest RHF version that the range allows. `npm run rhf:minimum` and `npm run rhf:maximum` (`scripts/install-rhf.mjs`) install that version without a second lockfile. The script requires a caret range.

## Package entries

`scripts/package-entries.mjs` derives the JavaScript entries from `package.json#exports`. The build (`tsdown.config.ts`), knip (`knip.config.js`), `tests/package/build-output.test.ts` and the docs-site gates read it, so they cannot drift from the published list. The `package:lint` script lists the entries for attw itself; `tests/package/package-metadata.test.ts` fails when that list differs from `package.json#exports`. For what each entry may import, read `architecture-overview.md` § Dependency rules.

To add an entry, add it to `package.json#exports`, create `index.ts` in the `src` folder of the same name, and add the entry to the `package:lint` script.

## Published package checks

- `npm run package:lint` runs publint in strict mode and attw with the node16 profile on every entry. These tools find export conditions and type declarations that resolve differently in ESM and CommonJS consumers.
- `npm run test:smoke` (`scripts/verify-smoke-fixtures.mjs`) installs the packed package into the projects in `tests/fixtures` and builds or runs each one. The fixtures cover React 18, React 19, Next.js, and plain Node with ESM and CommonJS, which unit tests cannot cover. The React 18 fixture pins the RHF peer minimum.
- `npm run verify` runs all of these checks, and the `verify` job in `.github/workflows/ci.yml` runs it.
- The tarball contains `dist/docs`, the site pages as Markdown for coding agents. The docs-site `postbuild` writes it with `scripts/build-agent-docs.mjs`, and `npm run build` deletes it with the rest of `dist`. So a publish needs a site build after the last package build: `npm run site:verify` in `.github/workflows/publish.yml` is that build, and the `prepublishOnly` script stops a publish whose `dist/docs` has a different version. The user contract: `docs-site/src/pages/ai-agents.mdx`.

## Type instantiation budget

`npm run typecheck:budget` (`scripts/check-type-budget.mjs`) fails when the TypeScript instantiation count of the project exceeds a fixed budget. The budget value lives in that script.

The deep path types and the schema-bound node scope types grow the work of the type checker a little with each change. The growth slows down the editor and the type check of every application that uses the library, and no single change shows it. The budget makes each increase a reviewed decision. Raise it only on purpose, in the change that needs it, and say why.
