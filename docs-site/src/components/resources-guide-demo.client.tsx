"use client"

import { useEffect, useState } from "react"

import { ResourceStatePreview } from "../snippets/resources-guide"

export function ResourceStateDemoClient() {
	const [isReady, setIsReady] = useState(false)
	useEffect(() => setIsReady(true), [])

	return (
		<div data-demo-client-ready={isReady} data-resource-preview="country">
			<ResourceStatePreview />
		</div>
	)
}
