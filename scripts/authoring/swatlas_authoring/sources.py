"""Load and validate the reviewed source layer (descriptions + editorial)."""

import hashlib
import json
from dataclasses import dataclass, field

import yaml

from . import config


class SourceError(ValueError):
    pass


@dataclass(frozen=True)
class Character:
    id: str
    name: str
    description: str
    description_variant: str
    variant_note: str
    allegiances: list[str]
    roles: list[str]
    eras: list[str]
    force_status: str
    classification_note: str
    source_ref: str
    article_order: int
    review_status: str


@dataclass(frozen=True)
class Relationship:
    from_id: str
    to_id: str
    type: str
    source_ref: str
    note: str | None


@dataclass
class Sources:
    characters: list[Character]
    relationships: list[Relationship]
    vocabularies: dict[str, list[str]]
    article: dict
    descriptions_sha256: str
    editorial_sha256: str
    editorial_meta: dict = field(default_factory=dict)

    @property
    def ids(self) -> list[str]:
        return [c.id for c in self.characters]

    def texts(self, mode: str) -> list[str]:
        if mode == "authored":
            return [c.description for c in self.characters]
        if mode == "relationships_removed":
            return [c.description_variant for c in self.characters]
        raise SourceError(f"unknown mode {mode!r}")


def _sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _require(condition: bool, message: str) -> None:
    if not condition:
        raise SourceError(message)


def _check_values(values: list[str], vocabulary: list[str], label: str) -> None:
    _require(isinstance(values, list) and len(values) > 0, f"{label}: must be a non-empty list")
    _require(len(set(values)) == len(values), f"{label}: duplicate values")
    unknown = [v for v in values if v not in vocabulary]
    _require(not unknown, f"{label}: values outside vocabulary {unknown}")
    if "unknown" in values or "disputed" in values:
        _require(len(values) == 1, f"{label}: 'unknown'/'disputed' must be the only value")


def load_sources() -> Sources:
    descriptions = json.loads(config.DESCRIPTIONS_FILE.read_text(encoding="utf-8"))
    editorial = yaml.safe_load(config.EDITORIAL_FILE.read_text(encoding="utf-8"))
    vocab = editorial["vocabularies"]
    article = descriptions["source"]
    line_ref = f"L{article['line_start']}-L{article['line_end']}"

    rows = descriptions["characters"]
    _require(len(rows) == config.EXPECTED_CHARACTER_COUNT, f"expected {config.EXPECTED_CHARACTER_COUNT} characters, found {len(rows)}")
    ids = [r["id"] for r in rows]
    _require(len(set(ids)) == len(ids), "duplicate character ids")
    _require(set(ids) == set(editorial["characters"]), "editorial ids do not match description ids")

    characters: list[Character] = []
    # Deterministic row order: sorted by stable id, independent of dict order.
    for row in sorted(rows, key=lambda r: r["id"]):
        cid = row["id"]
        ed = editorial["characters"][cid]
        _require(bool(row["description"].strip()), f"{cid}: empty description")
        variant = ed.get("description_variant", "")
        _require(isinstance(variant, str) and variant.strip() != "", f"{cid}: missing description_variant")
        _require(bool(ed.get("variant_note")), f"{cid}: missing variant_note")
        _check_values(ed["allegiances"], vocab["allegiances"], f"{cid}.allegiances")
        _check_values(ed["roles"], vocab["roles"], f"{cid}.roles")
        _check_values(ed["eras"], vocab["eras"], f"{cid}.eras")
        _require(ed["force_status"] in vocab["force_status"], f"{cid}: invalid force_status")
        _require(bool(ed.get("classification_note")), f"{cid}: missing classification_note")
        characters.append(
            Character(
                id=cid,
                name=row["name"],
                description=row["description"],
                description_variant=variant,
                variant_note=ed["variant_note"],
                allegiances=list(ed["allegiances"]),
                roles=list(ed["roles"]),
                eras=list(ed["eras"]),
                force_status=ed["force_status"],
                classification_note=ed["classification_note"],
                source_ref=f"{article['article_slug']}#{article['section'].lower().replace(' ', '-')}:{line_ref}[{row['name']!r}]",
                article_order=row["article_order"],
                review_status=editorial["review_status"],
            )
        )

    by_id = {c.id: c for c in characters}
    relationships: list[Relationship] = []
    seen: set[tuple[str, str, str]] = set()
    for rel in editorial["relationships"]:
        key = (rel["from"], rel["to"], rel["type"])
        _require(rel["from"] in by_id and rel["to"] in by_id, f"relationship {key}: unknown id")
        _require(rel["from"] != rel["to"], f"relationship {key}: self edge")
        _require(rel["type"] in vocab["relationship_types"], f"relationship {key}: invalid type")
        _require(key not in seen, f"relationship {key}: duplicate")
        source_char = by_id.get(rel["in"])
        _require(source_char is not None, f"relationship {key}: unknown source character")
        _require(rel["quote"] in source_char.description, f"relationship {key}: quote not found in {rel['in']} description")
        seen.add(key)
        relationships.append(
            Relationship(
                from_id=rel["from"],
                to_id=rel["to"],
                type=rel["type"],
                source_ref=f"{characters[0].source_ref.split('[')[0]}[{source_char.name!r}] \"{rel['quote']}\"",
                note=rel.get("note"),
            )
        )
    relationships.sort(key=lambda r: (r.from_id, r.to_id, r.type))

    return Sources(
        characters=characters,
        relationships=relationships,
        vocabularies=vocab,
        article=article,
        descriptions_sha256=_sha256(config.DESCRIPTIONS_FILE),
        editorial_sha256=_sha256(config.EDITORIAL_FILE),
        editorial_meta={k: editorial[k] for k in ("version", "review_status", "drafted_by")},
    )
