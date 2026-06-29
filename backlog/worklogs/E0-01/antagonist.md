# Antagonist Review — E0-01 Repository structure & solution layout

**Verdict:** COMPLIANT
**Scope audited:** `git diff main...story/E0-01` (commit `fe065e8`) — 17 files: `backend/Jaarplanner.sln`, the six projects (Domain/Application/Infrastructure/Api + Unit/IntegrationTests), `backend/.gitignore`, Api config/Program/launchSettings/.http, `frontend/README.md`, and the worklog.

## Findings

No violations. No CRITICAL/MAJOR/MINOR findings. One QUESTION (non-blocking) and one observation below.

### [QUESTION] `.slnx` vs `.sln` and `net10.0` target are sound but worth a directie/ADR note
- **Article/FR:** Art. VIII (".NET LTS, SDK pinned in `global.json`"); Art. XI (stack choices change only by amendment).
- **Where:** `backend/Jaarplanner.sln`; all `*.csproj` `<TargetFramework>net10.0`; worklog §"Key decisions".
- **Problem (not a violation):** Constitution Art. VIII says ".NET LTS". .NET 10 (`10.0.201` installed) is the current LTS, so `net10.0` is consistent with the article. The implementer correctly deferred `global.json` SDK pinning to E0-02 (per story scope). The `.slnx`→`.sln` decision is purely a tooling/format choice with no constitutional dimension — the story's acceptance criterion names `backend/Jaarplanner.sln`, and classic `.sln` satisfies it. No action required for this story; just confirming the LTS premise holds and that E0-02 must actually add `global.json` so the SDK is pinned (Art. VIII).

### [Observation] Api retains template OpenAPI scaffold — within scope
- **Article/FR:** Art. VIII (thin Api); scope discipline.
- **Where:** `backend/src/Jaarplanner.Api/Program.cs`, `Jaarplanner.Api.csproj` (`Microsoft.AspNetCore.OpenApi` 10.0.5).
- **Note:** `Program.cs` contains only default template wiring (`AddOpenApi`/`MapOpenApi`/`UseHttpsRedirection`) and an explicit comment that endpoints/DI come in E0-04. No health endpoint with logic, no business logic — the Api is genuinely thin. The leftover `.http` file still references `/weatherforecast/` (the trimmed sample). Cosmetic only; not a violation, but could be tidied when the first real endpoint lands.

## Checks run (proof of thoroughness)

- **Art. II — Domain language:** Project names keep the Dutch domain identifier `Jaarplanner`; layer names (Domain/Application/Infrastructure/Api) are English infrastructure terms, as Art. II.2 allows. No user-facing strings introduced. Grepped the diff for hard-coded Dutch literals in `.cs`/`.tsx`/`.ts` — none (the only Dutch tokens are project/namespace names and worklog prose). **Pass.**
- **Art. III / VII — Curriculum data integrity / Excel mapping:** No domain entities, no Excel parser, no Op.stap mapping introduced. Nothing to violate. **N/A — clean.**
- **Art. IV — AI advisory:** No AI client, prompt, or orchestration added. **N/A — clean.**
- **Art. V — Coverage:** No coverage logic added. **N/A — clean.**
- **Art. VI — Secrets/privacy/security:** Scanned the full diff for `password|secret|connectionstring|apikey|accountkey|pwd=|server=|host=` — none found. `appsettings.json` / `appsettings.Development.json` contain only logging config + `AllowedHosts: "*"` (template default, dev-only); no connection strings, no AI keys, no `ConnectionStrings` section. No frontend code that could reach an AI key. `.gitignore` ignores `bin/`/`obj/`/`.vs/`/`*.user`. **Pass.**
- **Art. VIII — Tech stack & layering:** Verified the project reference graph from the `.csproj` files:
  - `Jaarplanner.Domain` → (no ProjectReference). Cannot depend upward — structurally guaranteed.
  - `Jaarplanner.Application` → Domain only.
  - `Jaarplanner.Infrastructure` → Application (Domain transitive).
  - `Jaarplanner.Api` → Application + Infrastructure (thin composition root).
  - `UnitTests` → Domain + Application + Infrastructure; `IntegrationTests` → Api.
  Matches the prescribed `Domain ← Application ← Infrastructure`, thin Api. No inverted/forbidden dependency. **Pass.**
  - Forbidden/unauthorised deps: only `Microsoft.AspNetCore.OpenApi` (Api) and the standard xUnit test stack (`xunit`, `xunit.runner.visualstudio`, `Microsoft.NET.Test.Sdk`, `coverlet.collector`). **No EPPlus. No EF Core/Npgsql. No ClosedXML. No Azure packages.** All consistent with Art. VIII; no over-engineering. **Pass.**
- **Art. IX — Data model:** No entities added; no premature model commitments. **N/A — clean.**
- **Art. X — Definition of Done:** Worklog records `dotnet build` 0/0, `dotnet test` 2/2 green, `dotnet format --verify-no-changes` exit 0. Change is small (448 insertions, skeleton only) and reviewable. No hard-coded Dutch, no secrets. **Pass** (gate results are implementer-reported; not independently re-run here, but consistent with the inspected files).
- **Art. XIV — Open decisions:** No hard assumption on disciplines, planningsblok granularity, thema scope, graadklassen, export, or visibility. The `.NET LTS`/`net10.0` choice is a settled Art. VIII item, not an open decision. **Pass.**
- **Scope (FA / story boundary):** Confirmed the diff does NOT add EF Core/Npgsql, a health endpoint with logic, `global.json`, the frontend Vite app, or CI — each is a comment/worklog-noted deferral to E0-02/E0-04/E0-05/E0-08. No Non-Goal touched (no pupil data, no integrations, no parent/pupil access). **No scope creep.**

## Open questions surfaced

- None requiring directie decision. Reminder only: E0-02 must add `global.json` to satisfy Art. VIII's "SDK pinned in `global.json`" — currently unpinned, which is correct for this story but must not be forgotten.

**This change is COMPLIANT and may be considered done for E0-01.**
