"""Extract the 15 character descriptions from the article's Python block.

Run: uv run python -m swatlas_authoring.extract
Writes sources/article_descriptions.v1.json. The vendored file lets a fresh
checkout rebuild the bundle without access to the private article repository.
"""

import ast
import hashlib
import json
import re

from . import config

NAME_TO_ID = {
    "Luke Skywalker": "luke-skywalker",
    "Darth Vader": "darth-vader",
    "Han Solo": "han-solo",
    "Leia Organa": "leia-organa",
    "Emperor Palpatine": "emperor-palpatine",
    "Yoda": "yoda",
    "Obi-Wan Kenobi": "obi-wan-kenobi",
    "Boba Fett": "boba-fett",
    "Ahsoka Tano": "ahsoka-tano",
    "Din Djarin": "din-djarin",
    "Kylo Ren": "kylo-ren",
    "Rey": "rey",
    "Mace Windu": "mace-windu",
    "Count Dooku": "count-dooku",
    "Chewbacca": "chewbacca",
}

BLOCK_RE = re.compile(r"characters = (\{.*?\n\})", re.DOTALL)


def parse_article(text: str) -> tuple[dict[str, str], int, int]:
    match = BLOCK_RE.search(text)
    if match is None:
        raise ValueError("characters block not found in article")
    parsed = ast.literal_eval(match.group(1))
    if not isinstance(parsed, dict) or not all(isinstance(v, str) for v in parsed.values()):
        raise ValueError("characters block is not a dict of strings")
    start_line = text.count("\n", 0, match.start()) + 1
    end_line = text.count("\n", 0, match.end()) + 1
    return parsed, start_line, end_line


def extract() -> dict:
    raw = config.ARTICLE_PATH.read_bytes()
    text = raw.decode("utf-8")
    parsed, start, end = parse_article(text)
    if set(parsed) != set(NAME_TO_ID):
        raise ValueError(f"unexpected character names: {sorted(set(parsed) ^ set(NAME_TO_ID))}")
    return {
        "source": {
            "article_slug": config.ARTICLE_SLUG,
            "article_title": config.ARTICLE_TITLE,
            "article_path": f"latent/data/articles/{config.ARTICLE_SLUG}/article.md",
            "article_sha256": hashlib.sha256(raw).hexdigest(),
            "section": config.ARTICLE_SECTION,
            "block": "characters = {...}",
            "line_start": start,
            "line_end": end,
        },
        "characters": [
            {"id": NAME_TO_ID[name], "name": name, "description": description, "article_order": index}
            for index, (name, description) in enumerate(parsed.items())
        ],
    }


def main() -> None:
    data = extract()
    config.DESCRIPTIONS_FILE.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {config.DESCRIPTIONS_FILE} ({len(data['characters'])} characters)")


if __name__ == "__main__":
    main()
