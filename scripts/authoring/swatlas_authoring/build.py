"""Build the versioned swatlas artifact bundle.

Run through scripts/build_bundle.sh, or:
    uv run python -m swatlas_authoring.build [--version 2026-09-24.1]

Outputs frontend/public/bundles/<version>/ (manifest.json + content-hashed files
+ a download zip) and refreshes frontend/public/bundles/index.json.
"""

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import platform
import re
import shutil
import sys
import zipfile
from importlib import metadata

import numpy as np

from . import claims, compute, config
from .sources import Sources, load_sources

VERSION_RE = re.compile(r"^\d{4}-\d{2}-\d{2}\.\d{1,3}$")
PACKAGES = ["sentence-transformers", "transformers", "tokenizers", "torch", "numpy", "scipy", "scikit-learn", "umap-learn", "pynndescent", "numba", "huggingface-hub", "pyyaml"]
PREPARATION_COMMAND = "./scripts/build_bundle.sh"
LIMITATIONS = [
    "Fifteen hand-written descriptions from one blog article; results describe these texts, not the characters or the franchise.",
    f"One general-purpose embedding model ({config.MODEL_ID.split('/')[-1]}). Other models will rank neighbors differently.",
    "Allegiance, role, era, and Force-status fields are draft editorial classifications, not canon and not embedding axes.",
    "The relationship-removed variant changes several phrases at once; a neighbor change cannot be attributed to a single factor.",
    f"2D projections distort distances. Rankings and scores always use the original {config.EMBEDDING_DIMENSIONS}-dimensional vectors.",
    "Floating-point results are reproducible within the pinned environment on CPU; identical bits across hardware are not promised.",
]


def r(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("non-finite value in export")
    return round(float(value), config.FLOAT_DIGITS + 1)


def dump(data) -> bytes:
    return (json.dumps(data, ensure_ascii=False, separators=(",", ":"), sort_keys=False, allow_nan=False) + "\n").encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def safe_cell(value) -> str:
    text = str(value)
    if text and text[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + text
    return text


def to_csv(rows: list[list]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    for row in rows:
        writer.writerow([safe_cell(c) if isinstance(c, str) else c for c in row])
    return buffer.getvalue().encode("utf-8")


def package_versions() -> dict[str, str]:
    return {name: metadata.version(name) for name in PACKAGES}


def execution_settings() -> dict:
    import numba
    import torch

    return {
        "device": "cpu",
        "torch_num_threads": torch.get_num_threads(),
        "torch_deterministic_algorithms": torch.are_deterministic_algorithms_enabled(),
        "numba_threading_layer_config": numba.config.THREADING_LAYER,
        "numba_num_threads": numba.config.NUMBA_NUM_THREADS,
        "umap_n_jobs": config.UMAP_PARAMS["n_jobs"],
        "encode_batch_size": 1,
        "normalize_embeddings_in_model": False,
        "l2_normalized_in_pipeline": True,
        "float_export_decimals": config.FLOAT_DIGITS + 1,
        "python": sys.version.split()[0],
        "platform": platform.platform(),
        "machine": platform.machine(),
        "env": {k: os.environ.get(k) for k in ("OMP_NUM_THREADS", "MKL_NUM_THREADS", "NUMBA_NUM_THREADS", "PYTHONHASHSEED")},
    }


def build_mode(model, src: Sources, mode: str) -> dict:
    ids = src.ids
    texts = src.texts(mode)
    vectors = compute.round_vectors(compute.normalize(compute.embed(model, texts)))
    if vectors.shape != (len(ids), config.EMBEDDING_DIMENSIONS):
        raise ValueError(f"unexpected vector shape {vectors.shape}")
    deviation = compute.check_norms(vectors)
    matrix = compute.cosine_matrix(vectors)
    in_hash = compute.input_hash(ids, texts, config.MODEL_REVISION)

    projections = []
    coords, meta = compute.pca_projection(vectors)
    projections.append(("pca", "pca", None, coords, meta))
    for seed in config.UMAP_SEEDS:
        coords, meta = compute.umap_projection(vectors, seed)
        projections.append((f"umap-{seed}", "umap", seed, coords, meta))

    return {
        "mode": mode,
        "ids": ids,
        "texts": texts,
        "vectors": vectors,
        "matrix": matrix,
        "input_hash": in_hash,
        "norm_max_deviation": deviation,
        "projections": projections,
        "stats": compute.summary_stats(ids, matrix),
        "claims": claims.evaluate(ids, matrix),
    }


def mode_files(result: dict, version: str) -> dict[str, dict]:
    ids = result["ids"]
    base = {"schema_version": config.SCHEMA_VERSION, "version": version, "mode": result["mode"], "input_hash": result["input_hash"], "ids": ids}
    vectors = dict(base)
    vectors.update(
        {
            "model": config.MODEL_ID,
            "model_revision": config.MODEL_REVISION,
            "dimensions": config.EMBEDDING_DIMENSIONS,
            "normalization": "l2",
            "norm_max_deviation": result["norm_max_deviation"],
            "vectors_by_id": {cid: [r(x) for x in result["vectors"][i]] for i, cid in enumerate(ids)},
        }
    )
    similarity = dict(base)
    similarity.update(
        {
            "metric": "cosine",
            "space": f"original-{config.EMBEDDING_DIMENSIONS}d-normalized",
            "matrix": [[r(x) for x in row] for row in result["matrix"]],
            "stats": {k: (r(v) if isinstance(v, float) else v) for k, v in result["stats"].items()},
        }
    )
    projections = dict(base)
    projections["units"] = "none (projection coordinates carry no physical units)"
    projections["projections"] = [
        {
            "id": pid,
            "method": method,
            "dimensions": 2,
            "parameters": meta["parameters"],
            "seed": seed,
            "diagnostics": meta["diagnostics"],
            "coordinates_by_id": {cid: [r(coords[i, 0]), r(coords[i, 1])] for i, cid in enumerate(ids)},
        }
        for pid, method, seed, coords, meta in result["projections"]
    ]
    key = "variant" if result["mode"] == "relationships_removed" else "authored"
    return {f"vectors.{key}": vectors, f"similarity.{key}": similarity, f"projections.{key}": projections}


def characters_file(src: Sources, version: str) -> dict:
    return {
        "schema_version": config.SCHEMA_VERSION,
        "version": version,
        "review_status": src.editorial_meta["review_status"],
        "vocabularies": {k: v for k, v in src.vocabularies.items() if k != "relationship_types"},
        "characters": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "description_variant": c.description_variant,
                "variant_note": c.variant_note,
                "allegiances": c.allegiances,
                "roles": c.roles,
                "eras": c.eras,
                "force_status": c.force_status,
                "classification_note": c.classification_note,
                "source_ref": c.source_ref,
                "article_order": c.article_order,
                "review_status": c.review_status,
            }
            for c in src.characters
        ],
    }


def relationships_file(src: Sources, version: str) -> dict:
    return {
        "schema_version": config.SCHEMA_VERSION,
        "version": version,
        "review_status": src.editorial_meta["review_status"],
        "directed": True,
        "types": src.vocabularies["relationship_types"],
        "relationships": [
            {"from": rel.from_id, "to": rel.to_id, "type": rel.type, "source_ref": rel.source_ref, "note": rel.note} for rel in src.relationships
        ],
    }


def claims_file(results: dict[str, dict], version: str) -> dict:
    authored = results["authored"]["claims"]
    variant = {c["id"]: c for c in results["relationships_removed"]["claims"]}
    return {
        "schema_version": config.SCHEMA_VERSION,
        "version": version,
        "space": f"original-{config.EMBEDDING_DIMENSIONS}d-normalized",
        "note": "Automated checks of the article's narrative claims against the shipped scores.",
        "claims": [
            {
                "id": c["id"],
                "quote": c["quote"],
                "test": c["test"],
                "by_mode": {
                    "authored": {"outcome": c["outcome"], "evidence": c["evidence"]},
                    "relationships_removed": {"outcome": variant[c["id"]]["outcome"], "evidence": variant[c["id"]]["evidence"]},
                },
            }
            for c in authored
        ],
    }


def readme_text(version: str, src: Sources, results: dict) -> str:
    lines = [
        f"# swatlas bundle {version}",
        "",
        "Star Wars semantic atlas: 15 character descriptions from the article",
        f"\"{config.ARTICLE_TITLE}\", embedded with {config.MODEL_ID}",
        f"at revision {config.MODEL_REVISION} ({config.MODEL_LICENSE}).",
        "",
        "## Files",
        "- characters.csv: descriptions (authored + relationships-removed variant) and draft editorial fields.",
        f"- embeddings_<mode>.csv: L2-normalized {config.EMBEDDING_DIMENSIONS}-d vectors, one row per character id.",
        "- similarity_<mode>.csv: original-space cosine matrix (rows/columns in id order).",
        "- projections_<mode>.json: PCA and UMAP (seeds 7/21/42) coordinates with full parameters.",
        "- claims.json: article claims checked against the scores.",
        "- manifest.json: provenance, hashes, package versions, execution settings.",
        "",
        "## Modes",
    ]
    for mode, res in results.items():
        lines.append(f"- {mode}: input_hash {res['input_hash']}")
    lines += [
        "",
        "## Notes",
        "- Cosine scores are computed on the original normalized vectors, never on projected coordinates.",
        "- Editorial fields are drafts, not canon, and not embedding axes.",
        "- CSV cells that begin with = + - @ are prefixed with an apostrophe to neutralize spreadsheet formulas.",
        "",
        "## Limitations",
        *[f"- {item}" for item in LIMITATIONS],
        "",
        f"Reproduce: {PREPARATION_COMMAND} --version {version}",
        "",
    ]
    return "\n".join(lines)


def build_zip(version: str, src: Sources, results: dict, files: dict[str, dict], manifest_core: dict) -> bytes:
    entries: dict[str, bytes] = {}
    header = ["id", "name", "description", "description_variant", "allegiances", "roles", "eras", "force_status", "classification_note", "review_status", "source_ref"]
    rows = [header] + [
        [c.id, c.name, c.description, c.description_variant, "|".join(c.allegiances), "|".join(c.roles), "|".join(c.eras), c.force_status, c.classification_note, c.review_status, c.source_ref]
        for c in src.characters
    ]
    entries["characters.csv"] = to_csv(rows)
    for mode, res in results.items():
        ids = res["ids"]
        entries[f"embeddings_{mode}.csv"] = to_csv([["id", *[f"d{i}" for i in range(config.EMBEDDING_DIMENSIONS)]]] + [[cid, *[r(x) for x in res["vectors"][i]]] for i, cid in enumerate(ids)])
        entries[f"similarity_{mode}.csv"] = to_csv([["id", *ids]] + [[cid, *[r(x) for x in res["matrix"][i]]] for i, cid in enumerate(ids)])
        key = "variant" if mode == "relationships_removed" else "authored"
        entries[f"projections_{mode}.json"] = json.dumps(files[f"projections.{key}"], indent=2, ensure_ascii=False).encode("utf-8")
    entries["claims.json"] = json.dumps(files["claims"], indent=2, ensure_ascii=False).encode("utf-8")
    entries["manifest.json"] = json.dumps(manifest_core, indent=2, ensure_ascii=False).encode("utf-8")
    entries["README.md"] = readme_text(version, src, results).encode("utf-8")

    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name in sorted(entries):
            info = zipfile.ZipInfo(f"swatlas-{version}/{name}", date_time=(1980, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            archive.writestr(info, entries[name])
    return buffer.getvalue()


def write_index(version: str, created_at: str) -> None:
    index_path = config.BUNDLES_DIR / "index.json"
    existing = json.loads(index_path.read_text()) if index_path.exists() else {"versions": []}
    versions = [v for v in existing.get("versions", []) if v["version"] != version and (config.BUNDLES_DIR / v["version"] / "manifest.json").exists()]
    versions.append({"version": version, "created_at": created_at, "manifest": f"{version}/manifest.json"})
    versions.sort(key=lambda v: v["version"])
    index = {"schema_version": config.SCHEMA_VERSION, "artifact_id": config.ARTIFACT_ID, "default_version": version, "versions": versions}
    index_path.write_text(json.dumps(index, indent=2) + "\n")


def build(version: str, created_at: str) -> dict:
    if not VERSION_RE.match(version):
        raise SystemExit(f"invalid version {version!r}; expected YYYY-MM-DD.N")
    src = load_sources()
    model = compute.load_model()
    results = {mode: build_mode(model, src, mode) for mode in config.MODES}
    if results["authored"]["input_hash"] == results["relationships_removed"]["input_hash"]:
        raise ValueError("description modes produced identical input hashes")

    files: dict[str, dict] = {"characters": characters_file(src, version), "relationships": relationships_file(src, version)}
    for res in results.values():
        files.update(mode_files(res, version))
    files["claims"] = claims_file(results, version)

    out_dir = config.BUNDLES_DIR / version
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    file_entries = []
    for name in sorted(files):
        data = dump(files[name])
        digest = sha256(data)
        path = f"{name}.{digest[:12]}.json"
        (out_dir / path).write_bytes(data)
        file_entries.append({"key": name, "path": path, "sha256": digest, "bytes": len(data), "gzip_bytes": len(gzip.compress(data, mtime=0))})

    manifest = {
        "schema_version": config.SCHEMA_VERSION,
        "artifact_id": config.ARTIFACT_ID,
        "version": version,
        "created_at": created_at,
        "review_status": src.editorial_meta["review_status"],
        "editorial": src.editorial_meta,
        "kind": "measured-output",
        "kind_note": "Scores and coordinates are computed by the offline pipeline from the shipped descriptions; editorial fields are hand-authored drafts.",
        "source": {
            **src.article,
            "descriptions_file": "scripts/authoring/sources/article_descriptions.v1.json",
            "descriptions_sha256": src.descriptions_sha256,
            "editorial_file": "scripts/authoring/sources/editorial.v1.yaml",
            "editorial_sha256": src.editorial_sha256,
            "description_edits": "none; authored descriptions are verbatim from the article",
        },
        "license": {
            "descriptions": "Quoted from the author's own article; redistributed here by the same author.",
            "model": config.MODEL_LICENSE,
            "model_reuse_terms": config.MODEL_REUSE_TERMS,
            "portraits": "none included",
        },
        "model": {"id": config.MODEL_ID, "revision": config.MODEL_REVISION, "dimensions": config.EMBEDDING_DIMENSIONS, "pooling": "mean (model default)", "input_prefix": config.INPUT_PREFIX},
        "modes": {
            mode: {
                "label": "Authored descriptions" if mode == "authored" else "Named relationship phrases removed",
                "input_hash": res["input_hash"],
                "norm_max_deviation": res["norm_max_deviation"],
                "files": {kind: f"{kind}.{'variant' if mode == 'relationships_removed' else 'authored'}" for kind in ("vectors", "similarity", "projections")},
            }
            for mode, res in results.items()
        },
        "projections": {
            "ids": ["pca", *[f"umap-{s}" for s in config.UMAP_SEEDS]],
            "umap_parameters": config.UMAP_PARAMS,
            "umap_seeds": list(config.UMAP_SEEDS),
            "note": "Coordinates are exported once and never refit in the browser. A seed alone does not reproduce UMAP; see execution settings and package versions.",
            "reference": "https://umap-learn.readthedocs.io/en/latest/reproducibility.html",
        },
        "computation": {
            "similarity": "cosine on L2-normalized original vectors",
            "neighbor_order": "descending score, ties broken by ascending id, self excluded",
            "graph_rule": "each unordered pair once when score >= threshold",
            "default_threshold": config.DEFAULT_THRESHOLD,
            "numeric_tolerance": config.COSINE_TOLERANCE,
        },
        "counts": {"characters": len(src.characters), "relationships": len(src.relationships), "modes": len(results), "projections_per_mode": 1 + len(config.UMAP_SEEDS), "dimensions": config.EMBEDDING_DIMENSIONS},
        "packages": package_versions(),
        "execution": execution_settings(),
        "preparation_command": f"{PREPARATION_COMMAND} --version {version}",
        "limitations": LIMITATIONS,
        "files": file_entries,
    }

    archive = build_zip(version, src, results, files, manifest)
    archive_digest = sha256(archive)
    archive_name = f"swatlas-{version}.{archive_digest[:12]}.zip"
    (out_dir / archive_name).write_bytes(archive)
    manifest["download"] = {"path": archive_name, "sha256": archive_digest, "bytes": len(archive)}

    total_gzip = sum(f["gzip_bytes"] for f in file_entries) + len(gzip.compress(dump(manifest), mtime=0))
    manifest["bundle_gzip_bytes"] = total_gzip
    if total_gzip > config.MAX_COMPRESSED_BYTES:
        raise ValueError(f"default bundle is {total_gzip} bytes compressed, above {config.MAX_COMPRESSED_BYTES}")

    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    write_index(version, created_at)
    return manifest


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--version", default=config.DEFAULT_VERSION)
    parser.add_argument("--created-at", default=None, help="ISO timestamp; defaults to the version date at 00:00Z so rebuilds are reproducible")
    args = parser.parse_args()
    created_at = args.created_at or f"{args.version.split('.')[0]}T00:00:00Z"
    manifest = build(args.version, created_at)
    print(json.dumps({"version": manifest["version"], "files": [f["path"] for f in manifest["files"]], "download": manifest["download"]["path"], "bundle_gzip_bytes": manifest["bundle_gzip_bytes"], "input_hashes": {m: v["input_hash"] for m, v in manifest["modes"].items()}}, indent=2))


if __name__ == "__main__":
    main()
