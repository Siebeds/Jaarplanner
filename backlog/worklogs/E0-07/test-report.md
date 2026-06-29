# E0-07 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (dotnet build/test/format + live /health in Production; independent secret grep)

## Criteria checked
- **Criterion 1 — "No secret is in the repo."** → PASS
  - `git grep` over tracked files for `vault.azure.net`, `Password=`, `apikey`/`ApiKey`, `AccountKey=`, `sk-[A-Za-z0-9]{16,}`, `AKIA`, `BEGIN PRIVATE KEY`, `client_secret`: every hit is a placeholder, `//`-prefixed doc-comment key, XML doc, or worklog prose. No live credential, vault URI, or API key.
  - Committed `appsettings.Development.json` → `ConnectionStrings:Postgres` value is `""` (empty); base `appsettings.json` has no `ConnectionStrings` section. `Password=` appears only as the placeholder `<your .env POSTGRES_PASSWORD>` inside a `//Postgres-command` comment key (not a live config value).
  - `apikey` hits are the unused `AzureAIOptions` seam + the `<your-foundry-key>` placeholder. `sk-` / `AKIA` / `BEGIN PRIVATE KEY` / `client_secret` / `AccountKey=`: no real matches (only worklog descriptions of the scan).
  - `.gitignore` (committed) excludes `.env`, `.env.local`, `.env.*.local`.
- **Criterion 2 — "A documented `dotnet user-secrets` flow exists."** → PASS
  - `docs/dev-setup-secrets.md` documents the full flow: `dotnet user-secrets init`, `set "ConnectionStrings:Postgres" ...` (key consistent with E0-04), the future `set "AzureAI:ApiKey" ...`, plus `list`/`remove`/`clear`. States AI keys are server-side only and never reach the frontend; documents the Key Vault cloud binding.
  - `backend/README.md` carries a quick-start `user-secrets set` for `ConnectionStrings:Postgres` and links to the doc.

## Additional verification (acceptance gates)
- **Build** — `dotnet build Jaarplanner.sln` → "Build succeeded. 0 Warning(s), 0 Error(s)".
- **Tests (no Azure env)** — shell confirmed `KeyVault__Uri`, `AZURE_*`, `ConnectionStrings__Postgres` all unset. `dotnet test Jaarplanner.sln` → UnitTests 1/1 passed; IntegrationTests 7/7 passed (0 failed). `KeyVaultConfigurationTests` has 4 facts pinning the no-op binding:
  - `No_vault_uri_in_production_is_a_no_op_and_does_not_touch_Azure` — asserts no KeyVault source added, config key null.
  - `Development_environment_never_binds_Azure_even_if_a_uri_is_present`.
  - `Empty_vault_uri_in_production_is_a_no_op`.
  - `Malformed_vault_uri_in_production_fails_fast_with_a_clear_message` — fail-fast `InvalidOperationException`.
  These exercise the actual `AddAzureKeyVaultIfConfigured` behaviour, not just green stubs.
- **Format** — `dotnet format Jaarplanner.sln --verify-no-changes` → exit 0.
- **No-op /health proof** — `ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://localhost:5199 dotnet run ... --no-launch-profile` with no Azure env → `GET /health` returned **HTTP 200, body "Healthy"**. Log shows "Hosting environment: Production" and clean startup; app did NOT attempt to reach a vault. Process stopped afterwards (port 5199 → connection refused).
- **Scope** — E0-07 commit `8cfcb32` touches only: `backend/README.md`, `Configuration/AzureAIOptions.cs` (unused seam, not referenced anywhere else), `Configuration/KeyVaultConfiguration.cs` (guarded stub), `Jaarplanner.Api.csproj` (+`Azure.Extensions.AspNetCore.Configuration.Secrets` 1.5.1, `Azure.Identity` 1.21.0), `Program.cs` (one wiring line), `appsettings.Development.json` (comment keys), `KeyVaultConfigurationTests.cs`, `docs/dev-setup-secrets.md`, worklog. No AI client implemented. No frontend/Docker/CI changes in this story's commit.

## Commands run
- `dotnet build Jaarplanner.sln` → Build succeeded, 0 warnings/errors.
- `dotnet test Jaarplanner.sln --no-build` → 8 passed (1 unit + 7 integration), 0 failed.
- `dotnet format Jaarplanner.sln --verify-no-changes` → exit 0.
- `ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://localhost:5199 dotnet run --project src/Jaarplanner.Api --no-launch-profile` + `curl /health` → 200 "Healthy"; then stopped.
- `git grep` for the full secret-pattern set → only placeholders/comments/docs.
- `git show HEAD:.../appsettings*.json` → `ConnectionStrings:Postgres` empty.
- `git show --stat HEAD` → scope confirmed.

## Evidence
- /health: HTTP_CODE=200, BODY=[Healthy], log "Hosting environment: Production".
- Tests: "Passed! - Failed: 0, Passed: 1 ... UnitTests"; "Passed! - Failed: 0, Passed: 7 ... IntegrationTests".
- KeyVault no-op: `KeyVaultConfiguration.cs` returns early in Development and on missing/empty URI; `DefaultAzureCredential` only used when a well-formed URI is present in non-Development.

## Defects
- None.
