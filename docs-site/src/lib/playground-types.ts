const rawFiles: Readonly<Record<string, string>> = import.meta.glob(
	[
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
)

/** Declaration files keyed by their virtual `file:///node_modules/...` path. */
export const declarationFiles: ReadonlyMap<string, string> = new Map(
	Object.entries(rawFiles).map(([key, content]) => [virtualPath(key), content]),
)

/** Bare specifier to declaration entry point, for the compiler `paths` map. */
export const declarationPaths: Readonly<Record<string, readonly string[]>> = {
	"@standard-schema/spec": [
		"file:///node_modules/@standard-schema/spec/dist/index.d.ts",
	],
	csstype: ["file:///node_modules/csstype/index.d.ts"],
	"form-please": ["file:///node_modules/form-please/dist/index.d.ts"],
	"form-please/*": ["file:///node_modules/form-please/dist/*.d.ts"],
	immer: ["file:///node_modules/immer/dist/immer.d.ts"],
	react: ["file:///node_modules/@types/react/index.d.ts"],
	"react-hook-form": ["file:///node_modules/react-hook-form/dist/index.d.ts"],
	"react/jsx-runtime": ["file:///node_modules/@types/react/jsx-runtime.d.ts"],
	zod: ["file:///node_modules/zod/index.d.ts"],
}

function virtualPath(globKey: string): string {
	if (globKey.startsWith("../../../dist/")) {
		return `file:///node_modules/form-please/dist/${globKey.slice("../../../dist/".length)}`
	}
	if (globKey.startsWith("../../../node_modules/")) {
		return `file:///${globKey.slice("../../../".length)}`
	}
	return `file:///${globKey.slice("../../".length)}`
}
