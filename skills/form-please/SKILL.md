---
name: form-please
description: Build and maintain schema-validated React forms with Form, Please. Use when implementing, reviewing, debugging, or explaining code that uses Form, Please.
---

# Form, Please

Before working with Form, Please, read its documentation in this order:

1. If the project has `node_modules/form-please/dist/docs/SKILL.md`, read it.
   It is the documentation of the installed version: an index of pages with
   a description of each page. Read the pages in
   `node_modules/form-please/dist/docs/references/` that concern your task,
   and follow their relative links. In a monorepo, look for the package in
   the `node_modules` of the workspace that uses it.
2. Otherwise, read the
   [documentation index](https://r13v.github.io/form-please/llms.txt) and the
   pages that it lists for your task. These pages describe the latest
   release. Fetch them with your web tool or with an HTTP client, such as
   `curl -fsSL https://r13v.github.io/form-please/llms.txt`. If a tool
   rejects a page Markdown URL, read
   [llms-full.txt](https://r13v.github.io/form-please/llms-full.txt), which
   contains all pages, or the HTML page of the same path.

Treat the pages for your task as the source of truth. Use only documented
Form, Please APIs. If none of these paths gives you those pages, report the
access failure before implementing code that depends on them.
