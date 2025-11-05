'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BundleError, loadAtlas, type BundleErrorCode } from '@/lib/atlas/bundle';
import { parseUrlState, serializeState, validateAgainstAtlas, type UrlIssue } from '@/lib/atlas/urlState';
import { CharacterList } from './CharacterList';
import { ColorLegend } from './ColorLegend';
import { DetailsPanel } from './DetailsPanel';
import { FiltersPanel } from './FiltersPanel';
import { GraphControls } from './GraphControls';
import { GraphView } from './GraphView';
import { HoverPreview } from './HoverPreview';
import { MapView } from './MapView';
import { MatrixView } from './MatrixView';
import { Notices } from './Notices';
import { StatusRegion } from './StatusRegion';
import { Toolbar } from './Toolbar';
import { useDerived } from './derived';
import { useExplorer } from './store';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready' }
  | { status: 'error'; code: BundleErrorCode; requested: string | null; available: string[]; defaultVersion: string | null };

export default function Explorer() {
  const t = useTranslations('explorer');
  const te = useTranslations('explore');
  const init = useExplorer((s) => s.init);
  const state = useExplorer((s) => s.state);
  const atlas = useExplorer((s) => s.atlas);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [asTable, setAsTable] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ready = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    ready.current = false;
    setLoad({ status: 'loading' });
    const { state: parsed, issues } = parseUrlState(window.location.search);
    loadAtlas(parsed.version, fetch, controller.signal)
      .then((loaded) => {
        const validated = validateAgainstAtlas(parsed, loaded);
        const merged: UrlIssue[] = [];
        for (const issue of [...issues, ...validated.issues]) {
          if (!merged.some((m) => m.code === issue.code && m.field === issue.field)) merged.push(issue);
        }
        init(loaded, validated.state, merged, validated.unknownCharacter);
        ready.current = true;
        setLoad({ status: 'ready' });
      })
      .catch((error: unknown) => {
        if ((error as Error).name === 'AbortError') return;
        const e = error instanceof BundleError ? error : new BundleError('network', 'unexpected');
        setLoad({ status: 'error', code: e.code, requested: parsed.version, available: e.availableVersions, defaultVersion: e.defaultVersion });
      });
    return () => controller.abort();
  }, [init, attempt]);

  // Keep the address bar in sync so reload and sharing reproduce the view.
  useEffect(() => {
    if (!ready.current || !atlas) return;
    const query = serializeState(state);
    if (window.location.search.slice(1) !== query) {
      window.history.replaceState(window.history.state, '', `${window.location.pathname}?${query}`);
      window.dispatchEvent(new Event('swatlas:urlchange'));
    }
  }, [state, atlas]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (load.status === 'loading') {
    return (
      <p role="status" className="rounded-xl border border-border bg-surface p-6 text-muted" data-testid="explorer-loading">
        {te('loading')}
      </p>
    );
  }

  if (load.status === 'error') {
    return (
      <div role="alert" className="rounded-xl border-2 border-danger bg-surface p-6" data-testid="explorer-error" data-code={load.code}>
        <p className="font-semibold">{t(`errors.${load.code}`, { version: (load.requested ?? '').slice(0, 32) })}</p>
        {load.available.length > 0 && <p className="mt-1 text-sm text-muted">{t('errors.availableVersions', { versions: load.available.join(', ') })}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {load.code === 'unavailable-version' && load.defaultVersion ? (
            <a href={`${window.location.pathname}?v=${load.defaultVersion}`} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast">
              {t('errors.loadDefault', { version: load.defaultVersion })}
            </a>
          ) : (
            <button type="button" onClick={retry} className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast">
              {t('errors.retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  return <ExplorerReady asTable={asTable} setAsTable={setAsTable} />;
}

function ExplorerReady({ asTable, setAsTable }: { asTable: boolean; setAsTable: (v: boolean) => void }) {
  const t = useTranslations('explorer');
  const view = useExplorer((s) => s.state.view);
  const derived = useDerived();
  const tableLabel = view === 'matrix' ? (asTable ? t('matrix.heatmap') : t('matrix.semantic')) : asTable ? t('chart.showChart') : t('chart.showTable');

  return (
    <div className="space-y-4" data-testid="explorer" data-version={derived?.atlas.version}>
      <a href="#character-list" className="sr-only-focusable rounded bg-surface px-3 py-2 text-sm">
        {t('list.skip')}
      </a>
      <Toolbar />
      <Notices />
      <StatusRegion />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section aria-label={t(`toolbar.views.${view}`)} className="min-w-0 rounded-xl border border-border bg-surface p-3 lg:col-start-1 lg:row-start-1" data-testid="chart-panel">
          {view === 'graph' && <GraphControls />}
          <div className="flex justify-end py-2">
            <button type="button" aria-pressed={asTable} onClick={() => setAsTable(!asTable)} className="rounded-md border border-border px-3 py-1 text-sm hover:bg-paper" data-testid="table-toggle">
              {tableLabel}
            </button>
          </div>
          {derived && derived.visible.size === 0 ? (
            <p className="p-6 text-center text-muted">{t('chart.emptyVisible')}</p>
          ) : view === 'map' ? (
            <MapView asTable={asTable} />
          ) : view === 'graph' ? (
            <GraphView asTable={asTable} />
          ) : (
            <MatrixView asTable={asTable} />
          )}
          {view !== 'matrix' && !asTable && (
            <>
              <HoverPreview />
              <ColorLegend />
              <ul className="mt-1 space-y-1 px-1 text-xs text-muted">
                <li>{t('chart.legendNeighbors')}</li>
                <li>{t('chart.projectionNote')}</li>
              </ul>
            </>
          )}
        </section>
        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <div className="lg:sticky lg:top-4">
            <DetailsPanel />
          </div>
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-[18rem_minmax(0,1fr)] lg:col-start-1 lg:row-start-2">
          <CharacterList />
          <FiltersPanel />
        </div>
      </div>
    </div>
  );
}
