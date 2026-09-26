"use client"

import { ProfileForm } from "../snippets/profile-form"

export function GetStartedDemoClient() {
	return (
		<section
			aria-label="Get started profile form"
			className="form-please-complex"
			data-testid="get-started-demo"
		>
			<p className="form-please-complex__kicker">Live result</p>
			<div className="form-please-playground__form">
				<ProfileForm />
			</div>
		</section>
	)
}
