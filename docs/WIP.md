# WIP: architecture cleanup

Branch `refactor/architecture-cleanup`, one PR. Source: the Claude + Codex
architecture review. Goal: easier maintenance without new abstractions.
Public contracts and runtime behavior stay the same, except the item 1 bug fix.
Delete this file before merge.

Status: `[ ]` todo, `[~]` in progress, `[x]` done, `[v]` verified by Codex.

## Items

1. [v] Array move/remove keep schema and external issues with their row.
   - `src/create-form-kit.tsx` `dispatchArrayAction`, tests in
     `src/array-reconcile.test.tsx`.
2. [v] Sync ADRs with the code.
   - 0002, 0009: mark Superseded with links to the current decisions.
   - 0004 (`extend` slots), 0005 (FormData serialization), 0011 (`extend`
     grid): add an amendment note for the stale part only.
   - 0016, 0017, 0018, 0019: add `Amended by: ADR 0025`.
   - Keep historical text.
3. [v] Sync `docs/ARCHITECTURE.md` with the code.
   - `FormBinding`: `actions`, `submission`, `setIssues`, `array`.
   - Arrays: `reconcile` and the mounted-array requirement.
   - Canonical module table: `form-issues.ts`, `array-reconcile.ts`,
     `form-value.ts`, `form-submission.ts`, and other missing modules.
4. [v] Extract `src/form-submission.ts` from `src/create-form-kit.tsx`.
   - Move `createFormSubmissionRuntime`, `SubmitHandlerRejection`, and
     submitter helpers. Pass narrow capabilities, not the full `RuntimeForm`.
   - No new public exports.
5. [v] Split `src/create-form-kit.test.tsx`.
   - Move the `whenHidden`, `errorDisplay`, and submit-actions `describe`
     blocks to their own files, then arrays and focus from the main block.
   - Keep fixtures small and local; no shared fixture factory.
6. [v] Extend `src/testing/definition-render-parity.test.tsx` to array
   append, move, and remove (values, transaction source, patches).
7. [v] `npm run verify` builds once.
   - Keep standalone `test:types`, `test:package`, `package:check` with build.
   - Check `.github/workflows` for the same pattern.
8. [v] Share only the one-feature-per-form claim helpers of history and
   persistence. Keep separate factories and snapshot policies.

## Out of scope (rejected in review)

- `useConstant` helper for `useForm` lazy refs.
- Generic `createCoordinatorFeature` factory.
- Splitting `types.ts` or `create-form-kit.tsx` beyond item 4.

## Log
- 2026-10-14: branch created from `origin/main`, item 1 carried over.
  Subagent zones: docs (2, 3); submission (4); tests (5, 6); infra (7, 8).
  Codex reviews in peer room `arch-cleanup`.
- Codex verified item 1 (18/18 in `array-reconcile.test.tsx`).
- Item 4 done: `form-submission.ts` (244 lines), `create-form-kit.tsx`
  2352 → 2161 lines. `getRuntime` replaced by narrow `getForm` (api
  `getValues`/`handleSubmit`, `focusIssue`, `focusErrorSummaryFallback`).
  Type-only import from `create-form-kit.ts`, no runtime cycle. Awaiting Codex.
- Items 2, 3 done: ADR 0002, 0009 Superseded (link ADR 0015 and ARCHITECTURE
  "Form-kit ownership"); 0004, 0005, 0011 amended; 0016–0019 already had
  `Amended by: ADR 0025`. ARCHITECTURE: binding fields, `reconcile`, module
  table. Open question: ADR 0005 also names `setValue`/`setValues`/`unsetValue`
  commands that no longer exist. Awaiting Codex.
- Codex verified item 4 (submit-actions + focus 21/21, check, knip).
- Items 7, 8 done. New `package:lint` (publint + attw, one entrypoint list);
  `package:check` = build + `package:lint`; `verify` builds once and calls
  `typecheck`, package vitest, `package:lint` directly. Workflows unchanged
  (they call `verify`). `claimFeature`/`readFeatureClaim` in
  `value-middleware.ts`. Main fixed `tests/package/package-metadata.test.ts`
  to read `package:lint`. Awaiting Codex.
- Items 5, 6 done. `create-form-kit.test.tsx` 3587 → 2079 lines; 63 tests
  before and after across `create-form-kit`, `when-hidden-react`,
  `form-error-display`, `form-submit-actions`, `generated-array`, `form-focus`
  test files. Shared `kit`/`schema`/`definition` moved verbatim to
  `src/test-fixtures.tsx`. Parity: `it.each` over append/move/remove compares
  values, `nextValues`, `patches`, `source`. Awaiting Codex.
- Codex verified item 3. Item 2: main extended the ADR 0005 amendment (command API and registered-field gate replaced by `form.api` / `form.update`, ADR 0016). Awaiting Codex recheck.
- Full verify (main): check, test (31 files / 272 tests), build, typecheck,
  package vitest (28/28), registry, smoke, `package:lint`, knip pass.
  `test:browser` blocked: local Playwright Chromium binary is missing
  (`npx playwright install` not run). CI runs it.
- Codex verified items 2 (after ADR 0005 fix), 5, 6, 7, 8 (131/131 targeted tests). All items verified.
- `test:browser` passes locally (5/5) after installing Playwright Chromium. Full verify is green.
