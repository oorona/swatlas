import type { ZodType } from 'zod';
import {
  charactersFileSchema,
  indexSchema,
  manifestSchema,
  MODES,
  projectionsFileSchema,
  relationshipsFileSchema,
  similarityFileSchema,
  VERSION_RE,
  type BundleIndex,
  type Manifest,
  type Mode,
} from './schema';
import { sha256Hex } from './sha256';
import type { Atlas, ModeData } from './types';

export type BundleErrorCode = 'unavailable-version' | 'checksum-mismatch' | 'schema-invalid' | 'inconsistent' | 'network';

export class BundleError extends Error {
  constructor(
    public code: BundleErrorCode,
    message: string,
    public availableVersions: string[] = [],
    public defaultVersion: string | null = null,
  ) {
    super(message);
    this.name = 'BundleError';
  }
}

export const BUNDLE_ROOT = '/bundles';

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

async function fetchBytes(fetcher: Fetcher, url: string, signal?: AbortSignal): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetcher(url, { signal, credentials: 'same-origin' });
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error;
    throw new BundleError('network', `Could not fetch ${url}`);
  }
  if (!response.ok) throw new BundleError('network', `Fetching ${url} returned ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

function parseJson<T>(bytes: Uint8Array, schema: ZodType<T>, label: string): T {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BundleError('schema-invalid', `${label} is not valid JSON`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw new BundleError('schema-invalid', `${label} failed schema validation: ${result.error.issues[0]?.message ?? 'invalid'}`);
  return result.data;
}

export async function loadIndex(fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<BundleIndex> {
  return parseJson(await fetchBytes(fetcher, `${BUNDLE_ROOT}/index.json`, signal), indexSchema, 'index.json');
}

export function resolveVersion(index: BundleIndex, requested: string | null): string {
  const available = index.versions.map((v) => v.version);
  if (requested === null) return index.default_version;
  if (!VERSION_RE.test(requested) || !available.includes(requested)) {
    throw new BundleError('unavailable-version', `Version ${requested.slice(0, 32)} is not available`, available, index.default_version);
  }
  return requested;
}

function assertConsistent(condition: boolean, message: string): asserts condition {
  if (!condition) throw new BundleError('inconsistent', message);
}

export function assembleAtlas(manifest: Manifest, files: Record<string, unknown>, latestVersion = manifest.version): Atlas {
  const version = manifest.version;
  const characters = charactersFileSchema.parse(files.characters);
  const relationships = relationshipsFileSchema.parse(files.relationships);
  assertConsistent(characters.version === version && relationships.version === version, 'file version does not match manifest');
  const ids = characters.characters.map((c) => c.id);
  assertConsistent(new Set(ids).size === ids.length, 'duplicate character ids');
  const byId = new Map(characters.characters.map((c) => [c.id, c]));
  for (const rel of relationships.relationships) assertConsistent(byId.has(rel.from) && byId.has(rel.to), 'relationship references unknown id');

  const modes = {} as Record<Mode, ModeData>;
  for (const mode of MODES) {
    const meta = manifest.modes[mode];
    const sim = similarityFileSchema.parse(files[meta.files.similarity]);
    const proj = projectionsFileSchema.parse(files[meta.files.projections]);
    for (const file of [sim, proj]) {
      assertConsistent(file.version === version, `${mode}: version mismatch`);
      assertConsistent(file.mode === mode, `${mode}: mode mismatch`);
      assertConsistent(file.input_hash === meta.input_hash, `${mode}: input hash mismatch`);
      assertConsistent(file.ids.length === ids.length && file.ids.every((id, i) => id === ids[i]), `${mode}: id order mismatch`);
    }
    assertConsistent(sim.matrix.length === ids.length && sim.matrix.every((row) => row.length === ids.length), `${mode}: matrix shape`);
    for (const p of proj.projections) assertConsistent(ids.every((id) => p.coordinates_by_id[id] !== undefined), `${mode}: projection ${p.id} missing ids`);
    modes[mode] = { mode, inputHash: meta.input_hash, ids, matrix: sim.matrix, projections: proj.projections };
  }
  assertConsistent(modes.authored.inputHash !== modes.relationships_removed.inputHash, 'modes share an input hash');

  return {
    version,
    latestVersion,
    manifest,
    ids,
    characters: characters.characters,
    byId,
    vocabularies: characters.vocabularies,
    relationships: relationships.relationships,
    modes,
  };
}

/** Files the explorer needs; vectors ship in the bundle and download but are not needed for display. */
export function requiredKeys(manifest: Manifest): string[] {
  const keys = new Set(['characters', 'relationships']);
  for (const mode of MODES) {
    keys.add(manifest.modes[mode].files.similarity);
    keys.add(manifest.modes[mode].files.projections);
  }
  return [...keys];
}

export async function loadAtlas(requestedVersion: string | null, fetcher: Fetcher = fetch, signal?: AbortSignal): Promise<Atlas> {
  const index = await loadIndex(fetcher, signal);
  const version = resolveVersion(index, requestedVersion);
  const manifest = parseJson(await fetchBytes(fetcher, `${BUNDLE_ROOT}/${version}/manifest.json`, signal), manifestSchema, 'manifest.json');
  if (manifest.version !== version) throw new BundleError('inconsistent', 'manifest version does not match the requested version');

  const files: Record<string, unknown> = {};
  await Promise.all(
    requiredKeys(manifest).map(async (key) => {
      const entry = manifest.files.find((f) => f.key === key);
      if (!entry) throw new BundleError('inconsistent', `manifest does not list ${key}`);
      const bytes = await fetchBytes(fetcher, `${BUNDLE_ROOT}/${version}/${entry.path}`, signal);
      const digest = await sha256Hex(bytes);
      if (digest !== entry.sha256) throw new BundleError('checksum-mismatch', `${entry.path} does not match its manifest checksum`);
      try {
        files[key] = JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        throw new BundleError('schema-invalid', `${entry.path} is not valid JSON`);
      }
    }),
  );
  try {
    return assembleAtlas(manifest, files, index.default_version);
  } catch (error) {
    if (error instanceof BundleError) throw error;
    throw new BundleError('schema-invalid', 'A bundle file failed schema validation');
  }
}
