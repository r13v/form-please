"use client"

import {
	act,
	cleanup,
	fireEvent,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react"
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { z } from "zod"
import {
	createFormKit,
	type FormAction,
	type FormBinding,
} from "./create-form-kit.js"
import { definition, kit, schema } from "./test-fixtures.js"
import type { StandardSchema } from "./types.js"

describe("submit actions and external issues", () => {
	const reviewSchema = z.object({ name: z.string(), reason: z.string() })
	const reviewDefinition = kit.defineForm(reviewSchema, (ui) => [
		ui.field("name", { control: "text", label: "Name" }),
		ui.field("reason", { control: "text", label: "Reason" }),
	])

	function ReviewForm({
		approve,
		decline,
		withImplicit = true,
	}: {
		readonly approve: (value: unknown) => unknown
		readonly decline: (value: unknown) => unknown
		readonly withImplicit?: boolean
	}) {
		const form = kit.useForm(reviewDefinition, {
			defaultValues: { name: "Ada", reason: "" },
			actions: {
				approve: {
					implicit: withImplicit,
					onSubmit: ({ value }) => approve(value),
				},
				decline: {
					validate: ({ input }) =>
						input.reason.trim()
							? []
							: [{ path: "reason", message: "Enter a reason." }],
					onSubmit: ({ value }) => decline(value),
				},
			},
		})
		expectTypeOf(form.actions).toHaveProperty("approve")
		// @ts-expect-error Unknown action names are type errors.
		void form.actions.publish
		return (
			<kit.AutoForm form={form}>
				<kit.Submit action={form.actions.decline}>
					{({ buttonProps, isPending }) => (
						<button {...buttonProps}>
							{isPending ? "Declining" : "Decline"}
						</button>
					)}
				</kit.Submit>
				<kit.Submit action={form.actions.approve}>Approve</kit.Submit>
			</kit.AutoForm>
		)
	}

	it("runs the selected action and its validator", async () => {
		const approve = vi.fn()
		const decline = vi.fn()
		render(<ReviewForm approve={approve} decline={decline} />)

		fireEvent.click(screen.getByRole("button", { name: "Decline" }))
		expect(await screen.findByText("Enter a reason.")).toBeTruthy()
		expect(decline).not.toHaveBeenCalled()
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByLabelText("Reason")),
		)

		fireEvent.change(screen.getByLabelText("Reason"), {
			target: { value: "Duplicate" },
		})
		expect(screen.queryByText("Enter a reason.")).toBeNull()
		const declineButton = screen.getByRole("button", { name: "Decline" })
		await waitFor(() =>
			expect((declineButton as HTMLButtonElement).disabled).toBe(false),
		)
		fireEvent.click(declineButton)
		await waitFor(() =>
			expect(decline).toHaveBeenCalledWith({
				name: "Ada",
				reason: "Duplicate",
			}),
		)

		fireEvent.click(screen.getByRole("button", { name: "Approve" }))
		await waitFor(() => expect(approve).toHaveBeenCalledTimes(1))
		expect(decline).toHaveBeenCalledTimes(1)
	})

	it("disables every action button while one action runs", async () => {
		let release = () => {}
		const approve = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)
		render(<ReviewForm approve={approve} decline={vi.fn()} />)

		fireEvent.click(screen.getByRole("button", { name: "Approve" }))
		const pending = await screen.findByRole("button", { name: "Declining" })
		expect((pending as HTMLButtonElement).disabled).toBe(true)
		fireEvent.click(screen.getByRole("button", { name: "Approve" }))
		await act(async () => release())
		await screen.findByRole("button", { name: "Decline" })
		expect(approve).toHaveBeenCalledTimes(1)
	})

	it("runs only the implicit action when Enter is pressed in a field", async () => {
		const approve = vi.fn()
		const { unmount } = render(
			<ReviewForm approve={approve} decline={vi.fn()} />,
		)
		fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" })
		await waitFor(() => expect(approve).toHaveBeenCalledTimes(1))
		unmount()

		const withoutImplicit = vi.fn()
		render(
			<ReviewForm
				approve={withoutImplicit}
				decline={vi.fn()}
				withImplicit={false}
			/>,
		)
		fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" })
		fireEvent.submit(
			screen.getByLabelText("Name").closest("form") as HTMLElement,
		)
		await act(async () => {})
		expect(withoutImplicit).not.toHaveBeenCalled()
	})

	it("rejects ambiguous action configuration", () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {})
		function Both() {
			// @ts-expect-error onSubmit and actions are exclusive.
			kit.useForm(reviewDefinition, {
				defaultValues: { name: "", reason: "" },
				onSubmit: vi.fn(),
				actions: { approve: { onSubmit: vi.fn() } },
			})
			return null
		}
		function TwoImplicit() {
			kit.useForm(reviewDefinition, {
				defaultValues: { name: "", reason: "" },
				actions: {
					approve: { implicit: true, onSubmit: vi.fn() },
					decline: { implicit: true, onSubmit: vi.fn() },
				},
			})
			return null
		}
		function MissingAction() {
			const form = kit.useForm(reviewDefinition, {
				defaultValues: { name: "", reason: "" },
				actions: { approve: { onSubmit: vi.fn() } },
			})
			return (
				<kit.Form form={form}>
					<kit.Submit>Save</kit.Submit>
				</kit.Form>
			)
		}
		expect(() => render(<Both />)).toThrow("onSubmit or actions")
		expect(() => render(<TwoImplicit />)).toThrow("one implicit action")
		expect(() => render(<MissingAction />)).toThrow("requires an action")
		errors.mockRestore()
	})

	it("shows external issues immediately and clears them on edit", async () => {
		let form: ReturnType<typeof useReview> | undefined
		function useReview() {
			return kit.useForm(reviewDefinition, {
				defaultValues: { name: "Ada", reason: "" },
				mode: "onChange",
				onSubmit: vi.fn(),
			})
		}
		function View() {
			form = useReview()
			return <kit.AutoForm form={form} />
		}
		render(<View />)

		act(() =>
			form?.setIssues(
				[
					{ path: "name", message: "This name is already used." },
					{ path: "reason", message: "Explain the change." },
					{ message: "The source changed." },
				],
				{ focus: "name" },
			),
		)
		expect(screen.getByText("This name is already used.")).toBeTruthy()
		expect(screen.getByText("The source changed.")).toBeTruthy()
		await waitFor(() =>
			expect(document.activeElement).toBe(screen.getByLabelText("Name")),
		)

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Grace" },
		})
		await waitFor(() =>
			expect(screen.queryByText("This name is already used.")).toBeNull(),
		)
		expect(screen.getByText("Explain the change.")).toBeTruthy()
		expect(screen.getByText("The source changed.")).toBeTruthy()

		act(() => form?.setIssues([]))
		expect(screen.queryByText("Explain the change.")).toBeNull()
		expect(() =>
			form?.setIssues([{ path: "root" as "name", message: "Reserved path." }]),
		).toThrow("reserved React Hook Form root path")
		expect(screen.queryByText("The source changed.")).toBeNull()
	})

	it("clears only external issues and keeps schema and child errors", async () => {
		const addressSchema = z.object({
			name: z.string().min(2, "Enter at least two characters"),
			address: z.object({ zip: z.string().min(1, "Enter a zip code.") }),
		})
		const addressDefinition = kit.defineForm(addressSchema, (ui) => [
			ui.field("name", { control: "text", label: "Name" }),
			ui.field("address.zip", { control: "text", label: "Zip" }),
		])
		let form: FormBinding<typeof addressSchema, unknown, "submit"> | undefined
		function View() {
			form = kit.useForm(addressDefinition, {
				defaultValues: { name: "A", address: { zip: "" } },
				onSubmit: vi.fn(),
			})
			return <kit.AutoForm form={form} />
		}
		render(<View />)
		fireEvent.submit(
			screen.getByLabelText("Name").closest("form") as HTMLElement,
		)
		await screen.findByText("Enter a zip code.")

		act(() =>
			form?.setIssues([
				{ path: "name", message: "Enter at least two characters" },
				{ path: "address", message: "Check the address." },
				{ message: "The source changed." },
			]),
		)
		expect(screen.getByText("Check the address.")).toBeTruthy()
		act(() =>
			form?.setIssues([
				{ path: "name", message: "Enter at least two characters" },
				{ path: "name", message: "Choose another name." },
				{ path: "address", message: "Check the address." },
				{ message: "The source changed." },
			]),
		)
		await act(async () => {
			await form?.api.trigger()
		})
		expect(screen.getByText("Check the address.")).toBeTruthy()
		expect(screen.getByText("Choose another name.")).toBeTruthy()
		act(() => form?.setIssues([]))
		expect(screen.queryByText("Check the address.")).toBeNull()
		expect(screen.queryByText("The source changed.")).toBeNull()
		expect(screen.getByText("Enter at least two characters")).toBeTruthy()
		expect(screen.getByText("Enter a zip code.")).toBeTruthy()
	})

	it("focuses the summary when the issue field is not registered", async () => {
		const nameOnly = kit.defineForm(reviewSchema, (ui) => [
			ui.field("name", { control: "text", label: "Name" }),
		])
		let form: FormBinding<typeof reviewSchema, unknown, "submit"> | undefined
		function View() {
			form = kit.useForm(nameOnly, {
				defaultValues: { name: "Ada", reason: "" },
				onSubmit: vi.fn(),
			})
			return (
				<kit.AutoForm form={form}>
					<input aria-label="Notes" />
				</kit.AutoForm>
			)
		}
		render(<View />)
		screen.getByLabelText("Notes").focus()
		act(() =>
			form?.setIssues([{ path: "reason", message: "Explain the change." }], {
				focus: "reason",
			}),
		)
		await waitFor(() =>
			expect(document.activeElement?.textContent).toContain(
				"Explain the change.",
			),
		)
	})

	/** Replaces the runner listeners so a test can assert unhandled rejections. */
	function captureUnhandledRejections() {
		const runnerListeners = process.listeners("unhandledRejection")
		const reasons: unknown[] = []
		const listener = (reason: unknown) => {
			reasons.push(reason)
		}
		process.removeAllListeners("unhandledRejection")
		process.on("unhandledRejection", listener)
		return {
			reasons,
			async restore() {
				await new Promise((resolve) => setTimeout(resolve, 0))
				process.off("unhandledRejection", listener)
				for (const runnerListener of runnerListeners) {
					process.on("unhandledRejection", runnerListener)
				}
			},
		}
	}

	function renderRejectingForm(options: {
		readonly onSubmit: () => unknown
		readonly validate?: () => readonly []
	}) {
		const form = {
			current: undefined as
				| FormBinding<typeof reviewSchema, unknown, "save">
				| undefined,
			isSubmitSuccessful: undefined as boolean | undefined,
		}
		function View() {
			const binding = kit.useForm(reviewDefinition, {
				defaultValues: { name: "Ada", reason: "" },
				actions: {
					save: {
						implicit: true,
						validate: options.validate,
						onSubmit: options.onSubmit,
					},
				},
			})
			form.current = binding
			form.isSubmitSuccessful = binding.api.formState.isSubmitSuccessful
			return (
				<kit.AutoForm form={binding}>
					<kit.Submit action={binding.actions.save}>Save</kit.Submit>
				</kit.AutoForm>
			)
		}
		render(<View />)
		const submit = () =>
			fireEvent.click(screen.getByRole("button", { name: "Save" }))
		return { form, submit }
	}

	it("keeps an onSubmit rejection in the submission snapshot", async () => {
		const failure = new Error("Server unavailable")
		const onSubmit = vi.fn<() => Promise<void>>(() => Promise.reject(failure))
		const unhandled = captureUnhandledRejections()
		try {
			const { form, submit } = renderRejectingForm({ onSubmit })
			submit()
			await waitFor(() =>
				expect(form.current?.submission.getSnapshot()).toEqual({
					action: null,
					error: { value: failure },
				}),
			)
			expect(Object.isFrozen(form.current?.submission.getSnapshot())).toBe(true)
			expect(form.isSubmitSuccessful).toBe(false)
			const button = screen.getByRole("button", { name: "Save" })
			expect((button as HTMLButtonElement).disabled).toBe(false)

			onSubmit.mockImplementationOnce(() => Promise.reject(undefined))
			submit()
			await waitFor(() =>
				expect(form.current?.submission.getSnapshot().error).toEqual({
					value: undefined,
				}),
			)
		} finally {
			await unhandled.restore()
		}
		expect(unhandled.reasons).toEqual([])
	})

	it("clears the submission error on the next submit and on setIssues", async () => {
		let release = () => {}
		const onSubmit = vi.fn<() => Promise<void>>(() => Promise.reject(0))
		const { form, submit } = renderRejectingForm({ onSubmit })
		submit()
		await waitFor(() =>
			expect(form.current?.submission.getSnapshot().error).toEqual({
				value: 0,
			}),
		)

		onSubmit.mockImplementationOnce(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)
		submit()
		await waitFor(() =>
			expect(form.current?.submission.getSnapshot()).toEqual({
				action: "save",
				error: null,
			}),
		)
		await act(async () => release())
		await waitFor(() =>
			expect(form.current?.submission.getSnapshot()).toEqual({
				action: null,
				error: null,
			}),
		)

		submit()
		await waitFor(() =>
			expect(form.current?.submission.getSnapshot().error).not.toBeNull(),
		)
		act(() => form.current?.setIssues([]))
		expect(form.current?.submission.getSnapshot()).toEqual({
			action: null,
			error: null,
		})
	})

	it("clears the submission error on a native form reset", async () => {
		const onSubmit = vi.fn<() => Promise<void>>(() => Promise.reject(0))
		const { form, submit } = renderRejectingForm({ onSubmit })
		submit()
		await waitFor(() =>
			expect(form.current?.submission.getSnapshot().error).toEqual({
				value: 0,
			}),
		)
		const element = screen.getByRole("button", { name: "Save" }).closest("form")
		act(() => {
			fireEvent.reset(element as HTMLFormElement)
		})
		expect(form.current?.submission.getSnapshot()).toEqual({
			action: null,
			error: null,
		})
	})

	it("does not capture validate failures or schema issues as submission errors", async () => {
		const failure = new Error("Validator crashed")
		const unhandled = captureUnhandledRejections()
		try {
			const { form, submit } = renderRejectingForm({
				onSubmit: vi.fn(),
				validate: () => {
					throw failure
				},
			})
			submit()
			await waitFor(() => expect(unhandled.reasons).toEqual([failure]))
			expect(form.current?.submission.getSnapshot()).toEqual({
				action: null,
				error: null,
			})
		} finally {
			await unhandled.restore()
		}

		const strictSchema = z.object({ name: z.string().min(5, "Too short.") })
		const strictDefinition = kit.defineForm(strictSchema, (ui) => [
			ui.field("name", { control: "text", label: "Name" }),
		])
		const onSubmit = vi.fn()
		let form: FormBinding<typeof strictSchema, unknown, "submit"> | undefined
		function Strict() {
			form = kit.useForm(strictDefinition, {
				defaultValues: { name: "Ada" },
				onSubmit,
			})
			return <kit.AutoForm form={form} />
		}
		cleanup()
		render(<Strict />)
		fireEvent.submit(
			screen.getByLabelText("Name").closest("form") as HTMLElement,
		)
		await screen.findByText("Too short.")
		expect(onSubmit).not.toHaveBeenCalled()
		expect(form?.submission.getSnapshot()).toEqual({
			action: null,
			error: null,
		})
	})

	it("submits from a Submit outside Form with an action and the form attribute", async () => {
		let release = () => {}
		const onSubmit = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		)
		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
				onSubmit,
			})
			return (
				<>
					<kit.AutoForm form={form} id="invite-form" />
					<footer>
						<kit.Submit action={form.actions.submit} form="invite-form">
							{({ buttonProps, isPending }) => (
								<button {...buttonProps}>
									{isPending ? "Sending" : "Send invite"}
								</button>
							)}
						</kit.Submit>
					</footer>
				</>
			)
		}
		render(<View />)
		const button = screen.getByRole("button", { name: "Send invite" })
		expect(button.closest("form")).toBeNull()
		expect((button as HTMLButtonElement).form?.id).toBe("invite-form")

		fireEvent.click(button)
		const pending = await screen.findByRole("button", { name: "Sending" })
		expect((pending as HTMLButtonElement).disabled).toBe(true)
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ value: { name: "Ada" } }),
		)
		await act(async () => release())
		const idle = await screen.findByRole("button", { name: "Send invite" })
		expect((idle as HTMLButtonElement).disabled).toBe(false)
		expect(onSubmit).toHaveBeenCalledTimes(1)
	})

	it("accepts bindings of a narrower forContext kit in the base kit components", async () => {
		type AppContext = { readonly isNew: boolean }
		type InviteContext = AppContext & { readonly teams: readonly string[] }
		const appKit = kit.forContext<AppContext>()
		const inviteKit = appKit.forContext<InviteContext>()
		const inviteDefinition = inviteKit.defineForm(schema, (ui) => [
			ui.field("name", {
				control: "text",
				label: (_values, { context }) => context.teams.join(", "),
			}),
		])
		const save = vi.fn()
		const skip = vi.fn()

		function Footer<Schema extends StandardSchema, Context extends AppContext>({
			binding,
			action,
		}: {
			readonly binding: FormBinding<Schema, Context, "save" | "skip">
			readonly action: FormAction<Schema, Context, "skip">
		}) {
			return (
				<>
					<appKit.Submit action={binding.actions.save} form="invite-form">
						{/* An implicit any parameter here fails the typecheck. */}
						{({ buttonProps }) => <button {...buttonProps}>Save</button>}
					</appKit.Submit>
					<appKit.Submit action={action} form="invite-form">
						Skip
					</appKit.Submit>
				</>
			)
		}

		function Shell<Schema extends StandardSchema, Context extends AppContext>({
			form,
		}: {
			readonly form: FormBinding<Schema, Context>
		}) {
			return (
				<>
					<appKit.Form form={form} id="invite-form">
						<appKit.Fields />
					</appKit.Form>
					<appKit.AutoForm form={form} id="invite-auto-form" />
				</>
			)
		}

		function View() {
			const form = inviteKit.useForm(inviteDefinition, {
				context: { isNew: true, teams: ["Core", "Docs"] },
				defaultValues: { name: "Ada" },
				actions: {
					save: { onSubmit: ({ value }) => save(value) },
					skip: { onSubmit: ({ value }) => skip(value) },
				},
			})
			// @ts-expect-error A narrower binding is not a base binding.
			const widened: FormBinding<typeof schema, AppContext> = form
			void widened
			return (
				<>
					<Shell form={form} />
					<Footer action={form.actions.skip} binding={form} />
				</>
			)
		}

		function Unrelated({
			form,
		}: {
			readonly form: FormBinding<typeof schema, { readonly other: true }>
		}) {
			return (
				<>
					{/* @ts-expect-error The binding context must extend the kit context. */}
					<appKit.Submit action={form.actions.submit}>Save</appKit.Submit>
					{/* @ts-expect-error The binding context must extend the kit context. */}
					<appKit.AutoForm form={form} />
					{/* @ts-expect-error The binding context must extend the kit context. */}
					<appKit.Form form={form} />
				</>
			)
		}
		void Unrelated

		function BindingChildren({
			form,
		}: {
			readonly form: FormBinding<typeof schema, InviteContext>
		}) {
			return (
				<appKit.Submit action={form.actions.submit}>
					{({ values }) => {
						expectTypeOf(values.name).toEqualTypeOf<string>()
						// @ts-expect-error The values follow the action form schema.
						void values.nonexistent
						return "Save"
					}}
				</appKit.Submit>
			)
		}
		void BindingChildren

		render(<View />)
		expect(screen.getAllByLabelText("Core, Docs")).toHaveLength(2)
		fireEvent.click(screen.getByRole("button", { name: "Save" }))
		await waitFor(() => expect(save).toHaveBeenCalledWith({ name: "Ada" }))
		fireEvent.click(screen.getByRole("button", { name: "Skip" }))
		await waitFor(() => expect(skip).toHaveBeenCalledWith({ name: "Ada" }))
	})

	it("rejects a Submit whose action does not select its form", () => {
		const errors = vi.spyOn(console, "error").mockImplementation(() => {})
		const otherKit = createFormKit({ controls: kit.controls, slots: kit.slots })
		function Foreign() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
				onSubmit: vi.fn(),
			})
			return (
				<otherKit.Submit action={form.actions.submit}>Save</otherKit.Submit>
			)
		}
		function InsideMismatch() {
			const mounted = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
				onSubmit: vi.fn(),
			})
			const other = kit.useForm(definition, {
				defaultValues: { name: "Grace" },
				onSubmit: vi.fn(),
			})
			return (
				<kit.Form form={mounted}>
					<kit.Submit action={other.actions.submit}>Save</kit.Submit>
				</kit.Form>
			)
		}
		expect(() => render(<Foreign />)).toThrow("not mounted by this form kit")
		expect(() => render(<InsideMismatch />)).toThrow(
			"Submit action must belong to the surrounding Form",
		)
		errors.mockRestore()
	})

	it("keeps native Enter submission for the submit shorthand", () => {
		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
				onSubmit: vi.fn(),
			})
			return <kit.AutoForm form={form} />
		}
		render(<View />)
		expect(
			fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" }),
		).toBe(true)
	})

	it("keeps the submit shorthand as a submit action", async () => {
		const onSubmit = vi.fn()
		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
				onSubmit,
			})
			expectTypeOf(form.actions).toEqualTypeOf<{
				readonly submit: FormAction<typeof schema, unknown, "submit">
			}>()
			return (
				<kit.Form form={form}>
					<kit.Submit action={form.actions.submit}>Save</kit.Submit>
				</kit.Form>
			)
		}
		render(<View />)
		fireEvent.click(screen.getByRole("button", { name: "Save" }))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
	})
})

describe("form.submit", () => {
	const draftSchema = z.object({ title: z.string().min(1, "Enter a title") })
	const draftDefinition = kit.defineForm(draftSchema, (ui) => [
		ui.field("title", { control: "text", label: "Title" }),
	])

	function mountActions(
		options: {
			readonly title?: string
			readonly disabled?: boolean
			readonly publish?: () => unknown
			readonly validate?: () => readonly { message: string; path?: "title" }[]
		} = {},
	) {
		const { result } = renderHook(() =>
			kit.useForm(draftDefinition, {
				defaultValues: { title: options.title ?? "Draft" },
				disabled: options.disabled === true,
				actions: {
					publish: {
						validate: options.validate,
						onSubmit: () => options.publish?.(),
					},
					archive: { onSubmit: () => undefined },
				},
			}),
		)
		return result.current
	}

	it("resolves accepted after onSubmit without a mounted form", async () => {
		const publish = vi.fn()
		const form = mountActions({ publish })

		const result = await act(() => form.submit(form.actions.publish))

		expect(result).toEqual({ accepted: true, action: "publish" })
		expect(publish).toHaveBeenCalledOnce()
	})

	it("resolves invalid with the schema issues", async () => {
		const form = mountActions({ title: "" })

		const result = await act(() => form.submit(form.actions.publish))

		expect(result).toEqual({
			accepted: false,
			action: "publish",
			reason: "invalid",
			issues: [{ message: "Enter a title", path: "title" }],
		})
	})

	it("resolves invalid with the action issues", async () => {
		const form = mountActions({
			validate: () => [{ message: "Title is taken", path: "title" }],
		})

		const result = await act(() => form.submit(form.actions.publish))

		expect(result).toEqual({
			accepted: false,
			action: "publish",
			reason: "invalid",
			issues: [{ message: "Title is taken", path: "title" }],
		})
	})

	it("resolves pending for a second call while the first one runs", async () => {
		let release: () => void = () => undefined
		const form = mountActions({
			publish: () =>
				new Promise<void>((resolve) => {
					release = resolve
				}),
		})

		const first = form.submit(form.actions.publish)
		const second = await form.submit(form.actions.archive)
		await waitFor(() =>
			expect(form.submission.getSnapshot().action).toBe("publish"),
		)
		release()

		expect(second).toEqual({
			accepted: false,
			action: "archive",
			reason: "pending",
		})
		expect(await act(() => first)).toEqual({
			accepted: true,
			action: "publish",
		})
	})

	it("resolves disabled while the form option disabled is set", async () => {
		const publish = vi.fn()
		const form = mountActions({ disabled: true, publish })

		const result = await act(() => form.submit(form.actions.publish))

		expect(result).toEqual({
			accepted: false,
			action: "publish",
			reason: "disabled",
		})
		expect(publish).not.toHaveBeenCalled()
	})

	it("resolves failed with the onSubmit rejection", async () => {
		const rejection = new Error("Network down")
		const form = mountActions({
			publish: () => Promise.reject(rejection),
		})

		const result = await act(() => form.submit(form.actions.publish))

		expect(result).toEqual({
			accepted: false,
			action: "publish",
			reason: "failed",
			error: rejection,
		})
		expect(form.submission.getSnapshot().error).toEqual({ value: rejection })
	})

	it("accepts no action for the onSubmit shorthand only", async () => {
		const onSubmit = vi.fn()
		const shorthand = renderHook(() =>
			kit.useForm(draftDefinition, {
				defaultValues: { title: "Draft" },
				onSubmit,
			}),
		).result.current
		const named = mountActions()

		expect(await act(() => shorthand.submit())).toEqual({
			accepted: true,
			action: "submit",
		})
		expect(onSubmit).toHaveBeenCalledOnce()
		await expect(
			// @ts-expect-error Named actions require an action argument.
			named.submit(),
		).rejects.toThrow(
			"form.submit requires an action when useForm configures actions",
		)
		await expect(
			// @ts-expect-error The action of another form is a type error.
			named.submit(shorthand.actions.submit),
		).rejects.toThrow("form.submit requires an action of this form")
	})
})
