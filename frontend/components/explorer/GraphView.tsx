'use client';

import { useTranslations } from 'next-intl';
import { useMemo } from 'react';
import { curatedEdges, pairCount, similarityEdges } from '@/lib/atlas/graph';
import { fitCoordinates } from '@/lib/atlas/layout';
import { useDerived, useScore, useThresholdFormat } from './derived';
import { projectionLabel } from './labels';
import { CHART_H, CHART_W, DragBar, Points } from './Points';
import { useExplorer } from './store';
import { useLiveLayout, type Link } from './useLiveLayout';

function shorten(x1: number, y1: number, x2: number, y2: number, by: number) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  return { x1: x1 + (dx / len) * by, y1: y1 + (dy / len) * by, x2: x2 - (dx / len) * by, y2: y2 - (dy / len) * by };
}

export function GraphView({ asTable }: { asTable: boolean }) {
  const t = useTranslations('explorer.chart');
  const tg = useTranslations('explorer.graph');
  const tt = useTranslations('explorer.toolbar');
  const tv = useTranslations('vocab.relationship');
  const state = useExplorer((s) => s.state);
  const derived = useDerived();
  const score = useScore();
  const fmtT = useThresholdFormat();
  const projection = derived?.atlas.modes[state.mode].projections.find((p) => p.id === state.projection);
  const points = useMemo(
    () => (derived && projection ? fitCoordinates(projection.coordinates_by_id, derived.visibleOrdered.length ? derived.visibleOrdered : derived.atlas.ids, CHART_W, CHART_H, 56) : {}),
    [derived, projection],
  );
  const edges = useMemo(() => {
    if (!derived) return [];
    const data = derived.atlas.modes[state.mode];
    return similarityEdges(data.ids, data.matrix, state.threshold, derived.visible);
  }, [derived, state.mode, state.threshold]);
  const curated = useMemo(() => (derived && state.curated ? curatedEdges(derived.atlas.relationships, derived.visible) : []), [derived, state.curated]);
  // Stronger similarity pulls harder; curated story links pull gently.
  const links = useMemo<Link[]>(() => {
    const lo = Math.min(...edges.map((e) => e.score), state.threshold);
    const hi = Math.max(...edges.map((e) => e.score), state.threshold + 1e-6);
    return [
      ...edges.map((e) => ({ a: e.a, b: e.b, strength: 0.35 + (0.65 * (e.score - lo)) / (hi - lo || 1) })),
      ...curated.map((r) => ({ a: r.from, b: r.to, strength: 0.4 })),
    ];
  }, [edges, curated, state.threshold]);
  const layout = useLiveLayout(points, links, `${state.mode}|${state.projection}`);
  if (!derived || !projection) return null;

  const { atlas, visibleOrdered, selected, neighborRank } = derived;
  const pairs = pairCount(visibleOrdered.length);
  const scores = edges.map((e) => e.score);
  const lo = Math.min(...scores, state.threshold);
  const hi = Math.max(...scores, state.threshold + 1e-6);
  const name = (id: string) => atlas.byId.get(id)!.name;
  const selectedName = selected ? atlas.byId.get(selected)?.name : undefined;
  const countText = tg('edgeCount', { edges: edges.length, pairs, threshold: fmtT(state.threshold) });

  const header = (
    <div className="space-y-1 px-1 pb-2 text-sm">
      <p data-testid="edge-count" data-edges={edges.length} data-pairs={pairs}>
        {countText}
      </p>
      {edges.length === 0 && (
        <p className="font-medium" data-testid="no-edges">
          {tg('noEdges')}
        </p>
      )}
      {state.curated && <p className="text-muted">{tg('curatedCount', { count: curated.length })}</p>}
    </div>
  );

  if (asTable) {
    return (
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t('tableCaptionGraph', { threshold: fmtT(state.threshold) })}>
        {header}
        <table className="w-full text-sm" data-testid="graph-table">
          <caption className="px-1 pb-2 text-left text-muted">{t('tableCaptionGraph', { threshold: fmtT(state.threshold) })}</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="py-1 pr-2">{t('colPair')}</th>
              <th scope="col" className="py-1 text-right">{t('colCosine')}</th>
            </tr>
          </thead>
          <tbody>
            {[...edges].sort((x, y) => y.score - x.score || (x.a + x.b).localeCompare(y.a + y.b)).map((e) => (
              <tr key={`${e.a}|${e.b}`} className="border-b border-border/60">
                <th scope="row" className="py-1 pr-2 text-left font-normal">
                  {name(e.a)} — {name(e.b)}
                </th>
                <td className="py-1 text-right font-mono">{score(e.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {state.curated && (
          <table className="mt-4 w-full text-sm" data-testid="curated-table">
            <caption className="px-1 pb-2 text-left text-muted">{tg('curatedLegend')}</caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="py-1 pr-2">{t('colFrom')}</th>
                <th scope="col" className="py-1 pr-2">{t('colType')}</th>
                <th scope="col" className="py-1">{t('colTo')}</th>
              </tr>
            </thead>
            <tbody>
              {curated.map((r) => (
                <tr key={`${r.from}|${r.type}|${r.to}`} className="border-b border-border/60">
                  <td className="py-1 pr-2">{name(r.from)}</td>
                  <td className="py-1 pr-2">{tv(r.type)}</td>
                  <td className="py-1">{name(r.to)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  const summary = t('graphLabel', {
    projection: projectionLabel(tt, state.projection),
    edges: edges.length,
    threshold: fmtT(state.threshold),
    selected: selectedName ? t('selectedSuffix', { name: selectedName }) : t('noneSelected'),
  });

  const live = layout.points;
  return (
    <div>
      {header}
      <DragBar pinnedCount={layout.pinnedCount} onReset={layout.resetLayout} />
      <svg ref={layout.svgRef} role="img" aria-label={summary} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="h-auto w-full touch-manipulation select-none" data-testid="graph-svg" data-projection={state.projection}>
        <defs>
          <marker id="curated-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0L10 5L0 10Z" fill="var(--curated)" />
          </marker>
        </defs>
        <rect width={CHART_W} height={CHART_H} fill="var(--paper)" />
        <g data-testid="similarity-edges">
          {edges.map((e) => {
            const a = live[e.a]!;
            const b = live[e.b]!;
            const touches = e.a === selected || e.b === selected;
            const w = 0.8 + (3.2 * (e.score - lo)) / (hi - lo || 1);
            return (
              <line
                key={`${e.a}|${e.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={touches ? 'var(--foreground)' : 'var(--edge)'}
                strokeOpacity={touches ? 0.85 : 0.35}
                strokeWidth={w}
              >
                <title>{`${name(e.a)} — ${name(e.b)}: ${score(e.score)}`}</title>
              </line>
            );
          })}
        </g>
        <g data-testid="curated-edges">
          {curated.map((r) => {
            const s = shorten(live[r.from]!.x, live[r.from]!.y, live[r.to]!.x, live[r.to]!.y, 14);
            return (
              <line key={`${r.from}|${r.type}|${r.to}`} {...s} stroke="var(--curated)" strokeWidth={1.8} strokeDasharray="6 4" markerEnd="url(#curated-arrow)">
                <title>{`${name(r.from)} → ${tv(r.type)} → ${name(r.to)}`}</title>
              </line>
            );
          })}
        </g>
        <Points atlas={atlas} points={live} settled={layout.settled} home={points} ids={visibleOrdered} selected={selected} neighborRank={neighborRank} selectedLabel={t('selectedBadge')} drag={layout} />
      </svg>
    </div>
  );
}
