# Form Please Devtools

`form-please/devtools` exports `FormPleaseDevtools`, an optional read-only development instrument. React Hook Form DevTools shows the state that React Hook Form owns. Form Please Devtools shows why Form, Please resolved, rendered and changed the form. ADR `docs/adr/0024-add-form-please-devtools.md` explains the decision. The site page `docs-site/src/pages/devtools.mdx` owns user guidance, the drawer views, the retention limits and the data boundary.

## Read-only instrument

`FormPleaseDevtools` mounts the public `DevTool` of `@hookform/devtools` with `form.api.control` and does not deep-import or copy the private UI of React Hook Form DevTools.

The component does not add middleware and does not become a form store. React Hook Form stays the only live store and value authority.

The root entry, the presets, history and persistence do not import `src/devtools`, so they do not load the devtools UI or its store.

## Dormant without a sink

The core publishes diagnostic events through `src/diagnostics.ts`. Each publication site first checks `hasFormDiagnosticSink` for the exact coordinator capability. Without a mounted devtools component, the runtime keeps no event journal, does not time definition resolution and does not copy option dependencies.

The devtools store in `src/devtools/store.ts` attaches its sink and its React Hook Form values subscription when the component mounts. It releases them when the last mounted instance for the form unmounts. The store also records raw React Hook Form value publications outside a managed commit, so a direct `form.api` change is visible next to managed updates.

## Private runtime capability

The devtools read package-private data from the binding through `getFormDiagnosticsRuntime` in `src/diagnostics.ts`. The data is attached with a symbol key and is not part of the public `FormBinding` type.

## Retention

The retention limits are `maxUpdates` and `maxFeatureTransitions` in `src/devtools/store.ts`; the site states them. The store keeps local raw values, context, patches and errors without JSON serialization.

## Features

The Features view lists each diagnostic adapter that a managed feature registered, under its `label`. The devtools do not import the history or persistence entries. A new managed feature appears without a devtools change; `managed-features.md` § Diagnostic adapter owns the adapter contract.

## Scope

The site lists what the devtools do not provide. Add export, transport, state editing, forced submit, history seek, persistence operations or production monitoring only after its safety and lifecycle have an explicit design.
