export interface Point {
  x: number;
  y: number;
}

/**
 * Fit unitless projection coordinates into an SVG box, each axis scaled to
 * fill the box, with y pointing up as in the source coordinates. Axis scales
 * differ; 2D distances are only a rough guide either way.
 */
export function fitCoordinates(coords: Record<string, [number, number]>, ids: string[], width: number, height: number, pad: number): Record<string, Point> {
  const xs = ids.map((id) => coords[id]![0]);
  const ys = ids.map((id) => coords[id]![1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const sx = (width - 2 * pad) / spanX;
  const sy = (height - 2 * pad) / spanY;
  const out: Record<string, Point> = {};
  for (const id of ids) {
    const [x, y] = coords[id]!;
    out[id] = { x: pad + (x - minX) * sx, y: height - (pad + (y - minY) * sy) };
  }
  return out;
}

export interface LabelBox {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const overlap = (a: Rect, b: Rect) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));

/**
 * Greedy label placement: try eight positions around each point and keep the
 * one with the least overlap against earlier labels, all markers, and the
 * chart bounds. Deterministic for a given input order.
 */
export function placeLabels(
  points: Record<string, Point>,
  labels: { id: string; text: string; fontSize: number }[],
  width: number,
  height: number,
  obstacles: Rect[] = [],
): Record<string, LabelBox> {
  const markers: Rect[] = Object.values(points).map((p) => ({ x0: p.x - 10, y0: p.y - 10, x1: p.x + 10, y1: p.y + 10 }));
  const placed: Rect[] = [];
  const out: Record<string, LabelBox> = {};
  const order = [...labels].sort((a, b) => b.fontSize - a.fontSize || points[a.id]!.y - points[b.id]!.y || a.id.localeCompare(b.id));
  for (const label of order) {
    const p = points[label.id]!;
    const w = label.text.length * label.fontSize * 0.56;
    const h = label.fontSize * 1.1;
    const gap = 12;
    const candidates: LabelBox[] = [
      { x: p.x + gap, y: p.y + h * 0.35, anchor: 'start' },
      { x: p.x - gap, y: p.y + h * 0.35, anchor: 'end' },
      { x: p.x + gap - 2, y: p.y + gap + h * 0.6, anchor: 'start' },
      { x: p.x + gap - 2, y: p.y - gap, anchor: 'start' },
      { x: p.x - gap + 2, y: p.y + gap + h * 0.6, anchor: 'end' },
      { x: p.x - gap + 2, y: p.y - gap, anchor: 'end' },
      { x: p.x, y: p.y + gap + h * 0.9, anchor: 'middle' },
      { x: p.x, y: p.y - gap - 2, anchor: 'middle' },
    ];
    let best = candidates[0]!;
    let bestCost = Number.POSITIVE_INFINITY;
    let bestRect: Rect | null = null;
    for (const [i, c] of candidates.entries()) {
      const x0 = c.anchor === 'start' ? c.x : c.anchor === 'end' ? c.x - w : c.x - w / 2;
      const rect: Rect = { x0, y0: c.y - h * 0.85, x1: x0 + w, y1: c.y + h * 0.15 };
      let cost = i * 0.5;
      for (const r of placed) cost += overlap(rect, r) * 3;
      for (const r of markers) cost += overlap(rect, r) * 2;
      for (const r of obstacles) cost += overlap(rect, r);
      const outside = Math.max(0, -rect.x0) + Math.max(0, rect.x1 - width) + Math.max(0, -rect.y0) + Math.max(0, rect.y1 - height);
      cost += outside * 200;
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
        bestRect = rect;
      }
    }
    if (bestRect) placed.push(bestRect);
    out[label.id] = best;
  }
  return out;
}
