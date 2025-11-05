import type { Character } from './schema';

/**
 * Display grouping for the "Color by faction" option, derived from the draft
 * editorial allegiances and roles (never from the embedding). The first
 * matching rule wins; characters the editorial layer marks unknown or disputed
 * stay neutral rather than being forced into a camp.
 */
export const FACTIONS = ['jedi', 'sith', 'rebellion', 'bounty_hunters', 'other'] as const;
export type Faction = (typeof FACTIONS)[number];

export const FACTION_FILL: Record<Faction, string> = {
  jedi: 'var(--faction-jedi)',
  sith: 'var(--faction-sith)',
  rebellion: 'var(--faction-rebellion)',
  bounty_hunters: 'var(--faction-hunters)',
  other: 'var(--mark-unknown)',
};

export function factionOf(c: Pick<Character, 'allegiances' | 'roles'>): Faction {
  if (c.allegiances.includes('jedi-order')) return 'jedi';
  if (c.allegiances.includes('sith')) return 'sith';
  if (c.allegiances.includes('rebel-alliance')) return 'rebellion';
  if (c.roles.includes('bounty-hunter')) return 'bounty_hunters';
  return 'other';
}
