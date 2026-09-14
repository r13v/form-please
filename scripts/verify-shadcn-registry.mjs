#!/usr/bin/env node

import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { tmpdir } from "node:os"
import { basename, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import {
	addRegistryItems,
	loadRegistry,
	loadRegistryItem,
} from "shadcn/registry"
import { registrySchema } from "shadcn/schema"

const execFileAsync = promisify(execFile)
const rootDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)))
const controlNames = [
	"text",
	"textarea",
	"select",
	"checkbox",
	"number",
	"date",
	"time",
	"file",
	"radio",
	"switch",
	"slider",
	"rangeSlider",
	"multiSlider",
	"combobox",
	"multiCombobox",
	"datePicker",
	"dateRangePicker",
	"inputOtp",
]
const tempRoot = await mkdtemp(join(tmpdir(), "form-please-registry-"))

try {
	const registrySource = JSON.parse(
		await readFile(join(rootDirectory, "registry.json"), "utf8"),
	)
	registrySchema.parse(registrySource)

	const registry = await loadRegistry({ cwd: rootDirectory })
	assert.equal(registry.name, "form-please")
	assert.equal(registry.items.length, 1)

	const item = await loadRegistryItem("shadcn-form-kit", {
		cwd: rootDirectory,
	})
	assert.ok(item.dependencies?.includes("form-please"))
	assert.ok(item.dependencies?.includes("lucide-react"))
	assert.ok(item.registryDependencies?.includes("utils"))
	assert.equal(item.files?.[0]?.target, "@ui/form-please/shadcn-form-kit.tsx")

	const source = item.files?.[0]?.content
	assert.ok(source, "the registry item must include its adapter source")
	for (const controlName of controlNames) {
		assert.match(source, new RegExp(`\\n\\t${controlName}: defineControl<`))
	}
	assert.match(source, /export const shadcnFormKit = createFormKit/)

	const tarballPath = await packTarball(tempRoot)
	const fixtureDirectory = join(tempRoot, "base-ui-app")
	const installItem = {
		...item,
		dependencies: item.dependencies?.filter(
			(dependency) => dependency !== "form-please",
		),
	}
	const { server: registryServer, url: registryUrl } =
		await serveItem(installItem)
	try {
		await createFixture(fixtureDirectory, tarballPath, registryUrl)
		await run("npm", ["install", "--no-audit", "--no-fund"], fixtureDirectory)
		await addRegistryItems(["@form-please/shadcn-form-kit"], {
			cwd: fixtureDirectory,
			config: fixtureConfig(fixtureDirectory, registryUrl),
			overwrite: true,
			silent: true,
		})
	} finally {
		await new Promise((resolveClose, rejectClose) => {
			registryServer.close((error) => {
				if (error === undefined) {
					resolveClose()
					return
				}
				rejectClose(error)
			})
		})
	}

	const installedPath = join(
		fixtureDirectory,
		"src",
		"components",
		"ui",
		"form-please",
		"shadcn-form-kit.tsx",
	)
	const installedSource = await readFile(installedPath, "utf8")
	assert.match(installedSource, /export const shadcnFormKit = createFormKit/)
	for (const controlName of controlNames) {
		assert.match(
			installedSource,
			new RegExp(`\\n\\s*${controlName}: defineControl<`),
		)
	}

	await run("npm", ["run", "typecheck"], fixtureDirectory)
	await run("npm", ["run", "build"], fixtureDirectory)
} finally {
	await rm(tempRoot, { force: true, recursive: true })
}

async function packTarball(outputDirectory) {
	await run("npm", ["run", "build"], rootDirectory)
	const { stdout } = await run(
		"npm",
		["pack", "--pack-destination", outputDirectory, "--json"],
		rootDirectory,
	)
	const [result] = JSON.parse(stdout)
	assert.ok(result?.filename, "npm pack must report a tarball filename")
	return join(outputDirectory, result.filename)
}

async function createFixture(directory, tarballPath, registryUrl) {
	await mkdir(join(directory, "src"), { recursive: true })
	await writeJson(join(directory, "package.json"), {
		name: "form-please-shadcn-smoke",
		private: true,
		type: "module",
		scripts: {
			typecheck: "tsc --noEmit",
			build: "vite build",
		},
		dependencies: {
			"form-please": `file:${tarballPath}`,
			react: "19.2.8",
			"react-dom": "19.2.8",
			tailwindcss: "4.3.3",
			"tw-animate-css": "1.4.0",
		},
		devDependencies: {
			"@types/react": "19.2.17",
			"@types/react-dom": "19.2.3",
			typescript: "6.0.3",
			vite: "8.1.5",
		},
	})
	await writeJson(join(directory, "components.json"), {
		$schema: "https://ui.shadcn.com/schema.json",
		style: "base-nova",
		rsc: false,
		tsx: true,
		tailwind: {
			config: "",
			css: "src/index.css",
			baseColor: "neutral",
			cssVariables: true,
		},
		iconLibrary: "lucide",
		aliases: {
			components: "@/components",
			utils: "@/lib/utils",
			ui: "@/components/ui",
			lib: "@/lib",
			hooks: "@/hooks",
		},
		registries: {
			"@form-please": registryUrl,
		},
	})
	await writeJson(join(directory, "tsconfig.json"), {
		compilerOptions: {
			target: "ES2022",
			lib: ["ES2022", "DOM", "DOM.Iterable"],
			skipLibCheck: true,
			esModuleInterop: true,
			strict: true,
			module: "ESNext",
			moduleResolution: "Bundler",
			resolveJsonModule: true,
			isolatedModules: true,
			noEmit: true,
			jsx: "react-jsx",
			types: ["vite/client"],
			paths: { "@/*": ["./src/*"] },
		},
		include: ["src"],
	})
	await writeFile(
		join(directory, "index.html"),
		'<div id="root"></div><script type="module" src="/src/main.tsx"></script>\n',
	)
	await writeFile(
		join(directory, "src", "index.css"),
		'@import "tailwindcss";\n',
	)
	await writeFile(
		join(directory, "src", "main.tsx"),
		`import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { shadcnFormKit } from "@/components/ui/form-please/shadcn-form-kit"
import "./index.css"

void shadcnFormKit

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<main>Shadcn form-kit registry smoke test</main>
	</StrictMode>,
)
`,
	)
}

function fixtureConfig(directory, registryUrl) {
	return {
		$schema: "https://ui.shadcn.com/schema.json",
		style: "base-nova",
		rsc: false,
		tsx: true,
		tailwind: {
			config: "",
			css: "src/index.css",
			baseColor: "neutral",
			cssVariables: true,
		},
		iconLibrary: "lucide",
		aliases: {
			components: "@/components",
			utils: "@/lib/utils",
			ui: "@/components/ui",
			lib: "@/lib",
			hooks: "@/hooks",
		},
		registries: {
			"@form-please": registryUrl,
		},
		resolvedPaths: {
			cwd: directory,
			tailwindConfig: join(directory, "tailwind.config.ts"),
			tailwindCss: join(directory, "src", "index.css"),
			utils: join(directory, "src", "lib", "utils.ts"),
			components: join(directory, "src", "components"),
			lib: join(directory, "src", "lib"),
			hooks: join(directory, "src", "hooks"),
			ui: join(directory, "src", "components", "ui"),
		},
	}
}

async function serveItem(item) {
	const server = createServer((request, response) => {
		if (request.url !== "/shadcn-form-kit.json") {
			response.writeHead(404).end()
			return
		}
		response.writeHead(200, { "content-type": "application/json" })
		response.end(JSON.stringify(item))
	})

	await new Promise((resolveListen, rejectListen) => {
		server.once("error", rejectListen)
		server.listen(0, "127.0.0.1", resolveListen)
	})
	const address = server.address()
	assert.ok(address !== null && typeof address === "object")
	return {
		server,
		url: `http://127.0.0.1:${address.port}/{name}.json`,
	}
}

async function writeJson(path, value) {
	await writeFile(path, `${JSON.stringify(value, null, 2)}\n`)
}

async function run(command, args, cwd) {
	const label = `${basename(cwd)}$ ${command} ${args.join(" ")}`
	console.log(label)
	try {
		return await execFileAsync(command, args, {
			cwd,
			maxBuffer: 1024 * 1024 * 20,
		})
	} catch (error) {
		const output = [error.stdout, error.stderr].filter(Boolean).join("\n")
		throw new Error(`${label} failed\n${output}`)
	}
}
