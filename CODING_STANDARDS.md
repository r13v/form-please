# Coding standards

Reviewers check each change against these rules. A rule that a tool can check
belongs in a lint rule, a type, or a test instead of this file.

## Guards

A new runtime guard rejects one kind of input. Add a test for each rejected
case and a test for each nearby case that the guard must accept. For example,
a guard on array row counts needs a test that edits a value inside a row.

## Documentation

A change to observable behavior can make a docs-site page stale. Search
`docs-site/src/pages` for the old behavior and update each page that
describes it, including the API, TypeScript, testing, and devtools pages.
