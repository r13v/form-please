import ts from "typescript"
import type {
	PlaygroundDiagnostic,
	TypecheckRequest,
	TypecheckResponse,
} from "./playground-typecheck-protocol"

const entryFile = "/playground.tsx"
const libDirectory = "/node_modules/typescript/lib/"

const rawFiles: Readonly<Record<string, string>> = {
	...import.meta.glob(
		[
			"../../node_modules/typescript/lib/lib.es5.d.ts",
			"../../node_modules/typescript/lib/lib.es20*.d.ts",
			"../../node_modules/typescript/lib/lib.dom.d.ts",
			"../../node_modules/typescript/lib/lib.dom.iterable.d.ts",
			"../../node_modules/typescript/lib/lib.decorators.d.ts",
			"../../node_modules/typescript/lib/lib.decorators.legacy.d.ts",
			"../../node_modules/@types/react/index.d.ts",
			"../../node_modules/@types/react/jsx-runtime.d.ts",
			"../../node_modules/@types/react/global.d.ts",
			"../../node_modules/csstype/index.d.ts",
			"../../node_modules/zod/index.d.ts",
			"../../node_modules/zod/v4/**/*.d.ts",
			"../../node_modules/react-hook-form/dist/**/*.d.ts",
			"../../node_modules/@standard-schema/spec/dist/index.d.ts",
			"../../../node_modules/immer/dist/immer.d.ts",
			"../../../dist/*.d.ts",
		],
		{ eager: true, exhaustive: true, import: "default", query: "?raw" },
	),
}

const files = new Map<string, string>()
for (const [key, content] of Object.entries(rawFiles)) {
	files.set(virtualPath(key), content)
}

function virtualPath(globKey: string): string {
	if (globKey.startsWith("../../../dist/")) {
		return `/node_modules/form-please/dist/${globKey.slice("../../../dist/".length)}`
	}
	if (globKey.startsWith("../../../node_modules/")) {
		return `/${globKey.slice("../../../".length)}`
	}
	return `/${globKey.slice("../../".length)}`
}

const compilerOptions: ts.CompilerOptions = {
	jsx: ts.JsxEmit.ReactJSX,
	lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
	module: ts.ModuleKind.ESNext,
	moduleResolution: ts.ModuleResolutionKind.Bundler,
	noEmit: true,
	paths: {
		"@standard-schema/spec": [
			"/node_modules/@standard-schema/spec/dist/index.d.ts",
		],
		csstype: ["/node_modules/csstype/index.d.ts"],
		"form-please": ["/node_modules/form-please/dist/index.d.ts"],
		"form-please/*": ["/node_modules/form-please/dist/*.d.ts"],
		immer: ["/node_modules/immer/dist/immer.d.ts"],
		react: ["/node_modules/@types/react/index.d.ts"],
		"react-hook-form": ["/node_modules/react-hook-form/dist/index.d.ts"],
		"react/jsx-runtime": ["/node_modules/@types/react/jsx-runtime.d.ts"],
		zod: ["/node_modules/zod/index.d.ts"],
	},
	skipLibCheck: true,
	strict: true,
	target: ts.ScriptTarget.ES2022,
	types: [],
}

let entrySource = ""
let entryVersion = 0

const host: ts.LanguageServiceHost = {
	directoryExists(directory) {
		const prefix = directory.endsWith("/") ? directory : `${directory}/`
		if (prefix === "/") return true
		for (const path of files.keys()) {
			if (path.startsWith(prefix)) return true
		}
		return false
	},
	fileExists(path) {
		return path === entryFile || files.has(path)
	},
	getCompilationSettings: () => compilerOptions,
	getCurrentDirectory: () => "/",
	getDefaultLibFileName: () => `${libDirectory}lib.es2022.d.ts`,
	getDirectories: () => [],
	getScriptFileNames: () => [entryFile],
	getScriptSnapshot(path) {
		const content = path === entryFile ? entrySource : files.get(path)
		if (content === undefined) return undefined
		return ts.ScriptSnapshot.fromString(content)
	},
	getScriptVersion(path) {
		return path === entryFile ? String(entryVersion) : "1"
	},
	readFile(path) {
		return path === entryFile ? entrySource : files.get(path)
	},
	useCaseSensitiveFileNames: () => true,
}

const service = ts.createLanguageService(host, ts.createDocumentRegistry())

addEventListener("message", (event: MessageEvent<TypecheckRequest>) => {
	const request = event.data
	if (request.type === "check") {
		entrySource = request.source
		entryVersion += 1
		respond({
			type: "diagnostics",
			requestId: request.requestId,
			diagnostics: collectDiagnostics(),
		})
		return
	}
	respond({
		type: "quick-info",
		requestId: request.requestId,
		text: quickInfoAt(request.position),
	})
})

respond({ type: "ready" })

function respond(response: TypecheckResponse): void {
	postMessage(response)
}

function collectDiagnostics(): PlaygroundDiagnostic[] {
	const raw = [
		...service.getSyntacticDiagnostics(entryFile),
		...service.getSemanticDiagnostics(entryFile),
	]
	const diagnostics: PlaygroundDiagnostic[] = []
	for (const diagnostic of raw) {
		if (diagnostic.file?.fileName !== entryFile) continue
		const from = diagnostic.start ?? 0
		diagnostics.push({
			code: diagnostic.code,
			from,
			message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
			severity:
				diagnostic.category === ts.DiagnosticCategory.Error
					? "error"
					: "warning",
			to: from + (diagnostic.length ?? 0),
		})
	}
	return diagnostics
}

function quickInfoAt(position: number): string | null {
	const info = service.getQuickInfoAtPosition(entryFile, position)
	if (info === undefined) return null
	return ts.displayPartsToString(info.displayParts)
}
