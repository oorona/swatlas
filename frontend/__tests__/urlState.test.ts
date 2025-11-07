import { describe, expect, it } from 'vitest';
import { bundleThreshold, DEFAULT_STATE, MAX_QUERY_LENGTH, parseUrlState, serializeState, validateAgainstAtlas } from '@/lib/atlas/urlState';
import { loadFixtureAtlas } from './fixtures';

const atlas = loadFixtureAtlas();

describe('url state', () => {
  it('defaults to Luke, map, PCA, authored, 0.87, faction colors', () => {
    const { state, issues } = parseUrlState('');
    expect(state).toMatchObject({ selected: 'luke-skywalker', view: 'map', projection: 'pca', mode: 'authored', threshold: 0.87, colorBy: 'faction' });
    expect(issues).toEqual([]);
  });

  it('round-trips every shareable field', () => {
    const state = { ...DEFAULT_STATE, version: atlas.version, selected: 'yoda', view: 'graph' as const, projection: 'umap-21', mode: 'relationships_removed' as const, threshold: -0.37, curated: true, colorBy: 'force' as const, filters: { allegiances: ['jedi-order'], roles: [], eras: ['prequel', 'sequel'], force_status: ['sensitive'] } };
    const parsed = parseUrlState(`?${serializeState(state)}`);
    expect(parsed.issues).toEqual([]);
    expect(parsed.state).toEqual(state);
  });

  it('resets invalid fields with explanations', () => {
    const { state, issues } = parseUrlState('?view=cube&p=tsne&d=x&t=2&rel=yes&v=latest&k=rainbow');
    expect(state.view).toBe('map');
    expect(state.projection).toBe('pca');
    expect(state.threshold).toBe(0.87);
    expect(state.colorBy).toBe('faction');
    expect(issues.map((i) => i.code).sort()).toEqual(['invalid-color', 'invalid-curated', 'invalid-mode', 'invalid-projection', 'invalid-threshold', 'invalid-version', 'invalid-view']);
  });

  it('rejects oversized state', () => {
    const { state, issues } = parseUrlState(`?c=${'a'.repeat(MAX_QUERY_LENGTH)}`);
    expect(issues[0]!.code).toBe('oversized');
    expect(state.selected).toBe('luke-skywalker');
  });

  it('never remaps an unknown character id', () => {
    const { state } = parseUrlState('?c=jar-jar-binks');
    const validated = validateAgainstAtlas(state, atlas);
    expect(validated.unknownCharacter).toBe('jar-jar-binks');
    expect(validated.state.selected).toBe('');
  });

  it('drops unknown projection and filter values against the bundle', () => {
    const { state } = parseUrlState('?p=umap-99&al=jedi-order,hutt-cartel');
    const validated = validateAgainstAtlas(state, atlas);
    expect(validated.state.projection).toBe('pca');
    expect(validated.state.filters.allegiances).toEqual(['jedi-order']);
    expect(validated.issues.map((i) => i.code)).toEqual(['invalid-projection', 'invalid-filter']);
  });

  it('takes the default threshold from the bundle unless the URL sets one', () => {
    const bare = parseUrlState('?view=graph');
    expect(bare.thresholdFromUrl).toBe(false);
    const other = { ...atlas, manifest: { ...atlas.manifest, computation: { ...atlas.manifest.computation, default_threshold: 0.45 } } };
    expect(validateAgainstAtlas(bare.state, other, bare.thresholdFromUrl).state.threshold).toBe(0.45);
    const pinned = parseUrlState('?t=0.9');
    expect(pinned.thresholdFromUrl).toBe(true);
    expect(validateAgainstAtlas(pinned.state, other, pinned.thresholdFromUrl).state.threshold).toBe(0.9);
    expect(bundleThreshold(atlas)).toBe(atlas.manifest.computation.default_threshold);
  });
});
