// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import { type UseQueryResult, useQuery } from "@tanstack/react-query"
import { fromResource, matchResource, type ResourceState } from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

type Country = {
	readonly value: string
	readonly label: string
}

const profileSchema = z.object({
	country: z.string().optional(),
})

// [!region resource-form]
type ProfileContext = {
	readonly countries: ResourceState<readonly Country[], Error>
}

const profileKit = nativeFormKit.forContext<ProfileContext>()

const profileDefinition = profileKit.defineForm(profileSchema, (ui) => [
	ui.field("country", {
		control: "select",
		label: "Country",
		props: { emptyOption: { label: "Select a country" } },
		options: ({ context }) =>
			matchResource(context.countries, {
				pending: () => [],
				success: ({ value }) => value,
				error: () => [],
			}),
		disabled: (_values, { context }) => context.countries.status !== "success",
		description: (_values, { context }) =>
			matchResource(context.countries, {
				pending: () => "Loading countries…",
				success: ({ value }) => `${value.length} countries available`,
				error: ({ error }) => `Cannot load countries: ${error.message}`,
			}),
	}),
])
// [!endregion resource-form]

declare function loadCountries(): Promise<readonly Country[]>

// [!region query-context]
function toResource<Value>(
	query: UseQueryResult<Value, Error>,
): ResourceState<Value, Error> {
	if (query.isPending) return { status: "pending" }
	if (query.isError) return { status: "error", error: query.error }
	return { status: "success", value: query.data }
}

function ProfileForm() {
	const countries = useQuery({
		queryKey: ["countries"],
		queryFn: loadCountries,
	})
	const form = profileKit.useForm(profileDefinition, {
		defaultValues: { country: undefined },
		context: { countries: toResource(countries) },
	})

	return <profileKit.AutoForm form={form} />
}
// [!endregion query-context]

const previewStates = {
	pending: { status: "pending" },
	success: {
		status: "success",
		value: [
			{ value: "ca", label: "Canada" },
			{ value: "jp", label: "Japan" },
		],
	},
	error: { status: "error", error: new Error("Country service unavailable") },
} satisfies Record<string, ProfileContext["countries"]>

export function ResourceStatePreview() {
	const [status, setStatus] = useState<keyof typeof previewStates>("pending")
	const form = profileKit.useForm(profileDefinition, {
		defaultValues: { country: undefined },
		context: { countries: previewStates[status] },
	})

	return (
		<section
			aria-label="Resource state preview"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Live preview</p>
			<p className="form-please-complex__summary">
				Select a request state. The options, description, and disabled state
				change together.
			</p>
			<div className="form-please-complex__actions">
				<button onClick={() => setStatus("pending")} type="button">
					Loading
				</button>
				<button onClick={() => setStatus("success")} type="button">
					Loaded
				</button>
				<button onClick={() => setStatus("error")} type="button">
					Failed
				</button>
			</div>
			<profileKit.Form className="form-please-complex__form" form={form}>
				<profileKit.Fields />
			</profileKit.Form>
		</section>
	)
}

// [!region saved-options]
type SavedCountriesContext = ProfileContext & {
	readonly savedCountries: readonly Country[]
}

const savedCountriesKit = nativeFormKit.forContext<SavedCountriesContext>()

const savedCountriesDefinition = savedCountriesKit.defineForm(
	profileSchema,
	(ui) => [
		ui.field("country", {
			control: "select",
			label: "Country",
			props: { emptyOption: { label: "Select a country" } },
			options: ({ context }) =>
				matchResource(context.countries, {
					pending: () => context.savedCountries,
					success: ({ value }) => value,
					error: () => context.savedCountries,
				}),
		}),
	],
)
// [!endregion saved-options]

// [!region shared-selector]
const selectCountries = (
	_values: unknown,
	{ context }: { readonly context: ProfileContext },
) => context.countries

const sharedSelectorDefinition = profileKit.defineForm(profileSchema, (ui) => [
	ui.field("country", {
		control: "select",
		label: "Country",
		props: { emptyOption: { label: "Select a country" } },
		options: ({ context }) =>
			matchResource(context.countries, {
				pending: () => [],
				success: ({ value }) => value,
				error: () => [],
			}),
		disabled: fromResource(selectCountries, {
			pending: () => true,
			success: () => false,
			error: () => true,
		}),
		description: fromResource(selectCountries, {
			pending: () => "Loading countries…",
			success: ({ value }) => `${value.length} countries available`,
			error: ({ error }) => `Cannot load countries: ${error.message}`,
		}),
	}),
])
// [!endregion shared-selector]
