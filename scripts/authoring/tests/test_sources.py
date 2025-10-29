"""Acceptance 1: dataset validation."""

import json

import pytest

from swatlas_authoring import config, extract
from swatlas_authoring.sources import load_sources


def test_exactly_fifteen_unique_characters():
    src = load_sources()
    assert len(src.characters) == 15
    assert len(set(src.ids)) == 15
    assert src.ids == sorted(src.ids), "row order must be deterministic (sorted by id)"


def test_both_description_variants_present_and_distinct_where_edited():
    src = load_sources()
    for c in src.characters:
        assert c.description.strip() and c.description_variant.strip()
        assert c.variant_note
    changed = [c.id for c in src.characters if c.description != c.description_variant]
    assert len(changed) >= 12


def test_complete_source_references():
    src = load_sources()
    for c in src.characters:
        assert c.source_ref.startswith("mapping-star-wars-universe#building-character-descriptions:L22-L53")
        assert c.name in c.source_ref
    for rel in src.relationships:
        assert rel.source_ref and '"' in rel.source_ref


def test_editorial_is_marked_draft():
    src = load_sources()
    assert all(c.review_status == "draft" for c in src.characters)


def test_vendored_descriptions_match_article():
    if not config.ARTICLE_PATH.exists():
        pytest.skip("private article checkout not available")
    vendored = json.loads(config.DESCRIPTIONS_FILE.read_text())
    fresh = extract.extract()
    assert fresh == vendored


def test_parse_rejects_missing_block():
    with pytest.raises(ValueError):
        extract.parse_article("no code here")
