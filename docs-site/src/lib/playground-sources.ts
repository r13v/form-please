// Vite-only `?raw` imports live here so that the modules the Markdown audit
// loads in Node never import this file statically.
import arraySource from "../snippets/playground-array.tsx?raw"
import basicSource from "../snippets/playground-basic.tsx?raw"
import conditionalSource from "../snippets/playground-conditional.tsx?raw"
import derivedSource from "../snippets/playground-derived.tsx?raw"
import transformSource from "../snippets/playground-transform.tsx?raw"
import typoSource from "../snippets/playground-typo.tsx?raw"
import type { ScenarioId } from "./playground-scenarios"

/** Editor-ready scenario programs, with Twoslash directives stripped. */
export const scenarioSources: Readonly<Record<ScenarioId, string>> = {
	array: editorSource(arraySource),
	basic: editorSource(basicSource),
	conditional: editorSource(conditionalSource),
	derived: editorSource(derivedSource),
	transform: editorSource(transformSource),
	typo: editorSource(typoSource),
}

function editorSource(source: string): string {
	return source
		.split("\n")
		.filter((line) => !/^\s*\/\/\s*(@|\^\?)/.test(line))
		.join("\n")
		.trim()
		.concat("\n")
}
