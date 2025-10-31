import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { assembleAtlas, requiredKeys } from './bundle';
import { claimsFileSchema, indexSchema, manifestSchema, type BundleIndex, type ClaimsFile } from './schema';
import type { Atlas } from './types';

// Server pages (home preview, methodology, sitemap, llms.txt) read the same
// shipped bundle from disk with the same checksum and schema checks.

const BUNDLE_DIR = path.join(process.cwd(), 'public', 'bundles');

export interface ServerBundle {
  index: BundleIndex;
  atlas: Atlas;
  claims: ClaimsFile;
}

let cached: Promise<ServerBundle> | null = null;

async function readVerified(version: string, entry: { path: string; sha256: string }): Promise<unknown> {
  const bytes = await readFile(path.join(BUNDLE_DIR, version, entry.path));
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== entry.sha256) throw new Error(`checksum mismatch for ${entry.path}`);
  return JSON.parse(bytes.toString('utf-8'));
}

async function load(): Promise<ServerBundle> {
  const index = indexSchema.parse(JSON.parse(await readFile(path.join(BUNDLE_DIR, 'index.json'), 'utf-8')));
  const version = index.default_version;
  const manifest = manifestSchema.parse(JSON.parse(await readFile(path.join(BUNDLE_DIR, version, 'manifest.json'), 'utf-8')));
  const files: Record<string, unknown> = {};
  for (const key of [...requiredKeys(manifest), 'claims']) {
    const entry = manifest.files.find((f) => f.key === key);
    if (!entry) throw new Error(`manifest does not list ${key}`);
    files[key] = await readVerified(version, entry);
  }
  const atlas = assembleAtlas(manifest, files);
  const claims = claimsFileSchema.parse(files.claims);
  if (claims.version !== version) throw new Error('claims version mismatch');
  return { index, atlas, claims };
}

export function getServerBundle(): Promise<ServerBundle> {
  if (!cached) {
    cached = load().catch((error) => {
      cached = null;
      throw error;
    });
  }
  return cached;
}
