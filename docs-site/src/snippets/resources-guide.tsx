// biome-ignore-all lint/correctness/noUnusedImports: Named regions are consumed independently by the documentation.
// biome-ignore-all lint/correctness/noUnusedVariables: Named regions are consumed independently by the documentation.
"use client"

import { useQuery } from "@tanstack/react-query"
import {
	fromResource,
	matchResource,
	type ResourceState,
	type UiResolver,
} from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { z } from "zod"

import { queryToResource } from "./query-to-resource"

type CountryOption = {
	readonly value: string
	readonly label: string
}

type CountryResource = ResourceState<readonly CountryOption[], Error>

// [!region create-states]
const pendingCountries: CountryResource = { status: "pending" }

const loadedCountries: CountryResource = {
	status: "success",
	value: [
		{ value: "ca", label: "Canada" },
		{ value: "jp", label: "Japan" },
	],
}

const failedCountries: CountryResource = {
	status: "error",
	error: new Error("Country service unavailable"),
}
// [!endregion create-states]

// [!region match-resource]
function getCountryStatus(countries: CountryResource): string {
	return matchResource(countries, {
		pending: () => "Loading countries",
		success: ({ value }) => `${value.length} countries available`,
		error: ({ error }) => `Cannot load countries: ${error.message}`,
	})
}
// [!endregion match-resource]

const profileSchema = z.object({
	plan: z.enum(["solo", "team"]),
	country: z.string().optional(),
})

type ProfileInput = z.input<typeof profileSchema>
type ProfileContext = {
	readonly countries: CountryResource
	readonly savedCountryOptions: readonly CountryOption[]
}

const savedCountryOptions: readonly CountryOption[] = [
	{ value: "ca", label: "Canada" },
]

// [!region resource-resolvers]
const selectCountries: UiResolver<
	CountryResource,
	ProfileInput,
	ProfileContext
> = (_values, { context }) => context.countries

const countryDescription = fromResource(selectCountries, {
	pending: () => "Loading countries",
	success: ({ value }, values) =>
		`${value.length} countries available for the ${values.plan} plan`,
	error: ({ error }) => `Cannot load countries: ${error.message}`,
})

const countryOptions = ({ context }: { readonly context: ProfileContext }) =>
	matchResource(context.countries, {
		pending: () => context.savedCountryOptions,
		success: ({ value }) => value,
		error: () => context.savedCountryOptions,
	})
// [!endregion resource-resolvers]

const profileKit = nativeFormKit.forContext<ProfileContext>()

// [!region context-form]
const profileDefinition = profileKit.defineForm(profileSchema, {
	ui: [
		{
			kind: "field",
			path: "plan",
			control: "select",
			label: "Plan",
			options: [
				{ value: "solo", label: "Solo" },
				{ value: "team", label: "Team" },
			],
		},
		{
			kind: "field",
			path: "country",
			control: "select",
			label: "Country",
			description: countryDescription,
			options: countryOptions,
			disabled: fromResource(selectCountries, {
				pending: () => true,
				success: () => false,
				error: () => true,
			}),
		},
	],
})

function ProfileForm({ context }: { readonly context: ProfileContext }) {
	const form = profileKit.useForm(profileDefinition, {
		defaultValues: { plan: "solo", country: undefined },
		context,
	})

	return <profileKit.AutoForm form={form} />
}
// [!endregion context-form]

declare function loadCountries(): Promise<readonly CountryOption[]>

// [!region query-context]
function ProfileWithCountries() {
	const countriesQuery = useQuery({
		queryKey: ["countries"],
		queryFn: loadCountries,
	})

	const context: ProfileContext = {
		countries: queryToResource(countriesQuery),
		savedCountryOptions,
	}

	return <ProfileForm context={context} />
}
// [!endregion query-context]
