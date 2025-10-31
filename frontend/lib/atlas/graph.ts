import type { Relationship } from './schema';
import type { SimilarityEdge } from './types';

/** Each unordered visible pair exactly once when score >= threshold. */
export function similarityEdges(ids: string[], matrix: number[][], threshold: number, visible?: ReadonlySet<string>): SimilarityEdge[] {
  const edges: SimilarityEdge[] = [];
  for (let i = 0; i < ids.length; i++) {
    const a = ids[i]!;
    if (visible && !visible.has(a)) continue;
    for (let j = i + 1; j < ids.length; j++) {
      const b = ids[j]!;
      if (visible && !visible.has(b)) continue;
      const score = matrix[i]![j]!;
      if (score >= threshold) edges.push({ a, b, score });
    }
  }
  return edges;
}

export function pairCount(n: number): number {
  return (n * (n - 1)) / 2;
}

/** Curated story edges: directed, editorial, and never carrying a similarity score. */
export function curatedEdges(relationships: Relationship[], visible?: ReadonlySet<string>): Relationship[] {
  return relationships.filter((r) => !visible || (visible.has(r.from) && visible.has(r.to)));
}
