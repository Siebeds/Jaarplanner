# ADR-0012 — Secrets & configuration management

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The system holds sensitive credentials: the Postgres connection string and — most critically — the Azure AI Foundry key, which must **never** reach the frontend or the repo (Art. VI.4). The constitution mandates .NET user-secrets locally and Azure Key Vault in the cloud.

## Decision

We will manage configuration via the standard .NET configuration stack with environment-specific providers:
- **Local dev:** `dotnet user-secrets` for the DB connection string and AI key — nothing sensitive committed.
- **Cloud:** **Azure Key Vault** bound through the configuration provider; secrets injected at runtime, not baked into images.
- **AI keys are read only in Infrastructure (the AI client)** and are never serialised into any API response or frontend bundle.
- `.gitignore` and a CI secret-scan guard against accidental commits.

## Alternatives considered

- **`.env` files / appsettings with real values** — high risk of committing secrets; rejected.
- **Secrets as plain app settings in Azure** — workable but Key Vault gives rotation, access policies, and audit; preferred and mandated.
- **A frontend-readable token for AI** — would expose the key by definition; forbidden (Art. IV/VI).

## Consequences

**Positive**
- No secret in the repo; clean local/cloud parity; rotation and audit via Key Vault; structurally impossible for the SPA to see the AI key.

**Negative / trade-offs**
- Slight onboarding step (`user-secrets set …`); documented in E0-07.

**Follow-ups**
- E0-07 (user-secrets + Key Vault binding stub), E7-05 (security review confirms no exposure), CI secret-scan (E0-08).

## Compliance trace

- **Constitution:** Art. VI.4 (no secrets in repo, server-side keys), Art. VIII (Key Vault).
- **Backlog:** E0-07, E0-08, E7-05.
- **FR/NFR:** NFR-5.
