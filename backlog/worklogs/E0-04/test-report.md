# E0-04 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (build + xUnit + live `dotnet run` curl). Live EF↔Postgres connection PENDING a Docker host (Docker not installed in this environment — verified criterion 2 by construction, per the orchestrator's instruction).

## Criteria checked
- "`dotnet run --project src/Jaarplanner.Api` serves a working `/health` endpoint" → **PASS**
  - Started the API live on `http://localhost:5184`. `GET /health` → `HTTP/1.1 200 OK`, body `Healthy`. Liveness predicate is `_ => false` (excludes the DB check) so it is DB-independent.
  - `GET /health/ready` → `HTTP/1.1 503 Service Unavailable`, body `Unhealthy` — the DbContext readiness check (tag "ready") reports Unhealthy because no Postgres is running; the app did NOT crash and `GET /health` still returned 200 afterwards. App log shows only the expected `Health check postgres with status Unhealthy` line, no unhandled exception.
  - Pinned by `HealthEndpointTests` (IntegrationTests, WebApplicationFactory<Program>): `Health_liveness_returns_200_even_without_a_database` asserts 200 + "Healthy"; `Health_ready_responds_without_crashing_when_database_is_unreachable` asserts 503 + "Unhealthy". Both pass.
- "EF Core connects to Postgres (DbContext registered with Npgsql, connection string from configuration)" → **PASS (by construction; live DB PENDING Docker)**
  - `AppDbContext : DbContext` in `Jaarplanner.Infrastructure/Persistence/AppDbContext.cs` (intentionally empty — entities are E1).
  - `DependencyInjection.AddInfrastructure(IConfiguration)` calls `services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connectionString))`, where `connectionString = configuration.GetConnectionString("Postgres")` (i.e. `ConnectionStrings:Postgres`). The thin `Api/Program.cs` calls `builder.Services.AddInfrastructure(builder.Configuration)` — data-access wiring stays in Infrastructure (Art. VIII layering respected).
  - Packages `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.2 and `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` 10.0.9 are referenced ONLY in `Jaarplanner.Infrastructure.csproj` — NOT in Api or Domain csproj (verified by grep: "none (correct)").
  - The `AddDbContextCheck<AppDbContext>(name: "postgres", tags: ["db","ready"])` actually attempts `CanConnect` against the configured Npgsql provider — the 503 observed live is that check failing to reach a (non-running) Postgres, which itself proves the Npgsql provider + connection string are wired and exercised.

## Live-DB verification (run on a Docker host to complete criterion 2)
```
docker compose up -d db
dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5433;Database=jaarplanner;Username=jaarplanner;Password=<your .env POSTGRES_PASSWORD>" --project src/Jaarplanner.Api
dotnet run --project src/Jaarplanner.Api
curl -i http://localhost:5184/health/ready   # expect HTTP 200 "Healthy" once Postgres is reachable
```

## Commands run (from backend/)
- `dotnet build Jaarplanner.sln` → **Build succeeded. 0 Warning(s), 0 Error(s).**
  - (First attempt failed with MSB3027/MSB3021 file-lock errors — a leftover `Jaarplanner.Api (PID 59184)` from a prior run held `Jaarplanner.Infrastructure.dll`. ENVIRONMENT issue, not a product defect; killed the stray process and rebuilt clean.)
- `dotnet test Jaarplanner.sln --no-build` → **all pass**: UnitTests 1/1, IntegrationTests 3/3 (HealthEndpointTests x2 + SolutionLayoutTests x1).
- `dotnet format Jaarplanner.sln --verify-no-changes` → **exit 0** (no formatting changes).
- `dotnet run --project src/Jaarplanner.Api --urls http://localhost:5184` then `curl /health` (200 Healthy) and `curl /health/ready` (503 Unhealthy, no crash); app stopped after.

## Scope / hygiene checks
- No secret/real connection string committed: `appsettings.Development.json` holds an empty `"Postgres": ""` placeholder plus `//`-prefixed non-secret template comments; real value via user-secrets (`UserSecretsId` only, no secret). PASS.
- No domain entities added (`Jaarplanner.Domain` has only its .csproj — entities are E1). PASS.
- No EF migrations added. PASS.
- No Key Vault implementation (E0-07) — only a doc comment referencing it. PASS.
- No frontend / Docker / CI changes in this commit (files changed: Api Program.cs + csproj + appsettings.Development.json, Infrastructure DependencyInjection.cs + csproj + AppDbContext.cs, IntegrationTests HealthEndpointTests.cs + csproj, and the E0-04 worklog). PASS.
- Api stays thin (only `AddOpenApi`, `AddInfrastructure`, `MapHealthChecks`); layering Domain ← Application ← Infrastructure with EF/Npgsql confined to Infrastructure. PASS.

## Evidence
- API log: `%TEMP%/jaarplanner-api.log` — "Now listening on: http://localhost:5184", "Application started", and the single expected `Health check postgres with status Unhealthy` line (no unhandled exception).
- Live curl: `/health` → 200 "Healthy"; `/health/ready` → 503 "Unhealthy"; re-probe of `/health` → 200 (app survived).

## Defects
None.
