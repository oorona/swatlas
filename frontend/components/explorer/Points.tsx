'use client';

import { useTranslations } from 'next-intl';
import { Marker } from '@/components/atlas/Marker';
import { FACTION_FILL, factionOf } from '@/lib/atlas/faction';
import { placeLabels, type Point } from '@/lib/atlas/layout';
import { useMemo, type PointerEvent as ReactPointerEvent } from 'react';
import type { Atlas } from '@/lib/atlas/types';
import { useExplorer } from './store';

export const CHART_W = 640;
export const CHART_H = 460;

/**
 * Character marks shared by map and graph. Selection is shown with a thick
 * ring, bold label, and a "selected" tag (not color alone); neighbor ranks are
 * numbered badges. Points are pointer targets and can be dragged; the
 * character list is the keyboard path. `data-x`/`data-y` carry the projection
 * position, not wherever the point has been dragged or animated to.
 */
export function Points({ atlas, points, settled, home, ids, selected, neighborRank, selectedLabel, drag }: {
  atlas: Atlas;
  points: Record<string, Point>;
  /** Where points last came to rest; labels are placed here and ride along while moving. */
  settled: Record<string, Point>;
  home: Record<string, Point>;
  ids: string[];
  selected: string;
  neighborRank: Map<string, number>;
  selectedLabel: string;
  drag: {
    bind: (id: string) => { onPointerDown: (e: ReactPointerEvent<SVGGElement>) => void };
    consumeDrag: () => boolean;
    dragging: string | null;
  };
}) {
  const select = useExplorer((s) => s.select);
  const setHover = useExplorer((s) => s.setHover);
  const hover = useExplorer((s) => s.hover);
  const colorBy = useExplorer((s) => s.state.colorBy);
  const labels = useMemo(() => {
    const badges = [...neighborRank.keys()].filter((id) => settled[id]).map((id) => ({ x0: settled[id]!.x + 2, y0: settled[id]!.y - 19, x1: settled[id]!.x + 18, y1: settled[id]!.y - 3 }));
    return placeLabels(
      settled,
      ids.map((id) => ({ id, text: id === selected ? `${atlas.byId.get(id)!.name} (${selectedLabel})` : atlas.byId.get(id)!.name, fontSize: id === selected ? 14 : 12 })),
      CHART_W,
      CHART_H,
      badges,
    );
  }, [atlas, ids, settled, selected, neighborRank, selectedLabel]);
  // The dragged point paints last so it stays on top of its neighbors.
  const order = drag.dragging && ids.includes(drag.dragging) ? [...ids.filter((id) => id !== drag.dragging), drag.dragging] : ids;
  return (
    <g>
      {order.map((id) => {
        const c = atlas.byId.get(id)!;
        const p = points[id]!;
        const isSel = id === selected;
        const isHover = id === hover && !isSel;
        const rank = neighborRank.get(id);
        const at = labels[id]!;
        const rest = settled[id] ?? p;
        const label = { ...at, x: at.x + p.x - rest.x, y: at.y + p.y - rest.y };
        return (
          <g
            key={id}
            data-id={id}
            data-x={home[id]!.x.toFixed(2)}
            data-y={home[id]!.y.toFixed(2)}
            className={drag.dragging === id ? 'cursor-grabbing' : 'cursor-grab'}
            style={{ touchAction: 'none' }}
            {...drag.bind(id)}
            onClick={() => {
              if (!drag.consumeDrag()) select(id);
            }}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover(null)}
          >
            <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
            {drag.dragging === id && <circle cx={p.x} cy={p.y} r={20} fill="var(--foreground)" fillOpacity={0.08} />}
            {isSel && <circle cx={p.x} cy={p.y} r={15} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={3.5} />}
            {isHover && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="3 3" />}
            <Marker status={c.force_status} x={p.x} y={p.y} size={isSel ? 8 : 7} fill={colorBy === 'faction' ? FACTION_FILL[factionOf(c)] : undefined} />
            {rank !== undefined && (
              <g aria-hidden="true">
                <circle cx={p.x + 10} cy={p.y - 11} r={7.5} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={1.2} />
                <text x={p.x + 10} y={p.y - 7.8} textAnchor="middle" fontSize={10} fontWeight={700} fill="var(--foreground)">
                  {rank}
                </text>
              </g>
            )}
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              fontSize={isSel ? 14 : 12}
              fontWeight={isSel ? 700 : 400}
              fill="var(--foreground)"
              paintOrder="stroke"
              stroke="var(--paper)"
              strokeWidth={3}
              strokeLinejoin="round"
            >
              {c.name}
              {isSel ? ` (${selectedLabel})` : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function DragBar({ pinnedCount, onReset }: { pinnedCount: number; onReset: () => void }) {
  const t = useTranslations('explorer.chart');
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-2 text-xs text-muted">
      <p>{t('dragHint')}</p>
      <button
        type="button"
        onClick={onReset}
        disabled={pinnedCount === 0}
        className="rounded-md border border-border px-2 py-1 text-foreground hover:bg-paper disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="reset-layout"
      >
        {t('resetLayout')}
      </button>
    </div>
  );
}
