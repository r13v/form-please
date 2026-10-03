---
name: form-please
description: Build and maintain schema-validated React forms with Form, Please. Use when implementing, reviewing, debugging, or explaining code that uses Form, Please.
---

# Form, Please

Before working with Form, Please, get the current documentation in this order:

1. Read the [documentation index](https://r13v.github.io/form-please/llms.txt).
2. If a web tool rejects that direct URL, open the
   [repository](https://github.com/r13v/form-please). Follow its **Use with AI
   agents** link. Then follow the **llms.txt** link in the Documentation files
   table. In Codex `web.run`, use `click` for these links; repeating `open` on
   the file URL can still fail after a successful `click`.
3. If web navigation also fails, or you have no web tool, use shell/HTTP access
   to fetch the same URL with an available HTTP client. For example, with Node.js:

   ```sh
   node --input-type=module -e 'const r = await fetch("https://r13v.github.io/form-please/llms.txt"); if (!r.ok) throw new Error(`HTTP ${r.status}`); console.log(await r.text())'
   ```

   With curl, use `curl -fsSL https://r13v.github.io/form-please/llms.txt`.
   Use a client that your environment provides; curl is not required.
4. Read the HTML pages listed in the index for your task. With a web tool,
   follow their navigation links from the AI agents page if direct opens fail.
   If you read `/assets/md/<page>.md` and the tool rejects `text/markdown`, use the
   corresponding HTML page instead. For example, read
   [Get started](https://r13v.github.io/form-please/get-started/) for
   `/assets/md/get-started.md`. For Markdown as `text/plain`, follow the
   **llms-full.txt** link on the AI agents page or fetch
   [llms-full.txt](https://r13v.github.io/form-please/llms-full.txt) with your HTTP
   client. Read the relevant page heading and its section. If the response is
   truncated, read further or use the individual HTML page.
   If a Markdown example contains `[!include …]`, read its HTML page for the
   complete code.

Treat the pages for your task as the source of truth. Use only documented
Form, Please APIs. If none of these paths gives you those pages, report the
access failure before implementing code that depends on them.
