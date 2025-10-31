import type { Character } from './schema';

export const FILTER_FIELDS = ['allegiances', 'roles', 'eras', 'force_status'] as const;
export type FilterField = (typeof FILTER_FIELDS)[number];
export type Filters = Record<FilterField, string[]>;

export const EMPTY_FILTERS: Filters = { allegiances: [], roles: [], eras: [], force_status: [] };

function valuesOf(character: Character, field: FilterField): string[] {
  return field === 'force_status' ? [character.force_status] : character[field];
}

/** OR within a field, AND across fields; an empty field does not filter. Editorial fields only. */
export function matchesFilters(character: Character, filters: Filters): boolean {
  return FILTER_FIELDS.every((field) => {
    const selected = filters[field];
    return selected.length === 0 || valuesOf(character, field).some((v) => selected.includes(v));
  });
}

export function visibleIds(characters: Character[], filters: Filters): Set<string> {
  return new Set(characters.filter((c) => matchesFilters(c, filters)).map((c) => c.id));
}

export function valueCounts(characters: Character[], field: FilterField): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of characters) for (const v of valuesOf(c, field)) counts.set(v, (counts.get(v) ?? 0) + 1);
  return counts;
}

export function hasActiveFilters(filters: Filters): boolean {
  return FILTER_FIELDS.some((f) => filters[f].length > 0);
}
