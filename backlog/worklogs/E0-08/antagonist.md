# Antagonist Review — E0-08 CI pipeline & quality gates (`.github/workflows/ci.yml`)

**Verdict:** COMPLIANT
**Scope audited:** `git diff feature/e0-foundation...story/E0-08` — `.github/workflows/ci.yml` (new), `backlog/worklogs/E0-08/implementation.md` (new). No app/source/data-model changes.

## Findings
None. No violations, no drift requiring action.

## Checks run (proof of thoroughness)
- **Art. X — Definition of Done (all six gates present & blocking).**
  Backend: `dotnet build ... -c Release` (line 40), `dotnet test` (line 45), `dotnet format --verify-no-changes` (line 49).
  Frontend: `corepack pnpm lint` (line 77), `corepack pnpm test` (line 80), `corepack pnpm build` (line 83).
  Verified `frontend/package.json`: `lint` = `eslint . && tsc --noEmit` (lint + type-check both block), `test` = `vitest run`, `build` = `tsc -b && vite build`. Grepped the whole workflow for `continue-on-error` and `|| true` — none present. Every gate's non-zero exit fails the job. PASS.
- **Art. VIII — toolchain fidelity.**
  Backend uses `setup-dotnet@v4` with `global-json-file: global.json` (line 34); root `global.json` pins `10.0.201` / `latestPatch` — no hardcoded divergent version. Frontend uses `setup-node@v4` with `node-version-file: .nvmrc` (line 65); `.nvmrc` = `24`. pnpm resolved via `corepack enable` + `corepack pnpm ...`, honouring `frontend/package.json` `packageManager: pnpm@11.9.0`. No version drift; pins are the single source. `dotnet restore`/`build`/`test` target `backend/Jaarplanner.sln`, which exists. PASS.
- **Art. VI — secrets / least privilege.**
  Grepped for `secret|token|password|key` — none embedded. Workflow declares no `secrets:` and needs none. `permissions: contents: read` (lines 19-20) is least-privilege (read-only default GITHUB_TOKEN). No AI key, no frontend key exposure. PASS.
- **Scope discipline.**
  No `deploy|release|publish|registry|docker push` steps. No coverage/codecov upload. No Postgres `services:` container — instead a TODO comment (lines 42-43) defers it to E1, which is the allowed approach. Diff touches only the workflow + worklog; no app code. No scope creep. PASS.
- **Art. XIV — open decisions.**
  Nothing hard-assumed. Deferring the Postgres service container to E1 keeps the DB-integration decision behind a seam rather than committing to it now. PASS.
- **Art. X.6 — small/reviewable.**
  83-line single workflow file + worklog; two parallel jobs; concurrency `cancel-in-progress` to save runner minutes. Reviewable. PASS.
- **Triggers.**
  `push: branches: ["**"]` + `pull_request: branches: [main]` — matches the stated design; the duplicate-run cost is mitigated by the concurrency group. Acceptable, no violation.

## Open questions surfaced
None. The one deferred decision (Postgres service container) is explicitly parked as a TODO for E1 — correctly handled, no premature commitment.
