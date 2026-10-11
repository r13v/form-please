// @jsx: react-jsx
"use client"

import {
	type FieldPath,
	type FormInput,
	type FormIssueInput,
	type FormSubmitDetails,
	type StandardSchema,
	useSnapshot,
} from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { get } from "react-hook-form"
import { z } from "zod"

// The application HTTP client throws this error for a failed response.
class ApiError extends Error {
	constructor(
		readonly status: number,
		readonly issues: readonly { path?: string; message: string }[],
	) {
		super(`Request failed with status ${status}`)
	}
}

// Write the wrapper once and use it in each form.
function withApiIssues<Schema extends StandardSchema, Context>(
	pathByServerPath: Readonly<
		Record<string, FieldPath<FormInput<NoInfer<Schema>>>>
	>,
	submit: (details: FormSubmitDetails<Schema, Context>) => Promise<unknown>,
) {
	const pathByServer = new Map<
		string | undefined,
		FieldPath<FormInput<Schema>>
	>(Object.entries(pathByServerPath))
	return async (details: FormSubmitDetails<Schema, Context>) => {
		try {
			await submit(details)
		} catch (error) {
			if (error instanceof ApiError && error.status === 400) {
				const { form, input } = details
				const current = form.api.getValues()
				const issues: FormIssueInput<Schema>[] = []
				for (const issue of error.issues) {
					const path = pathByServer.get(issue.path)
					// Skip an issue when the user changed its field during the request.
					const unchanged =
						path === undefined ||
						JSON.stringify(get(current, path)) ===
							JSON.stringify(get(input, path))
					if (unchanged) issues.push({ path, message: issue.message })
				}
				// Keep the failure visible when no current issue remains.
				if (issues.length === 0) {
					issues.push({ message: "The server rejected the form. Try again." })
				}
				form.setIssues(issues, { focus: true })
			}
			throw error // The runtime keeps the error in form.submission.
		}
	}
}

const profileSchema = z.object({ name: z.string().min(1), email: z.email() })

async function saveProfile(value: z.output<typeof profileSchema>) {
	const response = await fetch("/api/profile", {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(value),
	})
	if (!response.ok) {
		const body = (await response.json()) as { issues?: ApiError["issues"] }
		throw new ApiError(response.status, body.issues ?? [])
	}
}

const profileDefinition = nativeFormKit.defineForm(profileSchema, (ui) => [
	ui.field("name", { control: "text", label: "Name" }),
	ui.field("email", { control: "text", label: "Email" }),
])

export function ProfileForm() {
	const form = nativeFormKit.useForm(profileDefinition, {
		defaultValues: { name: "", email: "" },
		onSubmit: withApiIssues(
			{ full_name: "name", email_address: "email" },
			({ value }) => saveProfile(value),
		),
	})
	const { error } = useSnapshot(form.submission)
	const isRequestFailure =
		error !== null &&
		!(error.value instanceof ApiError && error.value.status === 400)

	return (
		<nativeFormKit.AutoForm form={form}>
			{isRequestFailure && <p role="alert">The profile was not saved.</p>}
			<nativeFormKit.Submit>Save profile</nativeFormKit.Submit>
		</nativeFormKit.AutoForm>
	)
}
