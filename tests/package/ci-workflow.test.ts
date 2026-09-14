import { describe, expect, it } from "vitest"
import { parse } from "yaml"

import {
	expectRunOrder,
	jobRuns,
	readWorkflow,
	record,
} from "./workflow-contract.js"

const ciWorkflow = await readWorkflow("ci.yml")
const ci = parse(ciWorkflow) as Record<string, unknown>

describe("release-equivalent CI workflow", () => {
	it("runs the release-equivalent gates on pull requests and main", () => {
		expect(record(ci.on).pull_request).toBeNull()
		expect(record(record(ci.on).push).branches).toEqual(["main"])
		expect(record(ci.permissions).contents).toBe("read")
		expectRunOrder(jobRuns(ci, "verify"), [
			"npm ci",
			"npm ci --prefix docs-site",
			"npm run verify",
		])
	})

	it("runs preview verification after installing docs dependencies", () => {
		expectRunOrder(jobRuns(ci, "docs-site"), [
			"npm ci",
			"npm run build",
			"npm ci --prefix docs-site",
			"npm run site:verify:preview",
		])
	})

	it("does not publish, mutate source, or require credentials", () => {
		expect(ciWorkflow).not.toMatch(/\bnpm publish\b/)
		expect(ciWorkflow).not.toMatch(/\bnpm version\b/)
		expect(ciWorkflow).not.toMatch(/\bcheck:fix\b/)
		expect(ciWorkflow).not.toMatch(/\bbiome check --write\b/)
		expect(ciWorkflow).not.toMatch(/\bgit (?:commit|push)\b/)
		expect(ciWorkflow).not.toMatch(/\b(?:NPM_TOKEN|NODE_AUTH_TOKEN)\b/)
		expect(ciWorkflow).not.toContain("secrets.")
		expect(ciWorkflow).not.toContain("id-token: write")
		expect(ciWorkflow).not.toContain("packages: write")
		expect(ciWorkflow).not.toContain("pages: write")
		expect(ciWorkflow).not.toContain("deploy-pages")
		expect(ciWorkflow).not.toContain("upload-pages-artifact")
		expect(ciWorkflow).not.toContain("playwright install")
	})
})
