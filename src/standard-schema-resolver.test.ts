import type { StandardSchemaV1 } from "@standard-schema/spec"
import { describe, expect, it } from "vitest"

import {
	createStandardSchemaResolver,
	fieldErrorsToIssues,
	fieldErrorToIssues,
} from "./standard-schema-resolver.js"
import type { StandardSchema } from "./types.js"

const resolverOptions = {
	criteriaMode: "all" as const,
	fields: {},
	shouldUseNativeValidation: false,
}

describe("Standard Schema resolver", () => {
	it("returns transformed output from one validation", async () => {
		let validations = 0
		const schema: StandardSchema<
			{ readonly name: string },
			{ readonly normalizedName: string }
		> = {
			"~standard": {
				version: 1,
				vendor: "resolver-success-test",
				validate(value) {
					validations += 1
					return {
						value: {
							normalizedName: String(
								(value as { readonly name: string }).name,
							).trim(),
						},
					}
				},
			},
		}
		const resolver = createStandardSchemaResolver(schema)

		await expect(
			resolver({ name: "  Ada  " }, undefined, resolverOptions),
		).resolves.toEqual({ errors: {}, values: { normalizedName: "Ada" } })
		expect(validations).toBe(1)
	})

	it("validates a stable snapshot while an async schema is pending", async () => {
		let release: () => void = () => undefined
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const schema: StandardSchema<{ name: string }> = {
			"~standard": {
				version: 1,
				vendor: "async-snapshot-test",
				async validate(value) {
					await gate
					return { value: { name: (value as { name: string }).name } }
				},
			},
		}
		const values = { name: "Before validation" }
		const result = createStandardSchemaResolver(schema)(
			values,
			undefined,
			resolverOptions,
		)

		values.name = "Changed while validating"
		release()

		await expect(result).resolves.toEqual({
			errors: {},
			values: { name: "Before validation" },
		})
	})

	it("preserves pathless and repeated issues with RHF dot paths", async () => {
		const schema: StandardSchema<{
			readonly speakers: readonly { readonly name: string }[]
		}> = {
			"~standard": {
				version: 1,
				vendor: "resolver-error-test",
				validate() {
					return {
						issues: [
							{ message: "Form is unavailable" },
							{
								message: "Enter a name",
								path: ["speakers", 0, "name"],
							},
							{
								message: "Use at least two characters",
								path: ["speakers", 0, "name"],
							},
						],
					}
				},
			},
		}
		const resolver = createStandardSchemaResolver(schema)
		const result = await resolver(
			{ speakers: [{ name: "" }] },
			undefined,
			resolverOptions,
		)

		expect(result.values).toEqual({})
		expect(fieldErrorsToIssues(result.errors)).toEqual([
			{ message: "Form is unavailable" },
			{ message: "Enter a name", path: "speakers.0.name" },
			{
				message: "Use at least two characters",
				path: "speakers.0.name",
			},
		])
	})

	it("accepts every Standard Schema path segment shape", async () => {
		const resolver = createStandardSchemaResolver(
			issuingSchema([
				{
					message: "object segment",
					path: [{ key: "profile" }, { key: "age" }],
				},
				{ message: "numeric segment", path: ["items", 0, "name"] },
				{ message: "symbol segment", path: [Symbol("secret")] },
				{ message: "mixed segments", path: ["items", { key: 1 }, "name"] },
			]),
		)

		const result = await resolver({}, undefined, resolverOptions)

		expect(fieldErrorsToIssues(result.errors)).toEqual([
			{ message: "symbol segment", path: "Symbol(secret)" },
			{ message: "object segment", path: "profile.age" },
			{ message: "numeric segment", path: "items.0.name" },
			{ message: "mixed segments", path: "items.1.name" },
		])
	})

	it("keeps distinct messages for one path and drops exact duplicates", async () => {
		const resolver = createStandardSchemaResolver(
			issuingSchema([
				{ message: "too short", path: ["name"] },
				{ message: "too short", path: ["name"] },
				{ message: "reserved word", path: ["name"] },
				{ message: "unknown", path: [] },
				{ message: "unknown" },
			]),
		)

		const result = await resolver({}, undefined, resolverOptions)

		expect(result.values).toEqual({})
		expect(fieldErrorsToIssues(result.errors)).toEqual([
			{ message: "unknown" },
			{ message: "too short", path: "name" },
			{ message: "reserved word", path: "name" },
		])
		expect(fieldErrorToIssues(result.errors.name, "name")).toEqual([
			{ message: "too short", path: "name" },
			{ message: "reserved word", path: "name" },
		])
	})

	it("keeps a parent issue visible when a child path also fails", async () => {
		const resolver = createStandardSchemaResolver(
			issuingSchema([
				{ message: "child invalid", path: ["profile", "age"] },
				{ message: "parent invalid", path: ["profile"] },
			]),
		)

		const result = await resolver({}, undefined, resolverOptions)

		expect(fieldErrorsToIssues(result.errors)).toEqual([
			{ message: "parent invalid", path: "profile" },
			{ message: "child invalid", path: "profile.age" },
		])
	})

	it("returns no issues for error trees without schema content", () => {
		for (const value of [
			undefined,
			null,
			0,
			"message",
			[],
			{},
			{ types: {} },
		]) {
			expect(fieldErrorsToIssues(value)).toEqual([])
			expect(fieldErrorToIssues(value)).toEqual([])
		}
	})

	it("reads the root shape RHF uses for field-array errors", () => {
		expect(
			fieldErrorToIssues(
				{ root: { message: "Add one speaker", type: "standard-schema" } },
				"speakers",
			),
		).toEqual([{ message: "Add one speaker", path: "speakers" }])
	})

	it("preserves schema paths that overlap RHF error metadata", async () => {
		const schema: StandardSchema<{
			message: string
			group: { type: string; types: string; ref: string; root: string }
		}> = {
			"~standard": {
				version: 1,
				vendor: "metadata-path-test",
				validate() {
					return {
						issues: [
							{ message: "Enter a message", path: ["message"] },
							{ message: "Fix the group", path: ["group"] },
							{ message: "Enter a type", path: ["group", "type"] },
							{ message: "Enter types", path: ["group", "types"] },
							{ message: "Enter a ref", path: ["group", "ref"] },
							{ message: "Enter a root", path: ["group", "root"] },
						],
					}
				},
			},
		}
		const result = await createStandardSchemaResolver(schema)(
			{
				message: "",
				group: { type: "", types: "", ref: "", root: "" },
			},
			undefined,
			resolverOptions,
		)
		const issues = fieldErrorsToIssues(result.errors)

		expect(issues).toHaveLength(6)
		expect(issues).toEqual(
			expect.arrayContaining([
				{ message: "Enter a message", path: "message" },
				{ message: "Fix the group", path: "group" },
				{ message: "Enter a type", path: "group.type" },
				{ message: "Enter types", path: "group.types" },
				{ message: "Enter a ref", path: "group.ref" },
				{ message: "Enter a root", path: "group.root" },
			]),
		)
	})

	it("preserves top-level root field errors after RHF clears its root key", async () => {
		const schema: StandardSchema<{ readonly root: { readonly name: string } }> =
			{
				"~standard": {
					version: 1,
					vendor: "root-field-test",
					validate() {
						return {
							issues: [
								{ message: "Choose a root", path: ["root"] },
								{ message: "Enter a name", path: ["root", "name"] },
							],
						}
					},
				},
			}
		const result = await createStandardSchemaResolver(schema)(
			{ root: { name: "" } },
			undefined,
			resolverOptions,
		)

		expect(fieldErrorsToIssues(result.errors)).toEqual([
			{ message: "Choose a root", path: "root" },
			{ message: "Enter a name", path: "root.name" },
		])
		delete result.errors.root
		expect(fieldErrorsToIssues(result.errors)).toEqual([
			{ message: "Choose a root", path: "root" },
			{ message: "Enter a name", path: "root.name" },
		])
	})
})

/** Creates a schema that always reports the supplied Standard Schema issues. */
function issuingSchema(
	issues: readonly StandardSchemaV1.Issue[],
): StandardSchema<Record<string, unknown>, never> {
	return {
		"~standard": {
			validate: () => ({ issues }),
			vendor: "resolver-issue-test",
			version: 1,
		},
	}
}
