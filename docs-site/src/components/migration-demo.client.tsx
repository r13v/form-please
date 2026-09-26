"use client"

import { useState } from "react"
import { TicketFormAfter } from "../snippets/migration-after"
import { TicketFormBefore } from "../snippets/migration-before"

const versions = [
	{ id: "before", title: "React Hook Form", Form: TicketFormBefore },
	{ id: "after", title: "Form, Please", Form: TicketFormAfter },
] as const

type VersionId = (typeof versions)[number]["id"]

export function MigrationDemoClient() {
	const [activeId, setActiveId] = useState<VersionId>("before")

	return (
		<section
			aria-label="Migration before and after"
			className="form-please-complex form-please-playground"
			data-testid="migration-demo"
		>
			<div className="form-please-playground__tabs" role="tablist">
				{versions.map((version) => (
					<button
						aria-controls={`migration-demo-${version.id}`}
						aria-selected={version.id === activeId}
						className="form-please-playground__tab"
						id={`migration-demo-tab-${version.id}`}
						key={version.id}
						onClick={() => setActiveId(version.id)}
						role="tab"
						type="button"
					>
						{version.title}
					</button>
				))}
			</div>
			{versions.map((version) => (
				<div
					aria-labelledby={`migration-demo-tab-${version.id}`}
					className="form-please-playground__panel"
					hidden={version.id !== activeId}
					id={`migration-demo-${version.id}`}
					key={version.id}
					role="tabpanel"
				>
					<div className="form-please-playground__form">
						{version.id === activeId && <version.Form />}
					</div>
				</div>
			))}
		</section>
	)
}
