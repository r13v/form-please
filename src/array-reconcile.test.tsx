import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { defineControl } from "./control-definition.js"
import { createFormKit, type FormBinding } from "./create-form-kit.js"
import { createDefaultSlots } from "./default-slots/index.js"
import { createHistoryMiddleware } from "./history/index.js"
import { fieldErrorToIssues } from "./standard-schema-resolver.js"

const schema = z.object({
	otherRows: z.array(z.object({ id: z.string(), name: z.string() })),
	rows: z.array(
		z.object({
			id: z.string(),
			name: z.string().min(3, "Name too short"),
			children: z.array(z.object({ title: z.string() })),
		}),
	),
})
const kit = createFormKit({
	controls: {
		text: defineControl<string>({
			component: ({ value, setValue, blur, input }) => (
				<input
					{...input}
					value={value}
					onBlur={blur}
					onChange={(event) => setValue(event.target.value)}
				/>
			),
		}),
	},
	slots: createDefaultSlots(),
})
const initial = {
	otherRows: [
		{ id: "one", name: "First" },
		{ id: "two", name: "Second" },
	],
	rows: [
		{ id: "alex", name: "Alex edited", children: [{ title: "Alex child" }] },
		{ id: "sam", name: "Sam edited", children: [{ title: "Sam child" }] },
	],
}
const options = {
	key: (row: { readonly id: string }) => row.id,
	create: (id: string) => ({ id, name: "New", children: [] }),
}

function mount(
	policy: Parameters<typeof kit.defineForm<typeof schema>>[2] = {},
	fields = true,
	validationSchema = schema,
) {
	let binding: FormBinding<typeof schema> | undefined
	const definition = kit.defineForm(
		validationSchema,
		(ui) => [
			ui.array("rows", {
				label: "Rows",
				itemDefault: { id: "", name: "", children: [] },
				children: (row) => [
					row.field("name", { control: "text", label: "Name" }),
					row.array("children", {
						label: "Children",
						itemDefault: { title: "" },
						children: (child) => [
							child.field("title", { control: "text", label: "Title" }),
						],
					}),
				],
			}),
			ui.array("otherRows", {
				label: "Other rows",
				itemDefault: { id: "", name: "" },
				children: (row) => [
					row.field("name", { control: "text", label: "Other name" }),
				],
			}),
		],
		policy,
	)
	function Editor() {
		const form = kit.useForm(definition, { defaultValues: initial })
		void form.api.formState.isDirty
		binding = form
		return <kit.Form form={form}>{fields && <kit.Fields />}</kit.Form>
	}
	render(<Editor />)
	if (binding === undefined) throw new Error("Binding was not mounted")
	return binding
}

describe("managed array reconciliation", () => {
	it("keeps edited rows, DOM identity, touched and errors with the selected person", () => {
		const form = mount()
		const sam = screen.getAllByLabelText("Name")[1]
		const samChild = screen
			.getAllByLabelText("Title")[1]
			?.closest('[data-fp-node="array-item"]')
		const samRow = sam?.closest('[data-fp-node="array-item"]')
		expect(samRow).not.toBeNull()
		fireEvent.blur(sam as HTMLElement)
		act(() =>
			form.api.setError("rows.1.name", {
				type: "server",
				message: "Sam error",
			}),
		)
		act(() =>
			form.api.setError("rows.1.children.0.title", {
				type: "server",
				message: "Child error",
			}),
		)
		act(() =>
			form.api.setError("rows.root" as never, {
				type: "server",
				message: "Array error",
			}),
		)
		expect(form.api.getFieldState("rows.root" as never).error?.message).toBe(
			"Array error",
		)
		const create = vi.fn(options.create)
		act(() =>
			form.array("rows").reconcile(["sam", "maria"], { ...options, create }),
		)
		expect(form.api.getValues().rows).toEqual([
			initial.rows[1],
			options.create("maria"),
		])
		expect(
			screen
				.getAllByLabelText("Name")[0]
				?.closest('[data-fp-node="array-item"]'),
		).toBe(samRow)
		expect(form.api.getFieldState("rows.0.name").isTouched).toBe(true)
		expect(form.api.getFieldState("rows.0.name").error?.message).toBe(
			"Sam error",
		)
		expect(
			form.api.getFieldState("rows.0.children.0.title").error?.message,
		).toBe("Child error")
		expect(
			screen
				.getAllByLabelText("Title")[0]
				?.closest('[data-fp-node="array-item"]'),
		).not.toBe(samChild)
		expect(form.api.getFieldState("rows.root" as never).error?.message).toBe(
			"Array error",
		)
		expect(create).toHaveBeenCalledExactlyOnceWith("maria")
		expect(form.api.formState.isDirty).toBe(true)
	})

	it("remaps original schema issue paths so summaries point to the same person", async () => {
		const form = mount()
		act(() => form.api.setValue("rows.1.name", "x"))
		await act(() => form.api.trigger())
		expect(
			fieldErrorToIssues(
				form.api.getFieldState("rows.1.name").error,
				"rows.1.name",
			),
		).toEqual([{ message: "Name too short", path: "rows.1.name" }])
		act(() => form.array("rows").reconcile(["sam", "alex"], options))
		expect(
			fieldErrorToIssues(
				form.api.getFieldState("rows.0.name").error,
				"rows.0.name",
			),
		).toEqual([{ message: "Name too short", path: "rows.0.name" }])
	})

	it("keeps row issues when a schema reports the array issue before indexed issues", async () => {
		const validationSchema = schema.superRefine((_values, context) => {
			context.addIssue({
				code: "custom",
				path: ["rows"],
				message: "Array issue",
			})
			context.addIssue({
				code: "custom",
				path: ["rows", 1, "name"],
				message: "Sam issue",
			})
		})
		const form = mount({}, true, validationSchema)
		await act(() => form.api.trigger())
		act(() => form.array("rows").reconcile(["sam"], options))
		expect(
			fieldErrorToIssues(
				form.api.getFieldState("rows.0.name").error,
				"rows.0.name",
			),
		).toEqual([{ message: "Sam issue", path: "rows.0.name" }])
		expect(
			fieldErrorToIssues(form.api.getFieldState("rows").error, "rows"),
		).toEqual([{ message: "Array issue", path: "rows" }])
		expect(form.api.getFieldState("rows.1.name").error).toBeUndefined()
	})

	it("moves external issues with the selected person", () => {
		const form = mount()
		act(() =>
			form.setIssues([
				{ path: "rows.1.name", message: "Sam is unavailable." },
				{ path: "rows.0.name", message: "Alex is unavailable." },
			]),
		)
		act(() => {
			form.array("rows").reconcile(["sam", "maria"], options)
		})
		expect(form.api.getFieldState("rows.0.name").error?.message).toBe(
			"Sam is unavailable.",
		)
		expect(form.api.getFieldState("rows.1.name").error).toBeUndefined()
		expect(screen.getByText("Sam is unavailable.")).toBeTruthy()
		expect(screen.queryByText("Alex is unavailable.")).toBeNull()

		fireEvent.change(screen.getAllByLabelText("Name")[0] as HTMLElement, {
			target: { value: "Sam renamed" },
		})
		expect(screen.queryByText("Sam is unavailable.")).toBeNull()
	})

	it("clears external issues of fields that the update policy changes", () => {
		const form = mount({
			beforeUpdate: (draft) => {
				const first = draft.otherRows[0]
				if (first !== undefined) first.name = "Changed by policy"
			},
		})
		act(() =>
			form.setIssues([
				{ path: "otherRows.0.name", message: "Name is taken." },
				{ path: "rows", message: "Choose at least one person." },
			]),
		)
		act(() => {
			form.array("rows").reconcile(["sam"], options)
		})
		expect(screen.queryByText("Name is taken.")).toBeNull()
		expect(form.api.getFieldState("rows").error?.message).toBe(
			"Choose at least one person.",
		)
	})

	it("does no work for an unchanged selection and reads current rows at each call", () => {
		const afterUpdate = vi.fn()
		const form = mount({ afterUpdate })
		const handle = form.array("rows")
		const create = vi.fn(options.create)
		act(() => handle.reconcile(["alex", "sam"], { ...options, create }))
		expect(create).not.toHaveBeenCalled()
		expect(afterUpdate).not.toHaveBeenCalled()
		act(() => form.api.setValue("rows.1.name", "Latest"))
		act(() => handle.reconcile(["sam", "alex"], { ...options, create }))
		expect(form.api.getValues().rows[0]?.name).toBe("Latest")
		expect(afterUpdate).toHaveBeenCalledOnce()
	})

	it("rejects invalid selections and failed creation before changing values", () => {
		const form = mount()
		const original = form.api.getValues()
		expect(() => form.array("rows").reconcile(["sam", "sam"], options)).toThrow(
			"unique",
		)
		expect(() =>
			form.array("rows").reconcile(["maria"], {
				...options,
				create: () => options.create("wrong"),
			}),
		).toThrow("requested key")
		expect(() =>
			form.array("rows").reconcile(["maria"], {
				...options,
				create: () => {
					throw new Error("Create failed")
				},
			}),
		).toThrow("Create failed")
		expect(form.api.getValues()).toEqual(original)
		act(() => form.api.setValue("rows.1.id", "alex"))
		expect(() => form.array("rows").reconcile(["alex"], options)).toThrow(
			"unique",
		)
	})

	it("fails explicitly when the generated array is not mounted", () => {
		const form = mount({}, false)
		expect(() => form.array("rows").reconcile(["sam"], options)).toThrow(
			"mounted generated array",
		)
		expect(form.api.getValues()).toEqual(initial)
	})

	it("lets middleware cancel without removing row metadata", () => {
		const form = mount({ middleware: [() => () => () => "cancelled"] })
		act(() =>
			form.api.setError("rows.1.name", {
				type: "server",
				message: "Sam error",
			}),
		)
		expect(form.array("rows").reconcile(["sam"], options)).toBe("cancelled")
		expect(form.api.getValues()).toEqual(initial)
		expect(form.api.getFieldState("rows.1.name").error?.message).toBe(
			"Sam error",
		)
	})

	it("allows ordinary row fields to be adjusted by the update policy", () => {
		const form = mount({
			beforeUpdate: (draft) => {
				draft.rows[0].name = "Adjusted"
			},
		})
		act(() => form.array("rows").reconcile(["sam"], options))
		expect(form.api.getValues().rows[0]?.name).toBe("Adjusted")
	})

	it("rejects key changes from the update policy before removing rows", () => {
		const form = mount({
			beforeUpdate: (draft) => {
				draft.rows[0].id = "wrong"
			},
		})
		expect(() => form.array("rows").reconcile(["sam"], options)).toThrow(
			"keys or order",
		)
		expect(form.api.getValues()).toEqual(initial)
	})

	it("rejects middleware edits inside nested arrays before moving their parent", () => {
		const form = mount({
			beforeUpdate: (draft) => {
				draft.rows[0].children[0].title = "Changed"
			},
		})
		expect(() => form.array("rows").reconcile(["sam"], options)).toThrow(
			"nested array values",
		)
		expect(form.api.getValues()).toEqual(initial)
	})

	it("rejects structural edits to another generated array before changing either array", () => {
		const form = mount({
			beforeUpdate: (draft) => {
				draft.otherRows.reverse()
			},
		})
		expect(() => form.array("rows").reconcile(["sam"], options)).toThrow(
			"another generated array structure",
		)
		expect(form.api.getValues()).toEqual(initial)
	})

	it("allows a dependent ordinary field change in another generated array", () => {
		const form = mount({
			beforeUpdate: (draft) => {
				draft.otherRows[0].name = "Adjusted"
			},
		})
		act(() => form.array("rows").reconcile(["sam"], options))
		expect(form.api.getValues().otherRows[0]?.name).toBe("Adjusted")
	})

	it("supports a mounted nested array path without changing its parent selection", () => {
		const form = mount()
		act(() =>
			form.array("rows.0.children").reconcile(["Added", "Alex child"], {
				key: (row) => row.title,
				create: (title) => ({ title }),
			}),
		)
		expect(form.api.getValues().rows[0]?.children).toEqual([
			{ title: "Added" },
			{ title: "Alex child" },
		])
		expect(form.api.getValues().rows[1]).toEqual(initial.rows[1])
	})

	it("records one history step for several native row operations", () => {
		const history = createHistoryMiddleware()
		const form = mount({ middleware: [history] })
		act(() => form.array("rows").reconcile(["maria", "sam", "alex"], options))
		expect(history.handle(form).getSnapshot().canUndo).toBe(true)
		act(() => history.handle(form).undo())
		expect(form.api.getValues()).toEqual(initial)
		expect(history.handle(form).getSnapshot().canUndo).toBe(false)
	})
})

function checkArrayTypes(form: FormBinding<typeof schema>) {
	// @ts-expect-error A scalar field cannot preserve object-array row state.
	form.array("rows.0.name")
	// @ts-expect-error Unknown paths cannot select a generated array.
	form.array("missing")
	form.array("rows").reconcile(["new"], {
		key: (row) => row.id,
		// @ts-expect-error New rows need all editable fields, including nested arrays.
		create: (id) => ({ id, name: "New" }),
	})
	form.array("rows").reconcile([1], {
		// @ts-expect-error A numeric selection does not match a string row key.
		key: (row) => row.id,
		create: (id) => ({ id: String(id), name: "New", children: [] }),
	})
}
void checkArrayTypes
