"""Check the article's narrative claims against the recomputed original-space scores.

Each claim quotes the article, states a concrete test on the cosine matrix,
and reports supported / partial / contradicted with the numbers used. Claims
about projected 2D layout are tested in original space, and that substitution
is stated in the test text.
"""

import numpy as np

from .compute import neighbors

JEDI_CORE = ["mace-windu", "obi-wan-kenobi", "yoda"]
ARTICLE_NON_FORCE = ["boba-fett", "chewbacca", "din-djarin", "han-solo"]
ARTICLE_JEDI = ["luke-skywalker", "mace-windu", "obi-wan-kenobi", "rey", "yoda"]


def _score(ids, matrix, a, b) -> float:
    return float(matrix[ids.index(a), ids.index(b)])


def _mean_between(ids, matrix, group_a, group_b) -> float:
    values = [_score(ids, matrix, a, b) for a in group_a for b in group_b if a != b]
    return float(np.mean(values))


def _mean_within(ids, matrix, group) -> float:
    values = [_score(ids, matrix, a, b) for i, a in enumerate(group) for b in group[i + 1 :]]
    return float(np.mean(values))


def _overlap_outcome(found: int, needed: int) -> str:
    if found == needed:
        return "supported"
    return "partial" if found > 0 else "contradicted"


def _top(ids, matrix, subject, k):
    return [n for n, _ in neighbors(ids, matrix, subject, k)]


def evaluate(ids: list[str], matrix: np.ndarray) -> list[dict]:
    results = []

    def add(claim_id, quote, test, outcome, evidence):
        results.append({"id": claim_id, "quote": quote, "test": test, "outcome": outcome, "evidence": evidence})

    top3 = _top(ids, matrix, "luke-skywalker", 3)
    expected = ["obi-wan-kenobi", "yoda", "leia-organa"]
    add(
        "luke-top3",
        "Luke's nearest neighbors will be Obi-Wan, Yoda, and Leia.",
        "Luke's top 3 original-space neighbors equal {Obi-Wan, Yoda, Leia}.",
        _overlap_outcome(len(set(top3) & set(expected)), 3),
        {"top3": top3, "expected": expected, "rank_of_leia": _top(ids, matrix, "luke-skywalker", None).index("leia-organa") + 1},
    )

    top2 = _top(ids, matrix, "darth-vader", 2)
    expected = ["emperor-palpatine", "kylo-ren"]
    full = _top(ids, matrix, "darth-vader", None)
    add(
        "vader-palpatine-kylo",
        "Darth Vader sits next to Palpatine and Kylo Ren.",
        "Vader's top 2 original-space neighbors are Palpatine and Kylo Ren.",
        _overlap_outcome(len(set(top2) & set(expected)), 2),
        {"top2": top2, "rank_of_palpatine": full.index("emperor-palpatine") + 1, "rank_of_kylo": full.index("kylo-ren") + 1},
    )

    han1 = _top(ids, matrix, "han-solo", 1)[0]
    chewie1 = _top(ids, matrix, "chewbacca", 1)[0]
    add(
        "han-chewie-pair",
        "Han and Chewbacca pair up.",
        "Han and Chewbacca are each other's nearest neighbor.",
        "supported" if (han1 == "chewbacca" and chewie1 == "han-solo") else ("partial" if "chewbacca" == han1 or chewie1 == "han-solo" else "contradicted"),
        {"han_top1": han1, "chewbacca_top1": chewie1, "score": _score(ids, matrix, "han-solo", "chewbacca")},
    )

    han4 = _top(ids, matrix, "han-solo", 4)
    chewie4 = _top(ids, matrix, "chewbacca", 4)
    hits = sum(x in lst for lst in (han4, chewie4) for x in ("boba-fett", "din-djarin"))
    add(
        "rebels-near-hunters",
        "Han and Chewbacca pair up, near Boba Fett and Din Djarin.",
        "Boba Fett and Din Djarin appear in both Han's and Chewbacca's top 4.",
        _overlap_outcome(hits, 4),
        {"han_top4": han4, "chewbacca_top4": chewie4},
    )

    hunters = _score(ids, matrix, "boba-fett", "din-djarin")
    cross = max(_score(ids, matrix, a, b) for a in ("boba-fett", "din-djarin") for b in ("han-solo", "chewbacca"))
    add(
        "hunters-closer",
        "The bounty hunters (Boba and Din) are closer to each other than to the Rebellion-aligned characters (Han and Chewie).",
        "cos(Boba, Din) exceeds every cosine between {Boba, Din} and {Han, Chewbacca}.",
        "supported" if hunters > cross else "contradicted",
        {"boba_din": hunters, "max_cross": cross},
    )

    tight = sum(
        other in _top(ids, matrix, member, 3) for member in JEDI_CORE for other in JEDI_CORE if other != member
    )
    add(
        "jedi-core-tight",
        "Yoda, Obi-Wan, and Mace Windu cluster tight.",
        "For each of Yoda, Obi-Wan, and Mace Windu, the other two are in its top 3 (6 checks). Tested in original space, not the 2D projection.",
        _overlap_outcome(tight, 6),
        {"checks_passed": tight, "checks_total": 6, "top3": {m: _top(ids, matrix, m, 3) for m in JEDI_CORE}},
    )

    pal_dooku = "count-dooku" in _top(ids, matrix, "emperor-palpatine", 2)
    dooku_pal = "emperor-palpatine" in _top(ids, matrix, "count-dooku", 2)
    add(
        "sith-pocket",
        "Palpatine and Dooku form their own pocket.",
        "Dooku is in Palpatine's top 2 and Palpatine is in Dooku's top 2. Tested in original space.",
        "supported" if pal_dooku and dooku_pal else ("partial" if pal_dooku or dooku_pal else "contradicted"),
        {"palpatine_top2": _top(ids, matrix, "emperor-palpatine", 2), "dooku_top2": _top(ids, matrix, "count-dooku", 2), "score": _score(ids, matrix, "emperor-palpatine", "count-dooku")},
    )

    force_users = [i for i in ids if i not in ARTICLE_NON_FORCE]
    within_non = _mean_within(ids, matrix, ARTICLE_NON_FORCE)
    within_force = _mean_within(ids, matrix, force_users)
    between = _mean_between(ids, matrix, ARTICLE_NON_FORCE, force_users)
    separated = within_non > between and within_force > between
    add(
        "force-axis",
        "Force-sensitive characters (Jedi and Sith) sit in one region. Non-Force users (Han, Chewie, Boba Fett, Din Djarin) sit in another.",
        "Mean cosine within the article's non-Force group and within the other 11 both exceed the mean cosine between the groups. Whether it is the 'strongest axis' is not tested.",
        "supported" if separated else ("partial" if (within_non > between or within_force > between) else "contradicted"),
        {"within_non_force": within_non, "within_force": within_force, "between": between},
    )

    dooku_light = _mean_between(ids, matrix, ["count-dooku"], ARTICLE_JEDI)
    pal_light = _mean_between(ids, matrix, ["emperor-palpatine"], ARTICLE_JEDI)
    add(
        "dooku-light",
        "Count Dooku, described as 'formerly a Jedi Master,' pulls slightly toward the light side compared to pure Sith like Palpatine.",
        "Dooku's mean cosine to the article's Jedi group (Luke, Yoda, Obi-Wan, Mace, Rey) exceeds Palpatine's.",
        "supported" if dooku_light > pal_light else "contradicted",
        {"dooku_mean_to_jedi": dooku_light, "palpatine_mean_to_jedi": pal_light},
    )

    ahsoka_core = _mean_between(ids, matrix, ["ahsoka-tano"], JEDI_CORE)
    core_core = _mean_within(ids, matrix, JEDI_CORE)
    add(
        "ahsoka-off-core",
        "Ahsoka, who left the Jedi Order, sits slightly off the core Jedi cluster.",
        "Ahsoka's mean cosine to Yoda, Obi-Wan, and Mace is lower than their mean cosine to each other.",
        "supported" if ahsoka_core < core_core else "contradicted",
        {"ahsoka_to_core": ahsoka_core, "core_within": core_core},
    )

    return results
