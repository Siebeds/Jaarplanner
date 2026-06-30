# Antagonist Review — E0-07 Secrets & config strategy (branch story/E0-07 @ 8cfcb32)

**Verdict:** COMPLIANT
**Scope audited:** `git diff feature/e0-foundation...story/E0-07` (9 files) + full tracked-tree grep for secrets.

## Findings
None. No violations, no drift, no scope creep. (Detail and proof below.)

## Checks run (proof of thoroughness)

### Art. VI.4 — No secrets in repo (CRITICAL category, scrutinised hard)
- Read the FULL diff and independently grepped the tracked tree (not just the diff).
- `git grep "vault.azure.net"` (excl. worklogs/docs) → only `KeyVaultConfiguration.cs:20` doc placeholder `https://my-vault.vault.azure.net/` and `KeyVaultConfigurationTests.cs:54` fixture `https://example-vault.vault.azure.net/`. Both are fake/example, not real vaults.
- `git grep "Password="` → every hit is the placeholder `Password=<your .env POSTGRES_PASSWORD>` inside a `//`-comment doc key (`appsettings.Development.json:10`), README, docs, or worklogs. No literal password.
- Broad secret scan (`AccountKey=`, `BEGIN PRIVATE KEY`, `sk-…`, `AKIA…`, `client_secret`, `InstrumentationKey=`, `SharedAccessKey`) → zero real hits (only the worklog's own description of having scanned).
- `appsettings.json` (base) → no ConnectionStrings, no secrets. `appsettings.Development.json` → `ConnectionStrings:Postgres` = `""` (empty, confirmed at line 11); `//KeyVault`/`//AzureAI` are non-secret documentation keys with placeholders only.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local`.
- `<UserSecretsId>jaarplanner-api-dev</UserSecretsId>` is an id pointing at a per-user store, not a secret.
- AI-key placeholders are `<your-foundry-key>` only. No real key, URI, connection string, account key, or private key is committed anywhere. **CRITICAL hard-stop: not triggered.**

### Art. VI / Art. IV — AI keys server-side only
- `AzureAIOptions.cs` is the only AI-related code. `git grep AzureAIOptions` confirms it is referenced **nowhere** except its own declaration + doc/worklog mentions → genuinely unused seam, not a live client (correctly deferred to E2).
- It lives in `Jaarplanner.Api/Configuration` (server-side composition root). No AI key value committed; key documented to live at `AzureAI:ApiKey` via user-secrets/Key Vault, read in Infrastructure in E2.
- No frontend touched (see scope check) → no path for an AI key to reach the client. Compliant.

### Art. VIII — Layering & stack
- Config wiring (`AddAzureKeyVaultIfConfigured`) is invoked at the Api composition root in `Program.cs` before service registration — correct place for config composition; Api stays thin (no business logic added).
- No inverted dependency: the extension lives in Api and operates on `IConfigurationBuilder`/`IHostEnvironment` only. AI client correctly NOT placed here.
- Packages: `Azure.Extensions.AspNetCore.Configuration.Secrets` 1.5.1 and `Azure.Identity` 1.21.0 — both verified to exist on NuGet; both are the standard, sanctioned Key Vault config provider + `DefaultAzureCredential`. No EPPlus, no unauthorised framework. Azure + EU hosting already ratified (ADR-0016).

### Guard logic correctness (the heart of the story)
- Order: (1) `IsDevelopment()` → return unchanged; (2) URI null/whitespace → return unchanged; (3) URI not absolute → fail fast with `InvalidOperationException` naming the key; (4) else `AddAzureKeyVault(uri, DefaultAzureCredential())`. The `AddAzureKeyVault` call is reachable ONLY inside the guard — never in Development or without a URI.
- Intermediate `configuration.Build()` to read `KeyVault:Uri` reads only already-added sources (offline) — no Azure contact. Harmless.
- 4 tests pin: prod+no-URI no-op, Development-skips-even-with-URI, whitespace no-op, malformed-URI fail-fast. Behaviour matches the acceptance criterion (zero Azure dependency locally + in tests/CI).

### Scope discipline
- `git diff --name-only`: only `backend/README.md`, `Configuration/AzureAIOptions.cs`, `Configuration/KeyVaultConfiguration.cs`, `Jaarplanner.Api.csproj`, `Program.cs`, `appsettings.Development.json`, `KeyVaultConfigurationTests.cs`, plus `docs/dev-setup-secrets.md` and the E0-07 worklog.
- No frontend, no Docker, no `.yml`/CI/`.github` (E0-08 untouched), no domain/data-model/migration, no Excel/coverage/AI-client code. No real Key Vault *usage* beyond the guarded binding. No scope creep.

### Art. XIV — Open decisions
- Nothing hard-assumed. Cloud-secrets choice isolated behind the `AddAzureKeyVaultIfConfigured` seam; Azure/EU already ratified (ADR-0016). No planningsblok/discipline/Excel assumption.

### Art. X — DoD
- Small (9 files, +429/-1), reviewable. Worklog reports build + `dotnet test` (UnitTests 1/1, IntegrationTests 7/7) + `dotnet format --verify-no-changes` green with no Azure env, plus a Production `/health` 200 no-op proof. Code structure is consistent with these claims (test project pins `KeyVaultConfigurationTests`; no Azure env required). No hard-coded Dutch (backend, no user-facing strings). No secrets.

## Open questions surfaced
None. The change touches no Art. XIV open decision.

---
**Conclusion:** COMPLIANT. The story does exactly what it claims and nothing more. No secret of any kind is committed — only placeholders, an empty connection-string value, doc comments, and a fake example vault URI in a test fixture. The Key Vault binding is a true no-op without a configured URI and is unreachable in Development. The AI-key seam is server-side, unused, and documented. No scope creep into E2/E0-08/E7.
