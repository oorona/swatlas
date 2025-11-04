'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { fitCoordinates } from '@/lib/atlas/layout';
import { rankOf, scoreBetween } from '@/lib/atlas/neighbors';
import { useDerived, useScore } from './derived';
import { CHART_H, CHART_W, DragBar, Points } from './Points';
import { useExplorer } from './store';
import { projectionLabel } from './labels';
import { useLiveLayout, type Link } from './useLiveLayout';

export function MapView({ asTable }: { asTable: boolean }) {
  const t = useTranslations('explorer.chart');
  const tt = useTranslations('explorer.toolbar');
  const state = useExplorer((s) => s.state);
  const derived = useDerived();
  const score = useScore();
  const projection = derived?.atlas.modes[state.mode].projections.find((p) => p.id === state.projection);
  const points = useMemo(
    () => (derived && projection ? fitCoordinates(projection.coordinates_by_id, derived.visibleOrdered.length ? derived.visibleOrdered : derived.atlas.ids, CHART_W, CHART_H, 56) : {}),
    [derived, projection],
  );
  const links = useMemo<Link[]>(
    () => (derived?.selected && derived.visible.has(derived.selected) ? derived.neighbors.map((n) => ({ a: derived.selected, b: n.id, strength: 1 })) : []),
    [derived],
  );
  const layout = useLiveLayout(points, links, `${state.mode}|${state.projection}`);
  if (!derived || !projection) return null;
  const { atlas, visibleOrdered, selected, neighbors, neighborRank, visible } = derived;
  const data = atlas.modes[state.mode];
  const pLabel = projectionLabel(tt, state.projection);
  const selectedName = selected ? atlas.byId.get(selected)?.name : undefined;
  const summary = t('mapLabel', {
    projection: pLabel,
    visible: visibleOrdered.length,
    selected: selectedName ? t('selectedSuffix', { name: selectedName }) : t('noneSelected'),
  });

  if (asTable) {
    return (
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('tableCaptionMap', { projection: pLabel, selected: selectedName ?? '—' })}>
        <table className="w-full text-sm" data-testid="map-table">
          <caption className="px-1 pb-2 text-left text-muted">{t('tableCaptionMap', { projection: pLabel, selected: selectedName ?? '—' })}</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-1 pr-2">{t('colCharacter')}</th>
              <th scope="col" className="py-1 pr-2 text-right">{t('colX')}</th>
              <th scope="col" className="py-1 pr-2 text-right">{t('colY')}</th>
              <th scope="col" className="py-1 pr-2 text-right">{t('colScore')}</th>
              <th scope="col" className="py-1 text-right">{t('colRank')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleOrdered.map((id) => {
              const [x, y] = projection.coordinates_by_id[id]!;
              const s = selected && id !== selected ? scoreBetween(data.ids, data.matrix, selected, id) : null;
              const rank = selected && id !== selected ? rankOf(data.ids, data.matrix, selected, id, visible) : null;
              return (
                <tr key={id} className={`border-b border-border/60 ${id === selected ? 'font-semibold' : ''}`}>
                  <th scope="row" className="py-1 pr-2 text-left font-normal">
                    {atlas.byId.get(id)!.name}
                    {id === selected ? ` (${t('selectedBadge')})` : ''}
                  </th>
                  <td className="py-1 pr-2 text-right font-mono">{x.toFixed(3)}</td>
                  <td className="py-1 pr-2 text-right font-mono">{y.toFixed(3)}</td>
                  <td className="py-1 pr-2 text-right font-mono">{s === null ? '—' : score(s)}</td>
                  <td className="py-1 text-right font-mono">{rank ?? '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const live = layout.points;
  const sel = selected ? live[selected] : undefined;
  return (
    <div>
    <DragBar pinnedCount={layout.pinnedCount} onReset={layout.resetLayout} />
    <svg ref={layout.svgRef} role="img" aria-label={summary} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-auto w-full touch-manipulation select-none" data-testid="map-svg" data-projection={state.projection}>
      <rect width={CHART_W} height={CHART_H} fill="var(--paper)" />
      {sel &&
        visible.has(selected) &&
        neighbors.map((n) => (
          <line key={n.id} x1={sel.x} y1={sel.y} x2={live[n.id]!.x} y2={live[n.id]!.y} stroke="var(--edge)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" />
        ))}
      <Points atlas={atlas} points={live} settled={layout.settled} home={points} ids={visibleOrdered} selected={selected} neighborRank={neighborRank} selectedLabel={t('selectedBadge')} drag={layout} />
    </svg>
    </div>
  );
}
