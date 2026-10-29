"use client"

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { Profiler } from "react"
import {
	Controller,
	useFormContext,
	useFormState,
	useWatch,
} from "react-hook-form"
import { describe, expect, expectTypeOf, it, vi } from "vitest"
import { z } from "zod"
import { defineControl } from "./control-definition.js"
import { createFormKit } from "./create-form-kit.js"
import type { ResolvedFieldNode, ResolvedNode } from "./definition.js"
import { definition, kit, schema } from "./test-fixtures.js"
import type {
	ArraySlotProps,
	FieldSlotProps,
	RenderNodeComponent,
	RenderNodeProps,
	SectionSlotProps,
	StandardSchema,
	SubmitSlotProps,
} from "./types.js"
import type { FormMiddleware } from "./value-middleware.js"

function assertResolvedNodeContract(node: ResolvedNode) {
	switch (node.kind) {
		case "field":
			node.path satisfies string
			node.control satisfies string
			node.required satisfies boolean
			break
		case "section":
			node.columns satisfies number
			node.children satisfies readonly ResolvedNode[]
			break
		case "array":
			node.path satisfies string
			node.itemChildren satisfies readonly (readonly ResolvedNode[])[]
			break
		case "render":
			node.component satisfies RenderNodeComponent
			break
		default:
			node satisfies never
	}
}

void assertResolvedNodeContract
describe("form kit", () => {
	it("keeps erased resolved slot options honest", () => {
		expectTypeOf<ResolvedFieldNode["slotOptions"]>().toEqualTypeOf<unknown>()
		expectTypeOf<SubmitSlotProps["values"]>().toEqualTypeOf<
			Readonly<Record<string, unknown>>
		>()
	})

	it("stores one immutable managed-update policy on the definition", () => {
		const beforeUpdate = vi.fn()
		const afterUpdate = vi.fn()
		const first: FormMiddleware<{ name: string }> =
			() => (next) => (transaction) =>
				next(transaction.patches)
		const second: FormMiddleware<{ name: string }> =
			() => (next) => (transaction) =>
				next(transaction.patches)
		const middleware = [first]
		const configured = kit.defineForm(
			schema,
			{ ui: [] },
			{ afterUpdate, beforeUpdate, middleware },
		)
		middleware[0] = second

		expect(configured.beforeUpdate).toBe(beforeUpdate)
		expect(configured.afterUpdate).toBe(afterUpdate)
		expect(configured.middleware).toEqual([first])
		expect(Object.isFrozen(configured.middleware)).toBe(true)
	})

	it("normalizes schema-bound builders through the ordinary definition path", () => {
		const authorSchema = z.object({
			name: z.string(),
			speakers: z.array(z.object({ name: z.string() })),
		})
		const Summary = () => null
		let rootBuilds = 0
		let itemBuilds = 0
		const built = kit.defineForm(authorSchema, (ui) => {
			rootBuilds += 1
			return [
				ui.section("profile", {
					children: [
						ui.field("name", {
							control: "text",
							label: "Name",
						}),
					],
					columns: 2,
				}),
				ui.array("speakers", {
					children: (item) => {
						itemBuilds += 1
						return [
							item.field("name", {
								control: "text",
								label: "Speaker",
							}),
						]
					},
					itemDefault: { name: "" },
				}),
				ui.render("summary", { component: Summary }),
			]
		})
		const authored = kit.defineForm(authorSchema, {
			ui: [
				{
					kind: "section",
					id: "profile",
					children: [
						{
							kind: "field",
							path: "name",
							control: "text",
							label: "Name",
						},
					],
					columns: 2,
				},
				{
					kind: "array",
					path: "speakers",
					children: [
						{
							kind: "field",
							path: "name",
							control: "text",
							label: "Speaker",
						},
					],
					itemDefault: { name: "" },
				},
				{ kind: "render", id: "summary", component: Summary },
			],
		})

		expect(rootBuilds).toBe(1)
		expect(itemBuilds).toBe(1)
		expect(built.ui).toEqual(authored.ui)
		expect(built.nodes).toEqual(authored.nodes)
		expect(Object.isFrozen(built)).toBe(true)
		expect(built.nodes.every(Object.isFrozen)).toBe(true)
	})

	it("composes builder-authored fragments and protects node identity", () => {
		const addressFragment = kit.defineFragment(
			z.object({ street: z.string() }),
			(ui) => [ui.field("street", { control: "text" })],
		)
		const placed = kit.defineForm(
			z.object({ address: addressFragment.schema, name: z.string() }),
			(ui) => [
				ui.section("address", {
					children: [addressFragment.fields({ at: "address" })],
				}),
				ui.field("name", {
					control: "text",
					kind: "render",
					path: "missing",
				} as never),
			],
		)

		expect(placed.nodes.find((node) => node.kind === "field")?.path).toBe(
			"address.street",
		)
		expect(placed.ui[1]).toMatchObject({
			kind: "field",
			path: "name",
		})
	})

	it("validates static fragment layout against its form kit grid", () => {
		expect(() =>
			kit.defineFragment(schema, {
				ui: [{ control: "text", kind: "field", path: "name", span: 5 }],
			} as never),
		).toThrow("Layout span must use the kit grid")
	})

	it("rejects malformed schema-bound builder results", () => {
		const arraySchema = z.object({
			items: z.array(z.object({ name: z.string() })),
		})

		expect(() => kit.defineFragment(schema, (async () => []) as never)).toThrow(
			"Fragment definition builder must return a ui array",
		)
		expect(() =>
			kit.defineForm(arraySchema, (ui) => [
				ui.array("items", {
					children: [] as never,
					itemDefault: { name: "" },
				}),
			]),
		).toThrow("Array builder children must be a function")
		expect(() =>
			kit.defineForm(arraySchema, (ui) => [
				ui.array("items", {
					children: (() => ({})) as never,
					itemDefault: { name: "" },
				}),
			]),
		).toThrow("Array builder children must return a ui array")
		expect(() =>
			kit.defineForm(schema, (ui) => [ui.field("name", null as never)]),
		).toThrow("Field builder options must be an object")
	})

	it("requires every structural slot before a kit exists", () => {
		for (const missing of [
			"Field",
			"Section",
			"Array",
			"ArrayItem",
			"ErrorMessage",
			"Submit",
		] as const) {
			const slots = { ...kit.slots, [missing]: undefined }
			expect(() =>
				createFormKit({ controls: kit.controls, slots: slots as never }),
			).toThrow(`createFormKit requires a ${missing} slot`)
		}
	})

	it("requires an object defaultValues for every form binding", () => {
		for (const defaultValues of [undefined, null, "Ada", 1, [], () => null]) {
			function View() {
				kit.useForm(definition, { defaultValues } as never)
				return null
			}

			expect(() => render(<View />)).toThrow(
				"Form defaultValues must be an object",
			)
		}
	})
	it("rejects generated components rendered outside a form context", () => {
		const bare = createFormKit({ controls: kit.controls, slots: kit.slots })

		expect(() => render(<bare.Fields />)).toThrow(
			"React Hook Form context is missing",
		)
	})

	it("rejects a definition owned by another form kit", () => {
		const otherKit = createFormKit({ controls: kit.controls, slots: kit.slots })

		function View() {
			otherKit.useForm(definition as never, {
				defaultValues: { name: "Ada" },
			})
			return null
		}

		expect(() => render(<View />)).toThrow(
			"kit.useForm requires a definition from this exact form kit. If this error appears after a hot reload, reload the page or remount the component that calls kit.useForm.",
		)
	})

	it("rejects a form binding owned by another form kit", () => {
		const otherKit = createFormKit({ controls: kit.controls, slots: kit.slots })

		function View() {
			const form = kit.useForm(definition, { defaultValues: { name: "Ada" } })
			return <otherKit.Form form={form} />
		}

		expect(() => render(<View />)).toThrow(
			"Form binding is not mounted by this form kit",
		)
	})

	it("expands reusable fragments with local resolvers in every object scope", () => {
		type AddressContext = { readonly prefix: string }
		const addressKit = kit.forContext<AddressContext>()
		const cityFragment = addressKit.defineFragment(
			z.object({ city: z.string() }),
			{
				ui: [
					{
						kind: "field",
						path: "city",
						control: "text",
						label: (location) => `City ${location.city}`,
					},
				],
			},
		)
		const phoneFragment = addressKit.defineFragment(
			z.object({ number: z.string() }),
			{
				ui: [
					{
						kind: "field",
						path: "number",
						control: "text",
						label: (phone) => `Phone ${phone.number}`,
					},
				],
			},
		)
		const addressSchema = cityFragment.schema.extend({
			phoneGroups: z.array(
				z.object({
					phones: z.array(
						phoneFragment.schema.extend({ extension: z.string() }),
					),
					type: z.string(),
				}),
			),
			street: z.string(),
		})
		const addressFragment = addressKit.defineFragment(addressSchema, {
			ui: [
				{
					kind: "section",
					id: "details",
					children: [
						{
							kind: "field",
							path: "street",
							control: "text",
							label: (address, { context }) =>
								`${context.prefix} ${address.street}`,
						},
						cityFragment.fields(),
						{
							kind: "array",
							path: "phoneGroups",
							itemDefault: { phones: [], type: "" },
							children: [
								{
									kind: "field",
									path: "type",
									control: "text",
									label: (address) => `Group ${address.city}`,
								},
								{
									kind: "array",
									path: "phones",
									itemDefault: { extension: "", number: "" },
									children: [
										phoneFragment.fields(),
										{
											kind: "field",
											path: "extension",
											control: "text",
											label: (address) => `Extension ${address.city}`,
										},
									],
								},
							],
						},
					],
				},
			],
		})
		const hostKit = kit.forContext<
			AddressContext & { readonly canEdit: boolean }
		>()
		const hostSchema = z.object({
			addresses: z.array(addressFragment.schema),
			billing: addressFragment.schema,
			recipients: z.array(
				z.object({ address: addressFragment.schema, name: z.string() }),
			),
			shipping: addressFragment.schema.extend({ id: z.string() }),
		})
		const hostDefinition = hostKit.defineForm(hostSchema, {
			ui: [
				addressFragment.fields({ at: "shipping" }),
				addressFragment.fields({ at: "billing" }),
				{
					kind: "array",
					path: "recipients",
					itemDefault: {
						address: { city: "", phoneGroups: [], street: "" },
						name: "",
					},
					children: [addressFragment.fields({ at: "address" })],
				},
				{
					kind: "array",
					path: "addresses",
					itemDefault: { city: "", phoneGroups: [], street: "" },
					children: [addressFragment.fields()],
				},
			],
		})

		expect(hostDefinition.ui.map((node) => node.id)).toEqual([
			"shipping:details",
			"billing:details",
			"array:recipients",
			"array:addresses",
		])
		expect(
			hostDefinition.nodes.every((node) =>
				["array", "field", "render", "section"].includes(node.kind),
			),
		).toBe(true)

		const makeAddress = (street: string, city: string) => ({
			city,
			phoneGroups: [
				{
					phones: [{ extension: "42", number: `${street}-123` }],
					type: "mobile",
				},
			],
			street,
		})

		function View() {
			const form = hostKit.useForm(hostDefinition, {
				context: { canEdit: true, prefix: "Address" },
				defaultValues: {
					addresses: [makeAddress("Direct", "Direct City")],
					billing: makeAddress("Billing", "Billing City"),
					recipients: [
						{
							address: makeAddress("Recipient", "Recipient City"),
							name: "Ada",
						},
					],
					shipping: {
						...makeAddress("Shipping", "Shipping City"),
						id: "shipping-id",
					},
				},
			})
			return <hostKit.AutoForm form={form} />
		}

		render(<View />)
		expect(screen.getByLabelText("Address Shipping").getAttribute("name")).toBe(
			"shipping.street",
		)
		expect(screen.getByLabelText("Address Billing").getAttribute("name")).toBe(
			"billing.street",
		)
		expect(
			screen.getByLabelText("Address Recipient").getAttribute("name"),
		).toBe("recipients.0.address.street")
		expect(
			screen.getByLabelText("City Recipient City").getAttribute("name"),
		).toBe("recipients.0.address.city")
		expect(screen.getByLabelText("Address Direct").getAttribute("name")).toBe(
			"addresses.0.street",
		)
		expect(
			screen.getByLabelText("Phone Recipient-123").getAttribute("name"),
		).toBe("recipients.0.address.phoneGroups.0.phones.0.number")
		expect(
			screen.getByLabelText("Extension Recipient City").getAttribute("name"),
		).toBe("recipients.0.address.phoneGroups.0.phones.0.extension")
	})

	it("rejects fragment placements owned by another form kit", () => {
		const otherKit = createFormKit({ controls: kit.controls, slots: kit.slots })
		const foreignFragment = otherKit.defineFragment(
			z.object({ street: z.string() }),
			{ ui: [{ kind: "field", path: "street", control: "text" }] },
		)
		const hostSchema = z.object({ address: foreignFragment.schema })

		expect(() =>
			kit.defineFragment(hostSchema, {
				ui: [foreignFragment.fields({ at: "address" })],
			}),
		).toThrow("Fragment placement must come from this exact form kit")

		expect(() =>
			kit.defineForm(hostSchema, {
				ui: [foreignFragment.fields({ at: "address" })],
			}),
		).toThrow("Fragment placement must come from this exact form kit")
	})

	it("snapshots fragment sources and validates placement paths", () => {
		const schema = z.object({ street: z.string() })
		const ui = [
			{
				kind: "field" as const,
				path: "street" as const,
				control: "text" as const,
				label: "Original street",
			},
		]
		const fragment = kit.defineFragment(schema, { ui })
		expect(() =>
			kit.defineFragment(schema, {
				ui: [
					{
						kind: "field",
						path: "street",
						control: "missing" as never,
					},
				],
			}),
		).toThrow('Unknown control "missing"')

		ui[0].label = "Mutated street"
		const placement = fragment.fields({ at: "address" })
		const placed = kit.defineForm(z.object({ address: fragment.schema }), {
			ui: [placement],
		})

		expect(fragment.schema).toBe(schema)
		expect(Object.isFrozen(fragment)).toBe(true)
		expect(Object.isFrozen(placement)).toBe(true)
		expect(placed.ui[0]?.label).toBe("Original street")
		expect(() => fragment.fields({ at: "address[0]" as never })).toThrow(
			"invalid React Hook Form syntax",
		)
	})

	it("provides raw RHF context and submits parsed output", async () => {
		const onSubmit = vi.fn()

		function ManualState() {
			const api = useFormContext<{ name: string }>()
			const name = useWatch({ control: api.control, name: "name" })
			const state = useFormState({ control: api.control })
			return (
				<>
					<output aria-label="Watched name">{name}</output>
					<output aria-label="Attempts">{state.submitCount}</output>
				</>
			)
		}

		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "" },
				onSubmit,
			})

			return (
				<kit.AutoForm form={form}>
					<ManualState />
					<kit.Submit>Save</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)

		fireEvent.click(screen.getByRole("button", { name: "Save" }))
		expect(
			await screen.findByText("Enter at least two characters"),
		).toBeTruthy()
		expect(screen.getByLabelText("Attempts").textContent).toBe("1")
		expect(onSubmit).not.toHaveBeenCalled()

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "  Ada  " },
		})
		expect(screen.getByLabelText("Watched name").textContent).toBe("  Ada  ")
		const submit = screen.getByRole("button", { name: "Save" })
		await waitFor(() => {
			expect(screen.queryByText("Enter at least two characters")).toBeNull()
			expect((submit as HTMLButtonElement).disabled).toBe(false)
		})
		fireEvent.click(submit)

		await waitFor(() => {
			expect(onSubmit).toHaveBeenCalledWith(
				expect.objectContaining({
					input: { name: "  Ada  " },
					value: { name: "Ada" },
				}),
			)
		})
	})

	it("commits dependent fields before middleware continues after next", () => {
		const locationSchema = z.object({
			city: z.string(),
			country: z.string(),
		})
		const afterNext = vi.fn()
		const locationDefinition = kit.defineForm(
			locationSchema,
			{
				ui: [
					{
						kind: "field",
						path: "country",
						control: "select",
						label: "Country",
						options: ["US", "FR", "blocked"],
					},
					{ kind: "field", path: "city", control: "text", label: "City" },
				],
			},
			{
				middleware: [
					(api) => (next) => (transaction) => {
						if (
							transaction.source.type === "control" &&
							transaction.source.path === "country"
						) {
							if (transaction.nextValues.country === "blocked") {
								return "cancelled"
							}
							const result = next([
								...transaction.patches,
								{ op: "replace", path: ["city"], value: "Paris" },
							])
							afterNext(api.getValues())
							return result
						}
						return next(transaction.patches)
					},
				],
			},
		)
		const publications: { city: string; country: string }[] = []
		let readValues = () => ({ city: "", country: "" })
		let subscribe = (): (() => void) => () => undefined
		let updateLocation = (_country: string, _city: string): unknown => undefined

		function LocationState() {
			const values = useWatch<{ city: string; country: string }>()
			return <output aria-label="Location">{JSON.stringify(values)}</output>
		}

		function View() {
			const form = kit.useForm(locationDefinition, {
				defaultValues: { city: "New York", country: "US" },
			})
			readValues = form.api.getValues
			subscribe = () =>
				form.api.subscribe({
					callback: ({ values }) => publications.push({ ...values }),
					formState: { values: true },
				})
			updateLocation = (country, city) =>
				form.update((draft) => {
					draft.city = city
					draft.country = country
				})
			return (
				<kit.Form form={form}>
					<kit.Fields />
					<LocationState />
				</kit.Form>
			)
		}

		render(<View />)
		const unsubscribe = subscribe()
		fireEvent.change(screen.getByLabelText("Country"), {
			target: { value: "FR" },
		})

		expect(readValues()).toEqual({ city: "Paris", country: "FR" })
		expect(afterNext).toHaveBeenCalledWith({ city: "Paris", country: "FR" })
		expect(screen.getByLabelText("Location").textContent).toBe(
			'{"city":"Paris","country":"FR"}',
		)
		expect(publications).toEqual([{ city: "Paris", country: "FR" }])

		fireEvent.change(screen.getByLabelText("Country"), {
			target: { value: "blocked" },
		})
		expect(readValues()).toEqual({ city: "Paris", country: "FR" })
		expect(afterNext).toHaveBeenCalledTimes(1)
		expect(publications).toHaveLength(1)

		let updateResult: unknown
		act(() => {
			updateResult = updateLocation("US", "Boston")
		})
		expect(updateResult).toMatchObject({
			nextValues: { city: "Boston", country: "US" },
			source: { type: "update" },
		})
		expect(readValues()).toEqual({ city: "Boston", country: "US" })
		expect(publications).toEqual([
			{ city: "Paris", country: "FR" },
			{ city: "Boston", country: "US" },
		])
		unsubscribe()
	})

	it("loads field options, tracks accessed values, and preserves the selection", async () => {
		const loadOptions = vi.fn(
			async ({ values }: { readonly values: { readonly query: string } }) => [
				values.query,
			],
		)
		const optionSchema = z.object({
			choice: z.string(),
			query: z.string(),
			unrelated: z.string(),
		})
		const optionDefinition = kit.defineForm(optionSchema, {
			ui: [
				{
					kind: "field",
					path: "query",
					control: "text",
					label: "Option query",
				},
				{
					kind: "field",
					path: "unrelated",
					control: "text",
					label: "Unrelated value",
				},
				{
					kind: "field",
					path: "choice",
					control: "select",
					label: "Loaded choice",
					options: loadOptions,
				},
			],
		})
		let readChoice = () => ""

		function Form() {
			const form = kit.useForm(optionDefinition, {
				defaultValues: { choice: "first", query: "first", unrelated: "a" },
			})
			readChoice = () => form.api.getValues("choice")
			return <kit.AutoForm form={form} />
		}

		render(<Form />)
		// The request settles after the call, so wait for the rendered option.
		expect(await screen.findByRole("option", { name: "first" })).not.toBeNull()
		expect(loadOptions).toHaveBeenCalledTimes(1)

		fireEvent.change(screen.getByLabelText("Unrelated value"), {
			target: { value: "b" },
		})
		expect(loadOptions).toHaveBeenCalledTimes(1)

		fireEvent.change(screen.getByLabelText("Option query"), {
			target: { value: "second" },
		})
		expect(await screen.findByRole("option", { name: "second" })).not.toBeNull()
		expect(loadOptions).toHaveBeenCalledTimes(2)
		expect(readChoice()).toBe("first")
	})

	it("does not add React commits when pass-through middleware edits a large form", () => {
		const fieldCount = 40
		const largeSchema = z.object({
			fields: z.record(z.string(), z.string()),
		})
		type LargeInput = z.input<typeof largeSchema>
		const largeDefinitionSource = {
			ui: Array.from({ length: fieldCount }, (_, index) => ({
				kind: "field" as const,
				path: `fields.field${index}` as `fields.${string}`,
				control: "text" as const,
				label: `Performance field ${index + 1}`,
			})),
		}
		const editValues = Array.from(
			{ length: 20 },
			(_, index) => `Edit ${index + 1}`,
		)
		const handled = vi.fn()
		const passThrough: FormMiddleware<LargeInput> =
			() => (next) => (transaction) => {
				handled()
				return next(transaction.patches)
			}

		function countUpdateCommits(
			middleware?: readonly FormMiddleware<LargeInput>[],
		): number {
			let updateCommits = 0
			const largeDefinition = kit.defineForm(
				largeSchema,
				largeDefinitionSource,
				{ middleware },
			)

			function View() {
				const form = kit.useForm(largeDefinition, {
					defaultValues: {
						fields: Object.fromEntries(
							Array.from({ length: fieldCount }, (_, index) => [
								`field${index}`,
								`Value ${index + 1}`,
							]),
						),
					},
				})

				return (
					<Profiler
						id="large-form"
						onRender={(_id, phase) => {
							if (phase !== "mount") updateCommits += 1
						}}
					>
						<kit.Form form={form}>
							<kit.Fields />
						</kit.Form>
					</Profiler>
				)
			}

			const view = render(<View />)
			const input = view.getByLabelText("Performance field 20")
			for (const value of editValues) {
				fireEvent.change(input, { target: { value } })
			}
			expect((input as HTMLInputElement).value).toBe(editValues.at(-1))
			view.unmount()
			return updateCommits
		}

		const baselineCommits = countUpdateCommits()
		const middlewareCommits = countUpdateCommits([passThrough])

		expect(handled).toHaveBeenCalledTimes(editValues.length)
		expect(middlewareCommits).toBe(baselineCommits)
		expect(middlewareCommits).toBeGreaterThan(0)
	})

	it("does not re-render an unrelated generated branch when resolved UI changes", () => {
		const arrayRenders = vi.fn()
		const controlRenders = vi.fn<(path: string) => void>()
		const sectionRenders = vi.fn<(title: string) => void>()
		const isolatedKit = createFormKit({
			controls: {
				text: defineControl<
					string,
					{ readonly alternate?: string; readonly marker?: string }
				>({
					component: ({
						value,
						setValue,
						blur,
						input,
						props: controlProps,
						path,
					}) => {
						controlRenders(path)
						return (
							<input
								data-option-key={
									Object.hasOwn(controlProps, "marker") ? "marker" : "alternate"
								}
								id={input.id}
								name={input.name}
								onBlur={blur}
								onChange={(event) => setValue(event.currentTarget.value)}
								ref={input.ref}
								value={value}
							/>
						)
					},
				}),
			},
			slots: {
				...kit.slots,
				Array: ({ rootProps, label, children }: ArraySlotProps) => {
					arrayRenders()
					return (
						<section {...rootProps}>
							<h2>{label}</h2>
							{children}
						</section>
					)
				},
				Section: ({ rootProps, title, children }: SectionSlotProps) => {
					sectionRenders(String(title))
					return (
						<section {...rootProps}>
							<h2>{title}</h2>
							{children}
						</section>
					)
				},
			},
		})
		const isolatedSchema = z.object({
			details: z.string(),
			first: z.string(),
			items: z.array(z.object({ name: z.string() })),
			mode: z.string(),
		})
		const isolatedDefinition = isolatedKit.defineForm(isolatedSchema, {
			ui: [
				{
					kind: "section",
					id: "stable",
					title: "Stable section",
					children: [
						{
							kind: "field",
							path: "first",
							control: "text",
							label: "First isolated field",
						},
					],
				},
				{
					kind: "section",
					id: "dynamic",
					title: "Dynamic section",
					children: [
						{
							kind: "field",
							path: "mode",
							control: "text",
							label: "Mode",
						},
						{
							kind: "field",
							path: "details",
							control: "text",
							label: "Details",
							props: (values) =>
								values.mode === "show"
									? { marker: undefined }
									: { alternate: undefined },
							visible: (values) => values.mode.startsWith("show"),
						},
					],
				},
				{
					kind: "array",
					path: "items",
					label: "Stable items",
					itemDefault: { name: "" },
					children: [
						{
							kind: "field",
							path: "name",
							control: "text",
							label: "Stable item name",
						},
					],
				},
			],
		})

		function View() {
			const form = isolatedKit.useForm(isolatedDefinition, {
				defaultValues: {
					details: "Secret",
					first: "Ada",
					items: [{ name: "Stable" }],
					mode: "hide",
				},
			})
			return (
				<isolatedKit.Form form={form}>
					<isolatedKit.Fields />
					<button type="reset">Reset isolated form</button>
				</isolatedKit.Form>
			)
		}

		render(<View />)
		arrayRenders.mockClear()
		controlRenders.mockClear()
		sectionRenders.mockClear()

		fireEvent.change(screen.getByLabelText("Mode"), {
			target: { value: "show" },
		})
		expect(screen.getByLabelText("Details")).toBeTruthy()
		expect(
			screen.getByLabelText("Details").getAttribute("data-option-key"),
		).toBe("marker")
		expect(arrayRenders).not.toHaveBeenCalled()
		expect(sectionRenders).not.toHaveBeenCalledWith("Stable section")
		expect(sectionRenders).toHaveBeenCalledWith("Dynamic section")
		expect(controlRenders).not.toHaveBeenCalledWith("first")

		controlRenders.mockClear()
		fireEvent.change(screen.getByLabelText("Mode"), {
			target: { value: "show-alt" },
		})
		expect(
			screen.getByLabelText("Details").getAttribute("data-option-key"),
		).toBe("alternate")
		expect(controlRenders).toHaveBeenCalledWith("details")

		controlRenders.mockClear()
		sectionRenders.mockClear()
		arrayRenders.mockClear()
		fireEvent.change(screen.getByLabelText("First isolated field"), {
			target: { value: "Grace" },
		})
		expect(controlRenders).toHaveBeenCalledWith("first")
		expect(controlRenders).not.toHaveBeenCalledWith("mode")
		expect(controlRenders).not.toHaveBeenCalledWith("details")
		expect(controlRenders).not.toHaveBeenCalledWith("items.0.name")
		expect(arrayRenders).not.toHaveBeenCalled()
		expect(sectionRenders).not.toHaveBeenCalled()

		arrayRenders.mockClear()
		controlRenders.mockClear()
		sectionRenders.mockClear()
		fireEvent.change(screen.getByLabelText("Stable item name"), {
			target: { value: "Updated" },
		})
		expect(controlRenders).toHaveBeenCalledWith("items.0.name")
		expect(controlRenders).not.toHaveBeenCalledWith("first")
		expect(controlRenders).not.toHaveBeenCalledWith("mode")
		expect(controlRenders).not.toHaveBeenCalledWith("details")
		expect(arrayRenders).toHaveBeenCalledTimes(1)
		expect(sectionRenders).not.toHaveBeenCalled()

		arrayRenders.mockClear()
		controlRenders.mockClear()
		fireEvent.change(screen.getByLabelText("Stable item name"), {
			target: { value: "Updated again" },
		})
		expect(controlRenders).toHaveBeenCalledWith("items.0.name")
		expect(arrayRenders).not.toHaveBeenCalled()
		expect(sectionRenders).not.toHaveBeenCalled()

		fireEvent.click(screen.getByRole("button", { name: "Reset isolated form" }))
		expect(screen.queryByLabelText("Details")).toBeNull()
		expect(
			(screen.getByLabelText("First isolated field") as HTMLInputElement).value,
		).toBe("Ada")
		expect(
			(screen.getByLabelText("Stable item name") as HTMLInputElement).value,
		).toBe("Stable")
	})

	it("updates every resolvable UI property without retaining stale presentation", () => {
		type ProbeToken = { readonly token?: string }
		type ProbeRootProps = FieldSlotProps["rootProps"] & {
			readonly "data-disabled"?: string
			readonly "data-fp-path"?: string
			readonly "data-fp-span"?: string
			readonly "data-readonly"?: string
		}
		const probeKit = createFormKit({
			controls: {
				text: defineControl<string, ProbeToken>({
					component: ({
						value,
						setValue,
						blur,
						input,
						props: probeProps,
						path,
						disabled,
						readOnly,
						required,
					}) => (
						<>
							<output data-testid={`control-props-${path}`}>
								{JSON.stringify({
									disabled,
									props: probeProps.token,
									readOnly,
									required,
								})}
							</output>
							<input
								disabled={disabled}
								id={input.id}
								name={input.name}
								onBlur={blur}
								onChange={(event) => setValue(event.currentTarget.value)}
								readOnly={readOnly}
								ref={input.ref}
								required={required}
								value={value}
							/>
						</>
					),
				}),
			},
			slots: {
				...kit.slots,
				Field: ({
					rootProps,
					labelProps,
					label,
					description,
					slotOptions,
					control,
					errors,
					disabled,
					readOnly,
					required,
				}: FieldSlotProps<ProbeToken>) => {
					const probeRoot = rootProps as ProbeRootProps
					const path = String(probeRoot["data-fp-path"])
					return (
						<div {...rootProps}>
							<output data-testid={`field-props-${path}`}>
								{JSON.stringify({
									className: probeRoot.className,
									description,
									disabled,
									label,
									readOnly,
									required,
									slotOptions: slotOptions?.token,
									span: probeRoot["data-fp-span"],
								})}
							</output>
							<label {...labelProps} htmlFor={labelProps.htmlFor}>
								{label}
							</label>
							{description}
							{control}
							{errors}
						</div>
					)
				},
				Section: ({
					rootProps,
					layoutProps,
					title,
					description,
					slotOptions,
					children,
				}: SectionSlotProps<ProbeToken>) => {
					const probeRoot = rootProps as ProbeRootProps
					return (
						<section {...rootProps}>
							<output data-testid={`section-props-${String(rootProps.id)}`}>
								{JSON.stringify({
									className: probeRoot.className,
									columns: layoutProps["data-fp-columns"],
									description,
									disabled: probeRoot["data-disabled"] === "",
									readOnly: probeRoot["data-readonly"] === "",
									slotOptions: slotOptions?.token,
									span: probeRoot["data-fp-span"],
									title,
								})}
							</output>
							<h2>{title}</h2>
							{description}
							<div {...layoutProps}>{children}</div>
						</section>
					)
				},
				Array: ({
					rootProps,
					label,
					description,
					slotOptions,
					canAdd,
					children,
				}: ArraySlotProps<ProbeToken>) => {
					const probeRoot = rootProps as ProbeRootProps
					const path = String(probeRoot["data-fp-path"])
					return (
						<section {...rootProps}>
							<output data-testid={`array-props-${path}`}>
								{JSON.stringify({
									canAdd,
									className: probeRoot.className,
									description,
									disabled: probeRoot["data-disabled"] === "",
									label,
									readOnly: probeRoot["data-readonly"] === "",
									slotOptions: slotOptions?.token,
									span: probeRoot["data-fp-span"],
								})}
							</output>
							<h2>{label}</h2>
							{description}
							{children}
						</section>
					)
				},
			},
		})
		const probeSchema = z.object({
			driver: z.string(),
			fieldVisibility: z.string(),
			formFlags: z.string(),
			items: z.array(z.object({ name: z.string() })),
			sectionChild: z.string(),
			subject: z.string(),
			visibleItems: z.array(z.object({ name: z.string() })),
		})
		const RenderProbe = ({ disabled, readOnly }: RenderNodeProps) => (
			<output data-testid="render-props">
				{JSON.stringify({ disabled, readOnly })}
			</output>
		)
		const VisibleRenderProbe = () => (
			<output data-testid="visible-render">visible render</output>
		)
		const probeDefinition = probeKit.defineForm(probeSchema, {
			ui: [
				{
					kind: "field",
					path: "driver",
					control: "text",
					label: "Resolver driver",
				},
				{
					kind: "field",
					path: "subject",
					control: "text",
					label: (values) => `${values.driver} field label`,
					description: (values) => `${values.driver} field description`,
					slotOptions: (values) => ({ token: values.driver }),
					required: (values) => values.driver === "after",
					disabled: (values) => values.driver === "after",
					readOnly: (values) => values.driver === "after",
					className: (values) => `${values.driver}-field-class`,
					span: (values) => (values.driver === "after" ? "full" : 1),
					props: (values) => ({ token: values.driver }),
				},
				{
					kind: "field",
					path: "fieldVisibility",
					control: "text",
					label: "Visible field",
					visible: (values) => values.driver === "before",
				},
				{
					kind: "field",
					path: "formFlags",
					control: "text",
					label: "Form flags",
				},
				{
					kind: "section",
					id: "subject-section",
					title: (values) => `${values.driver} section title`,
					description: (values) => `${values.driver} section description`,
					slotOptions: (values) => ({ token: values.driver }),
					disabled: (values) => values.driver === "after",
					readOnly: (values) => values.driver === "after",
					className: (values) => `${values.driver}-section-class`,
					columns: (values) => (values.driver === "after" ? 2 : 1),
					span: (values) => (values.driver === "after" ? 2 : 1),
					children: [
						{
							kind: "field",
							path: "sectionChild",
							control: "text",
							label: "Section child",
						},
					],
				},
				{
					kind: "section",
					id: "visible-section",
					title: "Visible section",
					visible: (values) => values.driver === "before",
					children: [],
				},
				{
					kind: "array",
					path: "items",
					label: (values) => `${values.driver} array label`,
					description: (values) => `${values.driver} array description`,
					slotOptions: (values) => ({ token: values.driver }),
					disabled: (values) => values.driver === "after",
					readOnly: (values) => values.driver === "after",
					className: (values) => `${values.driver}-array-class`,
					span: (values) => (values.driver === "after" ? "full" : 1),
					itemDefault: { name: "" },
					children: [
						{
							kind: "field",
							path: "name",
							control: "text",
							label: "Array child",
						},
					],
				},
				{
					kind: "array",
					path: "visibleItems",
					label: "Visible array",
					visible: (values) => values.driver === "before",
					itemDefault: { name: "" },
					children: [],
				},
				{
					kind: "render",
					id: "render-probe",
					component: RenderProbe,
					disabled: (values) => values.driver === "after",
					readOnly: (values) => values.driver === "after",
				},
				{
					kind: "render",
					id: "visible-render-probe",
					component: VisibleRenderProbe,
					visible: (values) => values.driver === "before",
				},
			],
		})
		function View({
			disabled = false,
			readOnly = false,
		}: {
			readonly disabled?: boolean
			readonly readOnly?: boolean
		}) {
			const form = probeKit.useForm(probeDefinition, {
				defaultValues: {
					driver: "before",
					fieldVisibility: "visible",
					formFlags: "form flags",
					items: [{ name: "array child" }],
					sectionChild: "section child",
					subject: "subject",
					visibleItems: [],
				},
				disabled,
				readOnly,
			})
			return <probeKit.AutoForm form={form} />
		}

		const view = render(<View />)
		const cases = [
			{
				id: "field-props-subject",
				before: {
					className: "before-field-class",
					description: "before field description",
					disabled: false,
					label: "before field label",
					readOnly: false,
					required: false,
					slotOptions: "before",
					span: "1",
				},
				after: {
					className: "after-field-class",
					description: "after field description",
					disabled: true,
					label: "after field label",
					readOnly: true,
					required: true,
					slotOptions: "after",
					span: "full",
				},
			},
			{
				id: "control-props-subject",
				before: {
					disabled: false,
					props: "before",
					readOnly: false,
					required: false,
				},
				after: {
					disabled: true,
					props: "after",
					readOnly: true,
					required: true,
				},
			},
			{
				id: "control-props-sectionChild",
				before: { disabled: false, readOnly: false, required: false },
				after: { disabled: true, readOnly: true, required: false },
			},
			{
				id: "control-props-items.0.name",
				before: { disabled: false, readOnly: false, required: false },
				after: { disabled: true, readOnly: true, required: false },
			},
			{
				id: "control-props-formFlags",
				before: { disabled: false, readOnly: false, required: false },
				after: { disabled: false, readOnly: false, required: false },
			},
			{
				id: "section-props-subject-section",
				before: {
					className: "before-section-class",
					columns: 1,
					description: "before section description",
					disabled: false,
					readOnly: false,
					slotOptions: "before",
					span: "1",
					title: "before section title",
				},
				after: {
					className: "after-section-class",
					columns: 2,
					description: "after section description",
					disabled: true,
					readOnly: true,
					slotOptions: "after",
					span: "2",
					title: "after section title",
				},
			},
			{
				id: "array-props-items",
				before: {
					canAdd: true,
					className: "before-array-class",
					description: "before array description",
					disabled: false,
					label: "before array label",
					readOnly: false,
					slotOptions: "before",
					span: "1",
				},
				after: {
					canAdd: false,
					className: "after-array-class",
					description: "after array description",
					disabled: true,
					label: "after array label",
					readOnly: true,
					slotOptions: "after",
					span: "full",
				},
			},
			{
				id: "render-props",
				before: { disabled: false, readOnly: false },
				after: { disabled: true, readOnly: true },
			},
		] as const
		const readSnapshot = (id: string): unknown =>
			JSON.parse(screen.getByTestId(id).textContent ?? "null")
		for (const testCase of cases) {
			expect(readSnapshot(testCase.id), `${testCase.id} before`).toEqual(
				testCase.before,
			)
		}
		for (const id of [
			"field-props-fieldVisibility",
			"section-props-visible-section",
			"array-props-visibleItems",
			"visible-render",
		]) {
			expect(screen.getByTestId(id), `${id} before`).toBeTruthy()
		}

		fireEvent.change(screen.getByLabelText("Resolver driver"), {
			target: { value: "after" },
		})

		for (const testCase of cases) {
			expect(readSnapshot(testCase.id), `${testCase.id} after`).toEqual(
				testCase.after,
			)
		}
		for (const id of [
			"field-props-fieldVisibility",
			"section-props-visible-section",
			"array-props-visibleItems",
			"visible-render",
		]) {
			expect(screen.queryByTestId(id), `${id} after`).toBeNull()
		}

		view.rerender(<View disabled readOnly />)
		expect(readSnapshot("control-props-formFlags")).toEqual({
			disabled: true,
			readOnly: true,
			required: false,
		})
	})

	it("commits nested deletion and whole-input replacement exactly", () => {
		const profileSchema = z.object({
			count: z.number(),
			profile: z.object({ name: z.string(), note: z.string().optional() }),
		})
		type ProfileInput = z.input<typeof profileSchema>
		const profileDefinition = kit.defineForm(profileSchema, { ui: [] })
		let readValues = (): ProfileInput => ({
			count: 0,
			profile: { name: "" },
		})
		let removeNote = (): unknown => undefined
		let replaceInput = (): unknown => undefined

		function View() {
			const form = kit.useForm(profileDefinition, {
				defaultValues: {
					count: 1,
					profile: { name: "Ada", note: "remove me" },
				},
			})
			readValues = form.api.getValues
			removeNote = () =>
				form.update((draft) => {
					delete draft.profile.note
				})
			replaceInput = () =>
				form.update(() => ({
					count: 2,
					profile: { name: "Grace", note: "replacement" },
				}))
			return <kit.Form form={form} />
		}

		render(<View />)
		act(() => {
			removeNote()
		})
		expect(readValues()).toEqual({ count: 1, profile: { name: "Ada" } })

		act(() => {
			replaceInput()
		})
		expect(readValues()).toEqual({
			count: 2,
			profile: { name: "Grace", note: "replacement" },
		})
	})

	it("uses the touched source when middleware replaces its patches", async () => {
		let validations = 0
		const touchedSchema: StandardSchema<{
			readonly mirror: string
			readonly name: string
		}> = {
			"~standard": {
				version: 1,
				vendor: "managed-on-touched-test",
				validate(value) {
					validations += 1
					return {
						value: value as { readonly mirror: string; readonly name: string },
					}
				},
			},
		}
		const touchedDefinition = kit.defineForm(
			touchedSchema,
			{
				ui: [
					{
						kind: "field",
						path: "name",
						control: "text",
						label: "Touched name",
					},
					{ kind: "field", path: "mirror", control: "text", label: "Mirror" },
				],
			},
			{
				middleware: [
					() => (next) => (transaction) =>
						transaction.source.type === "control" &&
						transaction.source.path === "name"
							? next([{ op: "replace", path: ["mirror"], value: "after" }])
							: next(transaction.patches),
				],
			},
		)

		function View() {
			const form = kit.useForm(touchedDefinition, {
				defaultValues: { mirror: "before", name: "Ada" },
				mode: "onTouched",
			})
			return <kit.AutoForm form={form} />
		}

		render(<View />)
		const name = screen.getByLabelText("Touched name")
		fireEvent.blur(name)
		await waitFor(() => expect(validations).toBe(1))

		fireEvent.change(name, { target: { value: "Grace" } })
		await waitFor(() => expect(validations).toBe(2))
		expect(
			(screen.getByLabelText("Touched name") as HTMLInputElement).value,
		).toBe("Ada")
		expect((screen.getByLabelText("Mirror") as HTMLInputElement).value).toBe(
			"after",
		)
	})

	it("supports manual register and Controller fields in FormProvider", async () => {
		const ecosystemSchema = z.object({
			controlled: z.string().min(1),
			generated: z.string().min(1),
			manual: z.string().min(1),
		})
		type EcosystemInput = z.input<typeof ecosystemSchema>
		const ecosystemDefinition = kit.defineForm(ecosystemSchema, {
			ui: [
				{
					kind: "field",
					path: "generated",
					control: "text",
					label: "Generated field",
				},
			],
		})
		const onSubmit = vi.fn()

		function ManualFields() {
			const form = useFormContext<EcosystemInput>()
			return (
				<>
					<input aria-label="Registered field" {...form.register("manual")} />
					<Controller
						control={form.control}
						name="controlled"
						render={({ field }) => (
							<input aria-label="Controller field" {...field} />
						)}
					/>
				</>
			)
		}

		function View() {
			const form = kit.useForm(ecosystemDefinition, {
				defaultValues: { controlled: "", generated: "Ada", manual: "" },
				onSubmit,
			})
			return (
				<kit.AutoForm form={form}>
					<ManualFields />
					<kit.Submit>Submit ecosystem form</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		fireEvent.change(screen.getByLabelText("Registered field"), {
			target: { value: "Grace" },
		})
		fireEvent.change(screen.getByLabelText("Controller field"), {
			target: { value: "Lin" },
		})
		fireEvent.click(
			screen.getByRole("button", { name: "Submit ecosystem form" }),
		)

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				input: { controlled: "Lin", generated: "Ada", manual: "Grace" },
				value: { controlled: "Lin", generated: "Ada", manual: "Grace" },
			}),
		)
	})

	it("keeps disabled generated values in validation and blocks a disabled form", async () => {
		const disabledSchema = z.object({
			editable: z.string(),
			locked: z.string().min(1),
		})
		const disabledDefinition = kit.defineForm(disabledSchema, {
			ui: [
				{
					kind: "field",
					path: "locked",
					control: "text",
					label: "Locked value",
					disabled: true,
				},
			],
		})
		const onSubmit = vi.fn()

		function View({ disabled }: { readonly disabled: boolean }) {
			const form = kit.useForm(disabledDefinition, {
				defaultValues: { editable: "open", locked: "preserved" },
				disabled,
				onSubmit,
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit>Submit disabled state</kit.Submit>
				</kit.AutoForm>
			)
		}

		const view = render(<View disabled />)
		fireEvent.submit(
			screen.getByRole("button").closest("form") as HTMLFormElement,
		)
		expect(onSubmit).not.toHaveBeenCalled()

		view.rerender(<View disabled={false} />)
		fireEvent.click(
			screen.getByRole("button", { name: "Submit disabled state" }),
		)
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				input: { editable: "open", locked: "preserved" },
				value: { editable: "open", locked: "preserved" },
			}),
		)
	})

	it("passes typed values and submit state to a render function", async () => {
		const onSubmit = vi.fn()

		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
				onSubmit,
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit binding={form}>
						{({ buttonProps, values, isDirty, canSubmit }) => {
							expectTypeOf(values).toEqualTypeOf<{
								readonly name: string
							}>()
							return (
								<button {...buttonProps} disabled={!canSubmit || !isDirty}>
									Save {values.name}
								</button>
							)
						}}
					</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		const initial = screen.getByRole("button", { name: "Save Ada" })
		expect(initial.getAttribute("disabled")).not.toBeNull()

		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Bob" },
		})
		const dirty = screen.getByRole("button", { name: "Save Bob" })
		expect(dirty.getAttribute("disabled")).toBeNull()

		fireEvent.click(dirty)
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				input: { name: "Bob" },
				value: { name: "Bob" },
			}),
		)
	})

	it("rejects a submit binding that does not match the surrounding form", () => {
		function View() {
			const mounted = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
			})
			const other = kit.useForm(definition, {
				defaultValues: { name: "Grace" },
			})
			return (
				<kit.Form form={mounted}>
					<kit.Submit binding={other}>{() => null}</kit.Submit>
				</kit.Form>
			)
		}

		expect(() => render(<View />)).toThrow(
			"Submit binding must match the surrounding Form",
		)
	})

	it("parses once and keeps raw handleSubmit independent from the wrapper", async () => {
		let validations = 0
		const oneParseSchema: StandardSchema<
			{ readonly name: string },
			{ readonly normalizedName: string }
		> = {
			"~standard": {
				version: 1,
				vendor: "one-parse-test",
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
		const oneParseDefinition = kit.defineForm(oneParseSchema, { ui: [] })
		const onSubmit = vi.fn()
		const onRawSubmit = vi.fn()
		let submitRaw: (() => Promise<void>) | undefined

		function View() {
			const form = kit.useForm(oneParseDefinition, {
				defaultValues: { name: "  Ada  " },
				onSubmit,
			})
			submitRaw = form.api.handleSubmit(async (value) => {
				onRawSubmit(value)
			})
			return (
				<kit.Form form={form}>
					<kit.Submit>Submit once</kit.Submit>
				</kit.Form>
			)
		}

		render(<View />)
		fireEvent.click(screen.getByRole("button", { name: "Submit once" }))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(validations).toBe(1)
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				input: { name: "  Ada  " },
				value: { normalizedName: "Ada" },
			}),
		)

		await act(async () => {
			await submitRaw?.()
		})
		expect(validations).toBe(2)
		expect(onRawSubmit).toHaveBeenCalledWith({ normalizedName: "Ada" })
		expect(onSubmit).toHaveBeenCalledTimes(1)
	})

	it("submits matching input and output while async validation is pending", async () => {
		let release: () => void = () => undefined
		const gate = new Promise<void>((resolve) => {
			release = resolve
		})
		const asyncSchema: StandardSchema<{ readonly name: string }> = {
			"~standard": {
				version: 1,
				vendor: "async-submit-snapshot-test",
				async validate(value) {
					await gate
					return {
						value: { name: (value as { readonly name: string }).name },
					}
				},
			},
		}
		const asyncDefinition = kit.defineForm(asyncSchema, {
			ui: [{ kind: "field", path: "name", control: "text", label: "Name" }],
		})
		const onSubmit = vi.fn()

		function View() {
			const form = kit.useForm(asyncDefinition, {
				defaultValues: { name: "Before validation" },
				onSubmit,
			})
			return (
				<kit.AutoForm form={form}>
					<kit.Submit name="intent" value="publish">
						Submit async form
					</kit.Submit>
				</kit.AutoForm>
			)
		}

		render(<View />)
		const submitButton = screen.getByRole("button", {
			name: "Submit async form",
		}) as HTMLButtonElement
		fireEvent.click(submitButton)
		submitButton.name = "changed-intent"
		submitButton.value = "save-and-close"
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Changed while validating" },
		})
		await act(async () => release())

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({
				input: { name: "Before validation" },
				submitter: { name: "intent", value: "publish" },
				value: { name: "Before validation" },
			}),
		)
		expect(Object.isFrozen(onSubmit.mock.calls[0]?.[0].submitter)).toBe(true)
	})

	it("uses null submitter metadata for an implicit native submit", async () => {
		const onSubmit = vi.fn()

		function View() {
			const form = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
				onSubmit,
			})
			return <kit.Form form={form} aria-label="Implicit submit form" />
		}

		render(<View />)
		fireEvent.submit(screen.getByRole("form", { name: "Implicit submit form" }))

		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(onSubmit).toHaveBeenCalledWith(
			expect.objectContaining({ submitter: null }),
		)
	})

	it("preserves browser values in the editable input snapshot", async () => {
		const upload = new File(["notes"], "notes.txt", { type: "text/plain" })
		const fileSchema: StandardSchema<{
			readonly attachment: File
		}> = {
			"~standard": {
				version: 1,
				vendor: "file-snapshot-test",
				validate(value) {
					return { value: value as { readonly attachment: File } }
				},
			},
		}
		const fileDefinition = kit.defineForm(fileSchema, { ui: [] })
		const onSubmit = vi.fn()

		function View() {
			const form = kit.useForm(fileDefinition, {
				defaultValues: { attachment: upload },
				onSubmit,
			})
			return (
				<kit.Form form={form}>
					<kit.Submit>Submit file</kit.Submit>
				</kit.Form>
			)
		}

		render(<View />)
		fireEvent.click(screen.getByRole("button", { name: "Submit file" }))
		await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
		expect(onSubmit.mock.calls[0]?.[0].input.attachment).toBe(upload)
		expect(onSubmit.mock.calls[0]?.[0].value.attachment).toBe(upload)
	})

	it("keeps the initial definition until React remounts the hook", () => {
		const first = kit.defineForm(schema, {
			ui: [{ kind: "field", path: "name", control: "text", label: "First" }],
		})
		const second = kit.defineForm(schema, {
			ui: [{ kind: "field", path: "name", control: "text", label: "Second" }],
		})
		let activeDefinition: unknown

		function View({ definition }: { readonly definition: typeof first }) {
			const form = kit.useForm(definition, {
				defaultValues: { name: "Ada" },
			})
			activeDefinition = form.definition
			return <kit.AutoForm form={form} />
		}

		const view = render(<View definition={first} />)
		expect(activeDefinition).toBe(first)
		view.rerender(<View definition={second} />)
		expect(activeDefinition).toBe(first)
		expect(screen.getByLabelText("First")).toBeTruthy()
		expect(screen.queryByLabelText("Second")).toBeNull()
	})

	it("snapshots definition middleware and supplies current context", () => {
		type Context = { readonly label: string }
		type Input = { readonly name: string }
		const contextualKit = kit.forContext<Context>()
		const first = vi.fn()
		const second = vi.fn()
		const firstMiddleware: FormMiddleware<Input, Context> =
			() => (next) => (transaction) => {
				first(transaction.context.label)
				return next(transaction.patches)
			}
		const secondMiddleware: FormMiddleware<Input, Context> =
			() => (next) => (transaction) => {
				second(transaction.context.label)
				return next(transaction.patches)
			}
		const middleware = [firstMiddleware]
		const contextualDefinition = contextualKit.defineForm(
			z.object({ name: z.string() }),
			{
				ui: [
					{
						kind: "field",
						path: "name",
						control: "text",
						label: (_values, { context }) => context.label,
					},
				],
			},
			{ middleware },
		)
		middleware[0] = secondMiddleware

		function View({ context }: { readonly context: Context }) {
			const form = contextualKit.useForm(contextualDefinition, {
				context,
				defaultValues: { name: "Ada" },
			})
			return <contextualKit.AutoForm form={form} />
		}

		const view = render(<View context={{ label: "first context" }} />)
		expect(screen.getByLabelText("first context")).toBeTruthy()
		view.rerender(<View context={{ label: "current context" }} />)
		expect(screen.getByLabelText("current context")).toBeTruthy()
		fireEvent.change(screen.getByLabelText("current context"), {
			target: { value: "Grace" },
		})

		expect(first).toHaveBeenCalledWith("current context")
		expect(second).not.toHaveBeenCalled()
	})

	it("uses definition update hooks with current context for managed changes", () => {
		type Context = { readonly label: string }
		const contextualKit = kit.forContext<Context>()
		const observed: string[] = []
		const definition = contextualKit.defineForm(
			schema,
			{
				ui: [{ kind: "field", path: "name", control: "text", label: "Name" }],
			},
			{
				afterUpdate(transaction) {
					observed.push(
						`${transaction.context.label}:after:${transaction.nextValues.name}`,
					)
				},
				beforeUpdate(draft, transaction) {
					observed.push(
						`${transaction.context.label}:before:${transaction.source.type}`,
					)
					draft.name = draft.name.toUpperCase()
				},
			},
		)
		let setRawName: (name: string) => void = () => undefined
		let resetRawValues: () => void = () => undefined

		function View({ label }: { readonly label: string }) {
			const form = contextualKit.useForm(definition, {
				context: { label },
				defaultValues: { name: "Ada" },
			})
			setRawName = (name) => form.api.setValue("name", name)
			resetRawValues = () => form.api.reset({ name: "Reset" })
			return <contextualKit.AutoForm form={form} />
		}

		const view = render(<View label="first" />)
		view.rerender(<View label="current" />)
		fireEvent.change(screen.getByLabelText("Name"), {
			target: { value: "Grace" },
		})

		expect(observed).toEqual(["current:before:control", "current:after:GRACE"])
		expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
			"GRACE",
		)

		act(() => setRawName("Raw"))
		act(() => resetRawValues())
		expect(observed).toHaveLength(2)
		expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(
			"Reset",
		)
	})
	it("keeps the binding for an inline context with the same entries", () => {
		const bindings: unknown[] = []
		function View({ label }: { readonly label: string }) {
			const form = kit.useForm(definition, {
				context: { label },
				defaultValues: { name: "Ada" },
			})
			bindings.push(form)
			return <kit.AutoForm form={form} />
		}
		const view = render(<View label="first" />)
		view.rerender(<View label="first" />)
		view.rerender(<View label="second" />)
		const [first, same, changed] = [
			bindings[0],
			bindings.at(-2),
			bindings.at(-1),
		]
		expect(same).toBe(first)
		expect(changed).not.toBe(first)
		expect((changed as { context: unknown }).context).toEqual({
			label: "second",
		})
	})
})
