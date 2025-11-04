"""Check the article's narrative claims against the recomputed original-space scores.

Each claim quotes the article, states a concrete test on the cosine matrix,
and reports supported / partial / contradicted with the numbers used. Claims
about projected 2D layout are tested in original space, and that substitution
is stated in the test text.
"""

import numpy as np

from .compute import neighbors

JEDI_CORE = ["mace-windu", "obi-wan-kenobi", "yoda"]
NON_FORCE = ["boba-fett", "chewbacca", "din-djarin", "han-solo"]
# Groups the article's averages use: the four Jedi named as such plus the three Sith.
JEDI = ["luke-skywalker", "mace-windu", "obi-wan-kenobi", "yoda"]
SITH = ["count-dooku", "darth-vader", "emperor-palpatine"]
# The five descriptions that contain the word "Master".
MASTERS = ["count-dooku", "emperor-palpatine", "mace-windu", "obi-wan-kenobi", "yoda"]
NEW_GENERATION = ["kylo-ren", "luke-skywalker", "rey"]
# "No split": both within-minus-between gaps are under half the standard
# deviation of all pair scores, which keeps the test scale-free across models.
NO_SPLIT_SD_FRACTION = 0.5


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
    expected = ["rey", "darth-vader", "obi-wan-kenobi"]
    add(
        "luke-top3",
        "Luke's nearest neighbors are Rey (0.878), Darth Vader, and Obi-Wan.",
        "Luke's top 3 original-space neighbors are Rey, Darth Vader, and Obi-Wan, in that order.",
        "supported" if top3 == expected else ("partial" if set(top3) & set(expected) else "contradicted"),
        {"top3": top3, "expected": expected, "rank_of_leia": _top(ids, matrix, "luke-skywalker", None).index("leia-organa") + 1},
    )

    top2 = _top(ids, matrix, "darth-vader", 2)
    expected = ["emperor-palpatine", "count-dooku"]
    add(
        "vader-palpatine-dooku",
        "Vader's nearest is Palpatine (0.874), with Dooku right behind.",
        "Vader's top 2 original-space neighbors are Palpatine, then Dooku.",
        "supported" if top2 == expected else ("partial" if top2[0] == expected[0] or expected[1] in top2 else "contradicted"),
        {"top2": top2, "rank_of_kylo": _top(ids, matrix, "darth-vader", None).index("kylo-ren") + 1},
    )

    pairs = [(float(matrix[i, j]), ids[i], ids[j]) for i in range(len(ids)) for j in range(i + 1, len(ids))]
    best = max(pairs)
    add(
        "hunters-strongest",
        "The strongest pair in the whole set is Boba Fett and Din Djarin at 0.940.",
        "The highest off-diagonal cosine in the matrix is Boba Fett and Din Djarin.",
        "supported" if {best[1], best[2]} == {"boba-fett", "din-djarin"} else "contradicted",
        {"best_pair": [best[1], best[2]], "score": best[0], "boba_din": _score(ids, matrix, "boba-fett", "din-djarin")},
    )

    force_users = [i for i in ids if i not in NON_FORCE]
    within_non = _mean_within(ids, matrix, NON_FORCE)
    within_force = _mean_within(ids, matrix, force_users)
    between = _mean_between(ids, matrix, NON_FORCE, force_users)
    add(
        "force-axis",
        "The Force split is real but modest.",
        "Mean cosine within the four characters without the Force and within the other 11 both exceed the mean cosine between the groups.",
        "supported" if within_non > between and within_force > between else ("partial" if (within_non > between or within_force > between) else "contradicted"),
        {"within_non_force": within_non, "within_force": within_force, "between": between},
    )

    jj = _mean_within(ids, matrix, JEDI)
    ss = _mean_within(ids, matrix, SITH)
    js = _mean_between(ids, matrix, JEDI, SITH)
    gaps = [jj - js, ss - js]
    margin = NO_SPLIT_SD_FRACTION * float(np.std(matrix[np.triu_indices(len(ids), k=1)]))
    add(
        "no-light-dark-split",
        "Jedi and Sith don't split.",
        "Both within-group means (Jedi: Luke, Yoda, Obi-Wan, Mace; Sith: Vader, Palpatine, Dooku) exceed the Jedi to Sith mean by less than half the standard deviation of all pair scores.",
        "supported" if max(gaps) < margin else ("partial" if min(gaps) < margin else "contradicted"),
        {"jedi_within": jj, "sith_within": ss, "jedi_to_sith": js, "margin": margin},
    )

    masters_top1 = {m: _top(ids, matrix, m, 1)[0] for m in MASTERS}
    hits = sum(n in MASTERS for n in masters_top1.values())
    add(
        "masters-neighborhood",
        "Yoda, Obi-Wan, Mace Windu, Palpatine, and Dooku form their own neighborhood on every map.",
        "Each of the five 'Master' characters has another of the five as its nearest original-space neighbor (5 checks). Tested in original space, not the 2D projection.",
        _overlap_outcome(hits, 5),
        {"checks_passed": hits, "checks_total": 5, "top1": masters_top1, "masters_within": _mean_within(ids, matrix, MASTERS), "masters_to_rest": _mean_between(ids, matrix, MASTERS, [i for i in ids if i not in MASTERS])},
    )

    tight = sum(
        other in _top(ids, matrix, member, 3) for member in JEDI_CORE for other in JEDI_CORE if other != member
    )
    add(
        "jedi-core-tight",
        "Yoda, Obi-Wan, and Mace each have the other two in their top three.",
        "For each of Yoda, Obi-Wan, and Mace Windu, the other two are in its top 3 (6 checks).",
        _overlap_outcome(tight, 6),
        {"checks_passed": tight, "checks_total": 6, "top3": {m: _top(ids, matrix, m, 3) for m in JEDI_CORE}},
    )

    pal_dooku = "count-dooku" in _top(ids, matrix, "emperor-palpatine", 2)
    dooku_pal = "emperor-palpatine" in _top(ids, matrix, "count-dooku", 2)
    add(
        "sith-pocket",
        "Palpatine and Dooku are in each other's top two.",
        "Dooku is in Palpatine's top 2 and Palpatine is in Dooku's top 2.",
        "supported" if pal_dooku and dooku_pal else ("partial" if pal_dooku or dooku_pal else "contradicted"),
        {"palpatine_top2": _top(ids, matrix, "emperor-palpatine", 2), "dooku_top2": _top(ids, matrix, "count-dooku", 2), "score": _score(ids, matrix, "emperor-palpatine", "count-dooku")},
    )

    ahsoka1 = _top(ids, matrix, "ahsoka-tano", 1)[0]
    dooku2 = _top(ids, matrix, "count-dooku", 2)
    ok = [ahsoka1 == "count-dooku", "ahsoka-tano" in dooku2]
    add(
        "former-jedi",
        "Ahsoka's nearest neighbor is Count Dooku (0.876), and he returns the favor with her in second place.",
        "Dooku is Ahsoka's nearest neighbor and Ahsoka is in Dooku's top 2.",
        _overlap_outcome(sum(ok), 2),
        {"ahsoka_top1": ahsoka1, "dooku_top2": dooku2, "score": _score(ids, matrix, "ahsoka-tano", "count-dooku")},
    )

    trio = {m: _top(ids, matrix, m, 3) for m in NEW_GENERATION}
    hits = sum(any(o in trio[m] for o in NEW_GENERATION if o != m) for m in NEW_GENERATION)
    add(
        "new-generation",
        "Luke, Rey, and Kylo Ren sit together in every projection.",
        "Each of Luke, Rey, and Kylo Ren has at least one of the other two in its top 3 (3 checks). Tested in original space, not the 2D projection.",
        _overlap_outcome(hits, 3),
        {"checks_passed": hits, "checks_total": 3, "top3": trio},
    )

    han4 = _top(ids, matrix, "han-solo", 4)
    expected = ["din-djarin", "chewbacca", "leia-organa", "boba-fett"]
    add(
        "han-gray-zone",
        "Han's nearest neighbors are Din Djarin, Chewbacca, Leia, and Boba Fett, in that order.",
        "Han's top 4 original-space neighbors are exactly Din Djarin, Chewbacca, Leia, and Boba Fett, in that order.",
        "supported" if han4 == expected else ("partial" if set(han4) & set(expected) else "contradicted"),
        {"han_top4": han4, "expected": expected},
    )

    hunters = _score(ids, matrix, "boba-fett", "din-djarin")
    cross = max(_score(ids, matrix, a, b) for a in ("boba-fett", "din-djarin") for b in ids if b not in ("boba-fett", "din-djarin"))
    add(
        "hunters-closer",
        "The bounty hunters are still closer to each other (0.940) than to anyone else.",
        "cos(Boba, Din) exceeds every cosine between either of them and any other character.",
        "supported" if hunters > cross else "contradicted",
        {"boba_din": hunters, "max_other": cross},
    )

    leia1 = _top(ids, matrix, "leia-organa", 1)[0]
    leia_jedi = _mean_between(ids, matrix, ["leia-organa"], JEDI)
    overall = float(np.mean(matrix[np.triu_indices(len(ids), k=1)]))
    ok = [leia1 == "han-solo", leia_jedi < overall]
    add(
        "leia-gray-zone",
        "She's Force sensitive on paper but averages only 0.824 with the Jedi, and her closest match is Han.",
        "Han is Leia's nearest neighbor, and Leia's mean cosine to the Jedi (Luke, Yoda, Obi-Wan, Mace) is below the all-pairs mean.",
        _overlap_outcome(sum(ok), 2),
        {"leia_top1": leia1, "leia_to_jedi": leia_jedi, "all_pairs_mean": overall},
    )

    vader1 = _top(ids, matrix, "darth-vader", 1)[0]
    ok = [ss - js > 0.02, vader1 == "emperor-palpatine"]
    add(
        "sith-without-family",
        "The Sith pull together once the family ties are gone.",
        "Sith within-group mean exceeds the Jedi to Sith mean by more than 0.02, and Palpatine is Vader's nearest neighbor. The article makes this claim about the relationships-removed descriptions; the authored column is the baseline.",
        _overlap_outcome(sum(ok), 2),
        {"sith_within": ss, "jedi_to_sith": js, "vader_top1": vader1},
    )

    return results
