"use client"

import { CompanyNameForm } from "../snippets/when-hidden"

export function WhenHiddenDemoClient() {
	return (
		<section
			aria-label="Hidden field reset form"
			className="form-please-complex"
			data-testid="when-hidden-demo"
		>
			<p className="form-please-complex__kicker">Live result</p>
			<div className="form-please-playground__form">
				<CompanyNameForm />
			</div>
		</section>
	)
}
