import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"

import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)

describe("built package entries", () => {
	it("loads the supported ESM and CommonJS entries", async () => {
		const esm = await loadEsm()
		const cjs = loadCommonJs()

		for (const modules of [esm, cjs]) {
			expect(modules.root.createFormKit).toBeTypeOf("function")
			expect(modules.root.defineControl).toBeTypeOf("function")
			expect(modules.root.fromResource).toBeTypeOf("function")
			expect(modules.root.useSnapshot).toBeTypeOf("function")
			expect(modules.defaultSlots.createDefaultSlots).toBeTypeOf("function")
			expect(modules.devtools.FormPleaseDevtools).toBeTypeOf("function")
			expect(modules.history.createHistoryMiddleware).toBeTypeOf("function")
			expect(modules.history.useHistory).toBeTypeOf("function")
			expect(modules.nativeControls.createNativeControls).toBeTypeOf("function")
			expect(modules.persistence.createPersistenceMiddleware).toBeTypeOf(
				"function",
			)
			expect(modules.persistence.usePersistence).toBeTypeOf("function")
			expect(modules.presetNative.nativeFormKit.useForm).toBeTypeOf("function")
			expect(modules.presetMui.createMuiFormKit).toBeTypeOf("function")
			expect(modules.testing.createDefinitionTester).toBeTypeOf("function")
		}
	})

	it("exports only canonical root runtime names", async () => {
		for (const root of [(await loadEsm()).root, loadCommonJs().root]) {
			expect(root).toHaveProperty("createFormKit")
			expect(root).toHaveProperty("useSnapshot")
			expect(root).not.toHaveProperty("createForm")
			expect(root).not.toHaveProperty("createFormStore")
			expect(root).not.toHaveProperty("useForm")
			expect(root).not.toHaveProperty("useCreateForm")
			expect(root).not.toHaveProperty("useBindForm")
		}
	})

	it("omits retired names and keeps canonical declarations", async () => {
		for (const extension of ["d.ts", "d.cts"]) {
			const declaration = await readFile(
				new URL(`../../dist/index.${extension}`, import.meta.url),
				"utf8",
			)
			for (const name of [
				"TanStackFormKit",
				"TanStackFormInstance",
				"ControlFormData",
				"ControlConfigOf",
				"ValuePolicy",
			]) {
				expect(declaration).not.toContain(name)
			}
			for (const name of [
				"ControlOwnPropsOf",
				"DefineFormOptions",
				"OptionValue",
				"FormBinding",
				"FormDefinition",
				"FormDefinitionUpdatePolicy",
				"FormKit",
				"FormMiddleware",
				"FormSubmitDetails",
				"UseFormOptions",
				"useSnapshot",
				"ValueTransaction",
			]) {
				expect(declaration).toContain(name)
			}

			const persistenceDeclaration = await readFile(
				new URL(`../../dist/persistence.${extension}`, import.meta.url),
				"utf8",
			)
			expect(persistenceDeclaration).toContain("PersistenceErrorDetails")
			expect(persistenceDeclaration).toContain("UsePersistenceResult")
			expect(persistenceDeclaration).toContain("usePersistence")

			const historyDeclaration = await readFile(
				new URL(`../../dist/history.${extension}`, import.meta.url),
				"utf8",
			)
			expect(historyDeclaration).toContain("UseHistoryResult")
			expect(historyDeclaration).toContain("useHistory")

			const devtoolsDeclaration = await readFile(
				new URL(`../../dist/devtools.${extension}`, import.meta.url),
				"utf8",
			)
			expect(devtoolsDeclaration).toContain("FormPleaseDevtoolsProps")
			expect(devtoolsDeclaration).toContain("FormPleaseDevtools")
			expect(devtoolsDeclaration).not.toContain("createDevtoolsMiddleware")
			expect(devtoolsDeclaration).not.toMatch(/\bid\?:/)

			const nativeDeclaration = await readFile(
				new URL(`../../dist/native-controls.${extension}`, import.meta.url),
				"utf8",
			)
			expect(nativeDeclaration).toContain("NativeSelectProps")
			expect(nativeDeclaration).not.toContain("NativeSelectConfig")

			const muiDeclaration = await readFile(
				new URL(`../../dist/preset-mui.${extension}`, import.meta.url),
				"utf8",
			)
			expect(muiDeclaration).toContain("MuiSelectProps")
			expect(muiDeclaration).not.toContain("MuiSelectConfig")

			const testingDeclaration = await readFile(
				new URL(`../../dist/testing.${extension}`, import.meta.url),
				"utf8",
			)
			expect(testingDeclaration).toContain("createDefinitionTester")
			expect(testingDeclaration).toContain("DefinitionTesterOptions")
			expect(testingDeclaration).toContain("ManagedDefinitionTransition")
			expect(testingDeclaration).not.toContain("ResolvedDefinition")
		}
	})
})

type Modules = {
	readonly root: Record<string, unknown>
	readonly defaultSlots: Record<string, unknown>
	readonly devtools: Record<string, unknown>
	readonly history: Record<string, unknown>
	readonly nativeControls: Record<string, unknown>
	readonly persistence: Record<string, unknown>
	readonly presetNative: {
		readonly nativeFormKit: { readonly useForm: unknown }
	}
	readonly presetMui: Record<string, unknown>
	readonly testing: Record<string, unknown>
}

async function loadEsm(): Promise<Modules> {
	return {
		root: await import("../../dist/index.js"),
		defaultSlots: await import("../../dist/default-slots.js"),
		devtools: await import("../../dist/devtools.js"),
		history: await import("../../dist/history.js"),
		nativeControls: await import("../../dist/native-controls.js"),
		persistence: await import("../../dist/persistence.js"),
		presetNative: await import("../../dist/preset-native.js"),
		presetMui: await import("../../dist/preset-mui.js"),
		testing: await import("../../dist/testing.js"),
	}
}

function loadCommonJs(): Modules {
	return {
		root: require("../../dist/index.cjs"),
		defaultSlots: require("../../dist/default-slots.cjs"),
		devtools: require("../../dist/devtools.cjs"),
		history: require("../../dist/history.cjs"),
		nativeControls: require("../../dist/native-controls.cjs"),
		persistence: require("../../dist/persistence.cjs"),
		presetNative: require("../../dist/preset-native.cjs"),
		presetMui: require("../../dist/preset-mui.cjs"),
		testing: require("../../dist/testing.cjs"),
	}
}
