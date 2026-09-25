"use client"

import type * as Monaco from "monaco-editor"
import {
	Component,
	type ComponentType,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react"
import type { PlaygroundMarker } from "#lib/playground-monaco"
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

type TypecheckStatus = "starting" | "on" | "failed"

export function LivePlaygroundClient() {
	const editorHost = useRef<HTMLDivElement>(null)
	const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
	const [scenarioId, setScenarioId] = useState<ScenarioId>("basic")
	const sourcesRef = useRef<Readonly<Record<ScenarioId, string>> | null>(null)
	const [source, setSource] = useState<string | null>(null)
	const [compiled, setCompiled] = useState<CompiledPlayground | null>(null)
	const [runtimeError, setRuntimeError] = useState<string | null>(null)
	const [typecheck, setTypecheck] = useState<TypecheckStatus>("starting")
	const [markers, setMarkers] = useState<readonly PlaygroundMarker[] | null>(
		null,
	)

	useEffect(() => {
		const host = editorHost.current
		if (host === null) return
		const requested = new URLSearchParams(window.location.search).get(
			"scenario",
		)
		const initial = findScenario(requested)
		setScenarioId(initial.id)

		let disposed = false
		let timer: ReturnType<typeof setTimeout> | undefined
		const disposables: Monaco.IDisposable[] = []
		let observer: MutationObserver | undefined

		void Promise.all([
			import("#lib/playground-monaco"),
			import("#lib/playground-sources"),
		]).then(
			([
				{ collectErrors, currentThemeName, playgroundUri, setupMonaco },
				{ scenarioSources },
			]) => {
				if (disposed) return
				sourcesRef.current = scenarioSources
				const initialSource = scenarioSources[initial.id]
				setSource(initialSource)
				const monaco = setupMonaco()
				const model =
					monaco.editor.getModel(playgroundUri) ??
					monaco.editor.createModel(initialSource, "typescript", playgroundUri)
				model.setValue(initialSource)
				const editor = monaco.editor.create(host, {
					automaticLayout: true,
					fixedOverflowWidgets: true,
					fontFamily:
						"ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
					fontSize: 13,
					lineNumbersMinChars: 3,
					minimap: { enabled: false },
					model,
					padding: { top: 12 },
					renderLineHighlight: "line",
					scrollBeyondLastLine: false,
					tabSize: 2,
					theme: currentThemeName(),
				})
				editorRef.current = editor

				disposables.push(
					model.onDidChangeContent(() => {
						clearTimeout(timer)
						timer = setTimeout(() => setSource(model.getValue()), 250)
					}),
					monaco.editor.onDidChangeMarkers((uris) => {
						if (
							!uris.some((uri) => uri.toString() === playgroundUri.toString())
						) {
							return
						}
						setMarkers(
							monaco.editor
								.getModelMarkers({ resource: playgroundUri })
								.filter(
									(marker) => marker.severity === monaco.MarkerSeverity.Error,
								)
								.map((marker) => ({
									column: marker.startColumn,
									line: marker.startLineNumber,
									message: marker.message,
								})),
						)
					}),
				)

				observer = new MutationObserver(() => {
					monaco.editor.setTheme(currentThemeName())
				})
				observer.observe(document.documentElement, {
					attributeFilter: ["data-vocs-theme"],
				})

				collectErrors(model).then(
					(errors) => {
						if (disposed) return
						setMarkers((current) => current ?? errors)
						setTypecheck("on")
					},
					() => {
						if (!disposed) setTypecheck("failed")
					},
				)
			},
			() => setTypecheck("failed"),
		)

		return () => {
			disposed = true
			clearTimeout(timer)
			observer?.disconnect()
			for (const disposable of disposables) disposable.dispose()
			editorRef.current?.dispose()
			editorRef.current = null
		}
	}, [])

	useEffect(() => {
		if (source === null) return
		setRuntimeError(null)
		setCompiled(compilePlayground(source))
	}, [source])

	function loadScenario(id: ScenarioId) {
		const next = findScenario(id)
		const nextSource = sourcesRef.current?.[next.id]
		if (nextSource === undefined) return
		setScenarioId(next.id)
		editorRef.current?.getModel()?.setValue(nextSource)
		setSource(nextSource)
		const url = new URL(window.location.href)
		url.searchParams.set("scenario", next.id)
		window.history.replaceState(null, "", url)
	}

	function jumpTo(marker: PlaygroundMarker) {
		const editor = editorRef.current
		if (editor === null) return
		editor.setPosition({ column: marker.column, lineNumber: marker.line })
		editor.revealLineInCenter(marker.line)
		editor.focus()
	}

	const scenario = findScenario(scenarioId)
	let errorCount: number | null = null
	if (markers !== null) errorCount = markers.length

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
					{typecheck === "on" && markers !== null && (
						<DiagnosticsList markers={markers} onSelect={jumpTo} />
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
	let text = "Loading the TypeScript language service…"
	if (status === "failed") {
		text = "The language service could not start in this browser."
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
	markers,
	onSelect,
}: {
	readonly markers: readonly PlaygroundMarker[]
	readonly onSelect: (marker: PlaygroundMarker) => void
}) {
	if (markers.length === 0) {
		return (
			<p
				className="form-please-live__diagnostics-empty"
				data-testid="diagnostics"
			>
				No type errors. Hover an identifier for its type, press Ctrl+Space for
				completions, or type an opening parenthesis for signature help.
			</p>
		)
	}
	return (
		<ul className="form-please-live__diagnostics" data-testid="diagnostics">
			{markers.map((marker) => (
				<li key={`${marker.line}:${marker.column}:${marker.message}`}>
					<button onClick={() => onSelect(marker)} type="button">
						<span className="form-please-live__diagnostic-line">
							Line {marker.line}
						</span>
						<span>{marker.message}</span>
					</button>
				</li>
			))}
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
	readonly source: string | null
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

	componentDidCatch(error: Error) {
		this.props.onError(error.message)
	}

	render() {
		if (this.state.failed) return null
		return this.props.children
	}
}
