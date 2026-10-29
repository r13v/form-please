# Form Please Devtools

`form-please/devtools` exports `FormPleaseDevtools`, an optional read-only development instrument. React Hook Form DevTools shows the state that React Hook Form owns. Form Please Devtools shows why Form, Please resolved, rendered and changed the form: resolved UI, issue routing, managed updates, asynchronous options and the configured managed features. ADR `docs/adr/0024-add-form-please-devtools.md` explains the decision. The site page `docs-site/src/pages/devtools.mdx` owns user guidance and the drawer views.

## Read-only instrument

`FormPleaseDevtools` receives the form binding. It needs no ID, middleware, provider or store. It mounts the public `DevTool` of `@hookform/devtools` with `form.api.control` and does not deep-import or copy the private UI of React Hook Form DevTools.

The component does not add middleware and does not become a form store. React Hook Form stays the only live store and value authority. The devtools cannot edit state, submit, seek history or run persistence operations.

Applications render the component only in development. The root entry, the presets, history and persistence do not import `src/devtools`, so they do not load the devtools UI or its store.

## Dormant without a sink

The core publishes diagnostic events through `src/diagnostics.ts`. Each publication site first checks `hasFormDiagnosticSink` for the exact coordinator capability. Without a mounted devtools component, the runtime keeps no event journal, does not time definition resolution and does not copy option dependencies. The devtools therefore cost nothing in a production form that does not mount them.

The devtools store in `src/devtools/store.ts` attaches its sink and its React Hook Form values subscription when the component mounts. It releases them when the last mounted instance for the form unmounts. The store also records raw React Hook Form value publications outside a managed commit, so a direct `form.api` change is visible next to managed updates.

## Private runtime capability

The devtools read package-private data from the binding through `getFormDiagnosticsRuntime` in `src/diagnostics.ts`. The data is attached with a symbol key and is not part of the public `FormBinding` type. The component throws for an object that is not a current Form, Please form binding.

## Retention

The store keeps a bounded number of updates and of transitions for each feature. The limits are `maxUpdates` and `maxFeatureTransitions` in `src/devtools/store.ts`. The store shows local raw values, context, patches and errors without JSON serialization.

## Features

The Features view lists each diagnostic adapter that a managed feature registered, under its `label`. The devtools do not import the history or persistence entries. A new managed feature appears without a devtools change; `managed-features.md` § Diagnostic adapter owns the adapter contract.

## Not provided

The devtools have no export, remote transport, sanitizer, state editing, forced submit, history seek, persistence operation, validation trace, generic React profiler or production monitoring contract. Add such a capability only after its safety and lifecycle have an explicit design.
