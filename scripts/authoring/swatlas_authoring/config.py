"""Pinned configuration for the swatlas authoring pipeline.

Every value that affects the published numbers lives here so the manifest can
record it verbatim.
"""

from pathlib import Path

AUTHORING_ROOT = Path(__file__).resolve().parent.parent
PROJECT_ROOT = AUTHORING_ROOT.parent.parent
SOURCES_DIR = AUTHORING_ROOT / "sources"
BUNDLES_DIR = PROJECT_ROOT / "frontend" / "public" / "bundles"

# Private latentSource checkout; only read when re-extracting or re-verifying.
ARTICLE_PATH = PROJECT_ROOT.parent / "latent" / "data" / "articles" / "mapping-star-wars-universe" / "article.md"
ARTICLE_SLUG = "mapping-star-wars-universe"
ARTICLE_TITLE = "Mapping the Star Wars Universe"
ARTICLE_URL_PATH = "/articles/mapping-star-wars-universe"
ARTICLE_SECTION = "Building character descriptions"

DESCRIPTIONS_FILE = SOURCES_DIR / "article_descriptions.v1.json"
EDITORIAL_FILE = SOURCES_DIR / "editorial.v1.yaml"

SCHEMA_VERSION = 1
ARTIFACT_ID = "swatlas-characters"
DEFAULT_VERSION = "2026-09-24.1"

MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"
# Resolved from the Hugging Face API on 2026-09-24 (lastModified 2026-06-01).
MODEL_REVISION = "1110a243fdf4706b3f48f1d95db1a4f5529b4d41"
MODEL_LICENSE = "apache-2.0"
MODEL_REUSE_TERMS = (
    "Apache License 2.0 per the model card. Derived embeddings are redistributed "
    "with attribution to sentence-transformers/all-MiniLM-L6-v2; the model weights "
    "themselves are not redistributed."
)
EMBEDDING_DIMENSIONS = 384

MODES = ("authored", "relationships_removed")

PCA_ID = "pca"
UMAP_SEEDS = (7, 21, 42)
UMAP_PARAMS = {
    "n_components": 2,
    "n_neighbors": 5,
    "min_dist": 0.3,
    "metric": "cosine",
    "n_jobs": 1,
}

NORM_TOLERANCE = 1e-5
COSINE_TOLERANCE = 1e-6
DEFAULT_THRESHOLD = 0.45
MAX_COMPRESSED_BYTES = 500 * 1024
FLOAT_DIGITS = 8

EXPECTED_CHARACTER_COUNT = 15
