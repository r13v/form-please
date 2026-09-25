import * as monaco from "monaco-editor"
import { typescript } from "monaco-editor"
import EditorWorker from "monaco-editor/editor/editor.worker?worker"
import TypeScriptWorker from "monaco-editor/language/typescript/ts.worker?worker"
import { declarationFiles, declarationPaths } from "./playground-types"

export const playgroundUri = monaco.Uri.parse("file:///playground.tsx")

export const themeNames = {
	dark: "form-please-dark",
	light: "form-please-light",
} as const

/** TypeScript's `ModuleResolutionKind.Bundler`; Monaco's enum omits it. */
const bundlerResolution = 100 as unknown as typescript.ModuleResolutionKind

let configured = false

/** Registers workers, themes, compiler options, and declaration files once. */
export function setupMonaco(): typeof monaco {
	if (configured) return monaco
	configured = true

	self.MonacoEnvironment = {
		getWorker(_workerId: string, label: string) {
			if (label === "typescript" || label === "javascript") {
				return new TypeScriptWorker()
			}
			return new EditorWorker()
		},
	}

	monaco.editor.defineTheme(themeNames.light, {
		base: "vs",
		colors: {
			"editor.background": "#ffffff",
			"editor.foreground": "#102e26",
			"editor.lineHighlightBackground": "#3c796714",
			"editor.selectionBackground": "#3c796733",
			"editorCursor.foreground": "#3c7967",
			"editorGutter.background": "#f1f5f2",
			"editorLineNumber.activeForeground": "#102e26",
			"editorLineNumber.foreground": "#53665f",
			"editorWidget.background": "#ffffff",
			"editorWidget.border": "#718078",
			"editorError.foreground": "#bb4a2b",
			"editorSuggestWidget.selectedBackground": "#3c796722",
			focusBorder: "#3c7967",
		},
		inherit: true,
		rules: [
			{ token: "comment", fontStyle: "italic", foreground: "6b7a74" },
			{ token: "keyword", foreground: "8a3e6a" },
			{ token: "string", foreground: "3c7967" },
			{ token: "number", foreground: "9a5a1c" },
			{ token: "type", foreground: "1f6f86" },
			{ token: "identifier", foreground: "102e26" },
			{ token: "delimiter", foreground: "53665f" },
			{ token: "tag", foreground: "2c5f8a" },
			{ token: "attribute.name", foreground: "1f6f86" },
		],
	})

	monaco.editor.defineTheme(themeNames.dark, {
		base: "vs-dark",
		colors: {
			"editor.background": "#171f1c",
			"editor.foreground": "#e8f0ec",
			"editor.lineHighlightBackground": "#79bda814",
			"editor.selectionBackground": "#79bda833",
			"editorCursor.foreground": "#79bda8",
			"editorGutter.background": "#1d2823",
			"editorLineNumber.activeForeground": "#e8f0ec",
			"editorLineNumber.foreground": "#b4c2bc",
			"editorWidget.background": "#1d2823",
			"editorWidget.border": "#7e9189",
			"editorError.foreground": "#ff9a78",
			"editorSuggestWidget.selectedBackground": "#79bda833",
			focusBorder: "#79bda8",
		},
		inherit: true,
		rules: [
			{ token: "comment", fontStyle: "italic", foreground: "8ea199" },
			{ token: "keyword", foreground: "e39ac1" },
			{ token: "string", foreground: "79bda8" },
			{ token: "number", foreground: "f0b47a" },
			{ token: "type", foreground: "7fd3e6" },
			{ token: "identifier", foreground: "e8f0ec" },
			{ token: "delimiter", foreground: "b4c2bc" },
			{ token: "tag", foreground: "8ec3ea" },
			{ token: "attribute.name", foreground: "7fd3e6" },
		],
	})

	const defaults = typescript.typescriptDefaults
	defaults.setCompilerOptions({
		allowNonTsExtensions: true,
		jsx: typescript.JsxEmit.ReactJSX,
		lib: ["es2022", "dom", "dom.iterable"],
		module: typescript.ModuleKind.ESNext,
		moduleResolution: bundlerResolution,
		noEmit: true,
		paths: declarationPaths as Record<string, string[]>,
		skipLibCheck: true,
		strict: true,
		target: typescript.ScriptTarget.ES2020,
		types: [],
	})
	defaults.setEagerModelSync(true)
	defaults.setExtraLibs(
		[...declarationFiles].map(([filePath, content]) => ({ content, filePath })),
	)

	return monaco
}

export function currentThemeName(): string {
	const theme = document.documentElement.getAttribute("data-vocs-theme")
	if (theme === "dark") return themeNames.dark
	return themeNames.light
}

export type PlaygroundMarker = Readonly<{
	column: number
	line: number
	message: string
}>

/**
 * Resolves once the TypeScript mode has registered its worker. Monaco loads
 * the mode lazily after the first TypeScript model appears, so the accessor
 * is unavailable for a few hundred milliseconds.
 */
export async function waitForTypeScript(
	timeoutMs = 60_000,
): Promise<Awaited<ReturnType<typeof typescript.getTypeScriptWorker>>> {
	const deadline = Date.now() + timeoutMs
	while (true) {
		try {
			return await typescript.getTypeScriptWorker()
		} catch (error) {
			if (Date.now() > deadline) throw error
			await new Promise((resolve) => setTimeout(resolve, 200))
		}
	}
}

/** Reads the current semantic and syntactic errors straight from the worker. */
export async function collectErrors(
	model: monaco.editor.ITextModel,
): Promise<PlaygroundMarker[]> {
	const getWorker = await waitForTypeScript()
	const worker = await getWorker(model.uri)
	const fileName = model.uri.toString()
	const diagnostics = [
		...(await worker.getSyntacticDiagnostics(fileName)),
		...(await worker.getSemanticDiagnostics(fileName)),
	]
	return diagnostics
		.filter((diagnostic) => diagnostic.category === 1)
		.map((diagnostic) => {
			const position = model.getPositionAt(diagnostic.start ?? 0)
			return {
				column: position.column,
				line: position.lineNumber,
				message: flattenMessage(diagnostic.messageText),
			}
		})
}

function flattenMessage(
	message: string | { messageText: string; next?: unknown[] },
): string {
	if (typeof message === "string") return message
	return message.messageText
}
