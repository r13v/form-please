#!/usr/bin/env node

import { execFile } from "node:child_process"
import { cp, mkdir, mkdtemp, readdir, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { basename, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const rootDirectory = resolve(fileURLToPath(new URL("..", import.meta.url)))
const fixturesDirectory = join(rootDirectory, "tests", "fixtures")
const fixtures = [
	{
		name: "react18-vite",
		requiredScripts: ["typecheck", "build"],
		css: "absent",
	},
	{
		name: "react19-vite",
		requiredScripts: ["typecheck", "build"],
		css: "present",
	},
	{
		name: "next-react19",
		requiredScripts: ["build"],
	},
	{
		name: "node-esm",
		requiredScripts: ["runtime"],
	},
	{
		name: "node-cjs",
		requiredScripts: ["typecheck", "runtime"],
	},
]

const tempRoot = await mkdtemp(join(tmpdir(), "form-please-smoke-"))

try {
	const tarballPath = await packTarball(tempRoot)
	const results = await Promise.allSettled(
		fixtures.map((fixture) => runFixture(fixture, tarballPath, tempRoot)),
	)
	const failure = results.find((result) => result.status === "rejected")
	if (failure?.status === "rejected") {
		throw failure.reason
	}
} finally {
	await rm(tempRoot, { force: true, recursive: true })
}

async function packTarball(tempRoot) {
	const packDirectory = join(tempRoot, "pack")
	await mkdir(packDirectory, { recursive: true })
	await run("npm", ["run", "build"], rootDirectory)
	const { stdout } = await run(
		"npm",
		["pack", "--pack-destination", packDirectory, "--json"],
		rootDirectory,
	)
	const [result] = JSON.parse(stdout)
	if (result?.filename === undefined) {
		throw new Error("npm pack did not report a tarball filename")
	}

	return resolve(packDirectory, result.filename)
}

async function runFixture(fixture, tarballPath, tempRoot) {
	const sourceDirectory = join(fixturesDirectory, fixture.name)
	const targetDirectory = join(tempRoot, fixture.name)

	try {
		await cp(sourceDirectory, targetDirectory, { recursive: true })

		await run("npm", ["ci"], targetDirectory)
		await run("npm", ["install", "--no-save", tarballPath], targetDirectory)

		for (const scriptName of fixture.requiredScripts) {
			await run("npm", ["run", scriptName], targetDirectory)
		}

		if (fixture.css !== undefined) {
			await assertCssResult(fixture, targetDirectory)
		}
	} finally {
		await rm(targetDirectory, { force: true, recursive: true })
	}
}

async function assertCssResult(fixture, fixtureDirectory) {
	const cssFiles = await readCssFiles(join(fixtureDirectory, "dist"))
	const css = cssFiles.map((file) => file.source).join("\n")
	const hasFormPleaseCss =
		css.includes("@layer fp") && css.includes("data-fp-node")

	if (fixture.css === "present" && !hasFormPleaseCss) {
		throw new Error(`${fixture.name} did not emit Form Please layout CSS`)
	}

	if (fixture.css === "absent" && css.includes("form-please")) {
		const files = cssFiles.map((file) => file.path).join(", ")
		throw new Error(
			`${fixture.name} emitted unexpected Form Please CSS in ${files}`,
		)
	}
}

async function readCssFiles(directory) {
	const files = []
	await walk(directory, files)
	return files
}

async function walk(directory, files) {
	const entries = await readdir(directory, { withFileTypes: true })

	for (const entry of entries) {
		const absolutePath = join(directory, entry.name)
		if (entry.isDirectory()) {
			await walk(absolutePath, files)
			continue
		}

		if (entry.isFile() && entry.name.endsWith(".css")) {
			files.push({
				path: relative(directory, absolutePath),
				source: await readFile(absolutePath, "utf8"),
			})
		}
	}
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
