'use client';

import { create } from 'zustand';
import { EMPTY_FILTERS, type FilterField } from '@/lib/atlas/filters';
import type { Mode } from '@/lib/atlas/schema';
import type { Atlas } from '@/lib/atlas/types';
import { bundleThreshold, DEFAULT_STATE, roundThreshold, type AtlasState, type ColorBy, type UrlIssue, type View } from '@/lib/atlas/urlState';

export type Notice = { kind: 'copied' } | { kind: 'reset' } | { kind: 'copy-fallback'; url: string } | null;

interface ExplorerStore {
  atlas: Atlas | null;
  state: AtlasState;
  hover: string | null;
  issues: UrlIssue[];
  unknownCharacter: string | null;
  notice: Notice;
  init: (atlas: Atlas, state: AtlasState, issues: UrlIssue[], unknownCharacter: string | null) => void;
  select: (id: string) => void;
  setHover: (id: string | null) => void;
  setView: (view: View) => void;
  setProjection: (projection: string) => void;
  setMode: (mode: Mode) => void;
  setThreshold: (value: number) => void;
  setCurated: (on: boolean) => void;
  setColorBy: (colorBy: ColorBy) => void;
  toggleFilter: (field: FilterField, value: string) => void;
  clearFilters: () => void;
  reset: () => void;
  dismissIssues: () => void;
  setNotice: (notice: Notice) => void;
}

export const useExplorer = create<ExplorerStore>((set) => ({
  atlas: null,
  state: DEFAULT_STATE,
  hover: null,
  issues: [],
  unknownCharacter: null,
  notice: null,
  init: (atlas, state, issues, unknownCharacter) => set({ atlas, state, issues, unknownCharacter, hover: null, notice: null }),
  select: (id) => set((s) => (s.atlas?.byId.has(id) ? { state: { ...s.state, selected: id }, unknownCharacter: null } : {})),
  setHover: (id) => set({ hover: id }),
  setView: (view) => set((s) => ({ state: { ...s.state, view } })),
  setProjection: (projection) => set((s) => ({ state: { ...s.state, projection } })),
  setMode: (mode) => set((s) => ({ state: { ...s.state, mode } })),
  setThreshold: (value) => set((s) => (Number.isFinite(value) ? { state: { ...s.state, threshold: roundThreshold(value) } } : {})),
  setCurated: (curated) => set((s) => ({ state: { ...s.state, curated } })),
  setColorBy: (colorBy) => set((s) => ({ state: { ...s.state, colorBy } })),
  toggleFilter: (field, value) =>
    set((s) => {
      const current = s.state.filters[field];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value].sort();
      return { state: { ...s.state, filters: { ...s.state.filters, [field]: next } } };
    }),
  clearFilters: () => set((s) => ({ state: { ...s.state, filters: { ...EMPTY_FILTERS } } })),
  reset: () =>
    set((s) => ({
      state: { ...DEFAULT_STATE, filters: { ...EMPTY_FILTERS }, version: s.atlas?.version ?? null, threshold: s.atlas ? bundleThreshold(s.atlas) : DEFAULT_STATE.threshold },
      issues: [],
      unknownCharacter: null,
      hover: null,
      notice: { kind: 'reset' },
    })),
  dismissIssues: () => set({ issues: [] }),
  setNotice: (notice) => set({ notice }),
}));
