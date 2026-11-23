# ADR 0030: Prefix thrown errors with stable codes

- Status: Accepted
- Date: 2026-11-23

## Context

The library throws `TypeError`, `RangeError`, `Error`, `AggregateError` and `FieldOptionsContractError` with a message only. An application developer or a coding agent had to search the troubleshooting page by message text, and an application that handled one error compared the message text. A change of a message, also a clarification, could therefore break an application.

## Decision

- Each message that the library throws starts with a code in brackets, `[FPnnn]`. `errorMessage` in `src/error-codes.ts` builds the prefix.
- `errorCodes` in `src/error-codes.ts` is the only registry. The hundreds digit names a group: form kits and components, definitions, submission, managed updates, history, persistence, devtools and testing. A new error takes the next free number of its group.
- A code keeps its meaning. The library does not renumber a code and does not give the number of a removed error to a new error.
- Each code has an entry on `docs-site/src/pages/troubleshooting.mdx`. The heading is the code, so the anchor is the code in lowercase.
- The error classes do not change. The code is in the message only.
- Gates: `src/error-codes.test.ts` fails when a thrown error in `src` has no registered code or when a registered code is not thrown. `docs-site/tests/content.test.mjs` fails when the registered codes and the troubleshooting entries differ.

## Considered options

- Add a `code` property to each error, or one error class with a code. This changes the error classes that applications already check with `instanceof`, and a property is not visible in a log line that prints only the message.
- Keep message text only and document each message. Applications keep matching on text, so a message change stays a breaking change.
- Use a code only for a selected group of errors. A developer then cannot know whether an error has an entry.
- Generate the troubleshooting entries from the registry. The cause and the fix need prose, and the gate already keeps the page and the registry in sync.

## Consequences

- An application or a test matches the code, and the text after the code can change in a minor version.
- Adding the prefix is a breaking change for code that compares the start of a message; the upgrade page names the fix.
- A new thrown error needs a registry entry and a troubleshooting entry in the same change.
