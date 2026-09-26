import { readFileSync } from "node:fs"
import { expect, type Page, test } from "@playwright/test"

const { version } = JSON.parse(
	readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as { version: string }

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

	test("opens each top navigation tab and marks the active tab", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		const topNav = page.locator("nav:not([data-v-sidebar])").filter({
			has: page.getByRole("link", { name: "API", exact: true }),
		})
		const tab = (name: string) =>
			topNav.getByRole("link", { name, exact: true })
		const activeTabs = topNav.locator('a[data-v-active="true"]')

		await page.goto("./")
		await expect(tab("Docs")).toBeVisible()
		await expect(activeTabs).toHaveCount(0)

		for (const [path, name] of [
			["./definitions", "Docs"],
			["./examples/history", "Examples"],
			["./types", "API"],
			["./glossary", "API"],
		] as const) {
			await page.goto(path)
			await expect(activeTabs).toHaveText([name])
		}

		for (const [name, url] of [
			["Docs", /\/form-please\/get-started$/],
			["Examples", /\/form-please\/examples$/],
			["Playground", /\/form-please\/playground$/],
			["API", /\/form-please\/api$/],
		] as const) {
			await tab(name).click()
			await expect(page).toHaveURL(url)
			await expect(activeTabs).toHaveText([name])
		}

		await topNav
			.getByRole("button", { name: `v${version}`, exact: true })
			.click()
		await expect(page.getByRole("link", { name: "Releases" })).toHaveAttribute(
			"href",
			"https://github.com/r13v/form-please/releases",
		)
		expect(errors).toEqual([])
	})

	test("opens the matching page from the first search result", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		await page.goto("./get-started")

		for (const [query, url, heading] of [
			[
				"localization",
				/\/form-please\/localization(#localization)?$/,
				"Localization",
			],
			[
				"troubleshooting",
				/\/form-please\/troubleshooting(#troubleshooting)?$/,
				"Troubleshooting",
			],
		] as const) {
			// A click before hydration opens nothing, so retry until the dialog opens.
			await expect(async () => {
				await page.getByRole("button", { name: /^Search\.\.\./ }).click()
				await expect(page.getByRole("combobox")).toBeVisible({ timeout: 1_000 })
			}).toPass()
			await page.getByRole("combobox").fill(query)
			await page
				.getByRole("listbox", { name: "Search results" })
				.getByRole("option")
				.first()
				.click()
			await expect(page).toHaveURL(url)
			await expect(
				page.getByRole("heading", { level: 1, name: heading }),
			).toBeVisible()
		}
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
		await expect(preview.getByText(/Undo: applied/)).toBeVisible()
		await preview.getByRole("button", { name: "Redo" }).click()
		await expect(name).toHaveValue("Grace Hopper")
		await expect(preview.getByText(/Redo: applied/)).toBeVisible()
		await expect(preview.getByRole("button", { name: "Redo" })).toBeDisabled()
		await expect(preview.getByRole("button", { name: "Undo" })).toBeEnabled()

		expect(errors).toEqual([])
	})

	test("runs the value middleware previews", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./middleware")

		const derived = page.getByRole("region", {
			name: "Derived total preview",
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
			name: "Cancellation preview",
		})
		await expect(
			page.locator('[data-middleware-preview="cancellation"]'),
		).toHaveAttribute("data-demo-client-ready", "true")
		await cancellation
			.getByRole("button", { name: "Try 40% as a managed update" })
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
			cancellation.getByText(/form\.api\.setValue bypassed the hooks/),
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

		const resource = page.getByRole("region", {
			name: "Resource state preview",
		})
		await expect(
			page.locator('[data-resource-preview="country"]'),
		).toHaveAttribute("data-demo-client-ready", "true")
		const country = resource.getByLabel("Country")
		await expect(country).toBeDisabled()
		await expect(resource.getByText("Loading countries…")).toBeVisible()
		await resource.getByRole("button", { name: "Loaded" }).click()
		await expect(country).toBeEnabled()
		await expect(resource.getByText("2 countries available")).toBeVisible()
		await resource.getByRole("button", { name: "Failed" }).click()
		await expect(country).toBeDisabled()
		await expect(
			resource.getByText("Cannot load countries: Country service unavailable"),
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
		const playground = page.getByTestId("scripted-playground")
		await expect(playground).toBeVisible()

		await playground.getByRole("tab", { name: "Typed output" }).click()
		await playground.getByRole("button", { name: "Save profile" }).click()
		await expect(
			playground.locator(
				"[role=tabpanel]:not([hidden]) .form-please-playground__form pre",
			),
		).toContainText("@ada-lovelace")
		await expect(
			playground.locator(
				"[role=tabpanel]:not([hidden]) .twoslash-query-persisted",
			),
		).toContainText("handle: string")

		await playground.getByRole("tab", { name: "Catch the typo" }).click()
		await expect(playground.getByText("Nothing to render")).toBeVisible()
		await expect(
			playground.locator("[role=tabpanel]:not([hidden]) .twoslash-error-line"),
		).toHaveCount(2)

		await page.goto("./get-started")
		const getStarted = page.getByTestId("get-started-demo")
		await expect(getStarted).toBeVisible()
		await getStarted.getByLabel("Name").fill("")
		await getStarted.getByRole("button", { name: "Save profile" }).click()
		await expect(
			getStarted.getByText("Enter at least two characters"),
		).toBeVisible()
		await getStarted.getByLabel("Name").fill("Ada Lovelace")
		await getStarted.getByLabel("Email").fill("ada@example.com")
		await getStarted.getByRole("button", { name: "Save profile" }).click()
		await expect(getStarted.locator("pre")).toContainText(
			'"slug": "ada-lovelace"',
		)

		await page.goto("./conditional-fields")
		const accountVariants = page.getByTestId("account-variants-demo")
		await expect(accountVariants).toBeVisible()
		await accountVariants.getByRole("radio", { name: "Company" }).check()
		await expect(accountVariants.getByLabel("First name")).toHaveCount(0)
		await accountVariants.getByRole("button", { name: "Open account" }).click()
		await expect(
			accountVariants.getByText("Enter the company name"),
		).toBeVisible()
		await accountVariants.getByLabel("Company name").fill("Compiler Labs")
		await accountVariants.getByLabel("VAT ID").fill("GB123")
		await accountVariants.getByLabel("Email").fill("ada@example.com")
		await accountVariants.getByRole("button", { name: "Open account" }).click()
		await expect(accountVariants.locator("pre")).toContainText(
			'"companyName": "Compiler Labs"',
		)
		await expect(accountVariants.locator("pre")).not.toContainText("firstName")

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

	test("requires the company name in the conditional scenario", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		await page.goto("./")
		const playground = page.getByTestId("scripted-playground")
		await playground.getByRole("tab", { name: "Conditional field" }).click()
		const demo = playground.locator(
			"[role=tabpanel]:not([hidden]) .form-please-playground__form",
		)

		const submit = demo.getByRole("button", { name: "Open account" })

		await demo.getByLabel("Account type").selectOption("company")
		await demo.getByLabel("Company name").fill("  ")
		await submit.click()
		await expect(demo.getByText("Enter the company name")).toBeVisible()
		await expect(demo.locator("pre")).toHaveText("Submit to see output")

		await demo.getByLabel("Company name").fill("Acme")
		await submit.click()
		await expect(demo.locator("pre")).toContainText('"companyName": "Acme"')

		await demo.getByLabel("Account type").selectOption("personal")
		await submit.click()
		await expect(demo.locator("pre")).toContainText('"accountType": "personal"')
		expect(errors).toEqual([])
	})

	test("keeps the total in sync in the dependent values scenario", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		await page.goto("./")
		const playground = page.getByTestId("scripted-playground")
		await playground.getByRole("tab", { name: "Dependent values" }).click()
		const demo = playground.locator(
			"[role=tabpanel]:not([hidden]) .form-please-playground__form",
		)

		await demo.getByLabel("Quantity").fill("4")
		await expect(demo.getByLabel("Total")).toHaveValue("60")

		await demo.getByLabel("Quantity").fill("60")
		await expect(demo.getByLabel("Total")).toHaveValue("60")

		await demo.getByRole("button", { name: "Place order" }).click()
		await expect(demo.locator("pre")).toContainText('"quantity": 4')
		await expect(demo.locator("pre")).toContainText('"total": 60')
		expect(errors).toEqual([])
	})

	test("puts fields in columns in the grid layout scenario", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		await page.goto("./")
		const playground = page.getByTestId("scripted-playground")
		await playground.getByRole("tab", { name: "Grid layout" }).click()
		const demo = playground.locator(
			"[role=tabpanel]:not([hidden]) .form-please-playground__form",
		)

		const name = await demo.getByLabel("Name").boundingBox()
		const email = await demo.getByLabel("Email").boundingBox()
		const street = await demo.getByLabel("Street").boundingBox()
		const city = await demo.getByLabel("City").boundingBox()
		expect(name?.y).toBe(email?.y)
		expect(email?.x).toBeGreaterThan(name?.x ?? 0)
		expect(street?.width).toBeGreaterThan((city?.width ?? 0) * 1.5)

		await demo.getByRole("button", { name: "Ship order" }).click()
		await expect(demo.locator("pre")).toContainText('"postcode": "SW1Y 4LE"')
		expect(errors).toEqual([])
	})

	test("shares one form with React Hook Form code", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./")
		const playground = page.getByTestId("scripted-playground")
		await playground.getByRole("tab", { name: "React Hook Form" }).click()
		const demo = playground.locator(
			"[role=tabpanel]:not([hidden]) .form-please-playground__form",
		)

		await expect(demo.getByText("No changes")).toBeVisible()
		await demo.getByLabel("Message").fill("Hello")
		await expect(demo.getByText("5 of 80 characters")).toBeVisible()
		await expect(demo.getByText("Unsaved changes")).toBeVisible()

		await demo.getByLabel("Referral code").fill("ADA-1")
		await demo.getByRole("button", { name: "Send invite" }).click()
		await expect(demo.locator("pre")).toContainText('"referral": "ADA-1"')
		expect(errors).toEqual([])
	})

	test("shows the same form before and after the migration", async ({
		page,
	}) => {
		const errors = pageErrors(page)
		await page.goto("./migrate-from-react-hook-form")
		const demo = page.getByTestId("migration-demo")

		for (const version of ["React Hook Form", "Form, Please"]) {
			await demo.getByRole("tab", { name: version }).click()
			const panel = demo.locator("[role=tabpanel]:not([hidden])")

			await panel.getByRole("button", { name: "Send ticket" }).click()
			await expect(
				panel.getByText("Enter at least two characters").first(),
			).toBeVisible()

			await panel.getByLabel("Name").fill("Ada Lovelace")
			await panel.getByLabel("Email").fill("ada@example.com")
			await panel.getByLabel("Topic").selectOption("bug")
			await panel.getByLabel("Message").fill("The export button fails.")
			await panel.getByRole("button", { name: "Send ticket" }).click()
			await expect(panel.locator("pre")).toContainText('"topic": "bug"')
		}
		expect(errors).toEqual([])
	})

	test("runs the live playground with IntelliSense", async ({ page }) => {
		const errors = pageErrors(page)
		await page.goto("./playground?scenario=transform")

		const editor = page.getByTestId("live-editor").locator(".monaco-editor")
		await expect(editor).toBeVisible()
		await expect(editor).toContainText("handle:")
		await page.getByRole("button", { name: "Save profile" }).click()
		await expect(page.getByTestId("live-preview")).toContainText(
			"@ada-lovelace",
		)
		await expect(page.getByTestId("typecheck-status")).toContainText(
			"no errors",
			{ timeout: 60_000 },
		)

		await page.getByLabel("Scenario").selectOption("typo")
		await expect(page).toHaveURL(/\/form-please\/playground\?scenario=typo$/)
		await expect(page.getByTestId("typecheck-status")).toContainText("2 errors")
		await expect(page.getByTestId("diagnostics")).toContainText(
			`Argument of type '"emial"' is not assignable`,
		)
		await expect(
			page.getByRole("button", { name: "Create account" }),
		).toBeVisible()

		await editor.locator(".view-lines").click({ position: { x: 24, y: 24 } })
		await page.keyboard.press("ControlOrMeta+End")
		await page.keyboard.press("Enter")
		await page.keyboard.type("kit.")
		const suggestions = page.locator(".suggest-widget")
		await expect(suggestions).toBeVisible()
		await expect(suggestions).toContainText("defineForm")
		await page.keyboard.press("Escape")
		await page.keyboard.type("useForm(")
		await expect(page.locator(".parameter-hints-widget")).toBeVisible()
		await page.keyboard.press("Escape")
		await expect(page.getByTestId("typecheck-status")).toContainText(
			/· \d+ errors?$/,
		)

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

	test("fits the overview hero on phones and desktops", async ({ page }) => {
		const errors = pageErrors(page)
		const hero = page.locator(".form-please-overview-hero")
		const heading = hero.locator("h1")
		const intro = hero.locator(".form-please-overview-intro")
		const logo = hero.locator(".form-please-overview-logo")

		await page.setViewportSize({ width: 375, height: 812 })
		await page.goto("./")
		await expect(heading).toBeVisible()
		const phone = await heading.evaluate((element) => ({
			clientWidth: element.clientWidth,
			scrollWidth: element.scrollWidth,
		}))
		expect(phone.scrollWidth).toBeLessThanOrEqual(phone.clientWidth)
		const phoneIntro = await intro.boundingBox()
		const phoneHeading = await heading.boundingBox()
		const phoneLogo = await logo.boundingBox()
		if (!phoneIntro || !phoneHeading || !phoneLogo) {
			throw new Error("The overview hero did not render.")
		}
		expect(phoneIntro.width).toBeGreaterThanOrEqual(300)
		expect(phoneIntro.x + phoneIntro.width).toBeLessThanOrEqual(375)
		expect(phoneHeading.x + phoneHeading.width).toBeLessThanOrEqual(375)
		expect(phoneLogo.y + phoneLogo.height).toBeLessThanOrEqual(phoneIntro.y)
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth <= window.innerWidth,
			),
		).toBe(true)

		await page.setViewportSize({ width: 1440, height: 900 })
		const desktopIntro = await intro.boundingBox()
		const desktopLogo = await logo.boundingBox()
		if (!desktopIntro || !desktopLogo) {
			throw new Error("The overview hero did not render.")
		}
		expect(desktopLogo.x).toBeGreaterThanOrEqual(
			desktopIntro.x + desktopIntro.width,
		)
		expect(desktopLogo.y).toBeLessThan(desktopIntro.y + desktopIntro.height)
		expect(desktopLogo.y + desktopLogo.height).toBeGreaterThan(desktopIntro.y)
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
