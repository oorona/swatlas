# Installation and operations

swatlas is a single Next.js frontend that serves a prebuilt data bundle. The data bundle already ships in the repository (`frontend/public/bundles/`), so running the site needs only Node. Python and the embedding model are needed only to regenerate the bundle.

## Prerequisites

| Task | Needs |
|---|---|
| Run or build the site | Node.js 24 or newer, npm |
| Regenerate the data bundle | [uv](https://docs.astral.sh/uv/) and Python 3.13 (uv installs it if missing). The first run downloads about 1.3 GB of `intfloat/e5-large-v2` weights from Hugging Face. CPU only, no GPU needed |
| End-to-end tests | Playwright's Chromium: `cd frontend && npx playwright install chromium` |
| Container deployment | Docker with Compose v2, a Traefik instance, and the external Docker networks `internet` and `intranet` |

There are no secrets: no database, no API keys and no auth.

## Run locally

```bash
cd frontend
npm ci
npm run dev            # http://localhost:3000
```

The English pages are `/`, `/explore` and `/methodology`. The Spanish versions are under `/es/...`.

To serve the production build exactly as the container does:

```bash
cd frontend
npm run build
./scripts/start-standalone.sh    # http://127.0.0.1:3217 (override with PORT=...)
```

## Configuration

All configuration is non-sensitive. Copy the template and edit it:

```bash
cp .env.example .env
```

| Variable | Used at | Purpose |
|---|---|---|
| `PROJECT_HOST` | Compose / Traefik | Public hostname Traefik routes to the container |
| `NEXT_PUBLIC_SITE_URL` | build time | Absolute origin for canonical URLs, sitemap, Open Graph and JSON-LD. It must match the host the site is served from, or canonical links point elsewhere |
| `NEXT_PUBLIC_ARTICLE_URL` | build time | Link back to the source article (default: the latentSource article) |
| `APP_UID`, `APP_GID` | Compose | Non-root user the container runs as (default 1000:1000) |
| `FRONTEND_CONTAINER_NAME` | Compose | Container name (default `swatlas-frontend`) |
| `TRAEFIK_CERTRESOLVER` | Compose | Traefik ACME resolver name (default `cloudflare`) |
| `BUILD_VERSION` | Compose | Image tag, `swatlas-frontend:<BUILD_VERSION>`. Keep the previous tag for rollback |

`NEXT_PUBLIC_*` values are baked into the JavaScript at build time, so changing them requires a rebuild (`docker compose up -d --build`).

## Regenerate the data bundle

The bundle is the only data source the site reads. Rebuild it after changing a description, the editorial layer or the model configuration:

```bash
./scripts/build_bundle.sh                           # rebuild the default version (2025-11-07.1)
./scripts/build_bundle.sh --version 2025-12-01.1    # publish a new version next to the existing ones
```

The script pins the thread counts and `PYTHONHASHSEED`, runs `uv sync --frozen`, and then runs `python -m swatlas_authoring.build`. It writes content-hashed JSON files, `manifest.json` and a download zip into `frontend/public/bundles/<version>/`, and points `frontend/public/bundles/index.json` at the new version. The build fails if a validation or math check fails, or if the bundle exceeds 500 KiB gzipped. Rebuilding the same version on the same machine gives byte-identical files.

Versions have the form `YYYY-MM-DD.N`. Older version directories stay published, and links can pin a version with `?v=<version>`.

### Editing the inputs

The inputs live in `scripts/authoring/sources/`:

- `article_descriptions.v1.json` holds the 15 descriptions, copied verbatim from the article. To re-extract them, run `cd scripts/authoring && uv run python -m swatlas_authoring.extract`. This reads the article from a sibling `../latent` checkout, which is private and not part of this repository. The vendored JSON is all the build needs.
- `editorial.v1.yaml` holds the allegiance, role, era and Force-status classifications, the 21 curated relationships, and the relationship-free description variants. Values must come from the controlled vocabularies at the top of the file, or the build rejects them.

The editorial layer ships as `review_status: draft` and the UI labels it that way. To publish it as reviewed:

1. Review the YAML and set `review_status: reviewed`.
2. Rebuild with a new version: `./scripts/build_bundle.sh --version <new>`.
3. Run `./test.sh all`.

### Changing the model

The model ID, revision, input prefix and default graph threshold are in `scripts/authoring/swatlas_authoring/config.py`. Changing the model changes the score range, so set a new default threshold, publish under a new version, and update any claim checks in `claims.py` that depend on specific rankings.

## Tests

```bash
./test.sh all        # everything below
./test.sh python     # pytest: dataset validation, NumPy recomputation, bundle checks
./test.sh frontend   # TypeScript typecheck + Vitest
./test.sh e2e        # production build + Playwright + axe (starts its own server)
```

`./test.sh backend` reports "not applicable" because there is no backend. To run the Playwright suite against a running container instead of a local server:

```bash
cd frontend && BASE_URL=http://127.0.0.1:3299 npx playwright test
```

## Deploy with Docker Compose

The Compose file defines one service, `swatlas-frontend`. It publishes no host ports and is reached only through Traefik over TLS. The external networks must already exist, because Traefik, Postgres and Redis are shared infrastructure and are never defined here:

```bash
docker network create internet    # once per host, if not provisioned already
docker network create intranet
cp .env.example .env               # set PROJECT_HOST and NEXT_PUBLIC_SITE_URL
docker compose up -d --build
curl -fsS https://$PROJECT_HOST/api/health    # {"status":"ok"}
```

The Dockerfile refuses to build if `frontend/public/bundles/index.json` is missing, and the bundle is baked into the image. The container runs read-only as a non-root user and has a health check on `/api/health`. See [ARCHITECTURE.md](ARCHITECTURE.md#container-and-deployment) for the full list of hardening settings.

On low-memory hosts, build the image on another machine using the destination's `NEXT_PUBLIC_*` values and UID/GID, then push or load it.

### Author's deployment convention

The author deploys with the shared `deploy.sh` and `checkdeploy.sh` scripts from a separate private infrastructure repository. They pick `.env.test` / `secrets.test/` or `.env.prod` / `secrets.prod/` depending on the target, and a production deploy requires a clean git tree. These env files and secrets folders are gitignored. The `secrets*/` folders hold only a placeholder README, because the checker expects them to exist. Deploy to the test target and confirm `/api/health` and `/explore` before production. `.env.prod` has no production hostname yet (`CHANGE_ME_PRODUCTION_HOST`), so fill it in before the first production deploy.

## Rollback

- **Image:** set `BUILD_VERSION` to the previous tag and run `docker compose up -d --no-build`.
- **Data:** bundles are append-only directories. Set `default_version` in `frontend/public/bundles/index.json` back to the previous directory and rebuild, or redeploy the previous image, which carries its own bundle. There is no database, so no migration compatibility is needed.
- **Retired bundle:** the original MiniLM bundle was removed from the site on 2025-11-08. Recover it from git history (the "Publish artifact bundle" commit) if needed.
