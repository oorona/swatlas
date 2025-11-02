# swatlas handoff: bundle 2026-09-24.1

This document is the implementation handoff for [SPECIFICATION.md](../SPECIFICATION.md), built to [architecture.md](../architecture.md). Nothing has been deployed.

## Resolved stack

| Layer | Resolution |
|---|---|
| Frontend | Next.js 16.3.6 App Router, React 19.3, TypeScript strict (ES2017), Tailwind 4.3.3, next-intl 4.14.7 (en/es, `as-needed` prefix, no locale cookie), Zustand 5 for linked-view state, zod 4 (jitless) for bundle validation |
| Visualization | SVG map/graph/heatmap plus semantic HTML tables; no canvas, no force layout |
| Backend / DB / Redis / LLM | None. Trust boundaries present: B1 and authoring→bundle only |
| Authoring | uv project, Python 3.13, sentence-transformers 6.1.0, torch 2.14.0+cpu, numpy 2.5.3, scikit-learn 1.9.1, umap-learn 0.5.12 (exact lock in `scripts/authoring/uv.lock`) |
| Container | `swatlas-frontend`, node:24-alpine (digest-pinned), standalone output, non-root, read-only root, cap_drop ALL, no-new-privileges, pids 200, 512 MiB, tmpfs `/tmp` + `/app/.next/cache`, networks `internet` + `intranet` (external), Traefik on `${PROJECT_HOST}`, no published ports |

## Artifact generation

```bash
./scripts/build_bundle.sh                # = --version 2026-09-24.1
./scripts/build_bundle.sh --version 2026-10-01.1   # new version; old versions stay published
```

The command runs `uv sync --frozen` and pins threads (`OMP/MKL/NUMBA_NUM_THREADS=1`, `PYTHONHASHSEED=0`). It then validates the sources, encodes each description separately on CPU, L2-normalizes and checks the vectors, and computes the cosine matrices, PCA, and UMAP (seeds 7/21/42). After that it evaluates the article claims and writes content-hashed files, `manifest.json`, a deterministic zip, and `bundles/index.json`. The build fails if any check fails or if the bundle exceeds 500 KiB gzipped.

It was rebuilt three times on this machine with byte-identical file hashes.

To re-extract the descriptions from the article (they are already vendored): `cd scripts/authoring && uv run python -m swatlas_authoring.extract`.

## Exact model revision

- Model: `sentence-transformers/all-MiniLM-L6-v2`
- Revision: `1110a243fdf4706b3f48f1d95db1a4f5529b4d41`, resolved from the Hugging Face API on 2026-09-24 (repo lastModified 2026-06-01).
- License: Apache-2.0. Derived embeddings are redistributed with attribution; the weights are not redistributed.
- The model downloads only during authoring. The runtime image contains no model and makes no provider calls.

## Source and bundle hashes (sha256)

| Item | Hash |
|---|---|
| Article `latent/data/articles/mapping-star-wars-universe/article.md` (block L22–L53) | `9c3e98a713ea5d83f8da40a34f948428411918fc61750304748d6f61d40dd0a4` |
| `scripts/authoring/sources/article_descriptions.v1.json` | `12f18144c41c94c4912f35d6df960bfedc7b744f171003151ac385102031fb4b` |
| `scripts/authoring/sources/editorial.v1.yaml` (draft) | `88089cbd51e583d22d953c9bf65ab339dae3ce3d10c7b9adf13ecdd51b71f164` |
| Input hash, authored mode | `80fc55a1b1df00042ced75af409e22dfba02a5ded208363669a88be3d75dd3e5` |
| Input hash, relationships-removed mode | `d592f078e6f82e56eac3c95c2c7bdd4b31b8932aa5b848c2046d00ed61c40434` |
| Download `swatlas-2026-09-24.1.71814ebe4f66.zip` (75,870 B) | `71814ebe4f66116a3ccf53ca078731262f524443bb949f9704f34814426a6f31` |

The per-file hashes are in `frontend/public/bundles/2026-09-24.1/manifest.json`. The whole bundle is 73,254 bytes gzipped against a 500 KiB budget. The explorer loads only characters, relationships, similarity, and projections, about 9 KiB gzipped. The vectors ship in the bundle and the zip.

## Test results (2026-09-24)

`./test.sh all`:

| Suite | Result | Covers |
|---|---|---|
| pytest (`scripts/authoring/tests`) | 20 passed | Acceptance 1 (15 ids, unique, both variants, source refs, draft marking, vendored text = article). Acceptance 2 (independent `einsum` recomputation within 1e-6, symmetric matrix, unit diagonal, norms within 1e-5, no zero vector, all values finite). Acceptance 3 (projections differ but neighbors are identical; variant changes the input hash and exactly the edited vectors). Acceptance 4 (the pair count at thresholds 1 / 0.45 / 0.7 / −1 equals matrix filtering). Also: manifest hashes, size budget, tie-breaking, curated edges carry no score. |
| Vitest | 22 passed | Neighbor/graph/filter math against the shipped bundle, URL allowlist and round-trip, oversized and unknown-id handling, CSV formula neutralization, safe filenames, pure SHA-256 = SubtleCrypto, tampered-file checksum rejection, listbox and grid keyboard behavior, escaping of hostile imported text |
| Playwright + axe | 37 passed | Acceptance 3, 5, 6, 7. Default state; the rankings shown equal the bundle matrix; PCA→UMAP keeps neighbors; view switches keep the selection; threshold 1 → 0 edges (matrix-derived); variant hash and diff; filters; URL reload reproduces every field; copy and reset; unknown id and unknown version recoverable; malformed fields explained; keyboard-only flow; table equivalents; zero external requests with all cross-origin requests aborted; axe WCAG 2.1 AA and no horizontal scroll at 390px on 9 page states; security headers and nonce CSP; robots, sitemap, llms.txt, health, cache headers; OG image |
| backend | not applicable | frontend-only project |

The same Playwright suite also passed against the hardened Docker container (`BASE_URL=http://127.0.0.1:3299`).

## Measured performance

Lighthouse 12 ran against the production standalone build on this machine. Settings: mobile emulation, simulated throttling with 4x CPU slowdown, 150 ms RTT, and 1.6 Mbps.

| Page | Perf | A11y | BP | SEO | FCP | LCP | CLS | TBT | JS transfer |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 99 | 100 | 100 | 92 | 0.9 s | 2.1 s | 0 | 10 ms | 152 KiB |
| `/explore` | 99 | 100 | 100 | 92 | 0.8 s | 2.0 s | 0 | 20 ms | 260 KiB (includes the lazy explorer chunk) |
| `/methodology` | 97 | 100 | 100 | 92 | 0.9 s | 2.6 s | 0 | 30 ms | 152 KiB |
| `/es/explore` | 98 | 100 | 100 | 92* | 0.8 s | 2.5 s | 0 | 50 ms | 260 KiB |

Explanations for the misses:
- The SEO score is 92 everywhere because Lighthouse's robots parser flags `Content-Signal` as an unknown directive. The architecture requires that directive, so the deduction is accepted.
- *`/es/explore` scored 83 for SEO when the build's `NEXT_PUBLIC_SITE_URL` differed from the host under test, because the canonical URL pointed to another origin. Rebuilt with a matching URL, it scored 92.
- `/methodology` LCP is 2.6 s in simulation, 0.1 s over the 2.5 s target. The LCP element is a text paragraph, and the time is dominated by TTFB, because nonce-bearing HTML must be rendered per request. Caching the HTML would break the nonce contract.
- Initial JS is under the 350 KiB target on every page. The explorer surface is lazy-loaded.
- These numbers come from a single run on a development machine, not from production.

## Walkthrough: how changing the description changes a result

1. Open `/explore`. Luke Skywalker is selected with authored descriptions. His five nearest neighbors are Obi-Wan Kenobi 0.699, Darth Vader 0.686, Rey 0.667, Ahsoka Tano 0.617, and Yoda 0.612.
2. Switch **Descriptions → Relationships removed**. The diff strikes out "son of Anakin Skywalker", "trained by Obi-Wan and Yoda", and "redeemed his father". The input hash changes from `80fc55a1…` to `d592f078…`.
3. The recomputed neighbors are Rey 0.729, Obi-Wan 0.618, Han Solo 0.592, Darth Vader 0.589, and Yoda 0.576. Han Solo enters the top 5 and Ahsoka drops to 7th. Each row shows its rank in the other mode.
4. Kylo Ren shows the strongest effect. His description loses "son of Han Solo and Leia Organa" and "trained by Luke then Snoke". His top score falls from 0.575 (Chewbacca) to 0.304 (Han Solo), and every neighbor drops below 0.31. Most of his similarity to the rest of the cast came from named relationship phrases.
5. The page states that several phrases change at once, so the shift shows that the words matter but does not isolate one cause.

## Article claims contradicted by the shipped scores (for editorial review)

These checks are in the original 384-d space; claims about the 2D picture were tested there instead, and the claim text says so. The article was not edited.

| Claim (article) | Authored | Relationships removed | Evidence (authored) |
|---|---|---|---|
| "Luke's nearest neighbors will be Obi-Wan, Yoda, and Leia." | partial | partial | Top 3 = Obi-Wan, Darth Vader, Rey. Leia ranks 8th. |
| "Darth Vader sits next to Palpatine and Kylo Ren." | **contradicted** | partial | Top 2 = Luke, Rey. Palpatine 4th, Kylo Ren 12th of 14. |
| "Han and Chewbacca pair up, near Boba Fett and Din Djarin." (the "near" half) | **contradicted** | **contradicted** | Neither Boba nor Din is in Han's or Chewbacca's top 4. |
| "Yoda, Obi-Wan, and Mace Windu cluster tight." | partial | partial | Only 2 of 6 mutual top-3 checks pass. Mace's top 3 is Rey, Dooku, Luke. |
| "Palpatine and Dooku form their own pocket." | **contradicted** | partial | Palpatine's top 2 = Vader, Yoda. Dooku's top 2 = Obi-Wan, Vader. |

Supported claims:
- Han and Chewbacca are mutual nearest neighbors (0.693).
- The bounty hunters are closer to each other (0.718) than to Han or Chewie (at most 0.388).
- The Force/non-Force groups separate on mean cosine (within 0.466 and 0.512, between 0.380).
- Dooku leans toward the Jedi more than Palpatine does (0.548 vs 0.499).
- Ahsoka sits off the Jedi core, but only by a 0.002 margin (0.518 vs 0.520), which is too thin to lean on.

The article also says that "every cluster, every outlier, every bridge character matches a narrative truth". The checks above do not support that sentence as written.

The article's plotting code also disagrees with its own descriptions: it labels Leia "Jedi", Kylo Ren "Sith", Ahsoka "Jedi", and Boba "Mandalorian". The editorial layer records these as notes, and Ahsoka's allegiance as *disputed*.

## Draft editorial layer (needs review before deploy)

`scripts/authoring/sources/editorial.v1.yaml` holds:
- allegiance, role, era, and Force status for all 15 characters, with classification notes
- 21 directed story relationships, each quoted from a description
- the 15 relationship-free variants; Palpatine and Yoda are unchanged because their descriptions name no one

All of it is `review_status: draft`, shown in the UI as "Draft: not reviewed, not canon, not an embedding axis". To publish reviewed data:
1. Edit the YAML and set `review_status: reviewed`.
2. Rebuild with a new `--version`.
3. Run `./test.sh all`.

## Deployment templates and rollback

Local files:
- `.env.example` (committed) and `.env`, `.env.test`, and `.env.prod` (gitignored). `.env.test` uses the suggested `swatlas.home.iktdts.com`. `.env.prod` has `PROJECT_HOST=CHANGE_ME_PRODUCTION_HOST` because no production domain was invented. Fill it in before a prod deploy.
- `secrets/`, `secrets.test/`, and `secrets.prod/` each hold only a placeholder README, which satisfies `checkdeploy.sh`. The app has no secrets.
- The folder is **not a git repository** yet. Initialize it and commit `frontend/package-lock.json` and `scripts/authoring/uv.lock` before using the deploy convention, because the prod gate requires a clean tree.

When deployment is authorized:
1. Run `deploy.sh projects.home.iktdts.com` for test and confirm health and `/explore`.
2. Then deploy to prod.
3. Suggest `/full-audit` against the live site afterward.

Rollback:
- **Image:** `BUILD_VERSION` tags the image (`swatlas-frontend:<version>`). Keep the previous tag. To roll back, set `BUILD_VERSION` to the previous tag and run `docker compose up -d --no-build`.
- **Data:** bundles are append-only directories. `index.json` names the default version, and older versions stay loadable through `?v=`. To roll back data, point `default_version` at the previous directory, or redeploy the previous image, which carries its own bundle. There is no database, so the rollback window needs no migration compatibility.
