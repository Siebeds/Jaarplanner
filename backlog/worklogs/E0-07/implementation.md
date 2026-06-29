# E0-07 — Secrets & config strategy

## Build round 1 — formalise secrets/config (user-secrets local + guarded Key Vault stub + AI-key-server-side principle)

- **FR / Article:** Constitution Art. VI.4 (no secrets in repo; .NET user-secrets local / Azure Key Vault cloud; AI keys server-side only), Art. VIII (Azure, layering — config wiring at the Api composition root, AI client lives in Infrastructure in E2), Art. IV (AI advisory; key never exposed to frontend), Art. X (small, reviewable). ADR-0012 (secrets & config management), ADR-0016 (Azure + EU residency, informational).

- **Files changed:**
  - `backend/src/Jaarplanner.Api/Jaarplanner.Api.csproj` — added `Azure.Extensions.AspNetCore.Configuration.Secrets` 1.5.1 and `Azure.Identity` 1.21.0 (standard Key Vault config provider + `DefaultAzureCredential`).
  - `backend/src/Jaarplanner.Api/Configuration/KeyVaultConfiguration.cs` — **new.** `AddAzureKeyVaultIfConfigured(IHostEnvironment)` extension: adds Key Vault as a config source ONLY in non-Development environments when `KeyVault:Uri` is a valid absolute URI; otherwise a true no-op. Reads the URI from config/env — nothing hard-coded.
  - `backend/src/Jaarplanner.Api/Configuration/AzureAIOptions.cs` — **new.** Minimal, documented, currently-unused options seam recording where the future Azure AI Foundry key (`AzureAI:ApiKey`) binds (server-side only; never frontend/repo). No AI client implemented (deferred to E2).
  - `backend/src/Jaarplanner.Api/Program.cs` — calls `builder.Configuration.AddAzureKeyVaultIfConfigured(builder.Environment)` before service registration (config wiring at the composition root; Api stays thin).
  - `backend/src/Jaarplanner.Api/appsettings.Development.json` — added non-secret `//KeyVault` and `//AzureAI` documentation comment keys (no real URI/key — only placeholders + the exact user-secrets commands).
  - `backend/tests/Jaarplanner.IntegrationTests/KeyVaultConfigurationTests.cs` — **new.** 4 tests pinning the no-op-when-absent guard.
  - `docs/dev-setup-secrets.md` — **new.** The documented developer secrets flow (user-secrets commands for `ConnectionStrings:Postgres` and `AzureAI:ApiKey`, the Key Vault binding design, the AI-keys-server-side principle, the no-secret proof).
  - `backend/README.md` — **new.** Backend command reference + a Secrets & configuration section referencing `docs/dev-setup-secrets.md`.

- **Packages added (+versions):**
  - `Azure.Extensions.AspNetCore.Configuration.Secrets` **1.5.1** (Api) — Key Vault → `IConfiguration` provider.
  - `Azure.Identity` **1.21.0** (Api) — `DefaultAzureCredential` (managed identity in Azure; no stored credential).

- **Key Vault stub design (how it's guarded to no-op locally):**
  - Trigger key: **`KeyVault:Uri`** (env `KeyVault__Uri`), e.g. `https://<vault>.vault.azure.net/`. Read from config/env; never committed.
  - Guard order: (1) `environment.IsDevelopment()` → return unchanged (local relies on user-secrets); (2) URI null/whitespace → return unchanged; (3) URI not a valid absolute URI → fail fast with a clear `InvalidOperationException`; (4) otherwise `AddAzureKeyVault(uri, new DefaultAzureCredential())`.
  - Net effect: with no URI set (local dev + CI + tests), the config pipeline is untouched and **zero Azure dependency** is required. `dotnet run` / `dotnet test` work offline. Provisioning the real vault + secrets is an E7 task.

- **User-secrets flow (documented in `docs/dev-setup-secrets.md` + `backend/README.md`):** run from `backend/`:
  ```
  dotnet user-secrets init --project src/Jaarplanner.Api      # already configured (UserSecretsId jaarplanner-api-dev)
  dotnet user-secrets set "ConnectionStrings:Postgres" "Host=localhost;Port=5433;Database=jaarplanner;Username=jaarplanner;Password=<your .env POSTGRES_PASSWORD>" --project src/Jaarplanner.Api
  dotnet user-secrets set "AzureAI:ApiKey" "<your-foundry-key>" --project src/Jaarplanner.Api   # future (E2)
  ```
  Connection-string key kept consistent with E0-04: `ConnectionStrings:Postgres`. Password matches `.env` `POSTGRES_PASSWORD` (E0-03); port = `DB_HOST_PORT` (default 5433).

- **AI-keys-server-side principle + where the future key lives:** Art. VI.4 / Art. IV — the Azure AI Foundry key is a server-side secret at config key **`AzureAI:ApiKey`** (user-secrets local, Key Vault cloud), read only in Infrastructure (the AI client, E2), never serialised into an API response or frontend bundle. Captured in code via `AzureAIOptions` (unused seam) and documented in `appsettings.Development.json` (`//AzureAI`) + the docs. No AI client implemented (scope discipline — E2).

- **Tests added:**
  - `KeyVaultConfigurationTests.No_vault_uri_in_production_is_a_no_op_and_does_not_touch_Azure` — Production + no URI → returns same builder, no Azure-requiring source added.
  - `..Development_environment_never_binds_Azure_even_if_a_uri_is_present` — Development is always skipped (user-secrets wins locally).
  - `..Empty_vault_uri_in_production_is_a_no_op` — whitespace URI → no-op.
  - `..Malformed_vault_uri_in_production_fails_fast_with_a_clear_message` — invalid URI → `InvalidOperationException` naming the key.

- **Gates:**
  - `dotnet build backend/Jaarplanner.sln` ✓ (Build succeeded, 0 warnings, 0 errors).
  - `dotnet test backend/Jaarplanner.sln` ✓ (UnitTests 1/1; IntegrationTests 7/7 — 3 prior + 4 new Key Vault tests). Run with **no Azure env vars set** (`KeyVault__Uri`, `AZURE_*` all unset) — proves the binding does not break tests.
  - `dotnet format --verify-no-changes` ✓ (exit 0).
  - **`/health` 200 with NO Azure/KeyVault env (no-op proof):**
    - Development (port 5184): `/health` → HTTP 200 "Healthy"; `/health/ready` → 503 "Unhealthy" (no DB).
    - **Production** (`ASPNETCORE_ENVIRONMENT=Production`, `--no-launch-profile`, port 5199, no Azure env): app started cleanly ("Hosting environment: Production"), `/health` → HTTP 200 "Healthy". This proves the Key Vault source is a true no-op when no URI is present, even outside Development. Process stopped after capture.

- **No-secret proof (Art. VI.4):** `git grep` over tracked files (excluding worklogs):
  - `vault.azure.net` → none.
  - `Password=` → only the `//Postgres-command` doc string with placeholder `<your .env POSTGRES_PASSWORD>` (a `//`-comment key, not a live config value).
  - `apikey` → only the `//AzureAI` doc comment with placeholder `<your-foundry-key>`.
  - broad scan (`AccountKey=`, `BEGIN PRIVATE KEY`, `sk-`, `AKIA`, `client_secret`) → none.
  - `ConnectionStrings:Postgres` value in `appsettings.Development.json` is `""` (empty). `.gitignore` excludes `.env*`. No real connection string, vault URI, or API key committed.

- **Branch:** story/E0-07

- **Self-check vs acceptance criteria:**
  - *"No secret is in the repo."* → MET. Grep proof above; only placeholders/templates/empty values.
  - *"A documented `dotnet user-secrets` flow exists."* → MET. `docs/dev-setup-secrets.md` (full flow + Key Vault + AI-key principle) and `backend/README.md` (quick start + reference). Exact commands for `ConnectionStrings:Postgres` and `AzureAI:ApiKey`.
  - *Key Vault binding stubbed, no-op when absent* → MET. `AddAzureKeyVaultIfConfigured` + 4 passing guard tests + Production `/health` 200 with no env.
  - *AI keys server-side only* → MET. Principle in code (`AzureAIOptions`) + config (`//AzureAI`) + docs; no AI client built.

- **For the test-runner:**
  - **Unit/integration (no Docker, no Azure needed):** from `backend/` run `dotnet test Jaarplanner.sln`. `KeyVaultConfigurationTests` (4) assert the no-op/guard behaviour; `HealthEndpointTests` still green. Ensure NO `KeyVault__Uri` / `AZURE_*` env vars are set — tests must pass regardless.
  - **No-op live proof (no Playwright; no UI):** from `backend/`, with no Azure env, `ASPNETCORE_ENVIRONMENT=Production ASPNETCORE_URLS=http://localhost:5199 dotnet run --project src/Jaarplanner.Api --no-launch-profile`, then GET `http://localhost:5199/health` → expect HTTP 200 "Healthy" (app starts with zero Azure dependency). Stop the process after.
  - **No-secret proof:** from the repo root, `git grep -nI "vault.azure.net"` and `git grep -nI "Password="` should surface only placeholder/comment strings.

- **Open questions / Art. XIV touched:** None. No domain entities, planningsblok granularity, Excel mapping, AI client, real Key Vault usage, frontend, Docker, or CI changes (deferred to E1 / E2 / E7 / E0-08 per scope discipline). The cloud-secrets choice is isolated behind the `AddAzureKeyVaultIfConfigured` seam.
