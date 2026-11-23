"use client"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { memo, Suspense, startTransition, use } from "react"
import { useWatch } from "react-hook-form"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import type { FormBinding } from "./create-form-kit.js"
import {
	attachFormDiagnosticSink,
	type FormDiagnosticEvent,
	getFormDiagnosticsRuntime,
} from "./diagnostics.js"
import { kit } from "./test-fixtures.js"
import type { RenderNodeProps } from "./types.js"
import type { FormMiddleware, ValueTransaction } from "./value-middleware.js"

describe("kit.useField", () => {
	const nicknameSchema = z.object({ name: z.string(), nickname: z.string() })

	it("dispatches a managed update with a control source", () => {
		const transactions: ValueTransaction<z.input<typeof nicknameSchema>>[] = []
		const middlewareCalls: string[] = []
		const recordSource: FormMiddleware<z.input<typeof nicknameSchema>> =
			() => (next) => (transaction) => {
				middlewareCalls.push(transaction.source.type)
				return next(transaction.patches)
			}
		const definition = kit.defineForm(
			nicknameSchema,
			(ui) => [ui.field("name", { control: "text", label: "Name" })],
			{
				beforeUpdate: (draft, transaction) => {
					draft.nickname = draft.nickname.toUpperCase()
					transactions.push(transaction)
				},
				middleware: [recordSource],
			},
		)
		function NicknameField({
			form,
		}: {
			readonly form: FormBinding<typeof nicknameSchema>
		}) {
			const field = kit.useField(form, "nickname")
			return (
				<input
					aria-label="Nickname"
					id={field.input.id}
					name={field.input.name}
					onBlur={field.blur}
					onChange={(event) => field.setValue(event.currentTarget.value)}
					ref={field.input.ref}
					value={field.value}
				/>
			)
		}
		function Editor() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "", nickname: "" },
			})
			return (
				<kit.Form form={form}>
					<kit.Fields />
					<NicknameField form={form} />
				</kit.Form>
			)
		}
		render(<Editor />)

		fireEvent.change(screen.getByLabelText("Nickname"), {
			target: { value: "ada" },
		})

		expect((screen.getByLabelText("Nickname") as HTMLInputElement).value).toBe(
			"ADA",
		)
		expect(transactions.map(({ source }) => source)).toEqual([
			{ path: "nickname", type: "control" },
		])
		expect(middlewareCalls).toEqual(["control"])
	})

	it("returns the binding of the surrounding Form through kit.useFormContext", () => {
		const definition = kit.defineForm(nicknameSchema, (ui) => [
			ui.field("name", { control: "text", label: "Name" }),
		])
		let bound: FormBinding<typeof nicknameSchema> | undefined
		let fromContext: FormBinding<typeof nicknameSchema> | undefined
		function Nested() {
			fromContext = kit.useFormContext<typeof nicknameSchema>()
			const field = kit.useField(fromContext, "nickname")
			return <output>{field.meta.dirty ? "dirty" : "clean"}</output>
		}
		function Editor() {
			bound = kit.useForm(definition, {
				defaultValues: { name: "", nickname: "" },
			})
			return (
				<kit.Form form={bound}>
					<Nested />
				</kit.Form>
			)
		}
		render(<Editor />)

		expect(fromContext).toBe(bound)
		expect(screen.getByText("clean")).toBeTruthy()
	})
})

describe("kit.useFormContext settings", () => {
	it("renders a memoized caller again when the context changes", () => {
		type Context = { readonly locale: string }
		const localeKit = kit.forContext<Context>()
		const definition = localeKit.defineForm(
			z.object({ name: z.string() }),
			(ui) => [ui.field("name", { control: "text", label: "Name" })],
		)
		const Locale = memo(function Locale() {
			return <output>{localeKit.useFormContext().context.locale}</output>
		})
		function Editor({ locale }: Context) {
			const form = localeKit.useForm(definition, {
				context: { locale },
				defaultValues: { name: "" },
			})
			return (
				<localeKit.Form form={form}>
					<Locale />
				</localeKit.Form>
			)
		}
		const { rerender } = render(<Editor locale="en" />)

		rerender(<Editor locale="fr" />)

		expect(screen.getByText("fr")).toBeTruthy()
	})
})

describe("render node path prefix", () => {
	it("gives a render node the absolute path of its array item", () => {
		const schema = z.object({
			rows: z.array(
				z.object({ items: z.array(z.object({ title: z.string() })) }),
			),
		})
		const scopes: string[] = []
		function Scope({ pathPrefix }: RenderNodeProps) {
			scopes.push(pathPrefix)
			return <span>{`scope:${pathPrefix}`}</span>
		}
		const definition = kit.defineForm(schema, (ui) => [
			ui.render("root", { component: Scope }),
			ui.array("rows", {
				itemDefault: { items: [] },
				children: (row) => [
					row.array("items", {
						itemDefault: { title: "" },
						children: (item) => [item.render("cell", { component: Scope })],
					}),
				],
			}),
		])
		function Editor() {
			const form = kit.useForm(definition, {
				defaultValues: {
					rows: [{ items: [] }, { items: [{ title: "a" }, { title: "b" }] }],
				},
			})
			return (
				<kit.Form form={form}>
					<kit.Fields />
				</kit.Form>
			)
		}
		render(<Editor />)

		expect(screen.getByText("scope:")).toBeTruthy()
		expect(screen.getByText("scope:rows.1.items.0")).toBeTruthy()
		expect(screen.getByText("scope:rows.1.items.1")).toBeTruthy()
	})
})

describe("kit.Fields node", () => {
	const schema = z.object({
		name: z.string(),
		email: z.string(),
		rows: z.array(z.object({ title: z.string() })),
	})
	const definition = kit.defineForm(schema, (ui) => [
		ui.section("identity", {
			title: "Identity",
			children: [ui.field("name", { control: "text", label: "Name" })],
		}),
		ui.field("email", { control: "text", label: "Email" }),
		ui.array("rows", {
			label: "Rows",
			itemDefault: { title: "" },
			children: (row) => [
				row.field("title", { control: "text", label: "Title" }),
			],
		}),
	])
	function Editor({ node }: { readonly node: string }) {
		const form = kit.useForm(definition, {
			defaultValues: { name: "", email: "", rows: [{ title: "" }] },
		})
		return (
			<kit.Form form={form}>
				<kit.Fields node={node} />
			</kit.Form>
		)
	}

	it("renders only the selected node and its children", () => {
		render(<Editor node="identity" />)

		expect(screen.getByRole("heading", { name: "Identity" })).toBeTruthy()
		expect(screen.getByLabelText("Name")).toBeTruthy()
		expect(screen.queryByLabelText("Email")).toBeNull()
		expect(screen.queryByLabelText("Title")).toBeNull()
	})

	it("selects a node in an array row by its row-prefixed ID", () => {
		render(<Editor node="rows.0.field:title" />)

		expect(screen.getByLabelText("Title")).toBeTruthy()
		expect(screen.queryByRole("heading", { name: "Rows" })).toBeNull()
	})

	it("throws for an unknown node ID", () => {
		vi.spyOn(console, "error").mockImplementation(() => undefined)
		expect(() => render(<Editor node="missing" />)).toThrow(
			'Unknown UI node id "missing"',
		)
		vi.restoreAllMocks()
	})
})

describe("resolution of one form", () => {
	it("resolves once per value change for several kit.Fields", () => {
		const schema = z.object({ name: z.string(), email: z.string() })
		const emailLabel = vi.fn(
			(values: { name: string }) => `Email ${values.name}`,
		)
		const definition = kit.defineForm(schema, (ui) => [
			ui.field("name", { control: "text", label: "Name" }),
			ui.field("email", { control: "text", label: emailLabel }),
		])
		let bound: FormBinding<typeof schema> | undefined
		function Wizard() {
			bound = kit.useForm(definition, {
				defaultValues: { name: "", email: "" },
			})
			return (
				<kit.Form form={bound}>
					<kit.Fields node="field:name" />
					<kit.Fields node="field:email" />
					<kit.Fields node="field:email" />
				</kit.Form>
			)
		}
		render(<Wizard />)
		const events: FormDiagnosticEvent[] = []
		const target = getFormDiagnosticsRuntime(bound as object).diagnosticTarget
		const detach = attachFormDiagnosticSink(target, {
			publish: (event) => events.push(event),
		})
		emailLabel.mockClear()

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Ada" },
		})
		detach()

		expect(emailLabel).toHaveBeenCalledTimes(1)
		expect(events.filter(({ kind }) => kind === "definition")).toHaveLength(1)
		expect(screen.getAllByText("Email Ada")).toHaveLength(2)
	})
})

describe("a render that React discards", () => {
	it("keeps the committed resolution", async () => {
		const schema = z.object({ name: z.string() })
		const definition = kit.defineForm(schema, (ui) => [
			ui.field("name", {
				control: "text",
				label: (values: { name: string }) => `Name ${values.name}`,
			}),
		])
		const pending = new Promise<never>(() => undefined)
		function Gate() {
			const name = useWatch({ name: "name" })
			if (name === "Ada") use(pending)
			return null
		}
		let bound: FormBinding<typeof schema> | undefined
		function Editor() {
			bound = kit.useForm(definition, { defaultValues: { name: "" } })
			return (
				<kit.Form form={bound}>
					<Suspense fallback={<p>Loading</p>}>
						<kit.Fields />
						<Gate />
					</Suspense>
				</kit.Form>
			)
		}
		render(<Editor />)
		const runtime = getFormDiagnosticsRuntime(bound as object)
		const committed = runtime.resolved

		// The transition suspends, so React discards its render of kit.Fields.
		await act(async () => {
			startTransition(() => bound?.api.setValue("name", "Ada"))
		})

		expect(screen.getByText("Name")).toBeTruthy()
		expect(screen.queryByText("Loading")).toBeNull()
		expect(runtime.resolved).toBe(committed)
		expect(runtime.resolved?.nodes[0]).toMatchObject({ label: "Name " })
	})
})

describe("kit.ErrorSummary", () => {
	it("receives focus on an invalid submit when no field takes it", async () => {
		const schema = z.object({ consent: z.literal(true, "Accept the terms") })
		const definition = kit.defineForm(schema, (ui) => [
			ui.render("terms", { component: () => <p>Terms</p> }),
		])
		function Editor() {
			const form = kit.useForm(definition, {
				defaultValues: { consent: false as unknown as true },
			})
			return (
				<kit.Form aria-label="Terms form" form={form}>
					<kit.ErrorSummary />
					<kit.Fields />
					<kit.Submit>Send</kit.Submit>
				</kit.Form>
			)
		}
		render(<Editor />)

		await act(async () => {
			fireEvent.click(screen.getByRole("button", { name: "Send" }))
		})

		const summary = await screen.findByText("Accept the terms")
		await waitFor(() => expect(document.activeElement).toBe(summary))
	})
})
