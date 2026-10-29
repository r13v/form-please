# Architecture overview

Form, Please is a React integration over React Hook Form (RHF). This document owns the system boundary, the public entries and the dependencies that each entry may reach.

## Owners

- Standard Schema owns input validity, issues and the transformed submit output.
- RHF owns the editable values, field metadata, validation scheduling, subscriptions, submission state, context and array operations.
- Form, Please owns the typed UI definitions, definition resolution, generated fields, the coordination of managed value updates, controls, slots and accessibility wiring.
- The application owns the product workflow, requests, caches, authorization, storage, server transport and visual design.

## No separate store

Form, Please has no form store, reducer, command model, server protocol or validation cache of its own. RHF is the only owner of live values.

- The managed-update coordinator proposes a change and commits it to RHF. It keeps no live values. `managed-updates.md` owns its contract, and `docs/adr/0016-coordinate-managed-value-updates-before-react-hook-form.md` gives the reason.
- Managed value history keeps independent input snapshots for navigation only.
- Form persistence encodes and transports the current editable input only.
- Form Please Devtools only reads. It adds no middleware and keeps no state that the form reads back.

A new feature that needs per-form state is a managed feature and does not add state to the form binding; see `managed-features.md`.

## Public entries

`package.json#exports` is the list of public entries. `scripts/package-entries.mjs` derives the JavaScript entries from it, and `releases-and-compatibility.md` says which tools read that list. The root entry has its source in `src/index.ts`, and each subpath entry has an `index.ts` in the `src` folder of the same name. The `layout.css` and `package.json` exports are not code entries.

Default slots, native controls and presets use the core modules. They do not define a second runtime.

## Dependency rules

`tests/package/build-output.test.ts` checks these rules on the built output. Read it for the exact assertions.

- The root entry reaches RHF and Immer. It must not reach devtools code, `@hookform/devtools`, `@uiw/react-json-view`, Material UI, history code or persistence code. An application that imports only the root does not pay for an optional feature.
- Only `form-please/devtools` reaches the RHF DevTools and the JSON viewer. These packages are direct dependencies, so the rule above is what keeps them out of an application that does not use devtools.
- Only `form-please/preset-mui` reaches Material UI. Material UI and Emotion are optional peers for this reason; `docs/adr/0013-ship-material-ui-as-an-opt-in-preset.md` gives the decision.
- `form-please/history` and `form-please/persistence` reach React and the coordinator. They do not import RHF directly; they change values only through the coordinator.
- Immer is a direct dependency because the coordinator produces Immer patches for every managed update.

## Client and server modules

Every React entry starts with a `"use client"` directive. `form-please/testing` is a headless, server-compatible entry: it has no `"use client"` directive and does not import React or React DOM. It uses the same definition resolver and coordinator as the React runtime, so a headless test exercises production code. Do not add a React import to the graph of the testing entry.
