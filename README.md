# swatlas: Star Wars semantic atlas

swatlas is an interactive web app that explains why an embedding model thinks two Star Wars characters are similar. It takes the 15 hand-written character descriptions from the latentSource article [Mapping the Star Wars Universe](https://thelatentsource.com/articles/mapping-star-wars-universe) and embeds them with a pinned open model, `intfloat/e5-large-v2`. It then lets a visitor inspect every score behind the resulting map: which characters are nearest to Luke, why Darth Vader sits next to Palpatine, and what happens to the neighborhoods when the family ties are taken out of the text.

## The problem it solves

Articles about embeddings usually show a 2D scatter plot and tell a story about its clusters. The reader can't check that story. The plot is a lossy projection of 1024 dimensions. The clusters depend on the model, the seed and the exact wording of the inputs, and nothing in the picture says whether a claim like "Yoda, Obi-Wan and Mace cluster tight" holds in the original space. swatlas turns that kind of article into an evidence surface:

- every ranking and score comes from cosine similarity on the original normalized 1024-dimensional vectors, never from distances on the plot
- every number is recomputed offline by a reproducible, pinned pipeline and shipped as a checksummed, versioned data bundle
- the article's own narrative claims are tested automatically against the shipped scores, and each one is marked supported, partial or contradicted

## What a visitor can do

- **Explore four linked views.** A 2D map (PCA plus UMAP with seeds 7, 21 and 42), a similarity graph, a 15×15 similarity matrix and a character list. The selection is kept when switching views, and changing the projection moves the points but never changes a ranking.
- **Inspect a character.** The selected description sits next to its five nearest characters and their cosine scores. Hovering shows a preview.
- **Tune the similarity graph.** The threshold runs from -1 to 1 in 0.01 steps and defaults to 0.87, because E5 scores are compressed into a 0.80 to 0.94 band. Curated story relationships (parent of, trained, redeemed, ...) can be shown as separate directed edges that never carry a similarity score.
- **Run a text ablation.** A second description mode removes the named relationship phrases ("son of Anakin Skywalker", "trained by Obi-Wan and Yoda"), shows the diff and recomputes the neighbors. Each neighbor row shows its rank in the other mode. The page says plainly that several phrases change at once, so a shift shows the words matter but doesn't isolate one cause.
- **Filter by editorial metadata.** Allegiance, role, era and Force sensitivity can be filtered. Filters hide characters but don't refit anything. These fields are draft classifications labeled "not canon, not an embedding axis", and contested cases such as Ahsoka's allegiance are marked *disputed* instead of being forced into a camp.
- **Color by faction or Force status, and drag points.** Points can be dragged around the map. Linked points follow on springs, and motion respects reduced-motion settings. Dragging only moves marks on the screen and never changes a score.
- **Share and download.** The URL stores the view, selection, projection, mode, threshold, filters and bundle version, so a copied link reproduces the exact state. The evidence download is a zip with the descriptions, normalized embeddings, score matrices, projection parameters and a README.
- **Read the methodology** in English or Spanish at `/methodology`: inputs, transformations, provenance, limitations and how to reproduce the bundle.

## AI and ML aspects

- **Model choice by measurement.** Nine open sentence-embedding models were compared on these 15 descriptions: MiniLM, MPNet, BGE small/base/large, E5 base/large, GTE base and mxbai large. `intfloat/e5-large-v2` separated the story groups best (silhouette 0.119 against 0.102 for the original MiniLM) and gave the tightest Jedi Council cluster. It is pinned to Hugging Face revision `f169b11e`, uses the `passage: ` input prefix, and is released under the MIT license. Only derived embeddings are shipped; the model weights are not.
- **Deterministic, verifiable math.** Each description is encoded on its own on CPU with a single thread and deterministic torch algorithms, then L2-normalized in the pipeline. The build checks the vector norms, rejects zero vectors and verifies the cosine matrix against an independent NumPy recomputation (tolerance 1e-6, symmetric, unit diagonal). Rebuilding gives byte-identical file hashes.
- **Honest projections.** PCA and UMAP coordinates (n_neighbors 5, min_dist 0.3, cosine metric) are exported once, together with their full execution settings and package versions. They are never refit in the browser.
- **Automated claim checking.** The pipeline tests 14 narrative claims from the article against the original-space scores. On the authored descriptions 13 are supported. The 14th, "the Sith pull together once the family ties are gone", is about the ablation and is only partially supported. An earlier version of the article, written for the MiniLM embeddings, had five claims contradicted or only partially supported. The article was later rewritten against the measured scores.
- **Findings.** Luke's nearest neighbors are Rey (0.878), Darth Vader (0.870) and Obi-Wan (0.868). The strongest pair in the set is Boba Fett and Din Djarin (0.940). Removing relationship phrases pulls Mace Windu and Han Solo into Luke's top three, and Kylo Ren's nearest neighbor moves from Rey to Ahsoka Tano.

## Tech stack

- **Frontend:** Next.js 16 (App Router, standalone output), React 19, TypeScript strict, Tailwind CSS 4, next-intl (English and Spanish), Zustand for linked-view state, zod for runtime bundle validation, and hand-built SVG charts with semantic HTML table equivalents.
- **Authoring pipeline:** Python 3.13 with uv, sentence-transformers 6.1, PyTorch 2.14 (CPU), NumPy, scikit-learn (PCA) and umap-learn, with every version locked in `uv.lock` and recorded in each bundle manifest.
- **Runtime:** one hardened Node 24 Alpine container behind Traefik. There is no backend, database, auth or runtime model call, and the site works with every external request blocked.
- **Quality gates:** pytest for the data and math acceptance checks, Vitest with React Testing Library for the client logic, and Playwright with axe for the end-to-end, WCAG 2.1 AA, 390px mobile and security-header checks. Lighthouse scores 97 to 99 for performance and 100 for accessibility.

## Documentation

- [docs/INSTALLATION.md](docs/INSTALLATION.md): prerequisites, local development, rebuilding the data bundle, tests, container deployment and rollback.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): components, the authoring pipeline, the bundle contract, frontend internals, security controls and design decisions.

Author: Oswaldo Orona ([latentSource](https://thelatentsource.com)).
