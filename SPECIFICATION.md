# 01. Star Wars semantic atlas

Status: ready for implementation planning; data preparation is part of the build. Apply [architecture.md](architecture.md). Project prefix: `swatlas`. New standalone app.

## Purpose and scope

Let a visitor investigate why two character descriptions look similar to an embedding model. Success is a linked visualization that exposes its inputs and scores. The first version covers the 15 characters authored in [Mapping the Star Wars Universe](../latent/data/articles/mapping-star-wars-universe/article.md). The article provides descriptions and Python sketches, not a saved embedding experiment. Its asserted clusters and nearest neighbors must be recomputed.

MVP includes a 2D projection, similarity graph, matrix, character inspection, explicit metadata filters, two description variants, downloadable evidence, and shareable views. Defer 3D, free-text semantic search, external franchise APIs, accounts, user uploads, and expanding the character catalog. Do not add copyrighted portraits or silently treat editorial classifications as authoritative canon.

## Architecture and boundaries

Next.js serves public pages and immutable JSON artifacts. Exploration runs in the browser using SVG and local state. No deployed FastAPI, Postgres, Redis, auth, or provider calls. Python authoring computes embeddings, cosine similarities, and projections with pinned dependencies. No runtime training/downloads. Offline sentence-transformer inference is an educational data-preparation step under the shared model-artifact policy.

Browser -> frontend -> reviewed artifact bundle is the full public data flow. The highest risks are misleading labels, imported text rendering, and inconsistent artifact versions. The common B1/authoring controls apply; B2/B3/B4 are absent.

## User experience

Open /explore with all 15 characters, PCA view, default authored descriptions, and Luke selected. Show the selected description beside its five nearest other characters and cosine scores. Do not promise particular neighbor names. Switching to UMAP, graph, or matrix preserves selection. Hover previews; click/keyboard selection commits. The matrix supports row/column navigation and a semantic table.

Filters for allegiance, role, era, and Force sensitivity operate on editorial fields, not embedding axes. A multi-valued field can be unknown or disputed. Show the classification note. Filters hide items and recompute the visible neighbor list from the same full similarity matrix; they do not retrain or refit projections. Display visible and total counts.

Graph threshold defaults to 0.45 and is adjustable from -1 to 1 in 0.01 steps. Similarity edges are undirected. Curated story relationships are separately toggled directed edges with a different line style and explicit label. A threshold yielding no edges is a valid state. No force-layout motion on load; use the selected fixed projection as graph coordinates.

Description mode switches between the original descriptions and an explicitly authored variant removing named relationship phrases. Show a diff and recomputed neighbors; do not imply that the change isolates a single causal factor. Copy-view links preserve version, character, filters, view, projection ID, description mode, and threshold. Reset restores defaults. Mobile uses chart then details; keyboard users can do the complete task through a character list.

## Data contract and preparation

Bundle schema v1 contains characters `{id,name,description,description_variant,allegiances[],roles[],eras[],force_status,classification_note,source_ref}`; editorial relationships `{from,to,type,source_ref,note}`; vectors keyed by character ID; cosine matrices; and projections `{id,method,dimensions,parameters,seed,coordinates_by_id}`. IDs and vector row order are explicitly mapped. All floating-point values are finite. Coordinates carry no physical units.

Start from the exact 15 source descriptions, record edits as a new version, and cite the article's specific description block. Use all-MiniLM-L6-v2 as the initial embedding family from the article; resolve and pin its model revision and document reuse terms before export. Normalize vectors for cosine computation, verify norm tolerance, and prohibit a zero vector. Use deterministic row ordering.

Export PCA and UMAP with n_neighbors 5, min_dist 0.3, cosine metric, seeds 7/21/42. Record execution settings and dependency versions. Preserve the computed coordinates rather than refitting in the browser. A seed alone is not sufficient documentation of every runtime setting. [UMAP reproducibility](https://umap-learn.readthedocs.io/en/latest/reproducibility.html).

Default bundle target: under 500 KiB compressed. API contract is static GET of one versioned manifest and its same-origin hashed files; unknown versions return a clear unavailable-version state. Downloads include descriptions, normalized embeddings, original-space scores, projection parameters, and a README. No HTML/script markup from data is executable.

## Computation and acceptance

Cosine comparisons use original normalized vectors, never projected distances. Neighbor ordering excludes self and breaks equal scores by stable ID. Graph includes each unordered pair once when score >= threshold; curated edges never inherit a numeric similarity claim. Projection changes cannot change the original-space ranking.

1. Dataset validation finds exactly the 15 source characters, unique IDs, both reviewed description variants, matching vector dimensions, and complete source references.
2. Independent NumPy recomputation matches exported cosine values within 1e-6; diagonal is approximately 1 and matrix is symmetric.
3. Switching PCA/UMAP changes coordinates but leaves original-space neighbors unchanged. Switching description variant changes the input hash and uses its own vectors/results.
4. Setting threshold to 1 yields only any mathematically eligible pairs, not a hardcoded empty graph; count matches matrix filtering.
5. Reloading a shared URL reproduces selected IDs, projection, threshold, and filters. Invalid IDs/version show a recoverable error rather than selecting another character silently.
6. All views support a keyboard/table equivalent and 390px layout; no selection is communicated only through color.
7. Default exploration completes with model/provider requests blocked. Every displayed ranking is derived from the shipped bundle, including cases contradicting the article's narrative.

## Build order and handoff

Extract/review descriptions and metadata; implement the reproducible exporter and math checks; establish the artifact schema; build the linked views and URL state; add methodology and downloads; run the common accessibility/performance/metadata checks. Deliver the artifact generation command, exact model revision, source hashes, test results, and one short walkthrough showing how changing the description affects a result. Do not rewrite the article as part of implementation; report any contradicted claims for later editorial review.
