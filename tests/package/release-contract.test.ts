import { describe, expect, it } from "vitest"

type RegistryLookupResult =
	| {
			readonly status: "available"
			readonly reason: "version_not_found"
	  }
	| {
			readonly status: "published"
			readonly version: string
	  }
	| {
			readonly status: "error"
			readonly reason: string
			readonly detail?: string
	  }

type ReleaseGuardModule = {
	readonly classifyNpmViewResult: (input: {
		readonly error?: unknown
		readonly stdout?: string
		readonly stderr?: string
		readonly expectedVersion: string
	}) => RegistryLookupResult
	readonly normalizeRepositoryUrl: (repository: unknown) => string | undefined
	readonly verifyRelease: (options: {
		readonly packageJson: Record<string, unknown>
		readonly packageLock: Record<string, unknown>
		readonly eventTag: string
		readonly githubRepository?: string
		readonly lookupVersion: (request: {
			readonly packageName: string
			readonly version: string
		}) => Promise<RegistryLookupResult> | RegistryLookupResult
	}) => Promise<{
		readonly packageName: string
		readonly repositoryUrl: string
		readonly tag: string
		readonly version: string
	}>
}

const releaseGuard = (await import(
	new URL("../../scripts/verify-release.mjs", import.meta.url).href
)) as ReleaseGuardModule

const basePackageJson = {
	name: "form-please",
	version: "0.2.0",
	repository: {
		type: "git",
		url: "git+https://github.com/r13v/form-please.git",
	},
}
const basePackageLock = {
	name: "form-please",
	version: "0.2.0",
	packages: {
		"": {
			name: "form-please",
			version: "0.2.0",
		},
	},
}

describe("release guard", () => {
	it("accepts the exact stable unpublished GitHub release", async () => {
		await expect(verifyRelease()).resolves.toEqual({
			packageName: "form-please",
			repositoryUrl: "https://github.com/r13v/form-please",
			tag: "v0.2.0",
			version: "0.2.0",
		})
	})

	it("normalizes supported GitHub repository metadata formats", () => {
		expect(
			releaseGuard.normalizeRepositoryUrl({
				url: "git+https://github.com/r13v/form-please.git",
			}),
		).toBe("https://github.com/r13v/form-please")
		expect(
			releaseGuard.normalizeRepositoryUrl(
				"git@github.com:r13v/form-please.git",
			),
		).toBe("https://github.com/r13v/form-please")
		expect(
			releaseGuard.normalizeRepositoryUrl(
				"ssh://git@github.com/r13v/form-please.git",
			),
		).toBe("https://github.com/r13v/form-please")
	})

	it("rejects mismatched tags, lockfiles, repositories, and package names", async () => {
		await expectReleaseFailure(
			{
				eventTag: "v0.2.1",
			},
			"tag_mismatch",
		)
		await expectReleaseFailure(
			{
				packageLock: {
					...basePackageLock,
					version: "0.2.1",
				},
			},
			"lockfile_version_mismatch",
		)
		await expectReleaseFailure(
			{
				packageLock: {
					...basePackageLock,
					packages: {
						"": {
							name: "form-please",
							version: "0.2.1",
						},
					},
				},
			},
			"lockfile_version_mismatch",
		)
		await expectReleaseFailure(
			{
				packageJson: {
					...basePackageJson,
					name: "not-form-please",
				},
			},
			"package_name_mismatch",
		)
		await expectReleaseFailure(
			{
				packageJson: {
					...basePackageJson,
					repository: "https://github.com/example/form-please",
				},
			},
			"repository_mismatch",
		)
		await expectReleaseFailure(
			{
				githubRepository: "example/form-please",
			},
			"github_repository_mismatch",
		)
	})

	it("rejects zero, prerelease, and already-published versions", async () => {
		await expectReleaseFailure(
			{
				eventTag: "v0.0.0",
				packageJson: {
					...basePackageJson,
					version: "0.0.0",
				},
				packageLock: lockfileForVersion("0.0.0"),
			},
			"zero_version",
		)
		await expectReleaseFailure(
			{
				eventTag: "v0.2.0-beta.1",
				packageJson: {
					...basePackageJson,
					version: "0.2.0-beta.1",
				},
				packageLock: lockfileForVersion("0.2.0-beta.1"),
			},
			"unstable_version",
		)
		await expectReleaseFailure(
			{
				lookupVersion: () => ({
					status: "published",
					version: "0.2.0",
				}),
			},
			"version_already_published",
		)
	})

	it("treats only npm's package-version-not-found response as available", () => {
		expect(
			releaseGuard.classifyNpmViewResult({
				error: { exitCode: 1 },
				expectedVersion: "0.2.0",
				stderr: [
					"npm ERR! code E404",
					"npm ERR! 404 No match found for version 0.2.0",
					"npm ERR! 404  'form-please@0.2.0' is not in this registry.",
				].join("\n"),
			}),
		).toEqual({
			status: "available",
			reason: "version_not_found",
		})

		expect(
			releaseGuard.classifyNpmViewResult({
				expectedVersion: "0.2.0",
				stdout: '"0.2.0"\n',
			}),
		).toEqual({
			status: "published",
			version: "0.2.0",
		})

		for (const [label, input] of [
			[
				"package-not-found",
				{
					error: { exitCode: 1 },
					stderr:
						"npm ERR! 404 Not Found - GET https://registry.npmjs.org/form-please",
				},
			],
			[
				"registry-outage",
				{
					error: { exitCode: 1 },
					stderr: "npm ERR! code E503\nnpm ERR! 503 Service Unavailable",
				},
			],
			[
				"authentication",
				{
					error: { exitCode: 1 },
					stderr: "npm ERR! code E401\nnpm ERR! Unable to authenticate",
				},
			],
			[
				"timeout",
				{
					error: { killed: true, signal: "SIGTERM" },
					stderr: "",
				},
			],
			[
				"malformed-response",
				{
					stdout: '{"unexpected":true}\n',
				},
			],
		] as const) {
			expect(
				releaseGuard.classifyNpmViewResult({
					expectedVersion: "0.2.0",
					...input,
				}),
				label,
			).toMatchObject({
				status: "error",
			})
		}
	})

	it("fails closed when the injected registry lookup cannot prove availability", async () => {
		await expectReleaseFailure(
			{
				lookupVersion: () => ({
					status: "error",
					reason: "registry_outage",
				}),
			},
			"registry_lookup_failed",
		)
	})
})

async function verifyRelease(
	overrides: Partial<Parameters<ReleaseGuardModule["verifyRelease"]>[0]> = {},
) {
	return await releaseGuard.verifyRelease({
		eventTag: "v0.2.0",
		githubRepository: "r13v/form-please",
		lookupVersion: () => ({
			status: "available",
			reason: "version_not_found",
		}),
		packageJson: basePackageJson,
		packageLock: basePackageLock,
		...overrides,
	})
}

async function expectReleaseFailure(
	overrides: Partial<Parameters<ReleaseGuardModule["verifyRelease"]>[0]>,
	code: string,
) {
	await expect(verifyRelease(overrides)).rejects.toMatchObject({ code })
}

function lockfileForVersion(version: string) {
	return {
		...basePackageLock,
		version,
		packages: {
			"": {
				name: "form-please",
				version,
			},
		},
	}
}
