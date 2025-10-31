'use client';

import { Marker } from '@/components/atlas/Marker';
import { placeLabels, type Point } from '@/lib/atlas/layout';
import { useMemo } from 'react';
import type { Atlas } from '@/lib/atlas/types';
import { useExplorer } from './store';

export const CHART_W = 640;
export const CHART_H = 460;

/**
 * Character marks shared by map and graph. Selection is shown with a thick
 * ring, bold label, and a "selected" tag (not color alone); neighbor ranks are
 * numbered badges. Points are pointer targets; the character list is the
 * keyboard path.
 */
export function Points({ atlas, points, ids, selected, neighborRank, selectedLabel }: {
  atlas: Atlas;
  points: Record<string, Point>;
  ids: string[];
  selected: string;
  neighborRank: Map<string, number>;
  selectedLabel: string;
}) {
  const select = useExplorer((s) => s.select);
  const setHover = useExplorer((s) => s.setHover);
  const hover = useExplorer((s) => s.hover);
  const labels = useMemo(() => {
    const badges = [...neighborRank.keys()].filter((id) => points[id]).map((id) => ({ x0: points[id]!.x + 2, y0: points[id]!.y - 19, x1: points[id]!.x + 18, y1: points[id]!.y - 3 }));
    return placeLabels(
      points,
      ids.map((id) => ({ id, text: id === selected ? `${atlas.byId.get(id)!.name} (${selectedLabel})` : atlas.byId.get(id)!.name, fontSize: id === selected ? 14 : 12 })),
      CHART_W,
      CHART_H,
      badges,
    );
  }, [atlas, ids, points, selected, neighborRank, selectedLabel]);
  return (
    <g>
      {ids.map((id) => {
        const c = atlas.byId.get(id)!;
        const p = points[id]!;
        const isSel = id === selected;
        const isHover = id === hover && !isSel;
        const rank = neighborRank.get(id);
        const label = labels[id]!;
        return (
          <g
            key={id}
            data-id={id}
            data-x={p.x.toFixed(2)}
            data-y={p.y.toFixed(2)}
            className="cursor-pointer"
            onClick={() => select(id)}
            onMouseEnter={() => setHover(id)}
            onMouseLeave={() => setHover(null)}
          >
            <circle cx={p.x} cy={p.y} r={18} fill="transparent" />
            {isSel && <circle cx={p.x} cy={p.y} r={15} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={3.5} />}
            {isHover && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="var(--foreground)" strokeWidth={1.5} strokeDasharray="3 3" />}
            <Marker status={c.force_status} x={p.x} y={p.y} size={isSel ? 8 : 7} />
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
