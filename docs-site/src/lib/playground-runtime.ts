import * as formPlease from "form-please"
import * as defaultSlots from "form-please/default-slots"
import * as nativeControls from "form-please/native-controls"
import * as presetNative from "form-please/preset-native"
import type { ComponentType } from "react"
import * as React from "react"
import * as jsxRuntime from "react/jsx-runtime"
import * as reactHookForm from "react-hook-form"
import { transform } from "sucrase"
import * as zod from "zod"

type ModuleNamespace = Readonly<Record<string, unknown>>

const modules: Readonly<Record<string, ModuleNamespace>> = {
	"form-please": formPlease,
	"form-please/default-slots": defaultSlots,
	"form-please/native-controls": nativeControls,
	"form-please/preset-native": presetNative,
	react: React,
	"react-hook-form": reactHookForm,
	"react/jsx-runtime": jsxRuntime,
	zod,
}

export const availableModules: readonly string[] = Object.keys(modules)

export type CompiledPlayground =
	| Readonly<{ ok: true; Component: ComponentType }>
	| Readonly<{ ok: false; error: string }>

export function compilePlayground(source: string): CompiledPlayground {
	let code: string
	try {
		code = transform(source, {
			filePath: "playground.tsx",
			jsxRuntime: "automatic",
			production: true,
			transforms: ["typescript", "jsx", "imports"],
		}).code
	} catch (error) {
		return { ok: false, error: describeError(error) }
	}

	const exportsObject: Record<string, unknown> = {}
	const moduleObject = { exports: exportsObject }
	try {
		const run = new Function("require", "exports", "module", code) as (
			require: (name: string) => unknown,
			exports: Record<string, unknown>,
			module: { exports: Record<string, unknown> },
		) => void
		run(requireModule, exportsObject, moduleObject)
	} catch (error) {
		return { ok: false, error: describeError(error) }
	}

	const Component = pickComponent(moduleObject.exports)
	if (Component === undefined) {
		return {
			ok: false,
			error:
				"Export a React component. The playground renders the default export, or the first exported function.",
		}
	}
	return { ok: true, Component }
}

function requireModule(name: string): unknown {
	const found = modules[name]
	if (found === undefined) {
		throw new Error(
			`"${name}" is not available in the playground. Available modules: ${availableModules.join(", ")}.`,
		)
	}
	return { __esModule: true, ...found, default: found.default ?? found }
}

function pickComponent(
	exported: Readonly<Record<string, unknown>>,
): ComponentType | undefined {
	if (typeof exported.default === "function") {
		return exported.default as ComponentType
	}
	for (const [name, value] of Object.entries(exported)) {
		if (name !== "__esModule" && typeof value === "function") {
			return value as ComponentType
		}
	}
	return undefined
}

function describeError(error: unknown): string {
	if (error instanceof Error) return error.message
	return String(error)
}
