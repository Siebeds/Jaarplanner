# Jaarplanner backend

ASP.NET Core Web API (C#, .NET 10) — pragmatically layered: `Domain` ← `Application` ←
`Infrastructure`, with a thin `Api` (Constitution Art. VIII).

## Common commands

Run from `backend/`:

```bash
dotnet restore
dotnet build Jaarplanner.sln
dotnet test Jaarplanner.sln
dotnet format                       # apply code style
dotnet run --project src/Jaarplanner.Api   # serves /health and /health/ready
```

Local Postgres (from the repo root, where `docker-compose.yml` lives):

```bash
cp .env.example .env                # set POSTGRES_PASSWORD to a local-only value
docker compose up -d db
```

## Secrets & configuration

**No secret is ever committed** (Art. VI.4 / ADR-0012). Local dev uses **.NET user-secrets**;
the cloud uses **Azure Key Vault** (bound only when `KeyVault:Uri` is set); **AI keys are
server-side only**.

The full developer flow — `dotnet user-secrets` commands for the Postgres connection string
(`ConnectionStrings:Postgres`) and the future AI key (`AzureAI:ApiKey`), plus the Key Vault
binding details — lives in **[`docs/dev-setup-secrets.md`](../docs/dev-setup-secrets.md)**.

Quick start (from `backend/`):

```bash
dotnet user-secrets set "ConnectionStrings:Postgres" \
  "Host=localhost;Port=5433;Database=jaarplanner;Username=jaarplanner;Password=<your .env POSTGRES_PASSWORD>" \
  --project src/Jaarplanner.Api
```

The app starts fine with no secret set; `/health` returns 200 and `/health/ready` reports the
database as unreachable until the connection string and a running Postgres are present.
