# E0-02 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (CLI toolchain verification — no UI, no running app; Playwright not applicable)

## Criteria checked

### Criterion 1 — `dotnet --version` resolves to the pinned SDK (.NET 10 LTS, 10.0.201, rollForward latestPatch) governed by a worktree-root `global.json`
- **PASS** — `global.json` at worktree root contains exactly:
  ```json
  { "sdk": { "version": "10.0.201", "rollForward": "latestPatch" } }
  ```
- `dotnet --version` from the worktree root → `10.0.201`.
- `dotnet --info` → `Version: 10.0.201`, `Base Path: C:\Program Files\dotnet\sdk\10.0.201\` — confirms the resolved SDK matches the pin.
- `dotnet build backend/Jaarplanner.sln` → **Build succeeded, 0 Warning(s), 0 Error(s)**; all 6 projects compiled to `net10.0`. The pin does not break the existing solution.

### Criterion 2 — pnpm pinned (pnpm@11.9.0 via Corepack `packageManager`) and Node pinned (`.nvmrc` = 24; `engines.node >=24`), clean-machine-friendly
- **PASS** — `frontend/package.json` contains `"packageManager": "pnpm@11.9.0"`, `"engines": { "node": ">=24" }`, and `"private": true`.
- `.nvmrc` at worktree root = `24` (the 24 LTS line).
- `corepack pnpm --version` from `frontend/` → `11.9.0` — the pinned pnpm resolves via the non-admin Corepack invocation path. Confirms the implementer's note that `corepack enable` requires admin (not run) while `corepack pnpm <cmd>` still resolves the pinned version.
- `node --version` → `v24.11.1` — satisfies both `.nvmrc` 24 and `engines.node >=24`. Clean-machine-friendly: pins are declarative (global.json / .nvmrc / packageManager), no machine-specific paths.

## Scope discipline — PASS
`git diff --stat main...HEAD` shows E0-02 added only:
- `.nvmrc` (+1)
- `frontend/package.json` (+8) — minimal, no real dependencies
- `global.json` (+6)
- `backlog/worklogs/E0-02/implementation.md` (worklog)

No Vite/React app, no real dependencies, no `pnpm-lock.yaml`, no `node_modules`, no health endpoint, no EF/Docker/CI added. `frontend/` contains only `package.json` + `README.md`. The backend solution (6 projects) is pre-existing E0-01 scaffolding and is NOT part of this branch's diff.

## Commands run
- `dotnet --version` (worktree root) → `10.0.201`
- `dotnet --info` → SDK 10.0.201, Base Path `...\sdk\10.0.201\`
- `node --version` → `v24.11.1`
- `corepack pnpm --version` (from `frontend/`) → `11.9.0`
- `dotnet build backend/Jaarplanner.sln` → Build succeeded, 0 errors, 0 warnings
- `git diff --stat main...HEAD` → 4 files, pinning artifacts + worklog only
- `git ls-files` / `ls frontend/` → no node_modules, no lockfile, minimal frontend

## Evidence
- `global.json`: `version 10.0.201`, `rollForward latestPatch`
- `frontend/package.json`: `packageManager pnpm@11.9.0`, `engines.node >=24`, `private true`
- `.nvmrc`: `24`
- Build output: `net10.0` artifacts for all projects, 0/0 warnings/errors
- Branch `story/E0-02`, commit `bbf9936`

## Defects
None.
