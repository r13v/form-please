import type {
	UiResolver,
	UiResolverDetails,
	UiResolverValues,
} from "./types.js"

/** The loading, successful, or failed state of application-owned data. */
export type ResourceState<Value, Error = unknown> =
	| {
			/** Indicates that the resource has no result yet. */
			readonly status: "pending"
	  }
	| {
			/** Indicates that the resource contains a successful value. */
			readonly status: "success"
			/** The loaded resource value. */
			readonly value: Value
	  }
	| {
			/** Indicates that the resource contains an error. */
			readonly status: "error"
			/** The failure value reported by the resource owner. */
			readonly error: Error
	  }

/** A resource state with unknown success and error values. */
type AnyResourceState = ResourceState<unknown, unknown>
/** A valid resource status discriminator. */
type ResourceStatus = AnyResourceState["status"]
/** Extracts one discriminated branch from a resource state. */
type ResourceBranch<
	Resource extends AnyResourceState,
	Status extends ResourceStatus,
> = Extract<Resource, { readonly status: Status }>
/** Handlers that map each resource branch to an application value. */
type ResourceCases<
	Resource extends AnyResourceState,
	PendingResult,
	SuccessResult,
	ErrorResult,
	Arguments extends readonly unknown[],
> = {
	/** Handles a pending resource. */
	readonly pending: (
		state: ResourceBranch<Resource, "pending">,
		...args: Arguments
	) => PendingResult
	/** Handles a successful resource. */
	readonly success: (
		state: ResourceBranch<Resource, "success">,
		...args: Arguments
	) => SuccessResult
	/** Handles a failed resource. */
	readonly error: (
		state: ResourceBranch<Resource, "error">,
		...args: Arguments
	) => ErrorResult
}

/**
 * Maps a resource state through its matching case handler.
 *
 * @example
 * ```ts
 * const label = matchResource(user, {
 *   pending: () => "Loading",
 *   success: ({ value }) => value.name,
 *   error: () => "Unavailable",
 * })
 * ```
 */
export function matchResource<
	Resource extends AnyResourceState,
	const PendingResult,
	const SuccessResult,
	const ErrorResult,
>(
	resource: Resource,
	cases: ResourceCases<
		Resource,
		PendingResult,
		SuccessResult,
		ErrorResult,
		readonly []
	>,
): PendingResult | SuccessResult | ErrorResult {
	return matchResourceWithArguments(resource, cases, [])
}

/**
 * Creates a synchronous UI resolver that branches on application resource state.
 *
 * Each handler also receives the resolver values and details.
 *
 * @see https://r13v.github.io/form-please/definitions
 */
export function fromResource<
	Resource extends AnyResourceState,
	Input,
	Context,
	const PendingResult,
	const SuccessResult,
	const ErrorResult,
>(
	select: UiResolver<Resource, Input, Context>,
	cases: ResourceCases<
		Resource,
		PendingResult,
		SuccessResult,
		ErrorResult,
		readonly [UiResolverValues<Input>, UiResolverDetails<Context>]
	>,
): UiResolver<PendingResult | SuccessResult | ErrorResult, Input, Context> {
	return (values, details) =>
		matchResourceWithArguments(select(values, details), cases, [
			values,
			details,
		])
}

/** Maps a resource state and forwards shared arguments to its matching handler. */
function matchResourceWithArguments<
	Resource extends AnyResourceState,
	PendingResult,
	SuccessResult,
	ErrorResult,
	Arguments extends readonly unknown[],
>(
	resource: Resource,
	cases: ResourceCases<
		Resource,
		PendingResult,
		SuccessResult,
		ErrorResult,
		Arguments
	>,
	args: Arguments,
): PendingResult | SuccessResult | ErrorResult {
	switch (resource.status) {
		case "pending":
			return cases.pending(
				resource as ResourceBranch<Resource, "pending">,
				...args,
			)
		case "success":
			return cases.success(
				resource as ResourceBranch<Resource, "success">,
				...args,
			)
		case "error":
			return cases.error(resource as ResourceBranch<Resource, "error">, ...args)
		default: {
			const unsupported: never = resource
			throw new TypeError(
				`Unsupported resource status "${String((unsupported as { readonly status?: unknown }).status)}"`,
			)
		}
	}
}
