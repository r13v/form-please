import { describe, expect, it } from "vitest"
import { parse } from "yaml"

import {
	expectRunOrder,
	job,
	readWorkflow,
	record,
	stepRuns,
	workflowSteps,
} from "./workflow-contract.js"

const pagesWorkflow = await readWorkflow("pages.yml")
const publishWorkflow = await readWorkflow("publish.yml")
const pages = parse(pagesWorkflow) as Record<string, unknown>
const publish = parse(publishWorkflow) as Record<string, unknown>

describe("GitHub Pages workflow", () => {
	it("deploys to production only from main", () => {
		expect(record(record(pages.on).push).branches).toEqual(["main"])
		expect(record(pages.on).pull_request).toBeUndefined()
		expect(record(pages.on).pull_request_target).toBeUndefined()
		expect(record(pages.permissions)).toMatchObject({
			contents: "read",
			pages: "write",
			"id-token": "write",
		})
	})

	it("deploys only docs-site output that production verification produced", () => {
		const steps = workflowSteps(job(pages, "build"))
		const stepIndex = (run: string) =>
			steps.findIndex((step) => step.run === run)
		const verifyIndex = stepIndex("npm run site:verify:production")
		const artifactIndex = steps.findIndex(
			(step) => step.uses === "actions/upload-pages-artifact@v4",
		)

		expect(verifyIndex).toBeGreaterThan(-1)
		expect(artifactIndex).toBeGreaterThan(-1)
		expectRunOrder(stepRuns(steps), [
			"npm ci",
			"npm ci --prefix docs-site",
			"npm run site:verify:production",
		])
		expect(artifactIndex).toBeGreaterThan(verifyIndex)
		expect(steps[artifactIndex]?.if).toBeUndefined()
		expect(record(steps[artifactIndex]?.with).path).toBe(
			"docs-site/dist/public",
		)
		expect(job(pages, "deploy").needs).toBe("build")
	})
})

describe("trusted npm publishing workflow", () => {
	it("grants each release job only the permissions it needs", () => {
		expect(publish.permissions).toBeUndefined()
		expect(record(job(publish, "release").permissions)).toEqual({
			contents: "write",
			issues: "write",
			"pull-requests": "write",
		})
		expect(
			record(job(publish, "release").permissions)["id-token"],
		).toBeUndefined()
		expect(record(job(publish, "publish").permissions)).toEqual({
			contents: "read",
			"id-token": "write",
		})
		expect(record(publish.concurrency)["cancel-in-progress"]).toBe(false)
	})

	it("publishes only the exact tag Release Please created", () => {
		const publishJob = job(publish, "publish")
		const steps = workflowSteps(publishJob)

		expect(publishJob.needs).toBe("release")
		expect(publishJob.if).toBe("needs.release.outputs.created == 'true'")
		expect(record(steps[0]?.with).ref).toBe(
			"$" + "{{ needs.release.outputs.tag }}",
		)
		expect(record(steps[1]?.with)["registry-url"]).toBe(
			"https://registry.npmjs.org",
		)
	})

	it("verifies the release completely before publishing", () => {
		const steps = workflowSteps(job(publish, "publish"))
		const runs = stepRuns(steps)
		const releaseGuard = steps.find(
			(step) => step.run === "node scripts/verify-release.mjs",
		)

		expect(record(releaseGuard?.env).FORM_PLEASE_RELEASE_TAG).toBe(
			"$" + "{{ needs.release.outputs.tag }}",
		)
		expect(runs).toEqual([
			"node scripts/verify-release.mjs",
			"npm ci",
			"npm ci --prefix docs-site",
			"npm run verify",
			"npm run site:verify",
			"npm pack --dry-run",
			"npm publish --access public",
		])
	})

	it("does not configure untrusted triggers or long-lived npm credentials", () => {
		expect(record(publish.on).release).toBeUndefined()
		expect(record(record(publish.on).push).branches).toEqual(["main"])
		expect(publishWorkflow).not.toContain("pull_request:")
		expect(publishWorkflow).not.toContain("NPM_TOKEN")
		expect(publishWorkflow).not.toContain("NODE_AUTH_TOKEN")
		expect(publishWorkflow).not.toContain("secrets.")
		expect(publishWorkflow).not.toContain("--provenance")
		expect(publishWorkflow).not.toContain("playwright install")
		expect(publishWorkflow).not.toMatch(/\bnpm version\b/)
	})
})
