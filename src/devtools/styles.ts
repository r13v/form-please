/** Namespaced styles injected only while Form Please Devtools is mounted. */
export const devtoolsStyles = `
.fp-devtools,
.fp-devtools * { box-sizing: border-box; }
.fp-devtools {
  --fpd-bg: #f7f3e8;
  --fpd-panel: #fffdf7;
  --fpd-panel-strong: #ffffff;
  --fpd-text: #183c32;
  --fpd-muted: #65756f;
  --fpd-border: #d7d7c8;
  --fpd-accent: #1f6a55;
  --fpd-accent-soft: #dcece5;
  --fpd-danger: #a4472f;
  --fpd-danger-soft: #f6dfd7;
  --fpd-shadow: 0 -18px 60px rgb(20 45 37 / 18%);
  color: var(--fpd-text);
  font: 13px/1.45 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.fp-devtools button,
.fp-devtools input { font: inherit; }
.fp-devtools__launcher {
  align-items: center;
  background: var(--fpd-accent);
  border: 1px solid rgb(255 255 255 / 30%);
  border-radius: 999px;
  bottom: 18px;
  box-shadow: 0 8px 30px rgb(20 45 37 / 28%);
  color: #fff;
  cursor: pointer;
  display: flex;
  gap: 8px;
  min-height: 42px;
  padding: 9px 13px 9px 10px;
  position: fixed;
  right: 18px;
  z-index: 2147483000;
}
.fp-devtools__launcher:hover { background: #174f40; }
.fp-devtools__mark {
  align-items: center;
  background: #f7f3e8;
  border-radius: 50%;
  color: var(--fpd-accent);
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  height: 24px;
  justify-content: center;
  letter-spacing: -.04em;
  width: 24px;
}
.fp-devtools__badge {
  align-items: center;
  background: var(--fpd-danger);
  border: 2px solid var(--fpd-accent);
  border-radius: 999px;
  color: #fff;
  display: inline-flex;
  font-size: 10px;
  font-weight: 700;
  height: 19px;
  justify-content: center;
  min-width: 19px;
  padding: 0 4px;
  position: absolute;
  right: -5px;
  top: -5px;
}
.fp-devtools__drawer {
  background: var(--fpd-bg);
  border: 1px solid var(--fpd-border);
  border-radius: 14px 14px 0 0;
  bottom: 0;
  box-shadow: var(--fpd-shadow);
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  height: var(--fpd-height, 44vh);
  left: 0;
  min-height: 280px;
  overflow: hidden;
  position: fixed;
  right: 0;
  z-index: 2147483001;
}
.fp-devtools__resize {
  background: transparent;
  border: 0;
  cursor: ns-resize;
  height: 9px;
  left: 0;
  padding: 0;
  position: absolute;
  right: 0;
  top: 0;
  width: 100%;
}
.fp-devtools__resize::after {
  background: var(--fpd-border);
  border-radius: 99px;
  content: "";
  display: block;
  height: 3px;
  margin: 3px auto;
  width: 46px;
}
.fp-devtools__header {
  align-items: center;
  border-bottom: 1px solid var(--fpd-border);
  display: flex;
  gap: 12px;
  min-height: 54px;
  padding: 11px 14px 9px;
}
.fp-devtools__identity { min-width: 150px; }
.fp-devtools__eyebrow {
  color: var(--fpd-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .11em;
  text-transform: uppercase;
}
.fp-devtools__title { font-size: 15px; font-weight: 750; }
.fp-devtools__stats {
  color: var(--fpd-muted);
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 5px 12px;
}
.fp-devtools__actions { display: flex; gap: 7px; margin-left: auto; }
.fp-devtools__button,
.fp-devtools__icon-button,
.fp-devtools__tab {
  background: var(--fpd-panel);
  border: 1px solid var(--fpd-border);
  border-radius: 8px;
  color: var(--fpd-text);
  cursor: pointer;
  min-height: 30px;
  padding: 5px 9px;
}
.fp-devtools__button:hover,
.fp-devtools__icon-button:hover,
.fp-devtools__tab:hover { border-color: var(--fpd-accent); }
.fp-devtools__button[data-active="true"] {
  background: var(--fpd-accent-soft);
  border-color: var(--fpd-accent);
}
.fp-devtools__icon-button { font-size: 18px; line-height: 1; min-width: 32px; }
.fp-devtools__tabs {
  align-items: end;
  background: var(--fpd-panel);
  border-bottom: 1px solid var(--fpd-border);
  display: flex;
  gap: 3px;
  overflow-x: auto;
  padding: 7px 12px 0;
}
.fp-devtools__tab {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  min-width: 84px;
}
.fp-devtools__tab[aria-selected="true"] {
  background: var(--fpd-bg);
  border-bottom-color: var(--fpd-bg);
  color: var(--fpd-accent);
  font-weight: 700;
  margin-bottom: -1px;
}
.fp-devtools__body { min-height: 0; overflow: hidden; }
.fp-devtools__split {
  display: grid;
  grid-template-columns: minmax(280px, 38%) minmax(0, 1fr);
  height: 100%;
  min-height: 0;
}
.fp-devtools__pane { min-height: 0; overflow: auto; padding: 12px; }
.fp-devtools__pane + .fp-devtools__pane { border-left: 1px solid var(--fpd-border); }
.fp-devtools__toolbar { display: flex; gap: 7px; margin-bottom: 10px; }
.fp-devtools__search {
  background: var(--fpd-panel-strong);
  border: 1px solid var(--fpd-border);
  border-radius: 8px;
  color: var(--fpd-text);
  min-height: 32px;
  padding: 5px 9px;
  width: 100%;
}
.fp-devtools__search:focus { border-color: var(--fpd-accent); outline: 2px solid var(--fpd-accent-soft); }
.fp-devtools__list,
.fp-devtools__tree { list-style: none; margin: 0; padding: 0; }
.fp-devtools__row,
.fp-devtools__node {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 2px;
  margin: 2px 0;
  padding: 7px 8px;
  text-align: left;
  width: 100%;
}
.fp-devtools__row:hover,
.fp-devtools__node:hover { background: var(--fpd-panel); border-color: var(--fpd-border); }
.fp-devtools__row[data-selected="true"],
.fp-devtools__node[data-selected="true"] { background: var(--fpd-accent-soft); border-color: var(--fpd-accent); }
.fp-devtools__node-line,
.fp-devtools__row-line { align-items: center; display: flex; gap: 7px; min-width: 0; }
.fp-devtools__path {
  color: var(--fpd-muted);
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fp-devtools__kind,
.fp-devtools__pill {
  background: var(--fpd-panel);
  border: 1px solid var(--fpd-border);
  border-radius: 999px;
  color: var(--fpd-muted);
  font-size: 10px;
  line-height: 18px;
  padding: 0 6px;
  white-space: nowrap;
}
.fp-devtools__pill[data-tone="danger"] { background: var(--fpd-danger-soft); border-color: #dfaa98; color: var(--fpd-danger); }
.fp-devtools__pill[data-tone="good"] { background: var(--fpd-accent-soft); border-color: #9cc6b6; color: var(--fpd-accent); }
.fp-devtools__muted { color: var(--fpd-muted); }
.fp-devtools__danger { color: var(--fpd-danger); }
.fp-devtools__group-label {
  color: var(--fpd-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .08em;
  margin: 8px 0 3px;
  text-transform: uppercase;
}
.fp-devtools__section { margin-bottom: 16px; }
.fp-devtools__section h3 { font-size: 12px; margin: 0 0 7px; }
.fp-devtools__grid {
  display: grid;
  gap: 1px;
  grid-template-columns: minmax(110px, auto) minmax(0, 1fr);
}
.fp-devtools__grid > * { border-bottom: 1px solid var(--fpd-border); padding: 6px 4px; }
.fp-devtools__grid dt { color: var(--fpd-muted); }
.fp-devtools__grid dd { margin: 0; min-width: 0; }
.fp-devtools__empty {
  align-items: center;
  color: var(--fpd-muted);
  display: flex;
  height: 100%;
  justify-content: center;
  min-height: 120px;
  padding: 24px;
  text-align: center;
}
.fp-devtools__value {
  background: var(--fpd-panel);
  border: 1px solid var(--fpd-border);
  border-radius: 8px;
  font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  max-width: 100%;
  overflow: auto;
  padding: 8px;
  white-space: pre-wrap;
  word-break: break-word;
}
.fp-devtools__value details { margin-left: 10px; }
.fp-devtools__value summary { cursor: pointer; }
.fp-devtools__stage {
  border-left: 2px solid var(--fpd-border);
  margin-left: 5px;
  padding: 5px 0 8px 12px;
}
.fp-devtools__stage[data-status="failed"],
.fp-devtools__stage[data-status="cancelled"] { border-left-color: var(--fpd-danger); }
.fp-devtools__feature {
  background: var(--fpd-panel);
  border: 1px solid var(--fpd-border);
  border-radius: 10px;
  margin-bottom: 10px;
  padding: 12px;
}
.fp-devtools__feature h3 { margin: 0 0 8px; }
[data-fp-devtools-highlight="true"] {
  outline: 3px solid #d27a49 !important;
  outline-offset: 3px !important;
  transition: outline-color 160ms ease;
}
@media (max-width: 760px) {
  .fp-devtools__drawer { border-radius: 0; height: min(78vh, var(--fpd-height, 78vh)); }
  .fp-devtools__split { grid-template-columns: 1fr; grid-template-rows: minmax(150px, 42%) minmax(0, 1fr); }
  .fp-devtools__pane + .fp-devtools__pane { border-left: 0; border-top: 1px solid var(--fpd-border); }
  .fp-devtools__stats { display: none; }
  .fp-devtools__launcher { bottom: 12px; right: 12px; }
}
@media (prefers-color-scheme: dark) {
  .fp-devtools {
    --fpd-bg: #14211d;
    --fpd-panel: #192a24;
    --fpd-panel-strong: #20342d;
    --fpd-text: #e7eee9;
    --fpd-muted: #a1b2aa;
    --fpd-border: #395047;
    --fpd-accent: #70c4a5;
    --fpd-accent-soft: #23463a;
    --fpd-danger: #f09a7e;
    --fpd-danger-soft: #4b2b23;
    --fpd-shadow: 0 -18px 60px rgb(0 0 0 / 42%);
  }
  .fp-devtools__launcher { background: #266d58; }
  .fp-devtools__mark { background: #e8f0eb; color: #245d4c; }
}
`
