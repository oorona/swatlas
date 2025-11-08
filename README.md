# Star Wars semantic atlas

Project/service prefix: `swatlas`.

This app helps a visitor investigate why an embedding model scores two of the 15 character descriptions from [Mapping the Star Wars Universe](../latent/data/articles/mapping-star-wars-universe/article.md) as similar. The implementation follows [SPECIFICATION.md](SPECIFICATION.md) and [architecture.md](architecture.md). [docs/HANDOFF.md](docs/HANDOFF.md) holds the delivered evidence: the model revision, hashes, test results, a walkthrough, and the contradicted article claims.

## Layout

```
frontend/                 Next.js 16 app (en/es): /, /explore, /methodology
  public/bundles/         versioned, checksummed artifact bundles (the only data source)
scripts/build_bundle.sh   artifact generation command (offline authoring)
scripts/authoring/        uv project: sources/, pipeline, pytest checks
docker-compose.yml        single hardened swatlas-frontend service behind Traefik
test.sh                   python | frontend | e2e | backend (n/a) | all
```

The public data flow is browser → frontend → reviewed bundle. There is no backend, database, Redis, auth, or runtime model call.

## Common tasks

```bash
./scripts/build_bundle.sh                 # rebuild bundle 2026-09-28.1 (reproducible hashes)
./scripts/build_bundle.sh --version 2026-10-01.1   # publish a new version beside the old one
./test.sh all                             # pytest + typecheck + Vitest + build + Playwright
cd frontend && npm run dev                # local development on :3000
cp .env.example .env && docker compose up -d --build   # container (needs shared networks)
```

Editorial inputs live in `scripts/authoring/sources/`. The descriptions are extracted verbatim from the article by `uv run python -m swatlas_authoring.extract`. The metadata, relationships, and variants in `editorial.v1.yaml` are drafts and are marked that way everywhere they appear.

The article sources point into the neighboring private latentSource checkout. The only material copied from it is the reviewed public descriptions and the article card SVG. Do not publish that repository, its private content, or its secrets.
