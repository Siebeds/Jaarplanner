# E0-04 — Backend bootstrap (ASP.NET Core Web API)

## Build round 1 — minimal running Web API with `/health` + EF Core/Npgsql wiring

- **FR / Article:** FR-2/FR-9 data layer foundation; Constitution Art. VIII (layering Domain ← Application ← Infrastructure, thin Api; EF Core + Npgsql + PostgreSQL), Art. VI.4 (no secrets in repo, server-side only), Art. X (small, reviewable). ADR-0004 (PostgreSQL via EF Core + Npgsql), ADR-0012 (secrets via user-secrets local / Key Vault cloud).

- **Files changed:**
  - `backend/src/Jaarplanner.Infrastructure/Jaarplanner.Infrastructure.csproj` — added EF Core/Npgsql + health-check + config/DI abstraction packages (data access lives in Infrastructure, Art. VIII).
  - `backend/src/Jaarplanner.Infrastructure/Persistence/AppDbContext.cs` — new EF Core `DbContext`, intentionally empty (no `DbSet`s; entities + migrations come in E1).
  - `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — new `AddInfrastructure(IConfiguration)` extension: registers `AppDbContext` with `UseNpgsql(connectionString)` (read from `ConnectionStrings:Postgres`) and a `"db"/"ready"`-tagged `AddDbContextCheck<AppDbContext>()` readiness check.
  - `backend/src/Jaarplanner.Api/Program.cs` — calls `AddInfrastructure(builder.Configuration)` (keeps Api thin), maps `/health` (liveness) and `/health/ready` (DB readiness); exposes `public partial class Program` for the test host.
  - `backend/src/Jaarplanner.Api/Jaarplanner.Api.csproj` — added `<UserSecretsId>jaarplanner-api-dev</UserSecretsId>` to enable `dotnet user-secrets` locally (no secret stored in the csproj — only an id pointing at the per-user store).
  - `backend/src/Jaarplanner.Api/appsettings.Development.json` — added a NON-secret `ConnectionStrings:Postgres` structure (empty value) plus `//`-prefixed comment keys documenting the exact `user-secrets` command. No real credential committed.
  - `backend/tests/Jaarplanner.IntegrationTests/Jaarplanner.IntegrationTests.csproj` — added `Microsoft.AspNetCore.Mvc.Testing` 10.0.9 for in-memory hosting.
  - `backend/tests/Jaarplanner.IntegrationTests/HealthEndpointTests.cs` — new tests pinning `/health` liveness = 200 without a DB, and `/health/ready` = 503 (not a crash) when Postgres is unreachable.

- **Packages added (+versions):**
  - `Npgsql.EntityFrameworkCore.PostgreSQL` **10.0.2** (Infrastructure; transitively brings EF Core 10).
  - `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` **10.0.9** (Infrastructure; first-party `AddDbContextCheck`, deliberately not the Xabaril `AspNetCore.HealthChecks.NpgSql` which is only at 9.0.0 and not net10.0-aligned).
  - `Microsoft.Extensions.Configuration.Abstractions` **10.0.9** and `Microsoft.Extensions.DependencyInjection.Abstractions` **10.0.9** (Infrastructure; for the `AddInfrastructure` extension signature).
  - `Microsoft.AspNetCore.Mvc.Testing` **10.0.9** (IntegrationTests).

- **Key decisions:**
  - **DbContext readiness check via first-party `AddDbContextCheck<AppDbContext>`** rather than the Xabaril package — fewer deps, net10.0-aligned, sufficient for "EF connects to Postgres".
  - **Two probes:** `/health` (liveness, `Predicate = _ => false` → 200 as long as the app is up, DB-independent — the core acceptance criterion) and `/health/ready` (DB readiness, `Predicate = tag "ready"` → 503 when DB down). App never crashes when the DB is down.
  - **Connection string key `ConnectionStrings:Postgres`**, resolved via `IConfiguration.GetConnectionString("Postgres")`. Empty/missing → app still starts; check reports Unhealthy. Aligns with E0-03 compose (host `localhost`, port `5433`, db/user `jaarplanner`).
  - **No open decision (Art. XIV) touched** — no domain entities, no planningsblok granularity, no Excel mapping here.

- **Connection-string / user-secrets approach (ADR-0012, Art. VI.4):**
  - No secret in the repo. Local dev sets it via user-secrets. Exact command (run from `backend/`):
    ```
    dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5433;Database=jaarplanner;Username=jaarplanner;Password=<your .env POSTGRES_PASSWORD>" --project src/Jaarplanner.Api
    ```
  - `Password` must match `POSTGRES_PASSWORD` from the gitignored `.env` (E0-03; `.env.example` default placeholder is `changeme-local-dev`). `Port` = `DB_HOST_PORT` (default 5433).

- **Tests added:**
  - `HealthEndpointTests.Health_liveness_returns_200_even_without_a_database` — pins `/health` = 200 "Healthy" with no DB.
  - `HealthEndpointTests.Health_ready_responds_without_crashing_when_database_is_unreachable` — pins `/health/ready` = 503 "Unhealthy" (app stays up).

- **Gates:**
  - `dotnet build` ✓ (Build succeeded, 0 warnings, 0 errors).
  - `dotnet test` ✓ (UnitTests 1/1; IntegrationTests 3/3 — original placeholder + 2 new health tests).
  - `dotnet format --verify-no-changes` ✓ (exit 0, no changes).
  - **`/health` 200 capture (live `dotnet run`):**
    ```
    === /health ===        Healthy   HTTP 200
    === /health/ready ===  Unhealthy HTTP 503
    fail: ...HealthChecks.DefaultHealthCheckService[103] Health check postgres with status Unhealthy completed ... message '(null)'
    info: Microsoft.Hosting.Lifetime Now listening on: http://localhost:5184 / Application started.
    ```
    App started cleanly and served both endpoints; the DB-down Unhealthy on `/health/ready` is expected (no Postgres running) and did not crash the app.

- **Branch:** story/E0-04

- **Self-check vs acceptance criteria:**
  - *“`dotnet run --project src/Jaarplanner.Api` serves a working `/health` endpoint.”* → MET. Live run returned HTTP 200 "Healthy" on `http://localhost:5184/health`.
  - *“EF Core connects to Postgres (DbContext registered with Npgsql, using the connection string from configuration).”* → MET BY CONSTRUCTION; live DB connection PENDING a Docker host. `AppDbContext` is registered with `UseNpgsql(connectionString)` where `connectionString = configuration.GetConnectionString("Postgres")`; packages referenced in Infrastructure; `/health/ready` exercises `CanConnect` via `AddDbContextCheck`. Docker is not installed on this machine so a real connection cannot be proven here.

- **Docker-pending — verify live EF connection on a Docker host (from `backend/`):**
  ```
  cd ..                                  # repo root (where docker-compose.yml lives)
  cp .env.example .env                   # set POSTGRES_PASSWORD to a local-only value
  docker compose up -d db
  docker compose ps                      # wait for "healthy"
  cd backend
  dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5433;Database=jaarplanner;Username=jaarplanner;Password=<.env POSTGRES_PASSWORD>" --project src/Jaarplanner.Api
  dotnet run --project src/Jaarplanner.Api
  curl http://localhost:5184/health        # 200 Healthy
  curl http://localhost:5184/health/ready  # 200 Healthy once DB is reachable (503 if down)
  ```

- **For the test-runner:**
  - **Unit/integration (no Docker needed):** `cd backend && dotnet test` — `HealthEndpointTests` asserts `/health` = 200 and `/health/ready` = 503-without-crash via `WebApplicationFactory<Program>`.
  - **Manual / Playwright not required** (no UI). To verify the live endpoint: `cd backend && dotnet run --project src/Jaarplanner.Api`, then GET `http://localhost:5184/health` (expect 200 "Healthy"). `/health/ready` reflects DB connectivity. With Docker available, follow the Docker-pending steps above to see `/health/ready` flip to 200.

- **Open questions / Art. XIV touched:** None. No entities, migrations, Key Vault, frontend, CI, or Excel libs added (deferred to E1 / E0-07 / E0-08 per scope discipline).
