import { z } from "zod"
import { defineControl } from "./control-definition.js"
import { createFormKit } from "./create-form-kit.js"
import type {
	ArrayItemSlotProps,
	ArraySlotProps,
	ErrorMessageSlotProps,
	FieldSlotProps,
	SectionSlotProps,
	SubmitSlotProps,
} from "./types.js"

export const schema = z
	.object({
		name: z.string().min(2, "Enter at least two characters"),
	})
	.transform((value) => ({
		...value,
		name: value.name.trim(),
	}))

export const kit = createFormKit({
	controls: {
		text: defineControl<string>({
			component: ({ value, setValue, blur, input, disabled }) => (
				<input
					aria-describedby={input["aria-describedby"]}
					disabled={disabled}
					id={input.id}
					name={input.name}
					onBlur={blur}
					onChange={(event) => setValue(event.currentTarget.value)}
					ref={input.ref}
					value={value}
				/>
			),
		}),
		select: defineControl<string, Record<string, never>, unknown, string>({
			component: ({ value, setValue, blur, input, options }) => (
				<select
					id={input.id}
					name={input.name}
					onBlur={blur}
					onChange={(event) => setValue(event.currentTarget.value)}
					ref={input.ref}
					value={value}
				>
					{options.map((option) => (
						<option key={option} value={option}>
							{option}
						</option>
					))}
				</select>
			),
		}),
	},
	slots: {
		Field: ({
			rootProps,
			labelProps,
			label,
			control,
			errors,
		}: FieldSlotProps) => (
			<div {...rootProps}>
				<label {...labelProps} htmlFor={labelProps.htmlFor}>
					{label}
				</label>
				{control}
				{errors}
			</div>
		),
		Section: ({ rootProps, title, children }: SectionSlotProps) => (
			<section {...rootProps}>
				<h2>{title}</h2>
				{children}
			</section>
		),
		Array: ({ rootProps, label, add, canAdd, children }: ArraySlotProps) => (
			<section {...rootProps}>
				<h2>{label}</h2>
				<button disabled={!canAdd} onClick={add} type="button">
					Add speaker
				</button>
				{children}
			</section>
		),
		ArrayItem: ({
			rootProps,
			children,
			index,
			canMoveUp,
			canMoveDown,
			move,
			remove,
		}: ArrayItemSlotProps) => (
			<div {...rootProps}>
				{children}
				<button
					disabled={!canMoveUp}
					onClick={() => move(index - 1)}
					type="button"
				>
					Move speaker {index + 1} up
				</button>
				<button
					disabled={!canMoveDown}
					onClick={() => move(index + 1)}
					type="button"
				>
					Move speaker {index + 1} down
				</button>
				<button onClick={remove} type="button">
					Remove speaker {index + 1}
				</button>
			</div>
		),
		ErrorMessage: ({ rootProps, issue }: ErrorMessageSlotProps) => (
			<p {...rootProps}>{issue.message}</p>
		),
		Submit: ({ buttonProps }: SubmitSlotProps) => <button {...buttonProps} />,
	},
})

export const definition = kit.defineForm(schema, {
	ui: [
		{
			kind: "field",
			path: "name",
			control: "text",
			label: "Name",
			required: true,
		},
	],
})
