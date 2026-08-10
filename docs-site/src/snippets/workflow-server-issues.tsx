// @jsx: react-jsx
"use client"

import type { FieldPath, FormBinding, FormInput } from "form-please"
import { nativeFormKit } from "form-please/preset-native"
import { useEffect, useMemo, useRef, useState } from "react"
import { z } from "zod"

const profileSchema = z.object({
	name: z.string().min(1),
	email: z.email(),
	department: z.string().min(1),
})
type ProfileInput = FormInput<typeof profileSchema>
type ProfileScreen = "identity" | "work"
type ProfileContext = { readonly screen: ProfileScreen }
type ProfileForm = FormBinding<typeof profileSchema, ProfileContext>

const serverIssueSchema = z.object({
	issues: z.array(
		z.object({
			path: z.enum([
				"profile.full_name",
				"profile.email_address",
				"employment.department",
			]),
			message: z.string(),
		}),
	),
})
type ServerIssue = z.output<typeof serverIssueSchema>["issues"][number]

const inputPathByServerPath = {
	"profile.full_name": "name",
	"profile.email_address": "email",
	"employment.department": "department",
} satisfies Record<ServerIssue["path"], FieldPath<ProfileInput>>

const screenByInputPath = {
	name: "identity",
	email: "identity",
	department: "work",
} satisfies Record<FieldPath<ProfileInput>, ProfileScreen>

function applyServerIssues(
	form: ProfileForm,
	issues: readonly ServerIssue[],
): FieldPath<ProfileInput> | undefined {
	form.api.clearErrors(Object.values(inputPathByServerPath))
	let firstPath: FieldPath<ProfileInput> | undefined

	for (const issue of issues) {
		const path = inputPathByServerPath[issue.path]
		firstPath ??= path
		form.api.setError(path, { message: issue.message, type: "server" })
	}
	return firstPath
}

const profileKit = nativeFormKit.forContext<ProfileContext>()
const profileDefinition = profileKit.defineForm(profileSchema, {
	ui: [
		{
			kind: "field",
			path: "name",
			control: "text",
			label: "Name",
			visible: (_input, { context }) => context.screen === "identity",
		},
		{
			kind: "field",
			path: "email",
			control: "text",
			label: "Email",
			options: { type: "email" },
			visible: (_input, { context }) => context.screen === "identity",
		},
		{
			kind: "field",
			path: "department",
			control: "text",
			label: "Department",
			visible: (_input, { context }) => context.screen === "work",
		},
	],
})

export function ServerValidatedProfile() {
	const [screen, setScreen] = useState<ProfileScreen>("identity")
	const [requestError, setRequestError] = useState<string>()
	const pendingFocus = useRef<Readonly<{
		path: FieldPath<ProfileInput>
		screen: ProfileScreen
	}> | null>(null)
	const context = useMemo(() => ({ screen }), [screen])
	const form = profileKit.useForm(profileDefinition, {
		context,
		defaultValues: { name: "", email: "", department: "" },
		onSubmit: async ({ form, value }) => {
			setRequestError(undefined)
			try {
				const response = await fetch("/api/profile", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(value),
				})
				const body: unknown = await response.json()
				const result = serverIssueSchema.parse(body)
				const firstPath = applyServerIssues(form, result.issues)
				if (firstPath === undefined) return
				const issueScreen = screenByInputPath[firstPath]
				if (issueScreen === screen) {
					form.api.setFocus(firstPath)
					return
				}
				pendingFocus.current = { path: firstPath, screen: issueScreen }
				setScreen(issueScreen)
			} catch {
				setRequestError("The profile could not be saved.")
			}
		},
	})
	useEffect(() => {
		const pending = pendingFocus.current
		if (pending === null || pending.screen !== screen) return
		pendingFocus.current = null
		form.api.setFocus(pending.path)
	}, [form, screen])

	return (
		<profileKit.AutoForm form={form} data-screen={screen}>
			{requestError !== undefined && <p role="alert">{requestError}</p>}
			<profileKit.Submit>Save profile</profileKit.Submit>
		</profileKit.AutoForm>
	)
}
