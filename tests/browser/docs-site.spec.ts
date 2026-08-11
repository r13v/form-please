import { expect, type Page, test } from "@playwright/test"

function pageErrors(page: Page): string[] {
	const errors: string[] = []
	page.on("pageerror", (error) => errors.push(error.message))
	return errors
}

test.describe("Form, Please documentation", () => {
	test("navigates the supported guide and reference routes", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		await page.goto("./get-started")
		await expect(
			page.getByRole("heading", { level: 1, name: "Get started" }),
		).toBeVisible()

		const sidebar = page.locator("nav[data-v-sidebar]")
		await sidebar.getByRole("link", { name: "AI agents", exact: true }).click()
		await expect(page).toHaveURL(/\/form-please\/ai-agents$/)
		await expect(
			page.getByRole("heading", { level: 1, name: "Use with AI agents" }),
		).toBeVisible()

		await sidebar.getByRole("link", { name: "Form kits", exact: true }).click()
		await expect(page).toHaveURL(/\/form-please\/form-kits$/)
		await expect(
			page.getByRole("heading", { level: 1, name: "Form kits" }),
		).toBeVisible()

		await sidebar.getByRole("link", { name: "Definitions" }).click()
		await expect(page).toHaveURL(/\/form-please\/definitions$/)
		await expect(
			page.getByRole("heading", { level: 1, name: "Definitions" }),
		).toBeVisible()

		await sidebar.getByRole("link", { name: "Middleware", exact: true }).click()
		await expect(page).toHaveURL(/\/form-please\/middleware$/)
		await expect(
			page.getByRole("heading", { level: 1, name: "Value middleware" }),
		).toBeVisible()

		await sidebar.getByRole("link", { name: "History", exact: true }).click()
		await expect(page).toHaveURL(/\/form-please\/history$/)
		await expect(
			page.getByRole("heading", { level: 1, name: "Managed value history" }),
		).toBeVisible()

		await sidebar
			.getByRole("link", { name: "Persistence", exact: true })
			.click()
		await expect(page).toHaveURL(/\/form-please\/persistence$/)
		await expect(
			page.getByRole("heading", { level: 1, name: "Form persistence" }),
		).toBeVisible()

		await sidebar.getByRole("link", { name: "API", exact: true }).click()
		await expect(page).toHaveURL(/\/form-please\/api$/)
		await expect(
			page.getByRole("heading", { level: 2, name: "createFormKit" }),
		).toBeVisible()

		await sidebar.getByRole("link", { name: "Recipes", exact: true }).click()
		await expect(page).toHaveURL(/\/form-please\/recipes$/)
		await expect(
			page.getByRole("heading", {
				level: 2,
				name: "Compose generated and custom UI",
			}),
		).toBeVisible()
		expect(errors).toEqual([])
	})

	test("runs query string persistence through reload and clear", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		await page.goto("./examples/persistence")

		const wrapper = page.locator('[data-persistence-preview="query-string"]')
		await expect(wrapper).toHaveAttribute("data-demo-client-ready", "true")
		const preview = wrapper.getByRole("region", {
			name: "Query string persistence preview",
		})
		const name = preview.getByLabel("Name")
		await expect(preview.getByText(/Restore: active/)).toBeVisible()
		await expect(name).toHaveValue("Ada Lovelace")

		await name.fill("Grace Hopper")
		await preview.getByRole("button", { name: "Save now" }).click()
		await expect
			.poll(() => new URL(page.url()).searchParams.has("draft"))
			.toBe(true)

		await page.reload()
		await expect
			.poll(() => new URL(page.url()).searchParams.has("draft"))
			.toBe(true)
		await expect(preview.getByText(/Restore: active/)).toBeVisible()
		await expect(name).toHaveValue("Grace Hopper")
		await preview.getByRole("button", { name: "Clear saved draft" }).click()
		await expect
			.poll(() => new URL(page.url()).searchParams.has("draft"))
			.toBe(false)
		await expect(name).toHaveValue("Grace Hopper")

		await page.reload()
		await expect(name).toHaveValue("Ada Lovelace")
		expect(errors).toEqual([])
	})

	test("runs the managed value history preview", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./examples/history")

		const wrapper = page.locator('[data-history-preview="managed-values"]')
		await expect(wrapper).toHaveAttribute("data-demo-client-ready", "true")
		const preview = wrapper.getByRole("region", {
			name: "Managed value history preview",
		})
		const name = preview.getByLabel("Name")
		await expect(name).toHaveValue("Ada Lovelace")
		await name.fill("Grace Hopper")
		await expect(preview.getByRole("button", { name: "Undo" })).toBeEnabled()

		await preview.getByRole("button", { name: "Undo" }).click()
		await expect(name).toHaveValue("Ada Lovelace")
		await preview.getByRole("button", { name: "Redo" }).click()
		await expect(name).toHaveValue("Grace Hopper")
		await expect(preview.getByText(/Redo: applied/)).toBeVisible()

		expect(errors).toEqual([])
	})

	test("runs the value middleware previews", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./middleware")

		const derived = page.getByRole("region", {
			name: "Derived total middleware preview",
		})
		await expect(
			page.locator('[data-middleware-preview="derived-total"]'),
		).toHaveAttribute("data-demo-client-ready", "true")
		await derived.getByLabel("Quantity").fill("3")
		await expect(derived.getByLabel("Total")).toHaveValue("45")
		await expect(derived.getByText("Committed total: $45.00")).toBeVisible()
		await derived.getByRole("button", { name: "Apply bulk order" }).click()
		await expect(derived.getByLabel("Total")).toHaveValue("90")

		const cancellation = page.getByRole("region", {
			name: "Cancellation middleware preview",
		})
		await expect(
			page.locator('[data-middleware-preview="cancellation"]'),
		).toHaveAttribute("data-demo-client-ready", "true")
		await cancellation
			.getByRole("button", { name: "Try 40% as a managed change" })
			.click()
		await expect(cancellation.getByLabel("Discount percentage")).toHaveValue(
			"10",
		)
		await expect(cancellation.getByText(/Cancelled 40% discount/)).toBeVisible()
		await cancellation
			.getByRole("button", { name: "Set 40% through raw RHF" })
			.click()
		await expect(cancellation.getByLabel("Discount percentage")).toHaveValue(
			"40",
		)
		await expect(
			cancellation.getByText(/form\.api\.setValue bypassed middleware/),
		).toBeVisible()

		const complexEditing = page.getByRole("region", {
			name: "Complex middleware editing preview",
		})
		await expect(
			page.locator('[data-middleware-preview="complex-editing"]'),
		).toHaveAttribute("data-demo-client-ready", "true")
		for (const [label, value] of [
			["First name", "Responsive editor"],
			["Organization name", "Northstar Studio"],
			["Project title", "Partner workspace 2026"],
		] as const) {
			const input = complexEditing.getByLabel(label)
			await input.fill("")
			await input.pressSequentially(value)
			await expect(input).toHaveValue(value)
		}

		expect(errors).toEqual([])
	})

	test("documents validation and resource behavior", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./validation")
		await expect(
			page.getByText(
				"The resolver validates through React Hook Form once per validation run.",
			),
		).toBeVisible()
		await page.goto("./resources")
		await expect(
			page.getByText("fromResource", { exact: true }).first(),
		).toBeVisible()
		expect(errors).toEqual([])
	})

	test("shows type information for Twoslash snippets", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./examples/mui-yup")

		const trigger = page
			.locator("[data-v-twoslash-trigger]", { hasText: "createMuiFormKit" })
			.first()
		await expect(trigger).toBeVisible()
		await trigger.hover()
		await expect(page.locator(".twoslash-popup-container")).toContainText(
			"createMuiFormKit",
		)

		expect(errors).toEqual([])
	})

	test("renders every supported live example", async ({ page }) => {
		const errors = pageErrors(page)
		for (const [route, label] of [
			["examples/mui-yup", "Material UI with Yup conference example"],
			["examples/shadcn-valibot", "Shadcn with Valibot workshop example"],
			["examples/research-grant", "Research grant application example"],
			["examples/studio-policies", "Creative studio policies example"],
			["examples/makerspace-launch", "Makerspace launch wizard example"],
			["examples/learning-cohort", "Learning cohort editor example"],
			["examples/membership-ladder", "Membership ladder example"],
			["examples/campaign-builder", "Campaign builder example"],
		] as const) {
			await page.goto(`./${route}`)
			await expect(page.locator(`[aria-label="${label}"]`)).toBeVisible()
		}
		expect(errors).toEqual([])
	})

	test("submits preset and context examples", async ({ page }) => {
		const errors = pageErrors(page)

		await page.goto("./examples/mui-yup")
		await expect(
			page.getByRole("region", {
				name: "Material UI with Yup conference example",
			}),
		).toHaveAttribute("data-demo-client-ready", "true")
		await page.getByRole("button", { name: "Submit proposal" }).click()
		await expect(
			page.locator('output[aria-live="polite"]').filter({
				hasText: "ready for review",
			}),
		).toBeVisible()

		await page.goto("./examples/shadcn-valibot")
		await page.getByRole("button", { name: "Submit proposal" }).click()
		await expect(
			page.locator('output[aria-live="polite"]').filter({
				hasText: "ready for 24 participants",
			}),
		).toBeVisible()

		await page.goto("./examples/studio-policies")
		await page.getByRole("button", { name: "Publish policies" }).click()
		await expect(
			page.locator('.form-please-complex [aria-live="polite"]').filter({
				hasText: /Revision .* published with/,
			}),
		).toBeVisible()

		expect(errors).toEqual([])
	})

	test("renders and submits the live documentation demos", async ({ page }) => {
		const errors = pageErrors(page)

		await page.goto("./")
		await expect(
			page.getByLabel("Live 'Form, Please' profile form"),
		).toBeVisible()
		await page.getByRole("button", { name: "Save profile" }).click()
		await expect(page.getByTestId("overview-output")).toContainText(
			"Ada Lovelace",
		)

		await page.goto("./get-started")
		await expect(page.getByTestId("lab")).toBeVisible()
		await page.getByRole("button", { name: "Save profile" }).click()
		await expect(page.getByTestId("lab-submission")).toContainText(
			"Saved Ada Lovelace with 1 contact",
		)

		await page.goto("./examples/async-multiselect")
		await expect(page.getByTestId("async-multiselect-demo")).toBeVisible()
		await page.getByRole("button", { name: "Save selection" }).click()
		await expect(page.getByTestId("async-multiselect-output")).toContainText(
			"Saved: tokyo, istanbul, moscow, mumbai",
		)

		await page.goto("./styling")
		await expect(
			page.getByLabel("Tailwind resolver profile form"),
		).toBeVisible()

		expect(errors).toEqual([])
	})

	test("runs the production recipe previews", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./recipes")

		const baseline = page.getByRole("region", {
			name: "Saved baseline recipe preview",
		})
		await expect(baseline).toHaveAttribute("data-demo-client-ready", "true")
		await baseline.getByLabel("Name").fill("Saved name")
		await baseline.getByRole("button", { name: "Save current values" }).click()
		await baseline.getByLabel("Name").fill("Later edit")
		await expect(baseline.getByText("Saved baseline: Saved name")).toBeVisible()
		await expect(baseline.getByText("Unsaved changes")).toBeVisible()

		const atomic = page.getByRole("region", {
			name: "Atomic values recipe preview",
		})
		await atomic.getByLabel("Name").fill("Manual edit")
		await expect(atomic.getByText("No template applied")).toBeVisible()
		await atomic.getByRole("button", { name: "Apply profile template" }).click()
		await expect(atomic.getByLabel("Name")).toHaveValue("Grace Hopper")
		await expect(atomic.getByLabel("Department")).toHaveValue("Compilers")
		await expect(atomic.getByText("Profile template applied.")).toBeVisible()

		const draft = page.getByRole("region", {
			name: "Draft subscription recipe preview",
		})
		await draft.getByLabel("Name").fill("Draft name")
		await expect(draft.getByText("Draft saved for Draft name.")).toBeVisible()

		const wizard = page.getByRole("region", {
			name: "Step validation recipe preview",
		})
		await wizard.getByRole("button", { name: "Continue" }).click()
		await expect(wizard.getByLabel("Name")).toBeFocused()
		await wizard.getByLabel("Name").fill("Ada Lovelace")
		await wizard.getByLabel("Email").fill("ada@example.com")
		await wizard.getByRole("button", { name: "Continue" }).click()
		await expect(wizard.getByLabel("Department")).toBeVisible()

		expect(errors).toEqual([])
	})

	test("runs the product workflow tutorial", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./workflows")

		const workflow = page.getByRole("region", {
			name: "Product workflow recipe preview",
		})
		await workflow.getByLabel("Name").fill("Ada Lovelace")
		await workflow.getByLabel("Email").fill("ada@example.com")
		await workflow.getByLabel("I represent an organization").uncheck()
		await workflow.getByRole("button", { name: "Continue" }).click()
		await expect(workflow.getByText(/Details\. Step 2 of 3\./)).toBeVisible()

		await workflow.getByRole("button", { name: "Clear identity name" }).click()
		await workflow.getByRole("button", { name: "Review" }).click()
		await expect(workflow.getByLabel("Name")).toBeFocused()
		await workflow.getByLabel("Name").fill("Ada Lovelace")
		await workflow.getByRole("button", { name: "Continue" }).click()
		await workflow.getByLabel("Department").fill("Research")
		await workflow.getByRole("button", { name: "Review" }).click()
		await expect(workflow.getByText(/Review\. Step 3 of 3\./)).toBeVisible()
		await workflow.getByRole("button", { name: "Publish" }).click()
		await expect(workflow.getByText("Published Ada Lovelace.")).toBeVisible()

		expect(errors).toEqual([])
	})
})
