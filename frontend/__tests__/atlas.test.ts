import { describe, expect, it } from 'vitest';
import { BundleError, loadAtlas } from '@/lib/atlas/bundle';
import { safeCell, safeFilename, toCsv } from '@/lib/atlas/csv';
import { wordDiff } from '@/lib/atlas/diff';
import { EMPTY_FILTERS, visibleIds } from '@/lib/atlas/filters';
import { pairCount, similarityEdges } from '@/lib/atlas/graph';
import { nearestNeighbors } from '@/lib/atlas/neighbors';
import { sha256Hex, sha256Pure } from '@/lib/atlas/sha256';
import { diskFetcher, loadFixtureAtlas } from './fixtures';

const atlas = loadFixtureAtlas();

describe('neighbors', () => {
  it('excludes self, sorts descending, and breaks ties by id', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const m = [
      [1, 0.5, 0.5, 0.2],
      [0.5, 1, 0.1, 0.1],
      [0.5, 0.1, 1, 0.1],
      [0.2, 0.1, 0.1, 1],
    ];
    expect(nearestNeighbors(ids, m, 'a', 3).map((n) => n.id)).toEqual(['b', 'c', 'd']);
    expect(nearestNeighbors(ids, m, 'a', 3, new Set(['c', 'd'])).map((n) => n.id)).toEqual(['c', 'd']);
  });

  it('ranks from the shipped matrix and never from projections', () => {
    const data = atlas.modes.authored;
    const top = nearestNeighbors(data.ids, data.matrix, 'luke-skywalker', 5);
    expect(top).toHaveLength(5);
    for (let i = 1; i < top.length; i++) expect(top[i - 1]!.score).toBeGreaterThanOrEqual(top[i]!.score);
    const i = data.ids.indexOf('luke-skywalker');
    expect(top[0]!.score).toBe(data.matrix[i]![data.ids.indexOf(top[0]!.id)]);
  });

  it('description modes use their own matrices', () => {
    const a = nearestNeighbors(atlas.ids, atlas.modes.authored.matrix, 'kylo-ren', 5);
    const b = nearestNeighbors(atlas.ids, atlas.modes.relationships_removed.matrix, 'kylo-ren', 5);
    expect(a).not.toEqual(b);
    expect(atlas.modes.authored.inputHash).not.toBe(atlas.modes.relationships_removed.inputHash);
  });
});

describe('graph', () => {
  it('counts each unordered pair once and matches matrix filtering at any threshold', () => {
    const { ids, matrix } = atlas.modes.authored;
    for (const t of [-1, 0, 0.45, 0.7, 1]) {
      let expected = 0;
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (matrix[i]![j]! >= t) expected++;
      expect(similarityEdges(ids, matrix, t)).toHaveLength(expected);
    }
    expect(similarityEdges(ids, matrix, -1)).toHaveLength(pairCount(15));
    expect(similarityEdges(ids, matrix, 1)).toHaveLength(0);
  });

  it('restricts edges to visible characters', () => {
    const visible = visibleIds(atlas.characters, { ...EMPTY_FILTERS, force_status: ['not_sensitive'] });
    const edges = similarityEdges(atlas.ids, atlas.modes.authored.matrix, -1, visible);
    expect(edges).toHaveLength(pairCount(visible.size));
  });
});

describe('filters', () => {
  it('ORs within a field and ANDs across fields', () => {
    const jediOrSith = visibleIds(atlas.characters, { ...EMPTY_FILTERS, roles: ['jedi', 'sith'] });
    const jedi = visibleIds(atlas.characters, { ...EMPTY_FILTERS, roles: ['jedi'] });
    expect(jediOrSith.size).toBeGreaterThan(jedi.size);
    const both = visibleIds(atlas.characters, { ...EMPTY_FILTERS, roles: ['jedi'], eras: ['sequel'] });
    for (const id of both) expect(jedi.has(id)).toBe(true);
    expect(visibleIds(atlas.characters, EMPTY_FILTERS).size).toBe(15);
  });
});

describe('diff, csv, sha256', () => {
  it('marks removed relationship phrases', () => {
    const luke = atlas.byId.get('luke-skywalker')!;
    const removed = wordDiff(luke.description, luke.description_variant).filter((s) => s.type === 'removed').map((s) => s.text).join(' ');
    expect(removed).toContain('son of Anakin Skywalker');
    expect(removed).toContain('trained by Obi-Wan and Yoda');
  });

  it('neutralizes spreadsheet formulas and builds safe filenames', () => {
    expect(safeCell('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`);
    expect(safeCell('-1+2')).toBe(`'-1+2`);
    expect(toCsv([['@cmd', 0.5]])).toBe(`'@cmd,0.5\n`);
    expect(safeFilename(['swatlas', '../../etc', 'Luke Skywalker'], 'csv')).toBe('swatlas-..-..-etc-luke-skywalker.csv');
    expect(safeFilename(['swatlas', '../../etc'], 'csv')).not.toContain('/');
  });

  it('pure sha256 matches SubtleCrypto', async () => {
    for (const text of ['', 'abc', 'x'.repeat(1000)]) {
      const bytes = new TextEncoder().encode(text);
      expect(sha256Pure(bytes)).toBe(await sha256Hex(bytes));
    }
    expect(sha256Pure(new TextEncoder().encode('abc'))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});

describe('bundle loading', () => {
  it('loads and verifies the default bundle', async () => {
    const loaded = await loadAtlas(null, diskFetcher());
    expect(loaded.ids).toHaveLength(15);
    expect(loaded.version).toBe(atlas.version);
  });

  it('reports an unknown version without falling back silently', async () => {
    await expect(loadAtlas('1999-01-01.1', diskFetcher())).rejects.toMatchObject({ code: 'unavailable-version' });
    await expect(loadAtlas('../etc', diskFetcher())).rejects.toBeInstanceOf(BundleError);
  });

  it('rejects a tampered file by checksum', async () => {
    const fetcher = diskFetcher((url, body) => (url.includes('similarity.authored') ? Buffer.from(body.toString().replace('0.', '0.1')) : body));
    await expect(loadAtlas(null, fetcher)).rejects.toMatchObject({ code: 'checksum-mismatch' });
  });
});
