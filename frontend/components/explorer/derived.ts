'use client';

import { useFormatter } from 'next-intl';
import { useMemo } from 'react';
import { visibleIds } from '@/lib/atlas/filters';
import { nearestNeighbors } from '@/lib/atlas/neighbors';
import type { Atlas, Neighbor } from '@/lib/atlas/types';
import { useExplorer } from './store';

export interface Derived {
  atlas: Atlas;
  visible: Set<string>;
  visibleOrdered: string[];
  neighbors: Neighbor[];
  neighborRank: Map<string, number>;
  selected: string;
}

export function useDerived(): Derived | null {
  const atlas = useExplorer((s) => s.atlas);
  const state = useExplorer((s) => s.state);
  return useMemo(() => {
    if (!atlas) return null;
    const visible = visibleIds(atlas.characters, state.filters);
    const data = atlas.modes[state.mode];
    const neighbors = state.selected ? nearestNeighbors(data.ids, data.matrix, state.selected, 5, visible) : [];
    return {
      atlas,
      visible,
      visibleOrdered: atlas.ids.filter((id) => visible.has(id)),
      neighbors,
      neighborRank: new Map(neighbors.map((n, i) => [n.id, i + 1])),
      selected: state.selected,
    };
  }, [atlas, state.filters, state.mode, state.selected]);
}

export function useScore() {
  const format = useFormatter();
  return (value: number) => format.number(value, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function useThresholdFormat() {
  const format = useFormatter();
  return (value: number) => format.number(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
