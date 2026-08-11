// @jsx: react-jsx
"use client"

import { type ControlProps, defineControl } from "form-please"

export type UppercaseOptions = {
	readonly placeholder?: string
}

export function UppercaseControl({
	value,
	setValue,
	blur,
	input,
	meta,
	options,
	disabled,
	readOnly,
	required,
}: ControlProps<string | undefined, UppercaseOptions>) {
	return (
		<input
			aria-describedby={input["aria-describedby"]}
			aria-invalid={meta.invalid || undefined}
			disabled={disabled}
			id={input.id}
			name={input.name}
			onBlur={blur}
			onChange={(event) =>
				setValue(event.currentTarget.value.toUpperCase() || undefined)
			}
			placeholder={options.placeholder}
			readOnly={readOnly}
			ref={input.ref}
			required={required}
			value={value ?? ""}
		/>
	)
}

export const uppercase = defineControl<string | undefined, UppercaseOptions>({
	component: UppercaseControl,
})
