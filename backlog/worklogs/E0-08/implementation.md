# E0-08 — CI pipeline & quality gates

## Build round 1 — GitHub Actions workflow running the six DoD gates

- **FR / Article:** CONSTITUTION.md Art. X (Definition of Done — the gate set is exactly
  the DoD gates). Epic E0, Milestone M0.

- **Files changed:**
  - `.github/workflows/ci.yml` — new GitHub Actions workflow with two parallel jobs
    (`backend`, `frontend`) running the six DoD quality gates. This is the only file
    added; no application code touched.

### Workflow structure (jobs / steps)

Triggers: `on: push` (all branches, `["**"]`) and `pull_request` to `main`.
`concurrency` cancels superseded runs on the same ref. `permissions: contents: read`
(least privilege; no `GITHUB_TOKEN` write needed — there is nothing to push).

**`backend` job** (`ubuntu-latest`):
1. `actions/checkout@v4`
2. `actions/setup-dotnet@v4` with `global-json-file: global.json` — honours the pinned
   SDK `10.0.201` from repo-root `global.json` (no hardcoded version).
3. `dotnet restore backend/Jaarplanner.sln`
4. `dotnet build backend/Jaarplanner.sln --no-restore -c Release`
5. `dotnet test backend/Jaarplanner.sln --no-build -c Release`
   (carries a `# TODO E1:` comment — a Postgres service container will be added in E1
   when real DB integration tests arrive; deliberately omitted now.)
6. `dotnet format backend/Jaarplanner.sln --verify-no-changes` — **blocking format gate**.

**`frontend` job** (`ubuntu-latest`, `defaults.run.working-directory: frontend`):
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with `node-version-file: .nvmrc` — honours the pinned Node
   line `24` from repo-root `.nvmrc` (no hardcoded version).
3. `corepack enable` — so `pnpm` resolves to the version pinned in
   `frontend/package.json` (`packageManager: pnpm@11.9.0`); a bare `pnpm` is not
   guaranteed on PATH.
4. `corepack pnpm install --frozen-lockfile` — uses the committed
   `frontend/pnpm-lock.yaml`; `pnpm-workspace.yaml` `allowBuilds: { esbuild: true }`
   lets esbuild's build script run non-interactively.
5. `corepack pnpm lint` — **blocking lint gate**.
6. `corepack pnpm test`
7. `corepack pnpm build`

### How it honours the pinned toolchain
- .NET SDK: `setup-dotnet` reads `global.json` (`global-json-file: global.json`) → 10.0.201.
- Node: `setup-node` reads `.nvmrc` (`node-version-file: .nvmrc`) → 24.x.
- pnpm: `corepack` + `corepack pnpm …` → pnpm 11.9.0 from `packageManager`.
- Action versions pinned to `@v4` major tags (checkout, setup-dotnet, setup-node).

### How format / lint genuinely block
Both run as plain steps. There is **no** `continue-on-error` and **no** `|| true` anywhere
in the workflow (verified by a string scan). A non-zero exit from either step fails its
job, which fails the workflow. Proven locally:
- `dotnet format … --verify-no-changes` → **exit 2** when an unformatted file is present
  (temporary edit to `AzureAIOptions.cs`, then reverted).
- `pnpm lint` (`eslint .`) → **exit 1** on a `no-restricted-syntax` error (temporary
  `.tsx` probe with hard-coded JSX text, then removed). The `&&` chain short-circuits, so
  a lint failure fails the script before `tsc`.

### Local proof that every gate command passes ("CI is green on the skeleton")
Run from the worktree (`story/E0-08`, branched from `feature/e0-foundation`):

Backend (`backend/Jaarplanner.sln`):
- `dotnet restore` → success.
- `dotnet build --no-restore -c Release` → Build succeeded, 0 warnings, 0 errors.
- `dotnet test --no-build -c Release` → UnitTests 1/1 passed; IntegrationTests 7/7 passed.
  (Tests run without Postgres/Azure, as expected for the skeleton.)
- `dotnet format --verify-no-changes` → **exit 0** (clean).

Frontend (`frontend/`):
- `corepack pnpm install --frozen-lockfile` → exit 0 (lockfile already up to date; no
  lockfile change needed).
- `corepack pnpm lint` → exit 0 (2 react-refresh **warnings** only, 0 errors).
- `corepack pnpm test` → exit 0, 7/7 tests passed (2 files).
- `corepack pnpm build` → exit 0 (`tsc -b && vite build`, 87 modules, built clean).

### Workflow YAML validity
Parsed with a YAML parser: 2 jobs (`backend`, `frontend`), triggers `push` +
`pull_request`, backend 6 steps, frontend 7 steps; all action `uses`/`with` keys present
and correct. `actionlint` was not available on this machine; validation was therefore by
YAML parse + structural key assertions (`global-json-file`, `node-version-file`,
`working-directory`, blocking-step assertions).

### Key decisions
- Two parallel jobs (recommended) rather than one — cleaner separation and faster.
- `-c Release` for build+test (matches a CI-quality build); `--no-restore` / `--no-build`
  chain restore → build → test to avoid redundant work.
- `push` on all branches so the feature/story branches get CI too.
- No Art. XIV open decision is touched; this is pure tooling/infra.

### Deliberately deferred (scope discipline)
- **Postgres service container → E1** (no DB integration tests exist yet; marked with a
  `# TODO E1:` comment).
- **CD / deploy / release** → later (out of scope; this is CI gates only).
- **Coverage upload / external services** → not added.
- **`build-storybook`** → not added; the six DoD gates are the scope, Storybook build is
  not a DoD gate and would add runner time for no DoD value.

### Self-check vs acceptance criteria
- "CI is green on the current skeleton" → all six gate commands pass locally in the
  worktree (evidence above). The actual green GitHub run happens on push (orchestrator
  controls push); verified here by construction + local execution.
- "CI blocks on format/lint failures" → demonstrated: `dotnet format --verify-no-changes`
  exits 2 on an unformatted file; `pnpm lint` exits 1 on a lint-rule violation. Neither
  step uses `continue-on-error`/`|| true`, so each failure fails the pipeline.

### For the test-runner
This is infra — no Playwright. Verify by:
1. **YAML validity:** parse `.github/workflows/ci.yml` (or run `actionlint` if available).
   Expect 2 jobs, `push` + `pull_request` triggers, `@v4` actions, `global-json-file:
   global.json` and `node-version-file: .nvmrc`, no `continue-on-error`/`|| true`.
2. **Backend gates** (repo root):
   - `dotnet restore backend/Jaarplanner.sln`
   - `dotnet build backend/Jaarplanner.sln --no-restore -c Release`
   - `dotnet test backend/Jaarplanner.sln --no-build -c Release`
   - `dotnet format backend/Jaarplanner.sln --verify-no-changes` (expect exit 0)
3. **Frontend gates** (`cd frontend`):
   - `corepack enable && corepack pnpm install --frozen-lockfile`
   - `corepack pnpm lint` (exit 0; warnings only)
   - `corepack pnpm test` (7 passed)
   - `corepack pnpm build`
4. **Blocking proof (optional):** introduce an unformatted `.cs` change → `dotnet format
   --verify-no-changes` exits non-zero; introduce a `.tsx` with hard-coded JSX text →
   `pnpm lint` exits non-zero. Revert.

### Open questions / Art. XIV touched
None. Pure tooling. The actual green run on github.com/Siebeds/Jaarplanner will be
confirmed by the orchestrator on push.

### Branch
`story/E0-08` (branched from `feature/e0-foundation`). Not pushed, no PR.
