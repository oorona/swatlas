import type { Neighbor } from './types';

/**
 * Nearest other characters from the original-space cosine matrix.
 * Self is excluded; equal scores are ordered by stable id; only `visible`
 * characters are eligible. Projections are never consulted.
 */
export function nearestNeighbors(ids: string[], matrix: number[][], subject: string, k = 5, visible?: ReadonlySet<string>): Neighbor[] {
  const row = matrix[ids.indexOf(subject)];
  if (!row) return [];
  const ranked: Neighbor[] = [];
  ids.forEach((id, j) => {
    if (id !== subject && (!visible || visible.has(id))) ranked.push({ id, score: row[j]! });
  });
  ranked.sort((x, y) => y.score - x.score || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return ranked.slice(0, k);
}

export function scoreBetween(ids: string[], matrix: number[][], a: string, b: string): number | null {
  const i = ids.indexOf(a);
  const j = ids.indexOf(b);
  if (i < 0 || j < 0) return null;
  return matrix[i]![j]!;
}

/** 1-based rank of `other` among `subject`'s neighbors (visible set applied), or null. */
export function rankOf(ids: string[], matrix: number[][], subject: string, other: string, visible?: ReadonlySet<string>): number | null {
  const all = nearestNeighbors(ids, matrix, subject, ids.length, visible);
  const index = all.findIndex((n) => n.id === other);
  return index < 0 ? null : index + 1;
}
