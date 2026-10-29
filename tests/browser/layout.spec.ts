import { readFile } from "node:fs/promises"

import { expect, type Locator, type Page, test } from "@playwright/test"

const layoutCss = await readFile(
	new URL("../../src/layout.css", import.meta.url),
	"utf8",
)
const viewport = { width: 1400, height: 900 }

test.describe("form-please/layout.css", () => {
	test("uses section container width for one, two, and four effective columns", async ({
		page,
	}) => {
		await page.setViewportSize(viewport)

		for (const scenario of [
			{ width: 560, expectedColumns: 1 },
			{ width: 720, expectedColumns: 2 },
			{ width: 1120, expectedColumns: 4 },
		]) {
			await loadLayout(page, {
				body: formMarkup(
					sectionMarkup({
						id: "section",
						width: scenario.width,
						columns: 4,
						children: [
							fieldMarkup("field-1"),
							fieldMarkup("field-2"),
							fieldMarkup("field-3"),
							fieldMarkup("field-4"),
						].join(""),
					}),
				),
			})

			await expectFirstRowCount(page, scenario.expectedColumns)
		}
	})

	test("applies only the public spacing variables", async ({ page }) => {
		await page.setViewportSize(viewport)
		await loadLayout(page, {
			body: formMarkup(
				[
					sectionMarkup({
						id: "section",
						width: 720,
						columns: 2,
						children: [
							fieldMarkup("field-1"),
							fieldMarkup("field-2"),
							fieldMarkup("field-3"),
						].join(""),
					}),
					[
						'<div id="array" data-fp-node="array">',
						'<div id="item" data-fp-node="array-item">',
						fieldMarkup("item-field"),
						"</div>",
						"</div>",
					].join(""),
				].join(""),
				"--fp-column-gap: 24px; --fp-row-gap: 18px; --fp-stack-gap: 7px; --fp-array-item-gap: 13px;",
			),
		})

		await expect(page.locator("form")).toHaveCSS("gap", "7px")
		await expect(page.locator("#section-grid")).toHaveCSS("column-gap", "24px")
		await expect(page.locator("#section-grid")).toHaveCSS("row-gap", "18px")
		await expect(page.locator("#item")).toHaveCSS("gap", "13px")

		const first = await boundingBox(page.locator("#field-1"))
		const second = await boundingBox(page.locator("#field-2"))
		const third = await boundingBox(page.locator("#field-3"))
		expectClose(second.x - first.x - first.width, 24)
		expectClose(third.y - first.y - first.height, 18)
	})

	test("keeps nested section containers responsive to their own width", async ({
		page,
	}) => {
		await page.setViewportSize(viewport)
		await loadLayout(page, {
			body: formMarkup(
				sectionMarkup({
					id: "outer",
					width: 1120,
					columns: 4,
					children: [
						sectionMarkup({
							id: "inner-narrow",
							width: 520,
							columns: 4,
							span: "full",
							children: [
								fieldMarkup("narrow-1"),
								fieldMarkup("narrow-2"),
								fieldMarkup("narrow-3"),
							].join(""),
						}),
						sectionMarkup({
							id: "inner-medium",
							width: 720,
							columns: 4,
							span: "full",
							children: [
								fieldMarkup("medium-1"),
								fieldMarkup("medium-2"),
								fieldMarkup("medium-3"),
							].join(""),
						}),
					].join(""),
				}),
			),
		})

		await expectFirstRowCount(page, 1, "#inner-narrow-grid")
		await expectFirstRowCount(page, 2, "#inner-medium-grid")
	})

	test("clamps numeric spans and keeps full spans on full rows", async ({
		page,
	}) => {
		await page.setViewportSize(viewport)
		await loadLayout(page, {
			body: formMarkup(
				sectionMarkup({
					id: "section",
					width: 720,
					columns: 4,
					children: [
						fieldMarkup("span-1", "1"),
						fieldMarkup("span-4", "4"),
						fieldMarkup("span-full", "full"),
					].join(""),
				}),
			),
		})
		const mediumGrid = await boundingBox(page.locator("#section-grid"))
		const mediumSpan1 = await boundingBox(page.locator("#span-1"))
		const mediumSpan4 = await boundingBox(page.locator("#span-4"))
		const mediumFull = await boundingBox(page.locator("#span-full"))
		expect(mediumSpan1.width).toBeLessThan(mediumSpan4.width)
		expectClose(mediumSpan4.width, mediumGrid.width)
		expectClose(mediumFull.x, mediumGrid.x)
		expectClose(mediumFull.width, mediumGrid.width)
		expect(mediumFull.y).toBeGreaterThan(mediumSpan4.y)

		await loadLayout(page, {
			body: formMarkup(
				sectionMarkup({
					id: "section",
					width: 1120,
					columns: 4,
					children: [
						fieldMarkup("span-3", "3"),
						fieldMarkup("span-4", "4"),
						fieldMarkup("span-full", "full"),
					].join(""),
				}),
			),
		})
		const wideGrid = await boundingBox(page.locator("#section-grid"))
		const wideSpan3 = await boundingBox(page.locator("#span-3"))
		const wideSpan4 = await boundingBox(page.locator("#span-4"))
		const wideFull = await boundingBox(page.locator("#span-full"))
		expect(wideSpan3.width).toBeGreaterThan(wideGrid.width / 2)
		expect(wideSpan3.width).toBeLessThan(wideGrid.width)
		expectClose(wideSpan4.width, wideGrid.width)
		expectClose(wideFull.x, wideGrid.x)
		expectClose(wideFull.width, wideGrid.width)
		expect(wideFull.y).toBeGreaterThan(wideSpan4.y)
	})

	test("falls back to one column when container-query rules are unavailable", async ({
		page,
	}) => {
		await page.setViewportSize(viewport)
		await loadLayout(page, {
			css: withoutContainerQueries(layoutCss),
			body: formMarkup(
				sectionMarkup({
					id: "section",
					width: 1120,
					columns: 4,
					children: [
						fieldMarkup("field-1"),
						fieldMarkup("field-2"),
						fieldMarkup("field-3"),
						fieldMarkup("field-4"),
					].join(""),
				}),
			),
		})

		await expectFirstRowCount(page, 1)
	})
})

async function loadLayout(
	page: Page,
	options: {
		readonly body: string
		readonly css?: string
	},
) {
	await page.setContent(`<!doctype html>
<html>
	<head>
		<style>${options.css ?? layoutCss}</style>
	</head>
	<body>${options.body}</body>
</html>`)
}

function formMarkup(children: string, style = ""): string {
	return `<form data-fp-node="form" style="${style}">${children}</form>`
}

function sectionMarkup({
	id,
	width,
	columns,
	children,
	span,
}: {
	readonly id: string
	readonly width: number
	readonly columns: 1 | 2 | 3 | 4
	readonly children: string
	readonly span?: "1" | "2" | "3" | "4" | "full"
}): string {
	const spanAttribute = span === undefined ? "" : ` data-fp-span="${span}"`

	return [
		`<section id="${id}" data-fp-node="section"${spanAttribute} style="width: ${width}px;">`,
		`<div id="${id}-grid" data-fp-layout="grid" data-fp-columns="${columns}">`,
		children,
		"</div>",
		"</section>",
	].join("")
}

function fieldMarkup(id: string, span: "1" | "2" | "3" | "4" | "full" = "1") {
	return `<div id="${id}" data-fp-node="field" data-fp-span="${span}" style="min-height: 24px;"></div>`
}

async function expectFirstRowCount(
	page: Page,
	expectedColumns: number,
	layoutSelector = "#section-grid",
) {
	const firstRow = await page
		.locator(`${layoutSelector} > [data-fp-node]`)
		.evaluateAll((elements) => {
			const boxes = elements.map((element) => element.getBoundingClientRect())
			const firstTop = boxes[0]?.top ?? 0

			return boxes.filter((box) => Math.abs(box.top - firstTop) <= 1).length
		})

	expect(firstRow).toBe(expectedColumns)
}

async function boundingBox(locator: Locator) {
	const box = await locator.boundingBox()
	expect(box).not.toBeNull()

	return box as NonNullable<typeof box>
}

function expectClose(actual: number, expected: number) {
	expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1)
}

function withoutContainerQueries(css: string): string {
	const firstContainerQuery = css.indexOf("\n\t@container")
	expect(firstContainerQuery).toBeGreaterThan(0)

	return `${css.slice(0, firstContainerQuery)}\n}`
}
