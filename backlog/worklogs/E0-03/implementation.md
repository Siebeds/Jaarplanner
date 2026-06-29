# E0-03 — Local Postgres via Docker

## Build round 1 — local Postgres `db` service + no-secrets env pattern

- **FR / Article:** Art. VIII (PostgreSQL local via Docker), Art. VI.4 (no secrets in repo,
  server-side config), Art. X (small, reviewable change). ADRs consulted:
  `docs/adr/0004-postgresql-efcore-npgsql.md` (intent: Dockerised Postgres, EF wiring is E0-04)
  and `docs/adr/0012-secrets-config-management.md` (intent: nothing sensitive committed;
  user-secrets local, Key Vault cloud — config strategy is E0-07).

- **Files changed:**
  - `docker-compose.yml` (new) — single `db` service running PostgreSQL for local dev.
  - `.env.example` (new) — documents the env vars compose consumes; placeholder values only.
  - `.gitignore` (changed) — added `.env` / `.env.local` / `.env.*.local`; existing
    `.claude/worktrees/` entry preserved.
  - `backlog/worklogs/E0-03/implementation.md` (this file).

### Compose design

- **Image / version:** `postgres:17.5` — official image, version-pinned to a current stable
  major (Postgres 17). Not `latest` (Art. VIII / reproducibility).
- **Host port:** `${DB_HOST_PORT:-5433}:5432` — defaults to host **5433** to avoid clashing
  with a local Postgres install on 5432; overridable via `DB_HOST_PORT`. Documented in
  `.env.example`.
- **Named volume:** `jaarplanner-db-data` → `/var/lib/postgresql/data` for persistence across
  container recreates.
- **Healthcheck:** `pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}` (CMD-SHELL), 10s
  interval / 5s timeout / 5 retries / 10s start_period — so readiness is verifiable via
  `docker compose ps` (reports `healthy`). The `$$` is the compose escape so the variable is
  expanded by the shell **inside** the container (from the container's own environment), not
  interpolated by compose at parse time.
- **`restart: unless-stopped`** so the dev DB survives Docker restarts without auto-resurrecting
  after an explicit stop.

### Secrets pattern (Art. VI.4)

- No credentials are hard-coded in `docker-compose.yml`. `POSTGRES_USER` and
  `POSTGRES_PASSWORD` use the **required-variable** form `${VAR:?message}`, so compose fails
  fast with a clear error if `.env` is missing them — preventing accidental insecure defaults.
- `POSTGRES_DB` defaults to `jaarplanner`; `DB_HOST_PORT` defaults to `5433` (non-secret
  convenience defaults).
- Compose auto-loads `.env` from the project root for `${VAR}` interpolation — no explicit
  `env_file:` needed for these variables.
- `.env.example` (committed) documents every variable with a placeholder password
  (`changeme-local-dev`) that is intentionally not a real secret.
- `.env` (the real file) is **gitignored** and never committed.

### How E0-04 / E0-07 consume this (note only — not implemented here)

- **E0-04 (EF Core + Npgsql wiring):** the backend will NOT read these compose env vars.
  It connects to the running container on `localhost:5433` (the mapped host port). The
  connection string is supplied through .NET configuration, not this compose file.
- **E0-07 (secrets/config strategy):** the connection string lives in `dotnet user-secrets`
  locally and Azure Key Vault in the cloud (ADR-0012). This story deliberately stops at the
  container + the no-secrets compose pattern; the .NET config plumbing is out of scope.

### Scope discipline

- No EF Core / Npgsql packages, no backend connection code, no health endpoint, no frontend,
  no CI added — per the story's explicit "do NOT" list.

- **Tests added:** none — this is infra config (a compose file + env example + gitignore).
  No application code to unit-test.

- **Gates:**
  - `dotnet build` / `dotnet test` / `dotnet format` — **N/A** (no backend code touched).
  - `pnpm lint` / `pnpm test` / `pnpm build` — **N/A** (no frontend code touched).
  - YAML validity: parsed `docker-compose.yml` with PyYAML — **OK** (1 service `db`,
    image `postgres:17.5`, healthcheck present, 1 named volume).
  - `docker compose config` (the canonical validation): **could not run — Docker is not
    installed on this machine** (`docker: command not found`; `which docker` empty).

- **Branch:** `story/E0-03`

### Verification — runtime PENDING a Docker host

Docker is not available on this build machine, so the compose file is **correct-by-construction**
and YAML-validated, but not runtime-verified. When a Docker host is available, the test-runner
should run (from repo root):

```bash
cp .env.example .env          # then optionally edit the password
docker compose config         # validates + shows the fully interpolated config
docker compose up -d db
docker compose ps             # wait until db shows STATUS "healthy"
docker compose exec db pg_isready -U jaarplanner -d jaarplanner   # expect: accepting connections
# optional direct connect:
docker compose exec db psql -U jaarplanner -d jaarplanner -c '\l'
```

Expected: `docker compose config` succeeds; the `db` service reaches `healthy`; `pg_isready`
reports the server is accepting connections; the `jaarplanner` database exists.

- **Self-check vs acceptance criteria:**
  - *"`docker compose up -d db` gives a reachable Postgres instance"* → compose file defines a
    single `db` service on a pinned image with a mapped port and a `pg_isready` healthcheck.
    Structurally correct; **runtime verification pending a Docker host** (documented above).
  - *"Connection string / credentials via user-secrets / environment, NEVER committed
    (Art. VI.4)"* → met: credentials come from a gitignored `.env` via `${VAR:?}` interpolation;
    only `.env.example` with placeholders is committed; `.env` added to `.gitignore`. No real
    secret is in the repo. (The .NET user-secrets connection string itself is E0-07.)

- **For the test-runner:** No API/UI to exercise (infra story). Verify with the Docker commands
  above on a machine with Docker installed. Also confirm `git status` shows `.env` is ignored if
  one is created locally (`echo "x" > .env && git check-ignore .env` → prints `.env`).

- **Open questions / Art. XIV touched:** None. Postgres major version (17) can be revisited when
  E0-04 wires EF Core, but pinning to 17.5 is a safe current default and not an Art. XIV open
  decision.
