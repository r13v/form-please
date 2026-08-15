"use client"

import { DevTool } from "@hookform/devtools"
import {
	type CSSProperties,
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useId,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	useSyncExternalStore,
} from "react"
import { createPortal } from "react-dom"
import type { Control, FieldValues } from "react-hook-form"
import { useFormState } from "react-hook-form"

import {
	type FormBinding,
	getFormDiagnosticsRuntime,
} from "../create-form-kit.js"
import type {
	ResolvedDefinition,
	ResolvedFieldNode,
	ResolvedNode,
} from "../definition.js"
import { fieldErrorsToIssues } from "../standard-schema-resolver.js"
import type { FormIssue, StandardSchema } from "../types.js"
import {
	type DevtoolsFeatureState,
	type DevtoolsOptionsRequest,
	type DevtoolsOptionsState,
	type DevtoolsStoreSnapshot,
	type DevtoolsUpdateEvent,
	FormPleaseDevtoolsStore,
} from "./store.js"
import { devtoolsStyles } from "./styles.js"

type AnyFormSchema = StandardSchema<FieldValues, unknown>
type TabName = "features" | "options" | "ui" | "updates"

/** Props for the combined React Hook Form and Form Please development tool. */
export type FormPleaseDevtoolsProps<
	Schema extends StandardSchema = AnyFormSchema,
	Context = unknown,
> = Readonly<{
	/** The exact Form Please binding to inspect. */
	form: FormBinding<Schema, Context>
	/** An optional readable label for applications with several forms. */
	name?: string
}>

const generatedNames = new WeakMap<object, string>()
const objectKeys = new WeakMap<object, number>()
let generatedNameSequence = 0
let objectKeySequence = 0

/** Mounts RHF DevTools and the Form Please diagnostic drawer for one form. */
export function FormPleaseDevtools<
	Schema extends StandardSchema = AnyFormSchema,
	Context = unknown,
>({ form, name }: FormPleaseDevtoolsProps<Schema, Context>) {
	const runtime = getFormDiagnosticsRuntime(form)
	const diagnosticTarget = runtime.diagnosticTarget
	const storeRef = useRef<
		Readonly<{ store: FormPleaseDevtoolsStore; target: object }> | undefined
	>(undefined)
	if (storeRef.current?.target !== diagnosticTarget) {
		storeRef.current = {
			store: new FormPleaseDevtoolsStore(
				form as unknown as FormBinding,
				runtime,
			),
			target: diagnosticTarget,
		}
	}
	const store = storeRef.current.store
	store.updateHost(form as unknown as FormBinding, runtime)
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	)
	const state = useFormState({ control: form.api.control })
	const issues = useMemo(
		() => fieldErrorsToIssues(state.errors),
		[state.errors],
	)
	const [mounted, setMounted] = useState(false)
	const displayName = name ?? generatedFormName(diagnosticTarget)

	useLayoutEffect(() => store.connect(), [store])
	useEffect(() => setMounted(true), [])

	if (!mounted || typeof document === "undefined") return null
	return (
		<>
			<DevTool
				control={form.api.control as unknown as Control<FieldValues>}
				placement="top-right"
			/>
			{createPortal(
				<DevtoolsShell
					displayName={displayName}
					issues={issues}
					snapshot={snapshot}
					store={store}
				/>,
				document.body,
			)}
		</>
	)
}

function DevtoolsShell({
	displayName,
	issues,
	snapshot,
	store,
}: Readonly<{
	displayName: string
	issues: readonly FormIssue[]
	snapshot: DevtoolsStoreSnapshot
	store: FormPleaseDevtoolsStore
}>) {
	const [open, setOpen] = useState(false)
	const [tab, setTab] = useState<TabName>("ui")
	const [height, setHeight] = useState<number>()
	const resize = useRef<{ height: number; y: number } | undefined>(undefined)
	const tabIdPrefix = `fp-devtools-${useId().replaceAll(":", "")}`
	const resolvedNodes = snapshot.resolved?.nodes ?? []
	const visibleCount = resolvedNodes.filter((node) => node.visible).length
	const drawerStyle = {
		...(height === undefined ? {} : { "--fpd-height": `${height}px` }),
	} as CSSProperties

	return (
		<div className="fp-devtools">
			<style>{devtoolsStyles}</style>
			{open ? (
				<aside
					aria-label={`${displayName} Form Please Devtools`}
					className="fp-devtools__drawer"
					style={drawerStyle}
				>
					<button
						aria-label="Resize Form Please Devtools"
						className="fp-devtools__resize"
						onKeyDown={(event) => resizeWithKeyboard(event, height, setHeight)}
						onPointerDown={(event) => {
							resize.current = {
								height: event.currentTarget.parentElement?.offsetHeight ?? 420,
								y: event.clientY,
							}
							event.currentTarget.setPointerCapture(event.pointerId)
						}}
						onPointerMove={(event) => {
							if (resize.current === undefined) return
							setHeight(
								clampDrawerHeight(
									resize.current.height + resize.current.y - event.clientY,
								),
							)
						}}
						onPointerUp={() => {
							resize.current = undefined
						}}
						type="button"
					/>
					<header className="fp-devtools__header">
						<div className="fp-devtools__mark" aria-hidden="true">
							FP
						</div>
						<div className="fp-devtools__identity">
							<div className="fp-devtools__eyebrow">Form Please</div>
							<div className="fp-devtools__title">{displayName}</div>
						</div>
						<div className="fp-devtools__stats">
							<span>{resolvedNodes.length} nodes</span>
							<span>{visibleCount} visible</span>
							<span>{issues.length} issues</span>
							<span>{snapshot.updates.length} updates</span>
						</div>
						<div className="fp-devtools__actions">
							<button
								className="fp-devtools__button"
								data-active={snapshot.recording}
								onClick={() => store.setRecording(!snapshot.recording)}
								type="button"
							>
								{snapshot.recording ? "Recording" : "Paused"}
							</button>
							<button
								aria-label="Close Form Please Devtools"
								className="fp-devtools__icon-button"
								onClick={() => setOpen(false)}
								type="button"
							>
								×
							</button>
						</div>
					</header>
					<div
						aria-label="Form Please diagnostic views"
						className="fp-devtools__tabs"
						role="tablist"
					>
						{(["ui", "updates", "options", "features"] as const).map(
							(candidate) => (
								<button
									aria-controls={`${tabIdPrefix}-panel-${candidate}`}
									aria-selected={tab === candidate}
									className="fp-devtools__tab"
									id={`${tabIdPrefix}-tab-${candidate}`}
									key={candidate}
									onClick={() => setTab(candidate)}
									role="tab"
									type="button"
								>
									{tabLabel(candidate)}
								</button>
							),
						)}
					</div>
					<div
						aria-labelledby={`${tabIdPrefix}-tab-${tab}`}
						className="fp-devtools__body"
						id={`${tabIdPrefix}-panel-${tab}`}
						role="tabpanel"
					>
						{renderTab(tab, issues, snapshot, store)}
					</div>
				</aside>
			) : (
				<button
					aria-label={`Open ${displayName} Form Please Devtools`}
					className="fp-devtools__launcher"
					onClick={() => setOpen(true)}
					type="button"
				>
					<span className="fp-devtools__mark" aria-hidden="true">
						FP
					</span>
					<span>Devtools</span>
					{issues.length === 0 ? null : (
						<span className="fp-devtools__badge">{issues.length}</span>
					)}
				</button>
			)}
		</div>
	)
}

type NodeRow = Readonly<{
	depth: number
	node: ResolvedNode
	parent: Readonly<{ disabled: boolean; readOnly: boolean; visible: boolean }>
}>

function UiView({
	issues,
	snapshot,
	store,
}: Readonly<{
	issues: readonly FormIssue[]
	snapshot: DevtoolsStoreSnapshot
	store: FormPleaseDevtoolsStore
}>) {
	const [query, setQuery] = useState("")
	const [selectedId, setSelectedId] = useState<string>()
	const runtime = store.getRuntime()
	const rows = useMemo(
		() =>
			flattenResolved(snapshot.resolved, {
				disabled: runtime.disabled,
				readOnly: runtime.readOnly,
				visible: true,
			}),
		[runtime.disabled, runtime.readOnly, snapshot.resolved],
	)
	const normalizedQuery = query.trim().toLocaleLowerCase()
	const visibleRows = rows.filter(
		({ node }) =>
			normalizedQuery.length === 0 ||
			nodeSearchText(node).includes(normalizedQuery),
	)
	const selected =
		rows.find(({ node }) => node.id === selectedId) ?? visibleRows[0] ?? rows[0]
	const routes = useMemo(
		() => issues.map((issue) => routeIssue(issue, rows)),
		[issues, rows],
	)

	if (snapshot.resolved === undefined) {
		return (
			<div className="fp-devtools__empty">
				Render the generated fields to inspect their resolved UI.
			</div>
		)
	}
	return (
		<div className="fp-devtools__split">
			<div className="fp-devtools__pane">
				<div className="fp-devtools__toolbar">
					<input
						aria-label="Search resolved UI"
						className="fp-devtools__search"
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Search path, ID, or kind"
						value={query}
					/>
				</div>
				<ul className="fp-devtools__tree">
					{visibleRows.map((row) => {
						const path = nodePath(row.node)
						const issueCount =
							path === undefined
								? 0
								: issues.filter((issue) => issue.path === path).length
						return (
							<li key={row.node.id} style={{ paddingLeft: row.depth * 14 }}>
								<button
									className="fp-devtools__node"
									data-selected={selected?.node.id === row.node.id}
									onClick={() => setSelectedId(row.node.id)}
									type="button"
								>
									<span className="fp-devtools__node-line">
										<span className="fp-devtools__kind">{row.node.kind}</span>
										<strong>{nodeTitle(row.node)}</strong>
										{row.node.visible ? null : <Pill label="hidden" />}
										{issueCount === 0 ? null : (
											<Pill label={`${issueCount} issue`} tone="danger" />
										)}
									</span>
									<span className="fp-devtools__path">
										{path ?? row.node.id}
									</span>
								</button>
							</li>
						)
					})}
				</ul>
			</div>
			<div className="fp-devtools__pane">
				{selected === undefined ? (
					<div className="fp-devtools__empty">Select a resolved node.</div>
				) : (
					<NodeDetails
						row={selected}
						issues={issues}
						snapshot={snapshot}
						store={store}
					/>
				)}
				<div className="fp-devtools__section">
					<h3>Issue routing</h3>
					<p className="fp-devtools__muted">
						Last submit focus: {formatFocus(snapshot.lastFocus)}
					</p>
					{routes.length === 0 ? (
						<p className="fp-devtools__muted">No current validation issues.</p>
					) : (
						<ul className="fp-devtools__list">
							{routes.map((route) => (
								<li key={objectKey(route.issue)}>
									<button
										className="fp-devtools__row"
										onClick={() => {
											if (route.node !== undefined) setSelectedId(route.node.id)
										}}
										type="button"
									>
										<span className="fp-devtools__row-line">
											<Pill
												label={route.classification}
												tone={
													route.classification === "rendered"
														? "good"
														: "danger"
												}
											/>
											<span>{route.issue.message}</span>
										</span>
										<span className="fp-devtools__path">
											{route.issue.path ?? "Pathless issue"}
										</span>
									</button>
								</li>
							))}
						</ul>
					)}
				</div>
			</div>
		</div>
	)
}

function NodeDetails({
	issues,
	row,
	snapshot,
	store,
}: Readonly<{
	issues: readonly FormIssue[]
	row: NodeRow
	snapshot: DevtoolsStoreSnapshot
	store: FormPleaseDevtoolsStore
}>) {
	const path = nodePath(row.node)
	const ownVisible = row.parent.visible
		? String(row.node.visible)
		: "not evaluated"
	const ownDisabled = row.parent.disabled
		? "not evaluated"
		: String(row.node.disabled)
	const ownReadOnly = row.parent.readOnly
		? "not evaluated"
		: String(row.node.readOnly)
	const nodeIssues =
		path === undefined ? [] : issues.filter((issue) => issue.path === path)
	const changed =
		snapshot.resolution?.changedNodeIds.includes(row.node.id) === true
	return (
		<>
			<div className="fp-devtools__section">
				<div className="fp-devtools__row-line">
					<span className="fp-devtools__kind">{row.node.kind}</span>
					<h3>{nodeTitle(row.node)}</h3>
					{changed ? <Pill label="changed" tone="good" /> : null}
				</div>
				<div className="fp-devtools__toolbar">
					{path === undefined ? null : (
						<button
							className="fp-devtools__button"
							onClick={() => void copyText(path)}
							type="button"
						>
							Copy RHF path
						</button>
					)}
					{row.node.visible ? (
						<button
							className="fp-devtools__button"
							onClick={() => highlightNode(store, row.node)}
							type="button"
						>
							Highlight
						</button>
					) : null}
				</div>
				<dl className="fp-devtools__grid">
					<dt>ID</dt>
					<dd className="fp-devtools__path">{row.node.id}</dd>
					<dt>Path</dt>
					<dd className="fp-devtools__path">{path ?? "—"}</dd>
					<dt>Visible</dt>
					<dd>
						{String(row.node.visible)} · own {ownVisible} · inherited{" "}
						{String(!row.parent.visible)}
					</dd>
					<dt>Disabled</dt>
					<dd>
						{String(row.node.disabled)} · own {ownDisabled} · inherited{" "}
						{String(row.parent.disabled)}
					</dd>
					<dt>Read-only</dt>
					<dd>
						{String(row.node.readOnly)} · own {ownReadOnly} · inherited{" "}
						{String(row.parent.readOnly)}
					</dd>
					{"required" in row.node ? (
						<>
							<dt>Required</dt>
							<dd>{String(row.node.required)}</dd>
						</>
					) : null}
					{"control" in row.node ? (
						<>
							<dt>Control</dt>
							<dd>{String(row.node.control)}</dd>
						</>
					) : null}
					{"columns" in row.node ? (
						<>
							<dt>Columns</dt>
							<dd>{String(row.node.columns)}</dd>
						</>
					) : null}
					<dt>Span</dt>
					<dd>{row.node.span === undefined ? "—" : String(row.node.span)}</dd>
					<dt>Last cause</dt>
					<dd>
						{snapshot.resolution?.causeId === undefined
							? "—"
							: `Update #${snapshot.resolution.causeId}`}
					</dd>
				</dl>
			</div>
			{nodeIssues.length === 0 ? null : (
				<div className="fp-devtools__section">
					<h3>Issues</h3>
					{nodeIssues.map((issue) => (
						<p className="fp-devtools__danger" key={objectKey(issue)}>
							{issue.message}
						</p>
					))}
				</div>
			)}
		</>
	)
}

function UpdatesView({
	snapshot,
	store,
}: Readonly<{
	snapshot: DevtoolsStoreSnapshot
	store: FormPleaseDevtoolsStore
}>) {
	const [query, setQuery] = useState("")
	const [selectedId, setSelectedId] = useState<number>()
	const normalizedQuery = query.trim().toLocaleLowerCase()
	const updates = [...snapshot.updates]
		.reverse()
		.filter((update) =>
			normalizedQuery.length === 0
				? true
				: updateSearchText(update).includes(normalizedQuery),
		)
	const selected =
		snapshot.updates.find((update) => update.id === selectedId) ?? updates[0]
	return (
		<div className="fp-devtools__split">
			<div className="fp-devtools__pane">
				<div className="fp-devtools__toolbar">
					<input
						aria-label="Search updates"
						className="fp-devtools__search"
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Search source or path"
						value={query}
					/>
					<button
						className="fp-devtools__button"
						onClick={() => store.clearUpdates()}
						type="button"
					>
						Clear
					</button>
				</div>
				{updates.length === 0 ? (
					<div className="fp-devtools__empty">No recorded value updates.</div>
				) : (
					<ul className="fp-devtools__list">
						{updates.map((update) => (
							<li key={update.id}>
								<button
									className="fp-devtools__row"
									data-selected={selected?.id === update.id}
									onClick={() => setSelectedId(update.id)}
									type="button"
								>
									<span className="fp-devtools__row-line">
										<strong>#{update.id}</strong>
										<Pill
											label={update.kind}
											tone={update.kind === "raw" ? "danger" : "good"}
										/>
										<span>{updateSource(update)}</span>
										<Pill
											label={update.status}
											tone={updateStatusTone(update.status)}
										/>
									</span>
									<span className="fp-devtools__path">
										{update.paths.join(", ") || "Whole form"}
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
			<div className="fp-devtools__pane">
				{selected === undefined ? (
					<div className="fp-devtools__empty">Select an update.</div>
				) : (
					<UpdateDetails store={store} update={selected} />
				)}
			</div>
		</div>
	)
}

function UpdateDetails({
	store,
	update,
}: Readonly<{ store: FormPleaseDevtoolsStore; update: DevtoolsUpdateEvent }>) {
	return (
		<>
			<div className="fp-devtools__section">
				<div className="fp-devtools__row-line">
					<h3>Update #{update.id}</h3>
					<Pill label={update.status} tone={updateStatusTone(update.status)} />
				</div>
				<dl className="fp-devtools__grid">
					<dt>Source</dt>
					<dd>{updateSource(update)}</dd>
					<dt>Paths</dt>
					<dd className="fp-devtools__path">
						{update.paths.join(", ") || "Whole form"}
					</dd>
					<dt>Duration</dt>
					<dd>{formatDuration(update.duration)}</dd>
					<dt>Async work</dt>
					<dd>{update.asyncOutcome ?? "—"}</dd>
				</dl>
				<div className="fp-devtools__toolbar">
					{update.paths[0] === undefined ? null : (
						<button
							className="fp-devtools__button"
							onClick={() => highlightPath(store, update.paths[0] ?? "")}
							type="button"
						>
							Highlight first path
						</button>
					)}
				</div>
			</div>
			<div className="fp-devtools__section">
				<h3>Pipeline</h3>
				{update.stages.map((stage) => (
					<div
						className="fp-devtools__stage"
						data-status={stage.status}
						key={objectKey(stage)}
					>
						<strong>{stage.label}</strong>{" "}
						<span className="fp-devtools__muted">{stage.status}</span>
						{stage.input === undefined ? null : (
							<ValueBlock label="Input" value={stage.input} />
						)}
						{stage.output === undefined ? null : (
							<ValueBlock label="Output" value={stage.output} />
						)}
						{stage.result === undefined ? null : (
							<ValueBlock label="Result" value={stage.result} />
						)}
						{stage.error === undefined ? null : (
							<ValueBlock label="Error" value={stage.error} />
						)}
					</div>
				))}
			</div>
			{update.patches === undefined ? null : (
				<ValueBlock label="Final patches" value={update.patches} />
			)}
			{update.previousValues === undefined ? null : (
				<ValueBlock label="Previous values" value={update.previousValues} />
			)}
			{update.nextValues === undefined ? null : (
				<ValueBlock label="Next values" value={update.nextValues} />
			)}
			{update.error === undefined ? null : (
				<ValueBlock label="Failure" value={update.error} />
			)}
		</>
	)
}

function OptionsView({
	snapshot,
}: Readonly<{ snapshot: DevtoolsStoreSnapshot }>) {
	const [selectedPath, setSelectedPath] = useState<string>()
	const fields = (snapshot.resolved?.nodes ?? []).filter(
		(node): node is ResolvedFieldNode =>
			node.kind === "field" && node.options !== undefined,
	)
	const states = new Map(snapshot.options.map((state) => [state.path, state]))
	const selected =
		fields.find((field) => field.path === selectedPath) ?? fields[0]
	const selectedState =
		selected === undefined ? undefined : states.get(selected.path)
	return (
		<div className="fp-devtools__split">
			<div className="fp-devtools__pane">
				{fields.length === 0 ? (
					<div className="fp-devtools__empty">
						No selectable fields are resolved.
					</div>
				) : (
					<ul className="fp-devtools__list">
						{fields.map((field) => {
							const state = states.get(field.path)
							const status = Array.isArray(field.options)
								? "static"
								: (state?.current.status ??
									(field.visible ? "idle" : "not mounted"))
							return (
								<li key={field.id}>
									<button
										className="fp-devtools__row"
										data-selected={selected?.path === field.path}
										onClick={() => setSelectedPath(field.path)}
										type="button"
									>
										<span className="fp-devtools__row-line">
											<strong>{nodeTitle(field)}</strong>
											<Pill label={status} tone={optionStatusTone(status)} />
										</span>
										<span className="fp-devtools__path">{field.path}</span>
									</button>
								</li>
							)
						})}
					</ul>
				)}
			</div>
			<div className="fp-devtools__pane">
				{selected === undefined ? (
					<div className="fp-devtools__empty">Select an options resolver.</div>
				) : (
					<OptionDetails field={selected} state={selectedState} />
				)}
			</div>
		</div>
	)
}

function OptionDetails({
	field,
	state,
}: Readonly<{ field: ResolvedFieldNode; state?: DevtoolsOptionsState }>) {
	if (Array.isArray(field.options))
		return (
			<>
				<div className="fp-devtools__section">
					<h3>{field.path}</h3>
					<p>Static options · {field.options.length} items</p>
				</div>
				<ValueBlock label="Options" value={field.options} />
			</>
		)
	const current = state?.current
	return (
		<>
			<div className="fp-devtools__section">
				<h3>{field.path}</h3>
				<dl className="fp-devtools__grid">
					<dt>Status</dt>
					<dd>{current?.status ?? (field.visible ? "idle" : "not mounted")}</dd>
					<dt>Duration</dt>
					<dd>{formatDuration(current?.duration)}</dd>
					<dt>Option count</dt>
					<dd>{current?.optionCount ?? "—"}</dd>
					<dt>Visible</dt>
					<dd>{String(field.visible)}</dd>
				</dl>
			</div>
			{current === undefined ? null : (
				<OptionsRequestDetails label="Current request" request={current} />
			)}
			{state?.previous === undefined ? null : (
				<OptionsRequestDetails
					label="Previous request"
					request={state.previous}
				/>
			)}
		</>
	)
}

function OptionsRequestDetails({
	label,
	request,
}: Readonly<{ label: string; request: DevtoolsOptionsRequest }>) {
	return (
		<div className="fp-devtools__section">
			<h3>{label}</h3>
			{request.dependencies.length === 0 ? (
				<p className="fp-devtools__muted">No dependency reads were recorded.</p>
			) : (
				<ul className="fp-devtools__list">
					{request.dependencies.map((dependency) => (
						<li className="fp-devtools__path" key={objectKey(dependency)}>
							{dependency.root}.
							{dependency.path.map(String).join(".") || "(root)"}
						</li>
					))}
				</ul>
			)}
			{request.error === undefined ? null : (
				<ValueBlock label="Error" value={request.error} />
			)}
		</div>
	)
}

function FeaturesView({
	features,
}: Readonly<{ features: readonly DevtoolsFeatureState[] }>) {
	return (
		<div className="fp-devtools__pane">
			{(["history", "persistence"] as const).map((kind) => {
				const feature = features.find((candidate) => candidate.kind === kind)
				return (
					<section className="fp-devtools__feature" key={kind}>
						<div className="fp-devtools__row-line">
							<h3>{kind === "history" ? "Managed history" : "Persistence"}</h3>
							<Pill
								label={feature === undefined ? "not configured" : "configured"}
								tone={feature === undefined ? undefined : "good"}
							/>
						</div>
						{feature === undefined ? (
							<p className="fp-devtools__muted">
								This form does not configure the {kind} feature.
							</p>
						) : (
							<>
								<ValueBlock label="Current snapshot" value={feature.snapshot} />
								<ValueBlock label="Details" value={feature.details} />
								<div className="fp-devtools__section">
									<h3>Recent transitions</h3>
									{feature.transitions.map((transition) => (
										<div
											className="fp-devtools__stage"
											key={objectKey(transition)}
										>
											<span>
												{transition.causeId === undefined
													? "Feature lifecycle"
													: `Update #${transition.causeId}`}
											</span>
											<ValuePreview value={transition.snapshot} />
										</div>
									))}
								</div>
							</>
						)}
					</section>
				)
			})}
		</div>
	)
}

function ValueBlock({
	label,
	value,
}: Readonly<{ label: string; value: unknown }>) {
	return (
		<div className="fp-devtools__section">
			<h3>{label}</h3>
			<ValuePreview value={value} />
		</div>
	)
}

function ValuePreview({ value }: Readonly<{ value: unknown }>) {
	let content: ReactNode
	try {
		content = renderValue(value, 0, new WeakSet())
	} catch (error) {
		content = `[Unable to inspect: ${inspectionError(error)}]`
	}
	return <div className="fp-devtools__value">{content}</div>
}

function renderValue(
	value: unknown,
	depth: number,
	ancestors: WeakSet<object>,
): ReactNode {
	if (value === null) return "null"
	if (value === undefined) return "undefined"
	if (typeof value === "string") return JSON.stringify(value)
	if (
		typeof value === "number" ||
		typeof value === "boolean" ||
		typeof value === "bigint"
	)
		return String(value)
	if (typeof value === "symbol") return String(value)
	if (typeof value === "function")
		return `[Function ${value.name || "anonymous"}]`
	if (value instanceof Error)
		return `${value.name}: ${value.message}${value.stack === undefined ? "" : `\n${value.stack}`}`
	if (value instanceof Date) return value.toISOString()
	if (value instanceof RegExp) return String(value)
	if (typeof Blob !== "undefined" && value instanceof Blob)
		return `[Blob ${value.type || "unknown"}, ${value.size} bytes]`
	if (typeof value !== "object") return String(value)
	if (ancestors.has(value)) return "[Circular]"
	if (depth >= 5) return `[${value.constructor?.name ?? "Object"}]`
	ancestors.add(value)
	try {
		const entries = valueEntries(value).slice(0, 50)
		const label = valueLabel(value)
		return (
			<details open={depth < 1}>
				<summary>{label}</summary>
				{entries.map(([key, item]) => (
					<details key={key}>
						<summary>{key}</summary>
						{renderValue(item, depth + 1, ancestors)}
					</details>
				))}
			</details>
		)
	} finally {
		ancestors.delete(value)
	}
}

function valueEntries(value: object): [string, unknown][] {
	if (value instanceof Map)
		return [...value.entries()].map(([key, item], index) => [
			`${index}: ${previewKey(key)}`,
			item,
		])
	if (value instanceof Set)
		return [...value].map((item, index) => [String(index), item])
	return Reflect.ownKeys(value).map((key) => {
		try {
			return [String(key), Reflect.get(value, key)]
		} catch (error) {
			return [String(key), error]
		}
	})
}

function previewKey(value: unknown): string {
	if (typeof value === "string" || typeof value === "number")
		return String(value)
	return Object.prototype.toString.call(value)
}

function flattenResolved(
	resolved: ResolvedDefinition | undefined,
	root: NodeRow["parent"],
): NodeRow[] {
	if (resolved === undefined) return []
	const rows: NodeRow[] = []
	const visit = (
		nodes: readonly ResolvedNode[],
		depth: number,
		parent: NodeRow["parent"],
	) => {
		for (const node of nodes) {
			rows.push({ depth, node, parent })
			const nextParent = {
				disabled: node.disabled,
				readOnly: node.readOnly,
				visible: node.visible,
			}
			if (node.kind === "section") visit(node.children, depth + 1, nextParent)
			if (node.kind === "array")
				for (const children of node.itemChildren)
					visit(children, depth + 1, nextParent)
		}
	}
	visit(resolved.ui, 0, root)
	return rows
}

function routeIssue(issue: FormIssue, rows: readonly NodeRow[]) {
	if (issue.path === undefined)
		return { classification: "pathless", issue } as const
	const row = rows.find(({ node }) => nodePath(node) === issue.path)
	if (row === undefined)
		return { classification: "application-owned", issue } as const
	if (!row.node.visible)
		return { classification: "hidden", issue, node: row.node } as const
	if (row.node.disabled)
		return { classification: "disabled", issue, node: row.node } as const
	return { classification: "rendered", issue, node: row.node } as const
}

function nodePath(node: ResolvedNode): string | undefined {
	return "path" in node && typeof node.path === "string" ? node.path : undefined
}

function nodeTitle(node: ResolvedNode): string {
	if (node.kind === "field" || node.kind === "array")
		return typeof node.label === "string" ? node.label : node.path
	if (node.kind === "section")
		return typeof node.title === "string" ? node.title : node.id
	return node.id
}

function nodeSearchText(node: ResolvedNode): string {
	return `${node.id} ${node.kind} ${nodePath(node) ?? ""} ${nodeTitle(node)}`.toLocaleLowerCase()
}

function updateSearchText(update: DevtoolsUpdateEvent): string {
	return `${update.id} ${update.kind} ${update.status} ${updateSource(update)} ${update.paths.join(" ")}`.toLocaleLowerCase()
}

function updateSource(update: DevtoolsUpdateEvent): string {
	if (update.kind === "raw")
		return update.name === undefined
			? "Direct RHF update"
			: `Direct RHF update · ${update.name}`
	if (
		update.source === null ||
		typeof update.source !== "object" ||
		!("type" in update.source)
	)
		return "Managed update"
	const source = update.source as Record<string, unknown>
	const details = [source.type, source.action, source.path]
		.filter((part) => part !== undefined)
		.join(" · ")
	return details || "Managed update"
}

function highlightNode(
	store: FormPleaseDevtoolsStore,
	node: ResolvedNode,
): void {
	const path = nodePath(node)
	const input =
		path === undefined ? undefined : store.getRuntime().inputRefs.get(path)
	highlightElement(input ?? findStructuralElement(store, node.id, path))
}

function highlightPath(store: FormPleaseDevtoolsStore, path: string): void {
	highlightElement(
		store.getRuntime().inputRefs.get(path) ??
			findStructuralElement(store, undefined, path),
	)
}

function findStructuralElement(
	store: FormPleaseDevtoolsStore,
	id?: string,
	path?: string,
): HTMLElement | undefined {
	const form = store.getRuntime().formElement
	if (form === null) return undefined
	const elements: HTMLElement[] = [
		form,
		...form.querySelectorAll<HTMLElement>("[data-fp-node]"),
	]
	return elements.find(
		(element) =>
			(id !== undefined && element.id === id) ||
			(path !== undefined && element.dataset.fpPath === path),
	)
}

function highlightElement(element: HTMLElement | undefined): void {
	if (element === undefined) return
	element.scrollIntoView({ behavior: "smooth", block: "center" })
	element.setAttribute("data-fp-devtools-highlight", "true")
	window.setTimeout(
		() => element.removeAttribute("data-fp-devtools-highlight"),
		1400,
	)
}

async function copyText(value: string): Promise<void> {
	try {
		await navigator.clipboard?.writeText(value)
	} catch {
		// Clipboard access is optional in local development contexts.
	}
}

function Pill({
	label,
	tone,
}: Readonly<{ label: string; tone?: "danger" | "good" }>) {
	return (
		<span
			className="fp-devtools__pill"
			{...(tone === undefined ? {} : { "data-tone": tone })}
		>
			{label}
		</span>
	)
}

function tabLabel(tab: TabName): string {
	const labels: Record<TabName, string> = {
		features: "Features",
		options: "Options",
		ui: "UI",
		updates: "Updates",
	}
	return labels[tab]
}

function renderTab(
	tab: TabName,
	issues: readonly FormIssue[],
	snapshot: DevtoolsStoreSnapshot,
	store: FormPleaseDevtoolsStore,
): ReactNode {
	switch (tab) {
		case "ui":
			return <UiView issues={issues} snapshot={snapshot} store={store} />
		case "updates":
			return <UpdatesView snapshot={snapshot} store={store} />
		case "options":
			return <OptionsView snapshot={snapshot} />
		case "features":
			return <FeaturesView features={snapshot.features} />
	}
}

function updateStatusTone(
	status: DevtoolsUpdateEvent["status"],
): "danger" | "good" | undefined {
	if (status === "committed") return "good"
	if (status === "running") return undefined
	return "danger"
}

function optionStatusTone(status: string): "danger" | "good" | undefined {
	if (status === "rejected") return "danger"
	if (status === "fulfilled" || status === "static") return "good"
	return undefined
}

function valueLabel(value: object): string {
	if (Array.isArray(value)) return `Array(${value.length})`
	if (value instanceof Map) return `Map(${value.size})`
	if (value instanceof Set) return `Set(${value.size})`
	return value.constructor?.name ?? "Object"
}

function objectKey(object: object): number {
	const existing = objectKeys.get(object)
	if (existing !== undefined) return existing
	const key = ++objectKeySequence
	objectKeys.set(object, key)
	return key
}

function formatDuration(duration: number | undefined): string {
	if (duration === undefined) return "—"
	return duration < 1
		? `${duration.toFixed(2)} ms`
		: `${duration.toFixed(1)} ms`
}

function formatFocus(focus: DevtoolsStoreSnapshot["lastFocus"]): string {
	if (focus === undefined) return "not recorded"
	if (focus.target === "field") return focus.path ?? "generated field"
	if (focus.target === "summary") return "error summary"
	return "no available target"
}

function inspectionError(error: unknown): string {
	try {
		return error instanceof Error
			? `${error.name}: ${error.message}`
			: String(error)
	} catch {
		return "unknown inspection error"
	}
}

function generatedFormName(target: object): string {
	const existing = generatedNames.get(target)
	if (existing !== undefined) return existing
	const name = `Form ${++generatedNameSequence}`
	generatedNames.set(target, name)
	return name
}

function resizeWithKeyboard(
	event: KeyboardEvent<HTMLButtonElement>,
	height: number | undefined,
	setHeight: (height: number) => void,
): void {
	if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return
	event.preventDefault()
	const current = height ?? Math.round(window.innerHeight * 0.44)
	setHeight(clampDrawerHeight(current + (event.key === "ArrowUp" ? 24 : -24)))
}

function clampDrawerHeight(height: number): number {
	return Math.min(Math.max(height, 280), Math.round(window.innerHeight * 0.85))
}
