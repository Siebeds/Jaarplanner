# E0-01 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (.NET CLI) — no UI, Playwright not applicable

## Criteria checked
- "The .NET solution `backend/Jaarplanner.sln` builds empty (`dotnet build` succeeds, no errors)." → PASS — `dotnet build Jaarplanner.sln`: "Build succeeded. 0 Warning(s) 0 Error(s)". All 6 projects compiled to net10.0.
- "Layering enforced — Domain ← Application ← Infrastructure, thin Api" → PASS (per-project reference graph below).
  - `Jaarplanner.Domain` references no other project → PASS — `dotnet list reference`: "There are no Project to Project references". KEY INVARIANT confirmed independently.
  - `Jaarplanner.Application` references `Jaarplanner.Domain` only → PASS — single ref: `..\Jaarplanner.Domain\Jaarplanner.Domain.csproj`.
  - `Jaarplanner.Infrastructure` references `Jaarplanner.Application` (Domain transitive) → PASS — single ref: `..\Jaarplanner.Application\Jaarplanner.Application.csproj`.
  - `Jaarplanner.Api` references `Jaarplanner.Application` and `Jaarplanner.Infrastructure` → PASS — exactly those two refs.
  - Test projects reference what they need → PASS — UnitTests → Domain, Application, Infrastructure; IntegrationTests → Api.
- "All projects are in the single solution `backend/Jaarplanner.sln`." → PASS — `dotnet sln list` shows all 6 projects (Api, Application, Domain, Infrastructure, UnitTests, IntegrationTests).

## Commands run (from worktree `backend/`)
- `dotnet sln Jaarplanner.sln list` → 6 projects listed.
- `dotnet list <each>.csproj reference` → reference graph matches required layering exactly (see above).
- `dotnet build Jaarplanner.sln` → Build succeeded, 0 Warning(s), 0 Error(s).
- `dotnet test Jaarplanner.sln --no-build` → UnitTests: 1 passed / 0 failed; IntegrationTests: 1 passed / 0 failed.
- `dotnet format Jaarplanner.sln --verify-no-changes` → exit code 0 (no formatting changes needed).

## Evidence
- Reference direction strictly Domain ← Application ← Infrastructure; Api depends on Application + Infrastructure. Domain has zero project references (no inward dependency leaks) — the central layering invariant holds.
- No backend code (apart from placeholder tests) so the "builds empty" intent is satisfied.

## Observations (non-blocking, not part of E0-01 criteria)
- No `global.json` present in the worktree to pin the .NET SDK; build resolved to net10.0. CLAUDE.md mandates pinning the SDK, but this is not part of E0-01's "Done when" — flag for the relevant E0 story.

## Defects
- None.
