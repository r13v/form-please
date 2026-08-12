# ADR 0013: Ship Material UI as an opt-in preset

- Status: Accepted
- Date: 2026-08-02
- Amends: [ADR 0001](0001-styling-and-layout-boundary.md)

Material UI is a versioned npm component library with a stable public contract,
so Form, Please ships an official integration from
`form-please/preset-mui`. The entry exports `createMuiFormKit`, owns the Material
UI controls, structural slots, and grid integration, and declares Material UI
9 and its default Emotion styling engine as optional peer dependencies.

The preset does not provide a `ThemeProvider`, `CssBaseline`, or application
theme. Applications continue to own visual defaults and may pass supported
Material UI presentation props through their form definitions.

## Considered Options

- An application-owned adapter would preserve ADR 0001 without qualification,
  but it would not provide the official, ready integration requested for a
  versioned component library.
- A companion package would isolate the dependencies more completely, but it
  would add a second release and compatibility lifecycle to this repository.
- A preset-owned theme would make the first render more uniform, but it would
  compete with the consuming application's Material UI configuration.

## Consequences

- Applications that do not import `form-please/preset-mui` do not load Material
  UI, and the base package does not require its optional peers at runtime.
- Importing the preset requires a compatible Material UI 9 installation with
  the supported Emotion packages.
- Form, Please owns compatibility testing for the public preset API, while the
  consuming application owns theme configuration and brand styling.
