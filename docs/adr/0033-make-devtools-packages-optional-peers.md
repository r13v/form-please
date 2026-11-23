# ADR 0033: Make the devtools packages optional peers

- Status: Accepted
- Date: 2026-11-23
- Amends: [ADR 0024](0024-add-form-please-devtools.md)

## Context

`form-please/devtools` is the only entry that imports `@hookform/devtools` and `@uiw/react-json-view`. Both were direct dependencies, so every application installed them, with an alpha version of the JSON viewer and its `@babel/runtime` peer, also when it did not import the devtools entry. `@babel/runtime` was a direct dependency only to satisfy that peer; no built file imports it.

`package.json#engines` declared `node: ">=24"` for a library that runs in browsers. The field applies to each consumer install. A check with a package whose `engines.node` excludes the running Node.js gave these results:

- npm prints an `EBADENGINE` warning and installs the package. It fails only with the `engine-strict` configuration (https://docs.npmjs.com/cli/v11/configuring-npm/package-json#engines).
- pnpm prints a warning and installs the package. It fails only with `engineStrict` (https://pnpm.io/settings/cli).
- Yarn 1 stops the install with "The engine "node" is incompatible with this module" unless `--ignore-engines` is given (https://classic.yarnpkg.com/en/docs/cli/install).
- Yarn 4 installs the package without a message.

So the field blocked Yarn 1 applications that build on an older Node.js, and it gave a warning to npm and pnpm applications, for no runtime reason.

Immer had an exact version, so an application with another Immer 11 version installed and bundled a second copy.

## Decision

- `@hookform/devtools` and `@uiw/react-json-view` are optional peer dependencies with a caret range, as Material UI is in ADR 0013, and dev dependencies of the repository.
- `@babel/runtime` is not a dependency. The package manager of the application resolves it as the peer of `@uiw/react-json-view`.
- The manifest has no `engines`. The repository Node.js version is in `.nvmrc`, which the workflows read, and in `package.json#devEngines`, which npm checks before `install`, `ci` and `run` in this repository only.
- Immer has a caret range.

## Considered options

- Keep the devtools packages as direct dependencies. The dependency rule keeps them out of the bundle, but not out of the install and the audit of each application.
- Move the devtools to a companion package. This removes the peers from the manifest, but adds a second release and compatibility lifecycle.
- Keep `engines` with a lower range. Any range is a claim about consumer builds that the library cannot make, and Yarn 1 enforces it.

## Consequences

- An application that imports `form-please/devtools` must install the two packages. The import fails without them; the root entry and the other entries do not need them. The smoke fixtures `tests/fixtures/node-esm` and `tests/fixtures/node-cjs` assert both.
- npm and pnpm do not install optional peers automatically, so the upgrade page names the install command.
- Yarn 1 does not install a missing non-optional peer such as `@babel/runtime`; a Yarn 1 application that uses devtools installs it too.
