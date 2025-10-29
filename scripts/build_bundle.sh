#!/usr/bin/env bash
# Generate the swatlas artifact bundle (embeddings, cosine matrices, projections,
# claim checks, download zip) into frontend/public/bundles/<version>/.
# Offline authoring step: downloads the pinned model revision on first run only.
set -euo pipefail
cd "$(dirname "$0")/authoring"
export PYTHONHASHSEED=0 OMP_NUM_THREADS=1 MKL_NUM_THREADS=1 NUMBA_NUM_THREADS=1 TOKENIZERS_PARALLELISM=false
uv sync --frozen --quiet
uv run --frozen python -m swatlas_authoring.build "$@"
