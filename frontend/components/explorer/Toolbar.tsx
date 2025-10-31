'use client';

import { useTranslations } from 'next-intl';
import { toCsv, safeFilename } from '@/lib/atlas/csv';
import { MODES } from '@/lib/atlas/schema';
import { serializeState, VIEWS } from '@/lib/atlas/urlState';
import { useDerived } from './derived';
import { projectionLabel } from './labels';
import { useExplorer } from './store';

const segBtn = (on: boolean) =>
  `px-3 py-1.5 text-sm font-medium border border-border first:rounded-l-md last:rounded-r-md -ml-px first:ml-0 ${
    on ? 'bg-foreground text-background relative z-10' : 'bg-surface hover:bg-paper'
  }`;

export function Toolbar() {
  const t = useTranslations('explorer.toolbar');
  const state = useExplorer((s) => s.state);
  const setView = useExplorer((s) => s.setView);
  const setProjection = useExplorer((s) => s.setProjection);
  const setMode = useExplorer((s) => s.setMode);
  const reset = useExplorer((s) => s.reset);
  const setNotice = useExplorer((s) => s.setNotice);
  const derived = useDerived();
  if (!derived) return null;
  const { atlas, neighbors, selected } = derived;
  const projections = atlas.modes[state.mode].projections.map((p) => p.id);

  const copy = async () => {
    const url = `${window.location.origin}${window.location.pathname}?${serializeState(state)}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice({ kind: 'copied' });
    } catch {
      setNotice({ kind: 'copy-fallback', url });
    }
  };

  const downloadCsv = () => {
    const data = atlas.modes[state.mode];
    const rows: (string | number)[][] = [['version', 'mode', 'input_hash', 'selected_id', 'rank', 'neighbor_id', 'neighbor_name', 'cosine']];
    neighbors.forEach((n, i) => rows.push([atlas.version, state.mode, data.inputHash, selected, i + 1, n.id, atlas.byId.get(n.id)!.name, n.score]));
    const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = safeFilename(['swatlas', atlas.version, selected || 'none', state.mode, 'neighbors'], 'csv');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  };

  return (
    <div role="group" aria-label={t('label')} className="flex flex-wrap items-end gap-x-5 gap-y-3 rounded-xl border border-border bg-surface p-3">
      <div role="group" aria-labelledby="view-label">
        <p id="view-label" className="mb-1 text-xs font-medium text-muted">
          {t('view')}
        </p>
        <div className="flex">
          {VIEWS.map((view) => (
            <button key={view} type="button" aria-pressed={state.view === view} onClick={() => setView(view)} className={segBtn(state.view === view)} data-view={view}>
              {t(`views.${view}`)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="projection-select" className="mb-1 block text-xs font-medium text-muted">
          {t('projection')}
        </label>
        <select
          id="projection-select"
          value={state.projection}
          onChange={(e) => setProjection(e.target.value)}
          disabled={state.view === 'matrix'}
          className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm disabled:opacity-60"
        >
          {projections.map((id) => (
            <option key={id} value={id}>
              {projectionLabel(t, id)}
            </option>
          ))}
        </select>
      </div>

      <div role="group" aria-labelledby="mode-label">
        <p id="mode-label" className="mb-1 text-xs font-medium text-muted">
          {t('mode')}
        </p>
        <div className="flex">
          {MODES.map((mode) => (
            <button key={mode} type="button" aria-pressed={state.mode === mode} onClick={() => setMode(mode)} className={segBtn(state.mode === mode)} data-mode={mode}>
              {t(`modes.${mode}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-paper" data-testid="copy-link">
          {t('copy')}
        </button>
        <button type="button" onClick={reset} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-paper" data-testid="reset">
          {t('reset')}
        </button>
        <a href={`/bundles/${atlas.version}/${atlas.manifest.download.path}`} download className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-paper" data-testid="download-zip">
          {t('downloadBundle')}
        </a>
        <button type="button" onClick={downloadCsv} disabled={!selected} className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-paper disabled:opacity-50" data-testid="download-csv">
          {t('downloadCsv')}
        </button>
      </div>
      <p className="ml-auto self-center font-mono text-xs text-muted">{t('version', { version: atlas.version })}</p>
    </div>
  );
}
