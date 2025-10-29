"""Embedding, cosine, neighbor, graph, and projection math.

Rankings always come from the original normalized vectors; projections are
display coordinates only and never feed back into a ranking.
"""

import hashlib
import json
import warnings

import numpy as np

from . import config


def input_hash(ids: list[str], texts: list[str], model_revision: str) -> str:
    payload = json.dumps(
        {"ids": ids, "texts": texts, "model": config.MODEL_ID, "revision": model_revision},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def load_model():
    import torch
    from sentence_transformers import SentenceTransformer

    torch.set_num_threads(1)
    torch.use_deterministic_algorithms(True)
    return SentenceTransformer(config.MODEL_ID, revision=config.MODEL_REVISION, device="cpu")


def embed(model, texts: list[str]) -> np.ndarray:
    # One text per forward pass: padding inside a mixed-length batch perturbs the
    # float output, which would make a vector depend on its batch neighbors.
    rows = [
        model.encode([text], batch_size=1, convert_to_numpy=True, normalize_embeddings=False, show_progress_bar=False)[0]
        for text in texts
    ]
    return np.asarray(rows, dtype=np.float64)


def normalize(vectors: np.ndarray) -> np.ndarray:
    if not np.all(np.isfinite(vectors)):
        raise ValueError("non-finite embedding value")
    norms = np.linalg.norm(vectors, axis=1)
    if np.any(norms == 0):
        raise ValueError("zero vector is prohibited")
    return vectors / norms[:, None]


def round_vectors(vectors: np.ndarray) -> np.ndarray:
    return np.round(vectors, config.FLOAT_DIGITS + 1)


def check_norms(vectors: np.ndarray) -> float:
    deviation = float(np.max(np.abs(np.linalg.norm(vectors, axis=1) - 1.0)))
    if deviation > config.NORM_TOLERANCE:
        raise ValueError(f"norm deviation {deviation} exceeds tolerance")
    return deviation


def cosine_matrix(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1)
    sims = (vectors @ vectors.T) / np.outer(norms, norms)
    sims = (sims + sims.T) / 2.0
    return np.clip(sims, -1.0, 1.0)


def neighbors(ids: list[str], matrix: np.ndarray, subject: str, k: int | None = 5, visible: set[str] | None = None) -> list[tuple[str, float]]:
    """Nearest other characters: self excluded, ties broken by stable id."""
    i = ids.index(subject)
    ranked = [
        (other, float(matrix[i, j]))
        for j, other in enumerate(ids)
        if other != subject and (visible is None or other in visible)
    ]
    ranked.sort(key=lambda item: (-item[1], item[0]))
    return ranked if k is None else ranked[:k]


def similarity_pairs(ids: list[str], matrix: np.ndarray, threshold: float) -> list[tuple[str, str, float]]:
    """Each unordered pair once, where score >= threshold."""
    pairs = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            if matrix[i, j] >= threshold:
                pairs.append((ids[i], ids[j], float(matrix[i, j])))
    return pairs


def pca_projection(vectors: np.ndarray) -> tuple[np.ndarray, dict]:
    from sklearn.decomposition import PCA

    pca = PCA(n_components=2, svd_solver="full")
    coords = pca.fit_transform(vectors)
    # Deterministic sign: the largest-magnitude loading of each component is positive.
    for axis in range(2):
        component = pca.components_[axis]
        if component[np.argmax(np.abs(component))] < 0:
            coords[:, axis] *= -1
    params = {"n_components": 2, "svd_solver": "full", "centered": True, "sign_convention": "largest |loading| positive"}
    diagnostics = {"explained_variance_ratio": [float(v) for v in pca.explained_variance_ratio_]}
    return coords, {"parameters": params, "diagnostics": diagnostics}


def umap_projection(vectors: np.ndarray, seed: int) -> tuple[np.ndarray, dict]:
    import umap

    reducer = umap.UMAP(random_state=seed, **config.UMAP_PARAMS)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        coords = reducer.fit_transform(vectors)
    params = dict(config.UMAP_PARAMS)
    params.update(
        {
            "random_state": seed,
            "init": reducer.init,
            "n_epochs": reducer.n_epochs,
            "learning_rate": reducer.learning_rate,
            "spread": reducer.spread,
            "negative_sample_rate": reducer.negative_sample_rate,
            "transform_seed": reducer.transform_seed,
            "low_memory": reducer.low_memory,
        }
    )
    messages = sorted({str(w.message).splitlines()[0][:200] for w in caught})
    return np.asarray(coords, dtype=np.float64), {"parameters": params, "diagnostics": {"warnings": messages}}


def summary_stats(ids: list[str], matrix: np.ndarray) -> dict:
    upper = matrix[np.triu_indices(len(ids), k=1)]
    return {
        "pair_count": int(upper.size),
        "min": float(upper.min()),
        "max": float(upper.max()),
        "median": float(np.median(upper)),
        "mean": float(upper.mean()),
        "pairs_at_default_threshold": int(np.sum(upper >= config.DEFAULT_THRESHOLD)),
    }
