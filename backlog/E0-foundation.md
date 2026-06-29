# E0 — Project Foundation & Scaffolding

**Phase:** 0 (pre-build) · **Milestone:** M0 — Skeleton up
**Goal:** A running skeleton — repo structure, local Postgres, ASP.NET Core API, React/Vite SPA, CI, and the guardrails (i18n, secrets, layering) that the constitution requires from day one.
**Constitution:** [Art. VIII](../CONSTITUTION.md#article-viii--tech-stack--architecture-binding-choices) (stack), [Art. II](../CONSTITUTION.md#article-ii--domain-language-binding) (Dutch/i18n), [Art. VI](../CONSTITUTION.md#article-vi--roles-privacy--security) (no secrets).

---

- [x] **E0-01 — Repository structure & solution layout**
  Create the intended tree: `frontend/`, `backend/src/{Jaarplanner.Api,Application,Domain,Infrastructure}`, `backend/tests/{UnitTests,IntegrationTests}`, `docs/`, `backlog/`.
  *Done when:* solution builds empty; layering enforced (Domain ← Application ← Infrastructure, thin Api). Ref: Art. VIII.

- [x] **E0-02 — Pin toolchain**
  `global.json` pins the current .NET LTS SDK; frontend uses pnpm with a pinned Node version.
  *Done when:* `dotnet --version` and `pnpm` resolve to pinned versions on a clean machine.

- [x] **E0-03 — Local Postgres via Docker**
  `docker-compose.yml` with a `db` service.
  *Done when:* `docker compose up -d db` gives a reachable Postgres; connection string via user-secrets, **never committed** (Art. VI.4).

- [ ] **E0-04 — Backend bootstrap (ASP.NET Core Web API)**
  Minimal API project, health endpoint, EF Core + Npgsql wired, DI container.
  *Done when:* `dotnet run --project src/Jaarplanner.Api` serves `/health`; EF Core connects to Postgres.

- [~] **E0-05 — Frontend bootstrap (React 18 + TS + Vite + Tailwind)**
  Vite SPA, Tailwind, TanStack Query + Zustand providers, `@dnd-kit/core` installed.
  *Done when:* `pnpm dev` serves the app; `pnpm build` and `pnpm lint` pass.

- [ ] **E0-06 — i18n scaffold (`frontend/src/i18n/nl.json`)**
  Central Dutch strings file + a `t()` helper; lint/check that forbids hard-coded Dutch literals in components.
  *Done when:* sample screen renders all text from `nl.json`. Ref: Art. II.3.

- [ ] **E0-07 — Secrets & config strategy**
  .NET user-secrets locally; Azure Key Vault binding stubbed for cloud; **AI keys server-side only**.
  *Done when:* no secret is in the repo; a documented `dotnet user-secrets` flow exists. Ref: Art. VI.4.

- [ ] **E0-08 — CI pipeline & quality gates**
  CI runs `dotnet build` + `dotnet test` + `dotnet format --verify-no-changes` and `pnpm lint` + `pnpm test` + `pnpm build`.
  *Done when:* CI is green on an empty skeleton and blocks on format/lint failures. Ref: Art. X.

- [ ] **E0-09 — Design-system foundation (Radix + shadcn/ui + tokens + Storybook)**
  Add Radix UI + shadcn/ui (components copied into `frontend/src/components/ui/`); define Tailwind **design tokens** for doelsoort/suggestion-status/coverage colours; set up **Storybook**; wire **axe** accessibility checks into the dev/CI loop.
  *Done when:* a sample component renders from tokens, appears in Storybook, and passes an axe smoke check. Ref: ADR-0017, Art. VIII, Art. XII; UX doc `docs/ux/ui-ux-approach.md`.
