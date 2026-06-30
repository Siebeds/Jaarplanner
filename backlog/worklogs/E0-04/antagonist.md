# Antagonist Review — E0-04 Backend bootstrap (EF Core + Npgsql + /health)

**Verdict:** COMPLIANT
**Scope audited:** `git diff feature/e0-foundation...story/E0-04` — commit `65f63d7`, branch `story/E0-04`. 9 files: Api csproj/Program.cs/appsettings.Development.json, Infrastructure DependencyInjection.cs/csproj/Persistence/AppDbContext.cs, IntegrationTests csproj/HealthEndpointTests.cs, worklog.

## Findings
None. No CRITICAL, MAJOR, or MINOR violations. No open questions surfaced.

## Checks run (proof of thoroughness)

- **Art. VIII — layering.** EF Core (`AppDbContext`) + Npgsql wiring live entirely in `Jaarplanner.Infrastructure` (`Persistence/AppDbContext.cs`, `DependencyInjection.cs`). The EF/Npgsql/health-check PackageReferences are added only to `Jaarplanner.Infrastructure.csproj` — NOT to Domain or Api. Verified `Jaarplanner.Domain.csproj` has zero ProjectReferences and zero PackageReferences (references nothing). `Application` → Domain only; `Infrastructure` → Application. Dependency direction Domain ← Application ← Infrastructure is intact. Api references Application + Infrastructure and only composes (`builder.Services.AddInfrastructure(builder.Configuration)`) + maps two health endpoints — a thin composition root, no data-access logic in Api. COMPLIANT.

- **Art. VIII — stack.** Driver/ORM is `Npgsql.EntityFrameworkCore.PostgreSQL` 10.0.2 (EF Core 10 transitively) — the mandated EF Core + Npgsql, no alternative ORM. `global.json` pins SDK 10.0.201 (net10.0 across projects), consistent with the .NET LTS pin requirement. Health-check uses first-party `Microsoft.Extensions.Diagnostics.HealthChecks.EntityFrameworkCore` (not Xabaril) — a reasonable, minimal dependency choice. No EPPlus, no ClosedXML (correctly deferred). COMPLIANT.

- **Art. VI.4 — no secrets.** Full-diff scan plus repo grep for "password". Only occurrence is the literal placeholder `Password=<your .env POSTGRES_PASSWORD>` inside a `//`-prefixed documentation/comment key in `appsettings.Development.json`; the real `ConnectionStrings:Postgres` value is an empty string, with the live value supplied via `dotnet user-secrets` (UserSecretsId `jaarplanner-api-dev` — an id, not a secret). Base `appsettings.json` contains no connection string. No real credential committed. `bin/` copies that surfaced in grep are build artifacts and are NOT git-tracked (`git ls-files` empty for `bin/`). AI keys: none introduced; nothing frontend-reachable. COMPLIANT.

- **Scope discipline.** No domain entities added — `AppDbContext` is intentionally empty (no `DbSet`s). No EF migrations. No Key Vault implementation (E0-07 correctly deferred; only user-secrets seam present). No Excel/ClosedXML libs. No frontend changes. No CI (E0-08). Change is confined to backend bootstrap. No scope creep. COMPLIANT.

- **Art. III (read-only curriculum) / Art. IX (data model).** No entity, table, or model commitment made; the empty DbContext makes no premature decision about Leerplandoel/Thema/Jaarplan shape. No curriculum content touched. COMPLIANT.

- **Art. XIV — open decisions.** No planningsblok granularity, no discipline selection, no Excel structure, no thema-scope assumption hard-coded. The connection-string source is isolated behind configuration. None of the open decisions are hard-assumed. COMPLIANT.

- **Art. X — DoD.** Change is small and reviewable (9 files, +225/-2). Two integration tests present (`/health` 200 without DB; `/health/ready` 503 without crashing) using `WebApplicationFactory<Program>`. Worklog reports build/test/`dotnet format` green. No hard-coded Dutch (no user-facing strings introduced — backend health endpoints only; Art. II.3 not engaged). COMPLIANT.

## Open questions surfaced
- None. The worklog and code agree that no Art. XIV decision was touched.

## Notes / non-blocking observations
- Live EF→Postgres connectivity is verified-by-construction only (Docker not installed). This is the stated environment limitation, not a compliance issue. The readiness probe (`/health/ready`) is the seam that will prove the live connection once a Docker host is available; the test suite already asserts the app does not crash when the DB is down.
- `AddDbContextCheck` is registered with name `"postgres"` and tags `"db"`/`"ready"`; the worklog/Program comments at one point describe the tag/endpoint wiring slightly loosely (a Program.cs comment says the check is one that "`/health` uses", while the liveness `/health` predicate is `_ => false` and the readiness `/health/ready` predicate filters tag `"ready"`). The actual code wiring is correct and matches the tests; this is a comment-accuracy nit, not a behavioural or constitutional issue.

**This change is COMPLIANT and may be considered done for E0-04.**
