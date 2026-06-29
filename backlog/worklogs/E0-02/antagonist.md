# Antagonist Review — E0-02 (Pin toolchain)

**Verdict:** COMPLIANT
**Scope audited:** branch diff `feature/e0-foundation...story/E0-02` (commit `bbf9936`) — `global.json`, `.nvmrc`, `frontend/package.json`, and `backlog/worklogs/E0-02/implementation.md`.

## Findings
None blocking. The change is exactly the four files declared (3 artifacts + worklog), 157 insertions, all additions, no deletions/edits to existing files.

### [QUESTION] rollForward band is a deliberate reproducibility choice, not an open Art. XIV decision
- **Article/FR:** Art. VIII / Art. XIV
- **Where:** `global.json:4`
- **Problem:** Not a violation. `rollForward: latestPatch` locks the SDK to the 10.0.2xx feature band. A clean machine that only has a newer *feature* band (10.0.3xx+) would fail to resolve. The implementer explicitly flagged this as a non-blocking follow-up for the orchestrator rather than silently choosing `latestFeature`. This is the correct handling (isolated, surfaced, not hard-assumed). Raised only so the orchestrator is aware.
- **Required fix:** None. Optionally relax to `latestFeature` if CI provisions a newer feature band; otherwise leave as-is for maximum reproducibility.

## Checks run (proof of thoroughness)
- **Art. VIII (stack — .NET LTS pinned).** `global.json` pins `10.0.201` with `rollForward: latestPatch`. .NET 10 is the current LTS line (released Nov 2025, 3-yr support); the pin is in `global.json` at repo root exactly as Art. VIII requires. Schema valid (`sdk.version` + `rollForward`). PASS.
- **Art. VIII (frontend pnpm + Node).** `.nvmrc` = `24` (Node 24 "Krypton" is an active LTS line); `frontend/package.json` declares `packageManager: pnpm@11.9.0` (Corepack-blessed exact pin) and `engines.node: >=24`. pnpm is the mandated package manager; no contradiction with the stack. PASS.
- **Art. VIII (no unauthorised deps / no framework deviation).** `frontend/package.json` has zero `dependencies`/`devDependencies`/`scripts`. No EPPlus, no Vite scaffold, no Tailwind/TanStack/Zustand/@dnd-kit/ESLint. PASS.
- **Scope discipline (no creep into E0-03/04/05/08).** `git diff --name-status` shows only `.nvmrc`, `frontend/package.json`, `global.json`, and the worklog added. No Vite app, no health endpoint, no EF Core, no Docker, no CI workflow, no real frontend deps. The backend `.sln`/`src`/`tests` already exist from E0-01 and are untouched by this diff. PASS — genuinely minimal.
- **`frontend/package.json` is the minimal seam E0-05 extends.** Carries only identity (`name`, `private`) + the two pins. Confirmed minimal; worklog documents the merge expectation for E0-05. PASS.
- **Art. VI.4 (no secrets).** Scanned all added lines: no keys, tokens, connection strings, passwords, or AI keys. Pins are pure config. No AI key reachable from frontend (no AI code at all). PASS.
- **Art. VI.2 (no pupil data).** No data model, no entities introduced. N/A — clean. PASS.
- **Art. II (domain/UI language).** No domain entities, no user-facing strings, no `.tsx`/`.ts` app code. `name: jaarplanner-frontend` is a technical identifier (English-appropriate). No hard-coded Dutch. PASS.
- **Art. X (DoD).** Change is small and reviewable (157 lines, config only). No tests required — no runtime logic. Worklog records `dotnet build` (0/0) and `dotnet format --verify-no-changes` (exit 0) green under the pin (claimed, not independently re-run here; plausible given no source changes). No secrets, no hard-coded Dutch, constitution-consistent. PASS.
- **Art. XIV (open decisions).** No domain entity, planningsblok granularity, discipline selection, or Excel mapping touched. The one config-level judgement (rollForward band) was surfaced, not hard-assumed. PASS.
- **Scope (FA non-goals).** Nothing touches pupil tracking, external integrations, parent/pupil access, lesson-material generation, or grading. PASS.

## Open questions surfaced
- **rollForward feature-band policy** (config, not Art. XIV domain decision): `latestPatch` vs `latestFeature` for clean-machine resolution if a newer .NET 10 feature band is the only one installed. Implementer flagged it for the orchestrator; no action required for this story.

## Note on independent verification
The build/format/version-resolution gates (`dotnet --version` -> 10.0.201, `corepack pnpm --version` -> 11.9.0, backend build 0/0) are reported in the worklog and are consistent with a config-only change; I did not re-execute them. To fully confirm I would run `dotnet --version`, `dotnet --info` (global.json path), and `corepack pnpm --version` on this machine — but nothing in the diff could break a previously-green build.
