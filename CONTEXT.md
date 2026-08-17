# Form, Please

Form, Please is a code-first React form integration that connects a Standard
Schema input to a typed UI definition while React Hook Form owns form state.

## Language

**Schema input path**: A React Hook Form field path that addresses a value in
the Standard Schema input. Array indexes use canonical dot notation, such as
`speakers.0.name`.
_Avoid_: Registered path, server field name

**Rendered field path**: A schema input path represented by a visible generated
field or array node.
_Avoid_: Registered path, every schema path

**Form kit**: The immutable controls, slots, and grid integration returned by
`createFormKit`.
_Avoid_: Mutable kit, extension chain

**Form definition**: A Standard Schema, recursive typed UI tree, and fixed
managed-update policy normalized by one exact form kit.
_Avoid_: Form binding, inferred schema UI

**Form binding**: The thin integration returned by `kit.useForm` that contains
`form.api`, `form.update`, the fixed definition, and runtime context.
_Avoid_: Form store, Form Please runtime instance

**Form Please Devtools**: An optional read-only development instrument that
combines React Hook Form inspection with Form Please views of resolved UI,
issue routing, updates, asynchronous options, history, and persistence. React
Hook Form remains the sole owner of live form state.
_Avoid_: Form store, Redux DevTools

**React Hook Form API**: The state-owning React Hook Form API exposed unchanged
as `form.api`. Its direct mutations bypass Form Please middleware.
_Avoid_: Form Please command API

**Managed value update**: A value update initiated by a generated control,
generated array action, `form.update`, or optional history restore, and
therefore processed before it reaches the React Hook Form API. Every managed
update uses the coordinator even when the form has no configured middleware.
_Avoid_: Every React Hook Form update, raw API update

**Managed value history**: Retained schema input versions produced by
successful managed value updates and used for user-directed navigation. It
excludes raw React Hook Form changes and ephemeral form state.
_Avoid_: Form history, audit log, React Hook Form state history

**History group**: One undoable position in managed value history. Consecutive
control updates to the same schema input path can replace the group's retained
value within the configured grouping window.
_Avoid_: Event, transaction, audit record

**History journal**: A versioned in-memory export of retained schema input
positions and the current numeric position. It is a navigation artifact rather
than an event log or persistence format.
_Avoid_: Event journal, audit trail, serialized form

**History restore**: A user-directed managed value update that moves a form to
a retained history position while preserving the form's default-value baseline.
_Avoid_: Reset, replay, runtime-state restore

**Form update recipe**: A synchronous Immer recipe passed to `form.update`
that derives the next complete schema input by either mutating a writable draft
or returning a replacement, but not both. The produced input and its patches
become one managed value update; an empty patch list produces no transaction.
Its public return type is `unknown` because middleware controls the dispatch
return value.
_Avoid_: React state setter, partial object patch, raw React Hook Form update

**Value transaction**: A deeply readonly TypeScript view of a proposed managed
value update containing the previous and proposed schema input, Immer patches,
runtime context, and a discriminated `control`, `array`, `update`, or `history`
source. Its proposed input is derived from its patches rather than accepted as
an independent source of truth. Transaction values are not frozen at runtime
because React Hook Form requires mutable values.
_Avoid_: React Hook Form notification, validation event, form event

**Value patch**: An Immer patch with an `add`, `remove`, or `replace` operation
and a segment-array path. Value patches are the authoritative change format
forwarded to `next`; React Hook Form dot paths remain the public field-path
format elsewhere.
_Avoid_: JSON Patch pointer, React Hook Form dot path, custom diff record

**Form middleware**: A synchronous Redux-shaped function configured by one form
definition that forwards value patches with `next`, replaces or cancels a value
transaction, and controls the dispatch return value. The ordered middleware
list is copied and fixed by `kit.defineForm`; every binding initializes an
independent chain. A middleware can call
`next` synchronously at most once; returning without calling `next` cancels the
transaction. It may return a Promise after a synchronous commit. An exception
after `next` does not roll back the committed values.
_Avoid_: React Hook Form subscription, UI resolver, global middleware

**Form persistence middleware**: An optional form middleware configured in a
definition's fixed middleware list to coordinate durable form drafts.
_Avoid_: Persistence hook, `useForm` persistence option

**Persisted form draft**: A durable representation of the current editable
schema input for later restoration. It excludes managed history and React Hook
Form metadata.
_Avoid_: Form document, form state snapshot, history journal

**Persistence restore**: A managed value update that applies a persisted form
draft while preserving the form's original default-value baseline.
_Avoid_: Raw reset, history restore, clean-baseline replacement

**Persistence restore conflict**: A restore outcome in which live form values
changed while the persisted form draft was loading, so the loaded draft is not
applied.
_Avoid_: Automatic merge, last-write-wins restore

**Persistence handle**: The form-specific persistence operations and observable
status exposed by the exact form persistence middleware configured for a form.
_Avoid_: Global persistence controller, React hook result

**Persistence adapter**: An application-owned asynchronous keyed transport that
loads, saves, and removes persistence envelopes without interpreting them.
_Avoid_: Serializer, form store, persistence middleware

**Persistence envelope**: The versioned JSON-safe representation of a persisted
form draft produced and understood by Form Please.
_Avoid_: Raw form input, adapter-specific payload

**Persistence codec**: A tagged conversion between one supported non-structural
JavaScript value and its JSON representation inside a persistence envelope.
_Avoid_: Storage adapter, whole-draft serializer

**Persistence migration**: An application-owned transformation from a decoded,
untrusted persisted value at an older application version to the current input
shape.
_Avoid_: Protocol migration, schema validation

**Managed update hooks**: The definition-owned `beforeUpdate` and `afterUpdate`
callbacks for one managed value-update lifecycle. `beforeUpdate` can adjust or
cancel proposed values, while `afterUpdate` observes the committed transaction.
Both receive the binding's current context through the transaction.
_Avoid_: React Hook Form lifecycle hooks, raw update hooks

**Form middleware API**: The form-local `getValues` and `update` operations
available while configuring middleware. `getValues` returns a deeply readonly
view for synchronous use without cloning an archival snapshot. Calling `update`
during an active transaction is prohibited; a later call starts an independent
transaction.
_Avoid_: React Hook Form API, nested dispatch, global store API

**Terminal dispatch result**: The committed value transaction returned by the
terminal `next`, including its final `nextValues`. Any middleware can replace
that result according to Redux dispatch semantics.
_Avoid_: Guaranteed `form.update` result, duplicate next-values wrapper

**Render-level array transaction**: A generated structural array action and
its dependent changes presented in one final React render. Raw React Hook Form
subscriptions can observe intermediate state because the public React Hook Form
API cannot preserve field-array identities and publish the complete transaction
as one state change. Middleware can cancel the source operation and change row
or dependent values, but cannot change the source array length or order beyond
the source `append`, `remove`, or `move` operation. The transaction must not
change another generated array's structure.
_Avoid_: Atomic value commit, raw array update

**UI resolver**: A synchronous function that receives the complete deeply
readonly schema input and runtime context, then returns one derived UI property.
_Avoid_: Computed field, async resolver

**Control**: A registered typed adapter between one schema value and one
interactive React component.
_Avoid_: Field definition, serializer

**Choice value**: One value offered by a choice control and constrained in a
form definition to the schema input value union at its path.
_Avoid_: Option value, control value

**Slot**: An application- or preset-owned component that renders structural
field, section, array, error, or submit markup.
_Avoid_: Control, inferred layout

**Form kit grid scale**: The finite numeric layout vocabulary shared by section
column counts and numeric child spans.
_Avoid_: CSS grid implementation, global column range

**Resource state**: A pending, successful, or failed state of application-owned
asynchronous data supplied through values or runtime context.
_Avoid_: Form request, form cache

**Transformed submit output**: The Standard Schema output delivered to a
successful submit callback. It can differ from the editable form input.
_Avoid_: Cached validation result, editable form state

**Material UI preset**: The Form, Please-owned integration exported from
`form-please/preset-mui` with Material UI controls, slots, and a 12-column grid.
_Avoid_: Application-owned Material UI adapter
