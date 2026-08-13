type PathSegment = string | number

/** A value that can cross a JSON storage boundary. */
export type JsonValue =
	| null
	| boolean
	| number
	| string
	| readonly JsonValue[]
	| { readonly [key: string]: JsonValue }

/** Converts one supported opaque value to and from JSON. */
export type PersistenceCodec<Value = unknown> = Readonly<{
	tag: string
	canEncode(value: unknown): value is Value
	encode(value: Value): JsonValue | Promise<JsonValue>
	decode(value: JsonValue): Value | Promise<Value>
}>

/** Converts decoded data from an older application version. */
export type PersistenceMigration = (
	value: unknown,
	fromVersion: number,
	toVersion: number,
) => unknown | Promise<unknown>

type EncodedNode =
	| { readonly type: "null" }
	| { readonly type: "boolean"; readonly value: boolean }
	| { readonly type: "number"; readonly value: number }
	| { readonly type: "negative-zero" }
	| { readonly type: "string"; readonly value: string }
	| { readonly type: "undefined" }
	| { readonly type: "array"; readonly items: readonly EncodedNode[] }
	| {
			readonly type: "object"
			readonly entries: readonly (readonly [string, EncodedNode])[]
	  }
	| {
			readonly type: "codec"
			readonly tag: string
			readonly value: JsonValue
	  }

type PersistenceEnvelope = Readonly<{
	protocol: typeof FORM_PERSISTENCE_PROTOCOL
	protocolVersion: typeof FORM_PERSISTENCE_PROTOCOL_VERSION
	version: number
	payload: JsonValue
}>

const FORM_PERSISTENCE_PROTOCOL = "form-please/persistence" as const
const FORM_PERSISTENCE_PROTOCOL_VERSION = 1 as const

export async function encodePersistenceEnvelope(
	value: unknown,
	options: Readonly<{
		version: number
		codecs: readonly PersistenceCodec[]
	}>,
): Promise<JsonValue> {
	return Object.freeze({
		protocol: FORM_PERSISTENCE_PROTOCOL,
		protocolVersion: FORM_PERSISTENCE_PROTOCOL_VERSION,
		version: options.version,
		payload: (await encodeNode(
			value,
			options.codecs,
			[],
			new WeakSet(),
		)) as JsonValue,
	})
}

export async function decodePersistenceEnvelope(
	input: unknown,
	options: Readonly<{
		version: number
		codecs: readonly PersistenceCodec[]
		migrate?: PersistenceMigration
	}>,
): Promise<Readonly<{ value: unknown; migrated: boolean }>> {
	assertJsonValue(input, "Persistence envelope")
	const envelope = readEnvelope(input)
	const decoded = await decodeNode(envelope.payload, options.codecs, [])
	const migrated = envelope.version !== options.version
	if (!migrated) return Object.freeze({ migrated: false, value: decoded })
	if (options.migrate === undefined) {
		throw new TypeError(
			`Persisted form data version ${envelope.version} requires a migration to version ${options.version}`,
		)
	}
	return Object.freeze({
		migrated: true,
		value: await options.migrate(decoded, envelope.version, options.version),
	})
}

export function normalizePersistenceCodecs(
	codecs: readonly PersistenceCodec[] | undefined,
): readonly PersistenceCodec[] {
	if (codecs === undefined) return Object.freeze([])
	if (!Array.isArray(codecs)) {
		throw new TypeError("Persistence codecs must be an array")
	}
	const tags = new Set<string>()
	return Object.freeze(
		codecs.map((codec, index) => {
			if (typeof codec !== "object" || codec === null) {
				throw new TypeError(
					`Persistence codec at index ${index} must be an object`,
				)
			}
			if (typeof codec.tag !== "string" || codec.tag.length === 0) {
				throw new TypeError("Persistence codec tags must be non-empty strings")
			}
			if (tags.has(codec.tag)) {
				throw new TypeError(`Duplicate persistence codec tag "${codec.tag}"`)
			}
			if (
				typeof codec.canEncode !== "function" ||
				typeof codec.encode !== "function" ||
				typeof codec.decode !== "function"
			) {
				throw new TypeError(
					`Persistence codec "${codec.tag}" must define canEncode, encode, and decode`,
				)
			}
			tags.add(codec.tag)
			return Object.freeze({
				canEncode: codec.canEncode.bind(codec),
				decode: codec.decode.bind(codec),
				encode: codec.encode.bind(codec),
				tag: codec.tag,
			})
		}),
	)
}

function readEnvelope(input: JsonValue): PersistenceEnvelope {
	const envelope = readObject(input, "Persistence envelope")
	if (envelope.protocol !== FORM_PERSISTENCE_PROTOCOL) {
		throw new TypeError("Unsupported persistence protocol identifier")
	}
	if (envelope.protocolVersion !== FORM_PERSISTENCE_PROTOCOL_VERSION) {
		throw new TypeError(
			`Unsupported persistence protocol version ${String(envelope.protocolVersion)}`,
		)
	}
	const version = envelope.version
	if (
		typeof version !== "number" ||
		!Number.isSafeInteger(version) ||
		version < 0
	) {
		throw new TypeError(
			"Persistence application version must be a non-negative integer",
		)
	}
	if (!("payload" in envelope)) {
		throw new TypeError("Persistence envelope is missing its payload")
	}
	return envelope as unknown as PersistenceEnvelope
}

async function encodeNode(
	value: unknown,
	codecs: readonly PersistenceCodec[],
	path: readonly PathSegment[],
	ancestors: WeakSet<object>,
): Promise<EncodedNode> {
	if (value === null) return { type: "null" }
	if (value === undefined) return { type: "undefined" }
	if (typeof value === "boolean") return { type: "boolean", value }
	if (typeof value === "string") return { type: "string", value }
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw unsupported(path, "non-finite number")
		if (Object.is(value, -0)) return { type: "negative-zero" }
		return { type: "number", value }
	}

	for (const codec of codecs) {
		let claimed: boolean
		try {
			claimed = codec.canEncode(value)
		} catch (error) {
			throw codecFailure(codec.tag, "canEncode", path, error)
		}
		if (!claimed) continue
		let encoded: JsonValue
		try {
			encoded = await codec.encode(value)
			assertJsonValue(encoded, `Persistence codec "${codec.tag}" output`)
		} catch (error) {
			throw codecFailure(codec.tag, "encode", path, error)
		}
		return { tag: codec.tag, type: "codec", value: encoded }
	}

	if (typeof value !== "object") throw unsupported(path, typeof value)
	if (ancestors.has(value)) throw unsupported(path, "cyclic value")
	ancestors.add(value)
	try {
		if (Array.isArray(value)) {
			const items: EncodedNode[] = []
			for (const [index, item] of value.entries()) {
				items.push(await encodeNode(item, codecs, [...path, index], ancestors))
			}
			return { items, type: "array" }
		}
		const prototype = Object.getPrototypeOf(value)
		if (prototype !== Object.prototype && prototype !== null) {
			const prototypeConstructor = Object.hasOwn(prototype, "constructor")
				? (prototype as { readonly constructor?: unknown }).constructor
				: undefined
			const kind =
				typeof prototypeConstructor === "function" &&
				prototypeConstructor.name.length > 0
					? prototypeConstructor.name
					: "object prototype is not Object.prototype or null"
			throw unsupported(path, kind)
		}
		if (
			Object.getOwnPropertySymbols(value).some(
				(symbol) => Object.getOwnPropertyDescriptor(value, symbol)?.enumerable,
			)
		) {
			throw unsupported(path, "symbol key")
		}
		const entries: (readonly [string, EncodedNode])[] = []
		for (const key of Object.keys(value).sort()) {
			entries.push([
				key,
				await encodeNode(
					(value as Record<string, unknown>)[key],
					codecs,
					[...path, key],
					ancestors,
				),
			])
		}
		return { entries, type: "object" }
	} finally {
		ancestors.delete(value)
	}
}

async function decodeNode(
	input: JsonValue,
	codecs: readonly PersistenceCodec[],
	path: readonly PathSegment[],
): Promise<unknown> {
	const node = readObject(
		input,
		`Encoded persistence value at ${pathLabel(path)}`,
	)
	switch (node.type) {
		case "null":
			return null
		case "undefined":
			return undefined
		case "boolean":
			if (typeof node.value !== "boolean") throw malformed(path)
			return node.value
		case "number":
			if (typeof node.value !== "number" || !Number.isFinite(node.value)) {
				throw malformed(path)
			}
			return node.value
		case "negative-zero":
			return -0
		case "string":
			if (typeof node.value !== "string") throw malformed(path)
			return node.value
		case "array":
			if (!Array.isArray(node.items)) throw malformed(path)
			return Promise.all(
				node.items.map((item, index) =>
					decodeNode(item, codecs, [...path, index]),
				),
			)
		case "object": {
			if (!Array.isArray(node.entries)) throw malformed(path)
			const result = Object.create(null) as Record<string, unknown>
			for (const entry of node.entries) {
				if (
					!Array.isArray(entry) ||
					entry.length !== 2 ||
					typeof entry[0] !== "string" ||
					Object.hasOwn(result, entry[0])
				) {
					throw malformed(path)
				}
				result[entry[0]] = await decodeNode(entry[1], codecs, [
					...path,
					entry[0],
				])
			}
			return result
		}
		case "codec": {
			if (typeof node.tag !== "string" || !("value" in node)) {
				throw malformed(path)
			}
			const codec = codecs.find((candidate) => candidate.tag === node.tag)
			if (codec === undefined) {
				throw new TypeError(
					`Unknown persistence codec tag "${node.tag}" at ${pathLabel(path)}`,
				)
			}
			try {
				return await codec.decode(node.value)
			} catch (error) {
				throw codecFailure(codec.tag, "decode", path, error)
			}
		}
		default:
			throw malformed(path)
	}
}

function assertJsonValue(
	value: unknown,
	label: string,
): asserts value is JsonValue {
	const ancestors = new WeakSet<object>()
	const visit = (candidate: unknown): void => {
		if (
			candidate === null ||
			typeof candidate === "boolean" ||
			typeof candidate === "string"
		) {
			return
		}
		if (typeof candidate === "number" && Number.isFinite(candidate)) return
		if (typeof candidate !== "object") {
			throw new TypeError(`${label} must be JSON`)
		}
		if (ancestors.has(candidate)) {
			throw new TypeError(`${label} must be acyclic JSON`)
		}
		ancestors.add(candidate)
		try {
			if (Array.isArray(candidate)) {
				for (const item of candidate) visit(item)
				return
			}
			const prototype = Object.getPrototypeOf(candidate)
			if (prototype !== Object.prototype && prototype !== null) {
				throw new TypeError(`${label} must be JSON`)
			}
			for (const item of Object.values(candidate)) visit(item)
		} finally {
			ancestors.delete(candidate)
		}
	}
	visit(value)
}

function readObject(
	value: JsonValue,
	label: string,
): Record<string, JsonValue> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new TypeError(`${label} must be an object`)
	}
	return value as Record<string, JsonValue>
}

function unsupported(path: readonly PathSegment[], kind: string): TypeError {
	return new TypeError(
		`Unsupported persistence value at ${pathLabel(path)}: ${kind}`,
	)
}

/** Adds codec, operation, and value-path context to an application failure. */
function codecFailure(
	tag: string,
	operation: "canEncode" | "decode" | "encode",
	path: readonly PathSegment[],
	cause: unknown,
): TypeError {
	const action =
		operation === "canEncode"
			? `canEncode failed for value at ${pathLabel(path)}`
			: `failed to ${operation} value at ${pathLabel(path)}`
	return new TypeError(`Persistence codec "${tag}" ${action}`, { cause })
}

function malformed(path: readonly PathSegment[]): TypeError {
	return new TypeError(
		`Malformed encoded persistence value at ${pathLabel(path)}`,
	)
}

function pathLabel(path: readonly PathSegment[]): string {
	return path.length === 0 ? '"<root>"' : `"${path.join(".")}"`
}
