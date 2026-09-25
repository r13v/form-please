"use client"

import {
	defaultKeymap,
	history,
	historyKeymap,
	indentWithTab,
} from "@codemirror/commands"
import { javascript } from "@codemirror/lang-javascript"
import {
	bracketMatching,
	HighlightStyle,
	indentOnInput,
	syntaxHighlighting,
} from "@codemirror/language"
import {
	type Diagnostic,
	lintGutter,
	setDiagnostics as setEditorDiagnostics,
} from "@codemirror/lint"
import { EditorState } from "@codemirror/state"
import {
	drawSelection,
	EditorView,
	highlightActiveLine,
	hoverTooltip,
	keymap,
	lineNumbers,
} from "@codemirror/view"
import { tags } from "@lezer/highlight"
import {
	Component,
	type ComponentType,
	type ErrorInfo,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import {
	availableModules,
	type CompiledPlayground,
	compilePlayground,
} from "#lib/playground-runtime"
import {
	findScenario,
	type ScenarioId,
	scenarios,
} from "#lib/playground-scenarios"
import { TypecheckClient } from "#lib/playground-typecheck"
import type { PlaygroundDiagnostic } from "#lib/playground-typecheck-protocol"

type TypecheckStatus = "starting" | "on" | "failed"

const highlight = HighlightStyle.define([
	{ tag: tags.keyword, color: "var(--fp-editor-keyword)" },
	{
		tag: [tags.string, tags.special(tags.string)],
		color: "var(--fp-editor-string)",
	},
	{ tag: tags.comment, color: "var(--fp-editor-comment)", fontStyle: "italic" },
	{ tag: [tags.typeName, tags.className], color: "var(--fp-editor-type)" },
	{
		tag: [tags.propertyName, tags.attributeName],
		color: "var(--fp-editor-property)",
	},
	{
		tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
		color: "var(--fp-editor-function)",
	},
	{
		tag: [tags.number, tags.bool, tags.null],
		color: "var(--fp-editor-number)",
	},
	{ tag: [tags.tagName, tags.angleBracket], color: "var(--fp-editor-tag)" },
])

const editorTheme = EditorView.theme({
	"&": {
		backgroundColor: "var(--fp-docs-surface)",
		color: "var(--fp-docs-ink)",
		fontSize: "0.85rem",
		height: "100%",
	},
	".cm-content": {
		fontFamily: "var(--vocs-fontFamily_mono, ui-monospace, monospace)",
	},
	".cm-gutters": {
		backgroundColor: "var(--fp-docs-panel)",
		borderRight: "1px solid var(--fp-docs-border)",
		color: "var(--fp-docs-muted)",
	},
	".cm-activeLine": {
		backgroundColor:
			"color-mix(in srgb, var(--fp-docs-accent) 8%, transparent)",
	},
	".cm-activeLineGutter": {
		backgroundColor:
			"color-mix(in srgb, var(--fp-docs-accent) 12%, transparent)",
	},
	"&.cm-focused": { outline: "none" },
	".cm-tooltip": {
		backgroundColor: "var(--fp-docs-surface)",
		border: "1px solid var(--fp-docs-border)",
		borderRadius: "0.5rem",
		color: "var(--fp-docs-ink)",
	},
	".cm-tooltip .form-please-editor__hover": {
		fontFamily: "var(--vocs-fontFamily_mono, ui-monospace, monospace)",
		fontSize: "0.8rem",
		maxWidth: "36rem",
		padding: "0.5rem 0.65rem",
		whiteSpace: "pre-wrap",
	},
	".cm-diagnostic-error": { borderLeftColor: "var(--fp-docs-rust)" },
	".cm-lintRange-error": {
		backgroundImage: "none",
		textDecoration: "underline wavy var(--fp-docs-rust)",
		textUnderlineOffset: "0.2em",
	},
})

export function LivePlaygroundClient() {
	const editorHost = useRef<HTMLDivElement>(null)
	const viewRef = useRef<EditorView | null>(null)
	const clientRef = useRef<TypecheckClient | null>(null)
	const [scenarioId, setScenarioId] = useState<ScenarioId>("basic")
	const [source, setSource] = useState(() => findScenario("basic").source)
	const [compiled, setCompiled] = useState<CompiledPlayground | null>(null)
	const [runtimeError, setRuntimeError] = useState<string | null>(null)
	const [typecheck, setTypecheck] = useState<TypecheckStatus>("starting")
	const [diagnostics, setDiagnostics] = useState<
		readonly PlaygroundDiagnostic[] | null
	>(null)

	useEffect(() => {
		const host = editorHost.current
		if (host === null) return
		const requested = new URLSearchParams(window.location.search).get(
			"scenario",
		)
		const initial = findScenario(requested)
		let timer: ReturnType<typeof setTimeout> | undefined
		const view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: initial.source,
				extensions: [
					lineNumbers(),
					highlightActiveLine(),
					drawSelection(),
					history(),
					bracketMatching(),
					indentOnInput(),
					javascript({ jsx: true, typescript: true }),
					syntaxHighlighting(highlight),
					editorTheme,
					lintGutter(),
					hoverTooltip(async (_view, position) => {
						const client = clientRef.current
						if (client === null) return null
						const text = await client.quickInfo(position)
						if (text === null) return null
						return {
							pos: position,
							create() {
								const dom = document.createElement("div")
								dom.className = "form-please-editor__hover"
								dom.textContent = text
								return { dom }
							},
						}
					}),
					keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
					EditorView.updateListener.of((update) => {
						if (!update.docChanged) return
						clearTimeout(timer)
						timer = setTimeout(() => {
							setSource(update.state.doc.toString())
						}, 250)
					}),
				],
			}),
		})
		viewRef.current = view
		setScenarioId(initial.id)
		setSource(initial.source)
		const client = new TypecheckClient()
		clientRef.current = client
		client.ready.then(
			() => setTypecheck("on"),
			() => {
				client.terminate()
				clientRef.current = null
				setTypecheck("failed")
			},
		)
		return () => {
			clearTimeout(timer)
			view.destroy()
			viewRef.current = null
			clientRef.current?.terminate()
			clientRef.current = null
		}
	}, [])

	useEffect(() => {
		setRuntimeError(null)
		setCompiled(compilePlayground(source))
	}, [source])

	useEffect(() => {
		if (typecheck !== "on") return
		const client = clientRef.current
		const view = viewRef.current
		if (client === null || view === null) return
		let cancelled = false
		void client.check(source).then((items) => {
			if (cancelled) return
			setDiagnostics(items)
			if (view.state.doc.toString() !== source) return
			view.dispatch(
				setEditorDiagnostics(view.state, items.map(toEditorDiagnostic)),
			)
		})
		return () => {
			cancelled = true
		}
	}, [source, typecheck])

	function loadScenario(id: ScenarioId) {
		const view = viewRef.current
		if (view === null) return
		const next = findScenario(id)
		setScenarioId(next.id)
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: next.source },
		})
		setSource(next.source)
		const url = new URL(window.location.href)
		url.searchParams.set("scenario", next.id)
		window.history.replaceState(null, "", url)
	}

	function jumpTo(diagnostic: PlaygroundDiagnostic) {
		const view = viewRef.current
		if (view === null) return
		view.dispatch({
			selection: { anchor: diagnostic.from, head: diagnostic.to },
			scrollIntoView: true,
		})
		view.focus()
	}

	const scenario = findScenario(scenarioId)
	let errorCount: number | null = null
	if (diagnostics !== null) {
		errorCount = diagnostics.filter((item) => item.severity === "error").length
	}

	return (
		<section
			aria-label="Live playground"
			className="form-please-complex form-please-live"
			data-testid="live-playground"
		>
			<div className="form-please-live__toolbar">
				<label className="form-please-live__scenario">
					<span>Scenario</span>
					<select
						onChange={(event) => loadScenario(event.target.value as ScenarioId)}
						value={scenarioId}
					>
						{scenarios.map((item) => (
							<option key={item.id} value={item.id}>
								{item.title}
							</option>
						))}
					</select>
				</label>
				<TypecheckStatusLine status={typecheck} errorCount={errorCount} />
			</div>
			<p className="form-please-live__summary">{scenario.summary}</p>
			<div className="form-please-live__grid">
				<div className="form-please-live__editor-column">
					<div
						className="form-please-editor"
						data-testid="live-editor"
						ref={editorHost}
					/>
					{typecheck === "on" && diagnostics !== null && (
						<DiagnosticsList
							diagnostics={diagnostics}
							onSelect={jumpTo}
							source={source}
						/>
					)}
				</div>
				<div className="form-please-live__preview">
					<p className="form-please-lab__kicker">Rendered form</p>
					<PreviewSurface
						compiled={compiled}
						onRuntimeError={setRuntimeError}
						runtimeError={runtimeError}
						source={source}
					/>
					<p className="form-please-playground__try">
						<strong>Try this.</strong> {scenario.tryThis}
					</p>
					<p className="form-please-live__modules">
						Available imports: {availableModules.join(", ")}.
					</p>
				</div>
			</div>
		</section>
	)
}

function TypecheckStatusLine({
	errorCount,
	status,
}: {
	readonly errorCount: number | null
	readonly status: TypecheckStatus
}) {
	let text = "Loading the TypeScript compiler…"
	if (status === "failed") {
		text = "The type checker could not start in this browser."
	}
	if (status === "on") {
		text = "Type checking on · checking…"
		if (errorCount === 0) text = "Type checking on · no errors"
		if (errorCount === 1) text = "Type checking on · 1 error"
		if (errorCount !== null && errorCount > 1) {
			text = `Type checking on · ${errorCount} errors`
		}
	}
	return (
		<p
			className="form-please-live__typecheck"
			data-status={status}
			data-testid="typecheck-status"
		>
			<span aria-hidden="true">●</span> {text}
		</p>
	)
}

function DiagnosticsList({
	diagnostics,
	onSelect,
	source,
}: {
	readonly diagnostics: readonly PlaygroundDiagnostic[]
	readonly onSelect: (diagnostic: PlaygroundDiagnostic) => void
	readonly source: string
}) {
	if (diagnostics.length === 0) {
		return (
			<p
				className="form-please-live__diagnostics-empty"
				data-testid="diagnostics"
			>
				No type errors. Hover any identifier in the editor to see its inferred
				type.
			</p>
		)
	}
	return (
		<ul className="form-please-live__diagnostics" data-testid="diagnostics">
			{diagnostics.map((diagnostic) => {
				const line = source.slice(0, diagnostic.from).split("\n").length
				return (
					<li key={`${diagnostic.from}-${diagnostic.code}`}>
						<button onClick={() => onSelect(diagnostic)} type="button">
							<span className="form-please-live__diagnostic-line">
								Line {line}
							</span>
							<span>{diagnostic.message}</span>
						</button>
					</li>
				)
			})}
		</ul>
	)
}

function PreviewSurface({
	compiled,
	onRuntimeError,
	runtimeError,
	source,
}: {
	readonly compiled: CompiledPlayground | null
	readonly onRuntimeError: (message: string) => void
	readonly runtimeError: string | null
	readonly source: string
}) {
	const lastGood = useRef<ComponentType | null>(null)
	if (compiled?.ok === true) lastGood.current = compiled.Component
	const Current = lastGood.current
	let problem: string | null = null
	if (compiled?.ok === false) problem = compiled.error
	if (runtimeError !== null) problem = runtimeError

	return (
		<div className="form-please-playground__form" data-testid="live-preview">
			{problem !== null && (
				<pre className="form-please-live__problem" data-testid="live-problem">
					{problem}
				</pre>
			)}
			{problem !== null && Current !== null && (
				<p className="form-please-live__stale">
					The form below is the last version that compiled and ran.
				</p>
			)}
			{Current !== null && (
				<PreviewBoundary key={source} onError={onRuntimeError}>
					<Current />
				</PreviewBoundary>
			)}
		</div>
	)
}

class PreviewBoundary extends Component<
	{ readonly children: ReactNode; readonly onError: (message: string) => void },
	{ readonly failed: boolean }
> {
	state = { failed: false }

	static getDerivedStateFromError() {
		return { failed: true }
	}

	componentDidCatch(error: Error, _info: ErrorInfo) {
		this.props.onError(error.message)
	}

	render() {
		if (this.state.failed) return null
		return this.props.children
	}
}

function toEditorDiagnostic(diagnostic: PlaygroundDiagnostic): Diagnostic {
	return {
		from: diagnostic.from,
		message: diagnostic.message,
		severity: diagnostic.severity,
		to: diagnostic.to,
	}
}
