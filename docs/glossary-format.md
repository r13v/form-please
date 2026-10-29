# CONTEXT.md format

`CONTEXT.md` is the domain glossary and nothing else. It sets the canonical English terms for code, the docs site, error messages and documents.

## Structure

```md
# {Context name}

{One or two sentences: what this context is and why it exists.}

## Language

**Form binding**: {Definition of the term in one or two sentences.}
_Avoid_: Form store, runtime instance
```

Use subheadings inside `## Language` only when the terms naturally fall into groups; otherwise use a flat list.

## Rules

1. **One term per concept.** If people use several words for a concept, choose the canonical one and list the others in `_Avoid_`. Separate similar concepts explicitly: each gets its own term and an `_Avoid_` with the neighbour's term, such as History restore and Persistence restore.
2. **A definition is one or two sentences.** State what the concept is, not everything it does.
3. **Domain terms only.** General technical concepts, implementation details, requirements and architecture decisions do not go here; they have their own owners (`documentation-rules.md`). Before you add a term, ask whether it is unique to the Form, Please domain or a general concept.
4. **Language: English**, like all documentation. The docs site uses glossary terms verbatim; `docs-site/src/pages/glossary.mdx` is the user-facing glossary.
5. **A human decides the term.** Record a new term or a change of meaning after the user decides or explicitly delegates the choice.

## When to update

Update it in the same change as the code if the change:

- introduces a new domain concept that an application developer sees, such as a managed update source or a feature;
- renames a concept in the public API, an error message or the docs site;
- changes the meaning or boundary of a term;
- makes a word from `_Avoid_` necessary or finds a new competing word.

After a glossary edit, check that the public API, the docs site and the documents name the concept with the new term.
