# Secrets & configuration — developer setup

How Jaarplanner handles secrets and per-environment configuration.

> **Binding principle (Constitution Art. VI.4, ADR-0012):** **No secret is ever committed
> to the repo.** Locally, secrets come from **.NET user-secrets**. In the cloud, they come
> from **Azure Key Vault**. **AI keys are server-side only** and must never reach the frontend.

## Strategy at a glance

| Environment | Secret source | How it's wired |
| --- | --- | --- |
| Local dev | **`dotnet user-secrets`** (per-user store, outside the repo) | Standard .NET config provider, auto-loaded in Development via `<UserSecretsId>` |
| CI / tests | none required | No secret needed; the DB-readiness check tolerates an absent connection string |
| Cloud (non-Development) | **Azure Key Vault** | Added as a config source only when `KeyVault:Uri` is set (see below) |

The application reads everything through the standard `IConfiguration` stack, so a key set
via user-secrets, an environment variable, or Key Vault is read the same way in code.

## Local development: `dotnet user-secrets`

The `Jaarplanner.Api` project already carries a `<UserSecretsId>` (`jaarplanner-api-dev`),
so the user-secrets provider is loaded automatically in the Development environment. The id
only points at a per-user store on your machine (`%APPDATA%\Microsoft\UserSecrets\…` on
Windows); **no secret lives in the project file.**

Run these from the `backend/` directory.

1. (First time only) initialise the store — already configured, but harmless to re-run:

   ```bash
   dotnet user-secrets init --project src/Jaarplanner.Api
   ```

2. Set the Postgres connection string (key **`ConnectionStrings:Postgres`**, consistent with
   E0-04). The password must match `POSTGRES_PASSWORD` from your local, gitignored `.env`
   (see `.env.example`; the port is `DB_HOST_PORT`, default `5433`):

   ```bash
   dotnet user-secrets set "ConnectionStrings:Postgres" \
     "Host=localhost;Port=5433;Database=jaarplanner;Username=jaarplanner;Password=<your .env POSTGRES_PASSWORD>" \
     --project src/Jaarplanner.Api
   ```

3. (Future — E2, optional today) set the Azure AI Foundry key (key **`AzureAI:ApiKey`**).
   No AI client exists yet; this is where the key will live when it does:

   ```bash
   dotnet user-secrets set "AzureAI:ApiKey" "<your-foundry-key>" --project src/Jaarplanner.Api
   ```

Useful commands:

```bash
dotnet user-secrets list --project src/Jaarplanner.Api     # show what's set (values visible locally only)
dotnet user-secrets remove "AzureAI:ApiKey" --project src/Jaarplanner.Api
dotnet user-secrets clear --project src/Jaarplanner.Api
```

The app runs **without** any secret set — `/health` returns 200 and `/health/ready` reports
the DB as unreachable (503) rather than crashing. Set the connection string when you want a
live database (`docker compose up -d db` from the repo root first).

## Cloud: Azure Key Vault binding (stubbed)

In **non-Development** environments the host adds Azure Key Vault as a configuration source
**only when a vault URI is configured**. This is wired in `Program.cs` via
`builder.Configuration.AddAzureKeyVaultIfConfigured(builder.Environment)`
(`src/Jaarplanner.Api/Configuration/KeyVaultConfiguration.cs`).

- **Trigger:** config key **`KeyVault:Uri`** (or env var **`KeyVault__Uri`**), e.g.
  `https://jaarplanner-kv.vault.azure.net/`.
- **No-op when absent:** if the environment is Development, or the URI is missing/empty, the
  method returns without touching the config pipeline. This is why `dotnet run` and
  `dotnet test` work locally with **zero Azure dependencies**.
- **Auth:** uses `DefaultAzureCredential` (managed identity in Azure) — no credential is
  stored anywhere.
- **No hard-coded values:** the vault URI is read from config/env, never committed.

Packages (in `Jaarplanner.Api`): `Azure.Extensions.AspNetCore.Configuration.Secrets` and
`Azure.Identity`. Provisioning the actual vault and its secrets is an E7 (hosting) task; this
story only wires the guarded binding seam.

## AI keys are server-side only

Per Art. VI.4 / Art. IV and ADR-0012:

- The Azure AI Foundry key is a **server-side secret**: user-secrets locally (`AzureAI:ApiKey`),
  Azure Key Vault in the cloud.
- It is **never** committed to the repo and **never** sent to the frontend. All AI calls
  originate from the backend (`Infrastructure`), where the key is read.
- A documented, **currently-unused** options seam exists at
  `src/Jaarplanner.Api/Configuration/AzureAIOptions.cs` to mark where the key binds in E2.
  No AI client is implemented yet.

## Proving no secret is committed

The only `appsettings*.json` value for a secret is an empty string plus `//`-prefixed comment
keys documenting the command. There is no real connection string, vault URI, or API key
anywhere in the repo. `.gitignore` excludes `.env*`. See the E0-07 worklog for the exact grep
used to verify this.
