import { z } from 'zod';

// No eval-based JIT: the CSP forbids 'unsafe-eval', and zod otherwise probes Function().
z.config({ jitless: true });

// Bundle schema v1. Every file is validated on load; a mismatch is a typed
// error, never a silent reinterpretation.

export const SCHEMA_VERSION = 1;
export const ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const VERSION_RE = /^\d{4}-\d{2}-\d{2}\.\d{1,3}$/;

const id = z.string().regex(ID_RE).max(64);
const finite = z.number().refine(Number.isFinite, 'non-finite number');
const sha = z.string().regex(/^[0-9a-f]{64}$/);
const version = z.string().regex(VERSION_RE);
const relPath = z.string().regex(/^[A-Za-z0-9._-]+$/).max(128);

export const indexSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  artifact_id: z.string(),
  default_version: version,
  versions: z
    .array(z.object({ version, created_at: z.string(), manifest: z.string().regex(/^\d{4}-\d{2}-\d{2}\.\d{1,3}\/manifest\.json$/) }))
    .min(1)
    .max(100),
});

export const fileEntrySchema = z.object({
  key: z.string().regex(/^[a-z]+(?:\.[a-z]+)?$/),
  path: relPath,
  sha256: sha,
  bytes: z.number().int().positive().max(2_000_000),
  gzip_bytes: z.number().int().positive(),
});

export const MODES = ['authored', 'relationships_removed'] as const;
export type Mode = (typeof MODES)[number];

export const manifestSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  artifact_id: z.string(),
  version,
  created_at: z.string(),
  review_status: z.string(),
  kind: z.string(),
  kind_note: z.string(),
  source: z.object({
    article_slug: z.string(),
    article_title: z.string(),
    article_sha256: sha,
    section: z.string(),
    line_start: z.number().int(),
    line_end: z.number().int(),
    descriptions_sha256: sha,
    editorial_sha256: sha,
    description_edits: z.string(),
  }).passthrough(),
  license: z.record(z.string(), z.string()),
  model: z.object({ id: z.string(), revision: z.string().regex(/^[0-9a-f]{40}$/), dimensions: z.number().int().positive() }).passthrough(),
  modes: z.object({
    authored: z.object({ label: z.string(), input_hash: sha, norm_max_deviation: finite, files: z.object({ vectors: z.string(), similarity: z.string(), projections: z.string() }) }),
    relationships_removed: z.object({ label: z.string(), input_hash: sha, norm_max_deviation: finite, files: z.object({ vectors: z.string(), similarity: z.string(), projections: z.string() }) }),
  }),
  projections: z.object({ ids: z.array(z.string()), umap_parameters: z.record(z.string(), z.unknown()), umap_seeds: z.array(z.number()), note: z.string(), reference: z.string() }),
  computation: z.object({ similarity: z.string(), neighbor_order: z.string(), graph_rule: z.string(), default_threshold: finite, numeric_tolerance: finite }),
  counts: z.record(z.string(), z.number()),
  packages: z.record(z.string(), z.string()),
  execution: z.record(z.string(), z.unknown()),
  preparation_command: z.string(),
  limitations: z.array(z.string()),
  files: z.array(fileEntrySchema).min(1).max(32),
  download: z.object({ path: relPath, sha256: sha, bytes: z.number().int().positive() }),
  bundle_gzip_bytes: z.number().int().positive(),
});

const listOf = z.array(z.string().regex(ID_RE)).min(1).max(8);

export const characterSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  description: z.string().min(1).max(600),
  description_variant: z.string().min(1).max(600),
  variant_note: z.string().max(600),
  allegiances: listOf,
  roles: listOf,
  eras: listOf,
  force_status: z.enum(['sensitive', 'not_sensitive', 'unknown', 'disputed']),
  classification_note: z.string().max(800),
  source_ref: z.string().max(300),
  article_order: z.number().int(),
  review_status: z.string(),
});

export const charactersFileSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  version,
  review_status: z.string(),
  vocabularies: z.object({
    allegiances: z.array(z.string()),
    roles: z.array(z.string()),
    eras: z.array(z.string()),
    force_status: z.array(z.string()),
  }),
  characters: z.array(characterSchema).min(1).max(64),
});

export const relationshipsFileSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  version,
  review_status: z.string(),
  directed: z.literal(true),
  types: z.array(z.string()),
  relationships: z
    .array(z.object({ from: id, to: id, type: z.string().regex(/^[a-z_]+$/), source_ref: z.string().max(400), note: z.string().max(400).nullable() }).strict())
    .max(200),
});

const modeBase = { schema_version: z.literal(SCHEMA_VERSION), version, mode: z.enum(MODES), input_hash: sha, ids: z.array(id).min(1).max(64) };

export const vectorsFileSchema = z.object({
  ...modeBase,
  model: z.string(),
  model_revision: z.string(),
  dimensions: z.number().int().positive().max(4096),
  normalization: z.literal('l2'),
  norm_max_deviation: finite,
  vectors_by_id: z.record(id, z.array(finite)),
});

export const similarityFileSchema = z.object({
  ...modeBase,
  metric: z.literal('cosine'),
  space: z.string(),
  matrix: z.array(z.array(finite.refine((v) => v >= -1 - 1e-9 && v <= 1 + 1e-9, 'cosine out of range'))),
  stats: z.record(z.string(), finite),
});

export const projectionSchema = z.object({
  id: z.string().regex(/^(pca|umap-\d{1,3})$/),
  method: z.enum(['pca', 'umap']),
  dimensions: z.literal(2),
  parameters: z.record(z.string(), z.unknown()),
  seed: z.number().int().nullable(),
  diagnostics: z.record(z.string(), z.unknown()),
  coordinates_by_id: z.record(id, z.tuple([finite, finite])),
});

export const projectionsFileSchema = z.object({ ...modeBase, units: z.string(), projections: z.array(projectionSchema).min(1).max(8) });

export const claimsFileSchema = z.object({
  schema_version: z.literal(SCHEMA_VERSION),
  version,
  space: z.string(),
  note: z.string(),
  claims: z.array(
    z.object({
      id: z.string(),
      quote: z.string(),
      test: z.string(),
      by_mode: z.object({
        authored: z.object({ outcome: z.enum(['supported', 'partial', 'contradicted']), evidence: z.record(z.string(), z.unknown()) }),
        relationships_removed: z.object({ outcome: z.enum(['supported', 'partial', 'contradicted']), evidence: z.record(z.string(), z.unknown()) }),
      }),
    }),
  ),
});

export type BundleIndex = z.infer<typeof indexSchema>;
export type Manifest = z.infer<typeof manifestSchema>;
export type Character = z.infer<typeof characterSchema>;
export type CharactersFile = z.infer<typeof charactersFileSchema>;
export type RelationshipsFile = z.infer<typeof relationshipsFileSchema>;
export type Relationship = RelationshipsFile['relationships'][number];
export type VectorsFile = z.infer<typeof vectorsFileSchema>;
export type SimilarityFile = z.infer<typeof similarityFileSchema>;
export type Projection = z.infer<typeof projectionSchema>;
export type ProjectionsFile = z.infer<typeof projectionsFileSchema>;
export type ClaimsFile = z.infer<typeof claimsFileSchema>;
