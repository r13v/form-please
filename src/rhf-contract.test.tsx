import { act, renderHook } from "@testing-library/react"
import { useFieldArray, useForm } from "react-hook-form"
import { describe, expect, it } from "vitest"

/**
 * Each test pins one React Hook Form behavior that Form Please relies on. A
 * failure after an RHF upgrade names the assumption to revisit.
 */
describe("React Hook Form contract", () => {
	type Values = { rows: { name: string }[]; title: string }
	const defaultValues: Values = {
		rows: [{ name: "a" }, { name: "b" }],
		title: "",
	}

	function useRows() {
		const form = useForm<Values>({ defaultValues })
		const rows = useFieldArray({ control: form.control, name: "rows" })
		return { form, rows }
	}

	it("setValues does not update useFieldArray rows (structure guard)", () => {
		const { result } = renderHook(useRows)
		act(() => {
			result.current.form.setValues({ rows: [{ name: "a" }] })
		})
		expect(result.current.form.getValues().rows).toHaveLength(1)
		expect(result.current.rows.fields).toHaveLength(2)
	})

	it("setValues shallow-merges top-level keys (topLevelUpdates)", () => {
		const { result } = renderHook(useRows)
		act(() => {
			result.current.form.setValues({ title: "Next" } as Values)
		})
		expect(result.current.form.getValues()).toEqual({
			rows: defaultValues.rows,
			title: "Next",
		})
	})

	it("native row operations remap only array-shaped error branches (commitRowOperation)", () => {
		const { result } = renderHook(useRows)
		act(() => {
			result.current.form.setError("rows.1.name", { message: "Second" })
		})
		act(() => {
			result.current.rows.remove(0)
		})
		expect(
			result.current.form.getFieldState("rows.0.name").error?.message,
		).toBe("Second")
	})

	it("handleSubmit rethrows a truthy rejection and marks the submit unsuccessful (submission errors)", async () => {
		const { result } = renderHook(() => useForm<Values>({ defaultValues }))
		const marker = { rejected: true }
		await act(async () => {
			await expect(
				result.current.handleSubmit(() => {
					throw marker
				})(),
			).rejects.toBe(marker)
		})
		expect(result.current.formState.isSubmitSuccessful).toBe(false)
	})

	it("control._names.mount lists registered fields (error focus)", () => {
		const { result } = renderHook(() => useForm<Values>({ defaultValues }))
		act(() => {
			result.current.register("title")
		})
		expect([...result.current.control._names.mount]).toContain("title")
	})

	it("subscribe reports isSubmitted changes (managed revalidation)", async () => {
		const { result } = renderHook(() => useForm<Values>({ defaultValues }))
		const seen: (boolean | undefined)[] = []
		const unsubscribe = result.current.subscribe({
			formState: { isSubmitted: true },
			callback: ({ isSubmitted }) => {
				seen.push(isSubmitted)
			},
		})
		await act(() => result.current.handleSubmit(() => {})())
		unsubscribe()
		expect(seen).toContain(true)
	})

	it("reset with keepDefaultValues keeps the default baseline (history and persistence restore)", () => {
		const { result } = renderHook(() => useForm<Values>({ defaultValues }))
		act(() => {
			result.current.reset(
				{ ...defaultValues, title: "Restored" },
				{ keepDefaultValues: true },
			)
		})
		expect(result.current.formState.defaultValues?.title).toBe("")
		expect(result.current.getValues().title).toBe("Restored")
	})
})
