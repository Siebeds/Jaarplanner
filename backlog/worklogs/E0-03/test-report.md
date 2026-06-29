# E0-03 — Test report (round 1)

**Verdict:** PASS (criterion 1 runtime check PENDING a Docker host — environment limitation, not a defect)
**Mode:** infra/config (static verification by construction; Docker daemon unavailable on this machine)

## Criteria checked
- "`docker compose up -d db` gives a reachable Postgres." → PASS-by-construction (runtime PENDING) — `docker` is not installed here, so the container cannot be started/probed. The compose file is correct by construction: single `db` service; official **version-pinned** image `postgres:17.5` (not `latest`); host port mapping `${DB_HOST_PORT:-5433}:5432`; named volume `jaarplanner-db-data:/var/lib/postgresql/data` (declared under top-level `volumes:`); `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}` healthcheck with sensible interval/timeout/retries/start_period. YAML parses cleanly (`yaml.safe_load` → `YAML_OK`).
- "Connection string / DB credentials come via env / user-secrets and are NEVER committed (Art. VI.4)." → PASS — credentials are supplied via env interpolation only (`POSTGRES_USER`/`POSTGRES_PASSWORD` are `${VAR:?...}` required-with-error, `POSTGRES_DB`/`DB_HOST_PORT` have non-secret defaults). `.env` is gitignored (`git check-ignore .env` → `.env`) and NOT tracked (`git ls-files` lists only `.env.example`, never `.env`). `.env.example` holds an explicit non-secret placeholder password (`changeme-local-dev`). No hardcoded secrets found in tracked files.

## Commands run
- `command -v docker` → not found (Docker daemon absent on this machine)
- `git branch --show-current` → `story/E0-03`
- `python -c "import yaml; yaml.safe_load(open('docker-compose.yml'))..."` → YAML_OK; services=['db'], image=postgres:17.5, named volume present, healthcheck = pg_isready
- `git check-ignore .env` → `.env`
- `git ls-files | grep -i '\.env'` → `.env.example` only (no real `.env` tracked)
- `git grep -nE "(password|secret|api_key|...)=literal" -- docker-compose.yml .env.example` → no hardcoded secret patterns

## Evidence
- `docker-compose.yml`: `image: postgres:17.5`, `ports: ["${DB_HOST_PORT:-5433}:5432"]`, `volumes: jaarplanner-db-data:/var/lib/postgresql/data`, healthcheck `["CMD-SHELL","pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]`, env values all `${...}` interpolated.
- `.gitignore` lines 5-7 ignore `.env`, `.env.local`, `.env.*.local`.
- `.env.example` ships placeholder values only; comments explicitly flag the password as not a real secret and point the backend at .NET user-secrets (E0-07).

## Runtime verification PENDING (run on a machine with Docker installed)
- `docker compose -f docker-compose.yml config`  → should print resolved config without error
- `cp .env.example .env`  (then optionally edit the password)
- `docker compose up -d db`
- `docker compose ps`  → `db` service reports `healthy`
- `docker exec jaarplanner-db pg_isready -U jaarplanner -d jaarplanner`  → "accepting connections"

## Defects
- None. (No compose defect; no committed secret.)
