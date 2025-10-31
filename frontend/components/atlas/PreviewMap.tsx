import { fitCoordinates, placeLabels } from '@/lib/atlas/layout';
import { nearestNeighbors } from '@/lib/atlas/neighbors';
import type { Atlas } from '@/lib/atlas/types';
import { Marker } from './Marker';

const W = 640;
const H = 400;

/** Static, data-derived preview of the PCA map (authored descriptions). */
export function PreviewMap({ atlas, selected, label }: { atlas: Atlas; selected: string; label: string }) {
  const data = atlas.modes.authored;
  const pca = data.projections.find((p) => p.id === 'pca')!;
  const pts = fitCoordinates(pca.coordinates_by_id, atlas.ids, W, H, 48);
  const top = nearestNeighbors(atlas.ids, data.matrix, selected, 5);
  const rank = new Map(top.map((n, i) => [n.id, i + 1]));
  const sel = pts[selected]!;
  const badges = top.map((n) => ({ x0: pts[n.id]!.x + 2, y0: pts[n.id]!.y - 17, x1: pts[n.id]!.x + 16, y1: pts[n.id]!.y - 3 }));
  const labels = placeLabels(pts, atlas.characters.map((c) => ({ id: c.id, text: c.name, fontSize: c.id === selected ? 13 : 11 })), W, H, badges);
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${H}`} className="h-auto w-full">
      <rect width={W} height={H} fill="var(--paper)" />
      {top.map((n) => (
        <line key={n.id} x1={sel.x} y1={sel.y} x2={pts[n.id]!.x} y2={pts[n.id]!.y} stroke="var(--edge)" strokeOpacity={0.5} strokeWidth={1.5} strokeDasharray="4 4" />
      ))}
      {atlas.characters.map((c) => {
        const p = pts[c.id]!;
        const isSel = c.id === selected;
        const r = rank.get(c.id);
        const label = labels[c.id]!;
        return (
          <g key={c.id}>
            {isSel && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke="var(--foreground)" strokeWidth={3} />}
            <Marker status={c.force_status} x={p.x} y={p.y} />
            {r !== undefined && (
              <g>
                <circle cx={p.x + 9} cy={p.y - 10} r={7} fill="var(--surface)" stroke="var(--foreground)" strokeWidth={1} />
                <text x={p.x + 9} y={p.y - 7} textAnchor="middle" fontSize={9} fontWeight={700} fill="var(--foreground)">
                  {r}
                </text>
              </g>
            )}
            <text
              x={label.x}
              y={label.y}
              textAnchor={label.anchor}
              paintOrder="stroke"
              stroke="var(--paper)"
              strokeWidth={3}
              fontSize={isSel ? 13 : 11}
              fontWeight={isSel ? 700 : 400}
              fill="var(--foreground)"
            >
              {c.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
