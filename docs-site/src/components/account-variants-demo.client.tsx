"use client"

import { AccountForm } from "../snippets/account-variants"

export function AccountVariantsDemoClient() {
	return (
		<section
			aria-label="Account variants form"
			className="form-please-complex"
			data-testid="account-variants-demo"
		>
			<p className="form-please-complex__kicker">Live result</p>
			<div className="form-please-playground__form">
				<AccountForm />
			</div>
		</section>
	)
}
