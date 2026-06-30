# E0-08 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (backend gates) + frontend gates + YAML by-construction review
(NOT Playwright — CI/infra story)

## Criteria checked

- **AC1: "CI is green on the current skeleton (every gate command the workflow runs must pass locally)."** → PASS
  - `dotnet restore backend/Jaarplanner.sln` → exit 0 ("All projects are up-to-date").
  - `dotnet build backend/Jaarplanner.sln --no-restore -c Release` → exit 0, Build succeeded, 0 warnings / 0 errors.
  - `dotnet test backend/Jaarplanner.sln --no-build -c Release` → exit 0, all passed WITHOUT Postgres/Azure (UnitTests 1/1, IntegrationTests 7/7).
  - `dotnet format backend/Jaarplanner.sln --verify-no-changes` → exit 0 (no output).
  - `corepack pnpm install --frozen-lockfile` → exit 0 with the committed lockfile (pnpm 11.9.0 resolved via corepack from packageManager pin).
  - `corepack pnpm lint` → exit 0, 0 errors (2 non-blocking react-refresh warnings on shadcn ui/badge+button); includes `tsc --noEmit` type-check.
  - `corepack pnpm test` → exit 0, 7/7 passed including the jest-axe a11y smoke test (DoelsoortBadge.test.tsx `toHaveNoViolations`).
  - `corepack pnpm build` → exit 0, `tsc -b && vite build`, 87 modules, built in 2.75s.

- **AC2: "CI BLOCKS on format/lint failures (no continue-on-error / || true)."** → PASS
  - String-scan of ci.yml for `continue-on-error` and `|| true` → No matches.
  - Format gate blocks: injected `AddOpenApi(  )    ;` whitespace into Program.cs → `dotnet format --verify-no-changes` exited **2** with WHITESPACE errors. Reverted.
  - Lint gate blocks: injected hard-coded Dutch JSX text `<p>Welkom bij de jaarplanner</p>` into App.tsx → `pnpm lint` exited **1** with `no-restricted-syntax` (Art. II.3) error. Reverted.
  - Working tree confirmed clean after both reverts (only pre-existing untracked backlog/worklogs/E0-08/antagonist.md remains).

## Workflow YAML review (.github/workflows/ci.yml)

- Triggers: `push: branches: ["**"]` and `pull_request: branches: [main]`. PASS (push covers main; pull_request scoped to main per spec). Minor note: push fires on all branches, not only main — broader than the literal "push to main" wording but harmless and arguably desirable for a CI gate.
- Two jobs: `backend` (Backend gates) + `frontend` (Frontend gates). PASS.
- Backend: `actions/setup-dotnet@v4` with `global-json-file: global.json` (pins SDK 10.0.201). PASS.
- Frontend: `actions/setup-node@v4` with `node-version-file: .nvmrc` (24) + `corepack enable` + `corepack pnpm install --frozen-lockfile`. PASS.
- Actions pinned at `@v4`: checkout@v4, setup-dotnet@v4, setup-node@v4. PASS.
- Scope: no deploy/CD/release steps; no Postgres `services:` container (deferred to E1 via explicit TODO comment at lines 42-43); no app code changes in this story. PASS.

## Commands run
- dotnet restore / build (Release) / test (Release, --no-build) / format --verify-no-changes → all exit 0
- corepack pnpm install --frozen-lockfile / lint / test / build → all exit 0
- Negative: dotnet format with injected whitespace → exit 2; pnpm lint with injected Dutch JSX → exit 1
- git checkout -- (both files); git status --porcelain → clean (only untracked antagonist.md)

## Evidence
- ci.yml has zero `continue-on-error` / `|| true` (Grep: No matches).
- jest-axe smoke test present and executed: frontend/src/components/DoelsoortBadge.test.tsx ("has no axe violations for every doelsoort variant").
- Format step Program.cs(14,...) WHITESPACE errors on injection; eslint App.tsx 25:47 no-restricted-syntax error on injection.

## Environment notes (not defects)
- `corepack enable` failed locally with EPERM (cannot write shims into C:\Program Files\nodejs without admin) — Windows-only permission issue. `corepack pnpm <cmd>` works directly and resolves the pinned 11.9.0; on the CI ubuntu runner `corepack enable` succeeds. No impact on the gates.

## Defects
- None.
