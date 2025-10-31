import { EMPTY_FILTERS, FILTER_FIELDS, type FilterField, type Filters } from './filters';
import { ID_RE, VERSION_RE, type Mode } from './schema';
import type { Atlas } from './types';

// Shareable state is parsed against an allowlist. Invalid fields reset to their
// default with an explanation; an unknown character id is never remapped.

export const VIEWS = ['map', 'graph', 'matrix'] as const;
export type View = (typeof VIEWS)[number];

export const MAX_QUERY_LENGTH = 1024;
export const MAX_FILTER_VALUES = 12;
export const DEFAULT_CHARACTER = 'luke-skywalker';
export const DEFAULT_PROJECTION = 'pca';
export const DEFAULT_THRESHOLD = 0.45;

export interface AtlasState {
  version: string | null;
  selected: string;
  view: View;
  projection: string;
  mode: Mode;
  threshold: number;
  filters: Filters;
  curated: boolean;
}

export type IssueCode = 'oversized' | 'invalid-version' | 'invalid-character' | 'invalid-view' | 'invalid-projection' | 'invalid-mode' | 'invalid-threshold' | 'invalid-filter' | 'invalid-curated';

export interface UrlIssue {
  code: IssueCode;
  field: string;
}

export const DEFAULT_STATE: AtlasState = {
  version: null,
  selected: DEFAULT_CHARACTER,
  view: 'map',
  projection: DEFAULT_PROJECTION,
  mode: 'authored',
  threshold: DEFAULT_THRESHOLD,
  filters: EMPTY_FILTERS,
  curated: false,
};

const FILTER_PARAMS: Record<FilterField, string> = { allegiances: 'al', roles: 'ro', eras: 'er', force_status: 'fs' };
const MODE_PARAMS: Record<string, Mode> = { authored: 'authored', variant: 'relationships_removed' };
const PROJECTION_RE = /^(pca|umap-\d{1,3})$/;

export function roundThreshold(value: number): number {
  return Math.round(Math.min(1, Math.max(-1, value)) * 100) / 100;
}

export function parseUrlState(search: string): { state: AtlasState; issues: UrlIssue[] } {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (raw.length > MAX_QUERY_LENGTH) {
    return { state: { ...DEFAULT_STATE, filters: { ...EMPTY_FILTERS } }, issues: [{ code: 'oversized', field: '*' }] };
  }
  const params = new URLSearchParams(raw);
  const state: AtlasState = { ...DEFAULT_STATE, filters: { allegiances: [], roles: [], eras: [], force_status: [] } };
  const issues: UrlIssue[] = [];

  const v = params.get('v');
  if (v !== null) {
    if (VERSION_RE.test(v)) state.version = v;
    else issues.push({ code: 'invalid-version', field: 'v' });
  }

  const c = params.get('c');
  if (c !== null) {
    // Keep a syntactically valid id even if unknown; the explorer reports it
    // against the loaded version instead of silently choosing someone else.
    if (ID_RE.test(c) && c.length <= 64) state.selected = c;
    else {
      state.selected = '';
      issues.push({ code: 'invalid-character', field: 'c' });
    }
  }

  const view = params.get('view');
  if (view !== null) {
    if ((VIEWS as readonly string[]).includes(view)) state.view = view as View;
    else issues.push({ code: 'invalid-view', field: 'view' });
  }

  const p = params.get('p');
  if (p !== null) {
    if (PROJECTION_RE.test(p)) state.projection = p;
    else issues.push({ code: 'invalid-projection', field: 'p' });
  }

  const d = params.get('d');
  if (d !== null) {
    const mode = MODE_PARAMS[d];
    if (mode) state.mode = mode;
    else issues.push({ code: 'invalid-mode', field: 'd' });
  }

  const t = params.get('t');
  if (t !== null) {
    const value = /^-?\d(\.\d{1,2})?$/.test(t) ? Number(t) : Number.NaN;
    if (Number.isFinite(value) && value >= -1 && value <= 1) state.threshold = roundThreshold(value);
    else issues.push({ code: 'invalid-threshold', field: 't' });
  }

  for (const field of FILTER_FIELDS) {
    const value = params.get(FILTER_PARAMS[field]);
    if (value === null || value === '') continue;
    const parts = value.split(',');
    if (parts.length > MAX_FILTER_VALUES || !parts.every((part) => ID_RE.test(part) || /^[a-z_]+$/.test(part))) {
      issues.push({ code: 'invalid-filter', field: FILTER_PARAMS[field] });
      continue;
    }
    state.filters[field] = [...new Set(parts)].sort();
  }

  const rel = params.get('rel');
  if (rel !== null) {
    if (rel === '1' || rel === '0') state.curated = rel === '1';
    else issues.push({ code: 'invalid-curated', field: 'rel' });
  }

  return { state, issues };
}

export interface ValidatedState {
  state: AtlasState;
  issues: UrlIssue[];
  /** A syntactically valid id that does not exist in this version. */
  unknownCharacter: string | null;
}

/** Check parsed state against the loaded bundle's ids, projections, and vocabularies. */
export function validateAgainstAtlas(input: AtlasState, atlas: Atlas): ValidatedState {
  const state: AtlasState = { ...input, version: atlas.version, filters: { ...input.filters } };
  const issues: UrlIssue[] = [];
  let unknownCharacter: string | null = null;

  if (state.selected !== '' && !atlas.byId.has(state.selected)) {
    unknownCharacter = state.selected;
    state.selected = '';
  }

  const projectionIds = atlas.modes[state.mode].projections.map((p) => p.id);
  if (!projectionIds.includes(state.projection)) {
    issues.push({ code: 'invalid-projection', field: 'p' });
    state.projection = DEFAULT_PROJECTION;
  }

  for (const field of FILTER_FIELDS) {
    const allowed = atlas.vocabularies[field];
    const kept = state.filters[field].filter((v) => allowed.includes(v));
    if (kept.length !== state.filters[field].length) issues.push({ code: 'invalid-filter', field: FILTER_PARAMS[field] });
    state.filters[field] = kept;
  }

  return { state, issues, unknownCharacter };
}

export function serializeState(state: AtlasState): string {
  const params = new URLSearchParams();
  if (state.version) params.set('v', state.version);
  if (state.selected) params.set('c', state.selected);
  params.set('view', state.view);
  params.set('p', state.projection);
  params.set('d', state.mode === 'authored' ? 'authored' : 'variant');
  params.set('t', state.threshold.toFixed(2));
  for (const field of FILTER_FIELDS) {
    if (state.filters[field].length > 0) params.set(FILTER_PARAMS[field], [...state.filters[field]].sort().join(','));
  }
  if (state.curated) params.set('rel', '1');
  return params.toString();
}
