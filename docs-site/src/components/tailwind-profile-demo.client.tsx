"use client"

import { useState } from "react"

import {
	defaultValues,
	kit,
	profileDefinition,
} from "../snippets/lab-profile-form"

export function TailwindProfileDemoClient() {
	const [status, setStatus] = useState("Change the account type to restyle it.")
	const form = kit.useForm(profileDefinition, {
		defaultValues,
		onSubmit: ({ value }) => setStatus(`Saved ${value.name}.`),
	})

	return (
		<section
			aria-label="Tailwind resolver profile form"
			className="my-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-950"
		>
			<p className="mb-4 mt-0 text-sm font-medium text-slate-600 dark:text-slate-300">
				This is the shared profile form. Select Company to see its resolved
				Tailwind classes change.
			</p>
			<kit.AutoForm
				className="grid gap-5 text-slate-900 dark:text-slate-100 [&_[data-fp-layout=grid]]:grid [&_[data-fp-layout=grid]]:gap-4 [&_[data-fp-columns='2']]:md:grid-cols-2 [&_[data-fp-node=array-item]]:grid [&_[data-fp-node=array-item]]:gap-3 [&_[data-fp-node=array]]:grid [&_[data-fp-node=array]]:gap-3 [&_[data-fp-node=field]]:grid [&_[data-fp-node=field]]:gap-1.5 [&_[data-fp-node=field]>p]:m-0 [&_[data-fp-node=field]>p]:text-sm [&_[data-fp-node=field]>p]:text-slate-500 [&_[data-fp-node=section]>h2]:m-0 [&_[data-fp-node=section]>h2]:text-xl [&_[data-fp-node=section]>p]:mt-1 [&_[data-fp-node=section]>p]:text-sm [&_button]:rounded-lg [&_button]:border [&_button]:border-slate-300 [&_button]:bg-white [&_button]:px-3 [&_button]:py-2 [&_button]:font-medium [&_button]:text-slate-900 [&_button]:shadow-sm [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_button]:focus-visible:outline-emerald-600 [&_input:not([type='checkbox'])]:w-full [&_input:not([type='checkbox'])]:rounded-lg [&_input:not([type='checkbox'])]:border [&_input:not([type='checkbox'])]:border-slate-300 [&_input:not([type='checkbox'])]:bg-white [&_input:not([type='checkbox'])]:px-3 [&_input:not([type='checkbox'])]:py-2 [&_label]:text-sm [&_label]:font-medium [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 dark:[&_button]:border-slate-600 dark:[&_button]:bg-slate-900 dark:[&_button]:text-slate-100 dark:[&_input:not([type='checkbox'])]:border-slate-600 dark:[&_input:not([type='checkbox'])]:bg-slate-900 dark:[&_select]:border-slate-600 dark:[&_select]:bg-slate-900"
				form={form}
			>
				<div className="flex flex-wrap items-center gap-3">
					<kit.Submit className="border-emerald-700! bg-emerald-700! text-white! hover:bg-emerald-800!">
						Save profile
					</kit.Submit>
					<output
						aria-live="polite"
						className="text-sm text-slate-600 dark:text-slate-300"
					>
						{status}
					</output>
				</div>
			</kit.AutoForm>
		</section>
	)
}
