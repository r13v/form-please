// @jsx: react-jsx
"use client"

import { nativeFormKit } from "form-please/preset-native"
import { useState } from "react"
import { z } from "zod"

const articleSchema = z.object({
	title: z.string().min(1, "Enter a title"),
	summary: z.string().min(20, "Write at least 20 characters"),
})

type ReviewScreen = "edit" | "review"
type PublishReceipt = Readonly<{ id: string; publishedTitle: string }>

const articleDefinition = nativeFormKit.defineForm(articleSchema, {
	ui: [
		{ kind: "field", path: "title", control: "text", label: "Title" },
		{
			kind: "field",
			path: "summary",
			control: "textarea",
			label: "Summary",
			options: { rows: 5 },
		},
	],
})

async function publishArticle(
	value: z.output<typeof articleSchema>,
): Promise<PublishReceipt> {
	return { id: "article-42", publishedTitle: value.title.trim() }
}

export function ArticleWorkflow() {
	const [screen, setScreen] = useState<ReviewScreen>("edit")
	const [receipt, setReceipt] = useState<PublishReceipt>()
	const form = nativeFormKit.useForm(articleDefinition, {
		defaultValues: { title: "", summary: "" },
		readOnly: screen === "review",
		onSubmit: async ({ value }) => {
			setReceipt(await publishArticle(value))
		},
	})

	if (receipt !== undefined) {
		return (
			<section aria-labelledby="confirmation-title">
				<h2 id="confirmation-title">Article published</h2>
				<p>Confirmation ID: {receipt.id}</p>
				<p>Published title: {receipt.publishedTitle}</p>
			</section>
		)
	}
	let actions = (
		<button type="button" onClick={() => setScreen("review")}>
			Review current input
		</button>
	)
	if (screen === "review") {
		actions = (
			<>
				<button type="button" onClick={() => setScreen("edit")}>
					Edit
				</button>
				<nativeFormKit.Submit name="intent" value="publish">
					Publish
				</nativeFormKit.Submit>
			</>
		)
	}

	return <nativeFormKit.AutoForm form={form}>{actions}</nativeFormKit.AutoForm>
}
