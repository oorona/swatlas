import { readFileSync } from 'node:fs';
import path from 'node:path';
import { assembleAtlas, requiredKeys } from '@/lib/atlas/bundle';
import { manifestSchema, type Manifest } from '@/lib/atlas/schema';

export const BUNDLE_DIR = path.join(__dirname, '..', 'public', 'bundles');

export function readIndex() {
  return JSON.parse(readFileSync(path.join(BUNDLE_DIR, 'index.json'), 'utf-8'));
}

export function readManifest(): Manifest {
  const index = readIndex();
  return manifestSchema.parse(JSON.parse(readFileSync(path.join(BUNDLE_DIR, index.default_version, 'manifest.json'), 'utf-8')));
}

export function readFiles(manifest: Manifest, keys = requiredKeys(manifest)) {
  const files: Record<string, unknown> = {};
  for (const key of keys) {
    const entry = manifest.files.find((f) => f.key === key)!;
    files[key] = JSON.parse(readFileSync(path.join(BUNDLE_DIR, manifest.version, entry.path), 'utf-8'));
  }
  return files;
}

export function loadFixtureAtlas() {
  const manifest = readManifest();
  return assembleAtlas(manifest, readFiles(manifest));
}

/** A fetch stand-in serving the real bundle from disk, with optional tampering. */
export function diskFetcher(tamper?: (url: string, body: Buffer) => Buffer) {
  return async (url: string) => {
    const rel = url.replace(/^\/bundles\//, '');
    let body: Buffer;
    try {
      body = readFileSync(path.join(BUNDLE_DIR, rel));
    } catch {
      return new Response('not found', { status: 404 });
    }
    if (tamper) body = tamper(url, body);
    return new Response(new Uint8Array(body), { status: 200 });
  };
}
