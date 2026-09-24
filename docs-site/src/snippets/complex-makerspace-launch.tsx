// @jsx: react-jsx
"use client"

import {
	QueryClient,
	QueryClientProvider,
	useMutation,
	useQuery,
} from "@tanstack/react-query"
import {
	createFormKit,
	type FormBinding,
	type FormInput,
	type FormOutput,
} from "form-please"
import { createDefaultSlots } from "form-please/default-slots"
import { createNativeControls } from "form-please/native-controls"
import { useMemo, useState } from "react"
import { useWatch } from "react-hook-form"
import { z } from "zod"

const promotionSchema = z.object({
	enabled: z.boolean(),
	percent: z.number().min(1).max(90).optional(),
})

const launchSchema = z
	.object({
		identity: z.object({
			name: z.string().min(4, "Use a distinctive public name"),
			campusId: z.string().min(1, "Choose a campus"),
			description: z.string().min(60, "Write at least 60 characters"),
		}),
		location: z.object({
			regionId: z.string().min(1, "Choose a region"),
			postalCode: z.string().min(3, "Enter a postal code"),
			address: z.string().min(6, "Enter a complete address"),
			latitude: z.number().min(-90).max(90),
			longitude: z.number().min(-180).max(180),
		}),
		media: z.object({
			cover: z
				.custom<File | undefined>(
					(value) =>
						value === undefined ||
						(typeof File !== "undefined" && value instanceof File),
					"Choose an image file",
				)
				.optional(),
			gallery: z.array(
				z.object({
					assetUrl: z.string().url("Enter a valid media URL"),
					caption: z.string().min(2, "Add a caption"),
				}),
			),
		}),
		capacityBands: z
			.array(
				z.object({
					label: z.string().min(2, "Name the capacity band"),
					people: z.number().int().min(1).max(500),
					hourlyRate: z.number().min(0),
				}),
			)
			.min(1, "Add at least one capacity band"),
		amenities: z.object({
			stepFree: z.boolean(),
			ventilation: z.boolean(),
			toolLibrary: z.boolean(),
			quietZone: z.boolean(),
		}),
		accessInstructions: z
			.string()
			.min(20, "Explain how members enter the space"),
		promotions: z.object({
			launch: promotionSchema,
			student: promotionSchema,
			community: promotionSchema,
			offPeak: promotionSchema,
		}),
	})
	.superRefine((value, context) => {
		for (const [name, promotion] of Object.entries(value.promotions)) {
			if (promotion.enabled && promotion.percent === undefined) {
				context.addIssue({
					code: "custom",
					path: ["promotions", name, "percent"],
					message: "Set the active reduction",
				})
			}
		}

		const sorted = [...value.capacityBands].sort(
			(left, right) => left.people - right.people,
		)
		for (let index = 1; index < sorted.length; index += 1) {
			const previous = sorted[index - 1]
			const current = sorted[index]
			if (
				previous !== undefined &&
				current !== undefined &&
				current.hourlyRate < previous.hourlyRate
			) {
				context.addIssue({
					code: "custom",
					path: ["capacityBands"],
					message: "Larger capacity bands cannot cost less than smaller bands",
				})
				break
			}
		}
	})
	.transform((value) => ({
		...value,
		activePromotionCount: Object.values(value.promotions).filter(
			(promotion) => promotion.enabled,
		).length,
	}))

type LaunchInput = FormInput<typeof launchSchema>
type LaunchOutput = FormOutput<typeof launchSchema>
const stages = ["identity", "location", "capacity", "publishing"] as const
type LaunchScreen = (typeof stages)[number]

type LaunchContext = {
	readonly screen: LaunchScreen
	readonly campuses: readonly {
		readonly value: string
		readonly label: string
	}[]
	readonly regions: readonly {
		readonly value: string
		readonly label: string
	}[]
}

const defaultValues = {
	identity: {
		name: "Copperline Commons",
		campusId: "river-yard",
		description:
			"A shared fabrication floor for neighborhood prototypes, repair circles, material experiments, and open skill exchanges.",
	},
	location: {
		regionId: "north-bank",
		postalCode: "N4 7PX",
		address: "48 Foundry Lane",
		latitude: 51.542,
		longitude: -0.102,
	},
	media: {
		cover: undefined,
		gallery: [
			{
				assetUrl: "https://example.test/media/workbench.jpg",
				caption: "Shared assembly workbench",
			},
		],
	},
	capacityBands: [
		{ label: "Bench session", people: 8, hourlyRate: 45 },
		{ label: "Open floor", people: 24, hourlyRate: 110 },
	],
	amenities: {
		stepFree: true,
		ventilation: true,
		toolLibrary: true,
		quietZone: false,
	},
	accessInstructions:
		"Use the east courtyard entrance and check in at the tool desk before entering the floor.",
	promotions: {
		launch: { enabled: true, percent: 20 },
		student: { enabled: false, percent: undefined },
		community: { enabled: true, percent: 15 },
		offPeak: { enabled: false, percent: undefined },
	},
} satisfies LaunchInput

const kit = createFormKit({
	controls: createNativeControls(),
	slots: createDefaultSlots(),
})
const contextualKit = kit.forContext<LaunchContext>()
const promotionFragment = contextualKit.defineFragment(
	promotionSchema,
	(ui) => [
		ui.field("enabled", { control: "checkbox", label: "Enabled" }),
		ui.field("percent", {
			control: "number",
			label: "Reduction percent",
			visible: (promotion) => promotion.enabled,
			props: { min: 1, max: 90, step: 1 },
		}),
	],
)
const stageLabels = {
	identity: "Identity",
	location: "Location",
	capacity: "Capacity & media",
	publishing: "Publishing",
} satisfies Record<(typeof stages)[number], string>
const stageNames = {
	identity: "Identity",
	location: "Location",
	capacity: "Capacity & media",
	publishing: "Publishing",
} satisfies Record<(typeof stages)[number], string>
type LaunchForm = FormBinding<typeof launchSchema, LaunchContext>

function WizardNavigation({
	screen,
	setScreen,
}: {
	readonly screen: LaunchScreen
	readonly setScreen: (screen: LaunchScreen) => void
}) {
	const index = stages.indexOf(screen)
	const nextStage = stages[index + 1] ?? screen
	let primaryAction = (
		<contextualKit.Submit className="form-please-complex__primary">
			Publish makerspace
		</contextualKit.Submit>
	)
	if (index < stages.length - 1) {
		primaryAction = (
			<button
				className="form-please-complex__primary"
				onClick={() => setScreen(nextStage)}
				type="button"
			>
				Continue to {stageNames[nextStage]}
			</button>
		)
	}
	return (
		<nav aria-label="Launch stages" className="form-please-complex__wizard">
			<ol>
				{stages.map((item) => {
					let ariaCurrent: "step" | undefined
					let color: string | undefined
					if (item === screen) {
						ariaCurrent = "step"
						color = "var(--fp-docs-rust)"
					}
					return (
						<li aria-current={ariaCurrent} key={item}>
							<button
								style={{ color }}
								onClick={() => setScreen(item)}
								type="button"
							>
								{stageLabels[item]}
							</button>
						</li>
					)
				})}
			</ol>
			<div className="form-please-complex__actions">
				<button
					disabled={index === 0}
					onClick={() => setScreen(stages[index - 1] ?? screen)}
					type="button"
				>
					Back
				</button>
				{primaryAction}
			</div>
		</nav>
	)
}

function LaunchLiveDetails({
	form,
	screen,
	setScreen,
}: {
	readonly form: LaunchForm
	readonly screen: LaunchScreen
	readonly setScreen: (screen: LaunchScreen) => void
}) {
	const values = useWatch({ control: form.api.control }) as LaunchInput
	let locationDetails = null
	if (screen === "location") {
		locationDetails = (
			<>
				<AddressLookup form={form} postalCode={values.location.postalCode} />
				<aside
					aria-label="Coordinate preview"
					className="form-please-complex__preview"
				>
					<strong>{values.location.address}</strong>
					<span>
						{values.location.latitude.toFixed(3)},{" "}
						{values.location.longitude.toFixed(3)} ·{" "}
						{values.location.postalCode}
					</span>
				</aside>
			</>
		)
	}
	return (
		<>
			<WizardNavigation screen={screen} setScreen={setScreen} />
			{locationDetails}
		</>
	)
}

function AddressLookup({
	form,
	postalCode,
}: {
	readonly form: LaunchForm
	readonly postalCode: string
}) {
	const lookup = useQuery({
		queryKey: ["address-lookup", postalCode],
		queryFn: () => {
			let address = "12 Workshop Crescent"
			if (postalCode.toUpperCase().startsWith("N")) {
				address = "48 Foundry Lane"
			}
			return fakeRequest(
				{
					address,
					latitude: 51.542,
					longitude: -0.102,
				},
				320,
			)
		},
		enabled: postalCode.trim().length >= 3,
	})
	let status = "Address suggestion ready"
	if (lookup.isFetching) status = "Resolving postal code…"

	return (
		<div className="form-please-complex__embedded">
			<span>{status}</span>
			<button
				disabled={lookup.data === undefined}
				onClick={() => {
					if (lookup.data === undefined) return
					form.api.setValue("location.address", lookup.data.address)
					form.api.setValue("location.latitude", lookup.data.latitude)
					form.api.setValue("location.longitude", lookup.data.longitude)
				}}
				type="button"
			>
				Apply resolved address
			</button>
		</div>
	)
}

const launchDefinition = contextualKit.defineForm(launchSchema, (ui) => [
	ui.section("identity", {
		title: "Makerspace identity",
		visible: (_values, { context }) => context.screen === "identity",
		columns: 2,
		children: [
			ui.field("identity.name", {
				control: "text",
				label: "Public name",
				required: true,
			}),
			ui.field("identity.campusId", {
				control: "select",
				label: "Campus",
				options: ({ context }) => context.campuses,
			}),
			ui.field("identity.description", {
				control: "textarea",
				label: "Public description",
				description: "Explain the work this place makes possible.",
				span: "full",
				props: { rows: 5 },
			}),
		],
	}),
	ui.section("location", {
		title: "Location",
		visible: (_values, { context }) => context.screen === "location",
		columns: 2,
		children: [
			ui.field("location.regionId", {
				control: "select",
				label: "Region",
				options: ({ context }) => context.regions,
			}),
			ui.field("location.postalCode", {
				control: "text",
				label: "Postal code",
			}),
			ui.field("location.address", {
				control: "text",
				label: "Street address",
				span: "full",
			}),
			ui.field("location.latitude", {
				control: "number",
				label: "Latitude",
				props: { min: -90, max: 90, step: 0.001 },
			}),
			ui.field("location.longitude", {
				control: "number",
				label: "Longitude",
				props: { min: -180, max: 180, step: 0.001 },
			}),
		],
	}),
	ui.section("capacity", {
		title: "Capacity, media, and amenities",
		visible: (_values, { context }) => context.screen === "capacity",
		children: [
			ui.array("capacityBands", {
				label: "Capacity bands",
				itemDefault: { label: "", people: 1, hourlyRate: 0 },
				children: (capacityBand) => [
					capacityBand.field("label", {
						control: "text",
						label: "Band name",
					}),
					capacityBand.field("people", {
						control: "number",
						label: "People",
						props: { min: 1, max: 500, step: 1 },
					}),
					capacityBand.field("hourlyRate", {
						control: "number",
						label: "Hourly rate",
						props: { min: 0, step: 5 },
					}),
				],
			}),
			ui.field("media.cover", {
				control: "file",
				label: "Cover image",
				props: { accept: "image/*" },
			}),
			ui.array("media.gallery", {
				label: "Gallery",
				description: "Reorder references without losing row state.",
				itemDefault: { assetUrl: "", caption: "" },
				children: (media) => [
					media.field("assetUrl", {
						control: "text",
						label: "Media URL",
					}),
					media.field("caption", {
						control: "text",
						label: "Caption",
					}),
				],
			}),
			ui.section("amenities", {
				title: "Amenities",
				columns: 2,
				children: [
					ui.field("amenities.stepFree", {
						control: "checkbox",
						label: "Step-free",
					}),
					ui.field("amenities.ventilation", {
						control: "checkbox",
						label: "Extract ventilation",
					}),
					ui.field("amenities.toolLibrary", {
						control: "checkbox",
						label: "Tool library",
					}),
					ui.field("amenities.quietZone", {
						control: "checkbox",
						label: "Quiet zone",
					}),
				],
			}),
		],
	}),
	ui.section("publishing", {
		title: "Publishing rules",
		visible: (_values, { context }) => context.screen === "publishing",
		children: [
			ui.field("accessInstructions", {
				control: "textarea",
				label: "Access instructions",
				props: { rows: 4 },
			}),
			ui.section("promotion-launch", {
				title: "Launch offer",
				columns: 2,
				children: [promotionFragment.fields({ at: "promotions.launch" })],
			}),
			ui.section("promotion-student", {
				title: "Student access",
				columns: 2,
				children: [promotionFragment.fields({ at: "promotions.student" })],
			}),
			ui.section("promotion-community", {
				title: "Community partner",
				columns: 2,
				children: [promotionFragment.fields({ at: "promotions.community" })],
			}),
			ui.section("promotion-offPeak", {
				title: "Off-peak hours",
				columns: 2,
				children: [promotionFragment.fields({ at: "promotions.offPeak" })],
			}),
		],
	}),
])

export function MakerspaceLaunchExample() {
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	)
	return (
		<QueryClientProvider client={queryClient}>
			<MakerspaceLaunchForm />
		</QueryClientProvider>
	)
}

function MakerspaceLaunchForm() {
	const [screen, setScreen] = useState<LaunchScreen>("identity")
	const campuses = useQuery({
		queryKey: ["maker-campuses"],
		queryFn: () =>
			fakeRequest(
				[
					{ value: "river-yard", label: "River Yard" },
					{ value: "civic-annex", label: "Civic Annex" },
				],
				330,
			),
	})
	const regions = useQuery({
		queryKey: ["maker-regions"],
		queryFn: () =>
			fakeRequest(
				[
					{ value: "north-bank", label: "North Bank" },
					{ value: "old-market", label: "Old Market" },
				],
				470,
			),
	})
	const savePlace = useMutation({
		mutationFn: (value: LaunchOutput) =>
			fakeRequest({ id: value.identity.name.length + 900 }, 360),
	})
	const saveMedia = useMutation({
		mutationFn: (value: LaunchOutput) =>
			fakeRequest({ count: value.media.gallery.length }, 340),
	})
	const publish = useMutation({
		mutationFn: (value: LaunchOutput) =>
			fakeRequest({ offers: value.activePromotionCount }, 420),
	})
	const [notice, setNotice] = useState("Complete the four stages to publish.")
	const context = useMemo(
		() => ({
			screen,
			campuses: campuses.data ?? [],
			regions: regions.data ?? [],
		}),
		[screen, campuses.data, regions.data],
	)
	const form = contextualKit.useForm(launchDefinition, {
		defaultValues,
		context,
		async onSubmit({ value }) {
			try {
				const place = await savePlace.mutateAsync(value)
				const media = await saveMedia.mutateAsync(value)
				const release = await publish.mutateAsync(value)
				setNotice(
					`Space ${place.id} published with ${media.count} gallery item(s) and ${release.offers} offer(s).`,
				)
			} catch {
				setNotice("Publishing paused. The wizard kept every value.")
			}
		},
	})

	if (campuses.isPending || regions.isPending) {
		return (
			<section className="form-please-complex">
				Loading launch references…
			</section>
		)
	}
	if (campuses.isError || regions.isError) {
		return (
			<section className="form-please-complex">
				Could not open the launch wizard.
			</section>
		)
	}
	let status = notice
	if (savePlace.isPending || saveMedia.isPending || publish.isPending) {
		status = "Saving location, media, and release…"
	}

	return (
		<section
			aria-label="Makerspace launch wizard example"
			className="form-please-complex"
		>
			<p className="form-please-complex__kicker">Four-stage launch wizard</p>
			<p className="form-please-complex__summary">
				An external screen controls conditional sections through form context.
				Domain input still keeps address lookup, media rows, pricing bands, four
				offers, and three writes in one form.
			</p>
			<contextualKit.Form className="form-please-complex__form" form={form}>
				<LaunchLiveDetails form={form} screen={screen} setScreen={setScreen} />

				<contextualKit.Fields />
			</contextualKit.Form>

			<output className="form-please-complex__network" aria-live="polite">
				{status}
			</output>
		</section>
	)
}

function fakeRequest<Value>(value: Value, delay: number): Promise<Value> {
	return new Promise((resolve) =>
		window.setTimeout(() => resolve(value), delay),
	)
}
