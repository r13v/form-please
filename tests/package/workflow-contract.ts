import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { expect } from "vitest"

const rootDirectory = fileURLToPath(new URL("../..", import.meta.url))

export async function readWorkflow(name: string): Promise<string> {
	return (
		await readFile(join(rootDirectory, ".github/workflows", name), "utf8")
	).replaceAll("\r\n", "\n")
}

export function record(value: unknown): Record<string, unknown> {
	if (value === null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("Expected workflow object")
	}

	return value as Record<string, unknown>
}

export function job(
	workflow: Record<string, unknown>,
	name: string,
): Record<string, unknown> {
	return record(record(workflow.jobs)[name])
}

export function workflowSteps(
	jobDefinition: Record<string, unknown>,
): readonly Record<string, unknown>[] {
	const steps = jobDefinition.steps
	if (!Array.isArray(steps)) {
		throw new Error("Expected workflow job steps")
	}

	return steps.map((step) => record(step))
}

export function stepRuns(
	steps: readonly Record<string, unknown>[],
): readonly string[] {
	return steps
		.map((step) => step.run)
		.filter((run): run is string => typeof run === "string")
}

export function jobRuns(
	workflow: Record<string, unknown>,
	name: string,
): readonly string[] {
	return stepRuns(workflowSteps(job(workflow, name)))
}

/**
 * Asserts that each step of `sequence` is present and in that order. Without
 * the presence check, a deleted step has index -1 and still sorts first.
 */
export function expectRunOrder(
	runs: readonly string[],
	sequence: readonly string[],
): void {
	for (const step of sequence) {
		expect(runs).toContain(step)
	}

	const positions = sequence.map((step) => runs.indexOf(step))
	expect(positions).toEqual([...positions].sort((left, right) => left - right))
}
