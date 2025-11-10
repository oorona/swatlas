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
DEFAULT_VERSION = "2025-11-07.1"

# 2025-11-04: switched from all-MiniLM-L6-v2 after a comparison of nine open
# models on these descriptions; E5-large-v2 separated the story groups best.
# The first MiniLM bundle was retired; git history has it.
MODEL_ID = "intfloat/e5-large-v2"
# Resolved from the Hugging Face API on 2025-11-04 (lastModified 2025-02-17).
MODEL_REVISION = "f169b11e22de13617baa190a028a32f3493550b6"
MODEL_LICENSE = "mit"
MODEL_REUSE_TERMS = (
    "MIT License per the model card. Derived embeddings are redistributed "
    "with attribution to intfloat/e5-large-v2; the model weights "
    "themselves are not redistributed."
)
EMBEDDING_DIMENSIONS = 1024
# E5 expects a role prefix on every input; descriptions are passages, not queries.
INPUT_PREFIX = "passage: "

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
# E5-large-v2 scores sit between ~0.80 and 0.94; 0.87 keeps about the top sixth of pairs.
DEFAULT_THRESHOLD = 0.87
MAX_COMPRESSED_BYTES = 500 * 1024
FLOAT_DIGITS = 8

EXPECTED_CHARACTER_COUNT = 15
