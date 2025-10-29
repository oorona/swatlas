import json

import numpy as np
import pytest

from swatlas_authoring import config


@pytest.fixture(scope="session")
def bundle():
    index = json.loads((config.BUNDLES_DIR / "index.json").read_text())
    version_dir = config.BUNDLES_DIR / index["default_version"]
    manifest = json.loads((version_dir / "manifest.json").read_text())
    files = {entry["key"]: json.loads((version_dir / entry["path"]).read_text()) for entry in manifest["files"]}
    return {"index": index, "dir": version_dir, "manifest": manifest, "files": files}


@pytest.fixture(scope="session")
def modes(bundle):
    out = {}
    for mode, meta in bundle["manifest"]["modes"].items():
        vec = bundle["files"][meta["files"]["vectors"]]
        sim = bundle["files"][meta["files"]["similarity"]]
        proj = bundle["files"][meta["files"]["projections"]]
        ids = vec["ids"]
        out[mode] = {
            "ids": ids,
            "vectors": np.array([vec["vectors_by_id"][i] for i in ids], dtype=np.float64),
            "matrix": np.array(sim["matrix"], dtype=np.float64),
            "vec": vec,
            "sim": sim,
            "proj": proj,
        }
    return out
