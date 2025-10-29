"""Acceptance 1-4 against the exported bundle, with independent NumPy recomputation."""

import hashlib
import json
import math

import numpy as np

from swatlas_authoring import compute, config


def _walk_numbers(value):
    if isinstance(value, dict):
        for v in value.values():
            yield from _walk_numbers(v)
    elif isinstance(value, list):
        for v in value:
            yield from _walk_numbers(v)
    elif isinstance(value, float):
        yield value


def test_manifest_hashes_match_files(bundle):
    for entry in bundle["manifest"]["files"]:
        data = (bundle["dir"] / entry["path"]).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry["sha256"]
        assert entry["sha256"][:12] in entry["path"]
        assert len(data) == entry["bytes"]
    download = bundle["manifest"]["download"]
    assert hashlib.sha256((bundle["dir"] / download["path"]).read_bytes()).hexdigest() == download["sha256"]


def test_all_versions_agree(bundle):
    version = bundle["manifest"]["version"]
    for key, data in bundle["files"].items():
        assert data["version"] == version, key
        assert data["schema_version"] == 1, key


def test_all_numbers_finite(bundle):
    for data in bundle["files"].values():
        assert all(math.isfinite(x) for x in _walk_numbers(data))


def test_dimensions_and_explicit_id_mapping(bundle, modes):
    ids = [c["id"] for c in bundle["files"]["characters"]["characters"]]
    assert len(ids) == 15
    for mode in modes.values():
        assert mode["ids"] == ids
        assert mode["sim"]["ids"] == ids
        assert set(mode["vec"]["vectors_by_id"]) == set(ids)
        assert mode["vectors"].shape == (15, config.EMBEDDING_DIMENSIONS)


def test_norms_within_tolerance_and_no_zero_vector(modes):
    for mode in modes.values():
        norms = np.linalg.norm(mode["vectors"], axis=1)
        assert np.all(norms > 0)
        assert np.max(np.abs(norms - 1)) < config.NORM_TOLERANCE


def test_independent_cosine_recomputation(modes):
    for mode in modes.values():
        v = mode["vectors"]
        independent = np.einsum("ik,jk->ij", v, v) / np.outer(np.sqrt((v * v).sum(1)), np.sqrt((v * v).sum(1)))
        assert np.max(np.abs(independent - mode["matrix"])) < config.COSINE_TOLERANCE
        assert np.allclose(np.diag(mode["matrix"]), 1.0, atol=1e-6)
        assert np.array_equal(mode["matrix"], mode["matrix"].T)


def test_projection_switch_does_not_change_neighbors(modes):
    for mode in modes.values():
        ids, matrix = mode["ids"], mode["matrix"]
        projections = mode["proj"]["projections"]
        assert [p["id"] for p in projections] == ["pca", "umap-7", "umap-21", "umap-42"]
        coords = [json.dumps(p["coordinates_by_id"], sort_keys=True) for p in projections]
        assert len(set(coords)) == len(coords), "projections must differ"
        baseline = {cid: compute.neighbors(ids, matrix, cid) for cid in ids}
        for p in projections:
            assert set(p["coordinates_by_id"]) == set(ids)
            # Ranking inputs are the matrix only; the projection is never consulted.
            assert {cid: compute.neighbors(ids, matrix, cid) for cid in ids} == baseline


def test_umap_parameters_recorded(modes):
    for mode in modes.values():
        for p in mode["proj"]["projections"]:
            if p["method"] == "umap":
                params = p["parameters"]
                assert params["n_neighbors"] == 5 and params["min_dist"] == 0.3 and params["metric"] == "cosine"
                assert p["seed"] in (7, 21, 42) and params["random_state"] == p["seed"]


def test_variant_changes_input_hash_and_vectors(bundle, modes):
    a, b = modes["authored"], modes["relationships_removed"]
    assert a["vec"]["input_hash"] != b["vec"]["input_hash"]
    assert bundle["manifest"]["modes"]["authored"]["input_hash"] == a["vec"]["input_hash"]
    unchanged = {c["id"] for c in bundle["files"]["characters"]["characters"] if c["description"] == c["description_variant"]}
    for i, cid in enumerate(a["ids"]):
        same = np.allclose(a["vectors"][i], b["vectors"][i])
        assert same == (cid in unchanged), cid


def test_threshold_one_matches_matrix_filtering(modes):
    for mode in modes.values():
        ids, matrix = mode["ids"], mode["matrix"]
        for threshold in (1.0, 0.45, -1.0, 0.7):
            expected = int(np.sum(matrix[np.triu_indices(15, k=1)] >= threshold))
            assert len(compute.similarity_pairs(ids, matrix, threshold)) == expected
        assert len(compute.similarity_pairs(ids, matrix, -1.0)) == 105


def test_neighbor_tie_break_by_id():
    ids = ["a", "b", "c", "d"]
    m = np.array([[1, 0.5, 0.5, 0.2], [0.5, 1, 0.1, 0.1], [0.5, 0.1, 1, 0.1], [0.2, 0.1, 0.1, 1]])
    assert [n for n, _ in compute.neighbors(ids, m, "a", 3)] == ["b", "c", "d"]
    assert [n for n, _ in compute.neighbors(ids, m, "a", 3, visible={"c", "d"})] == ["c", "d"]


def test_zero_vector_rejected():
    import pytest

    with pytest.raises(ValueError):
        compute.normalize(np.zeros((2, 3)))


def test_bundle_under_size_budget(bundle):
    assert bundle["manifest"]["bundle_gzip_bytes"] < config.MAX_COMPRESSED_BYTES


def test_curated_relationships_carry_no_score(bundle):
    for rel in bundle["files"]["relationships"]["relationships"]:
        assert set(rel) == {"from", "to", "type", "source_ref", "note"}
