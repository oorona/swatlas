import type { Character, Manifest, Mode, Projection, Relationship } from './schema';

export interface ModeData {
  mode: Mode;
  inputHash: string;
  /** Row/column order of the matrix; identical to Atlas.ids. */
  ids: string[];
  matrix: number[][];
  projections: Projection[];
}

export interface Atlas {
  version: string;
  manifest: Manifest;
  ids: string[];
  characters: Character[];
  byId: Map<string, Character>;
  vocabularies: { allegiances: string[]; roles: string[]; eras: string[]; force_status: string[] };
  relationships: Relationship[];
  modes: Record<Mode, ModeData>;
}

export interface Neighbor {
  id: string;
  score: number;
}

export interface SimilarityEdge {
  a: string;
  b: string;
  score: number;
}
