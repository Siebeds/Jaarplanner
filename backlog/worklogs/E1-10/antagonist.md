# Antagonist Review — E1-10 backend CRUD for thema/subthema/activiteit + manual goal links

**Verdict:** COMPLIANT
**Scope audited:** `git diff 095bf8e..aab4df0` on `story/E1-10` — 3 controllers, exception handler, Program.cs/DI wiring, 1 Application interface + DTOs + exceptions, 1 Infrastructure service, 3 domain mutator additions, 3 test files, 1 csproj, 1 worklog. No frontend, no EF config, no migration touched.

## Ruling on the crux — Art. IX.2 level scoping: structurally enforced in one place, at three reinforcing layers — PASS
1. **Domain (single source of the invariant).** `Subthema`'s only construction path hard-requires non-empty `klasId` (`RequireKlas`) + non-blank `leeftijd`; `WijzigScope` re-applies both guards so re-scoping can re-point but never clear scope. `Activiteit` is created only via `Subthema.VoegActiviteitToe`, structurally inheriting class/age scope. `Thema`/`Themadoel`/kernwoordenschat carry no klas/leeftijd — school-wide by construction.
2. **Service.** `MaakSubthemaAsync`/`WijzigSubthemaAsync` also call `VereisKlasAsync` (rejects `Guid.Empty`, verifies klas exists), driving the domain mutators rather than re-implementing.
3. **Database.** `SubthemaConfiguration` makes `KlasId` a required FK (`Restrict`) + `Leeftijd` required.

Controllers add zero scoping logic; the DTO shapes alone encode the rule. Confirmed by `Maak_subthema_requires_a_klas_and_leeftijd`, `..._rejects_an_unknown_klas`, `Wijzig_subthema_cannot_clear_the_scope`, `Editing_a_subthema_does_not_affect_school_wide_thema`, and HTTP `Creating_a_subthema_without_a_klas_is_rejected_with_400`.

## Findings — no CRITICAL/MAJOR/MINOR violations

### [QUESTION] Goal-link duplicate prevention is app-layer only (no DB unique index)
- `SchoolcontentBeheerService.cs:219,297`. Unknown-code rejection is enforced both in-app and by a real DB FK (`Restrict`). Duplicate-link prevention is an app-layer `Any(...)` with no unique index — fine for the MVP single-school low-concurrency CRUD; flagged so the team knows there's no DB backstop against a concurrent race. No action for E1-10.

## Checks run
- **Art. II** — Dutch domain terms; plumbing English; no frontend/nl.json touched; Dutch strings are exception/ProblemDetails messages (developer/machine-facing). PASS.
- **Art. III** — links reference Leerplandoel by code only; `VereisLeerplandoelAsync` uses `.AsNoTracking().AnyAsync`; unknown code → 400; curriculum never loaded/mutated (test asserts count unchanged). PASS.
- **Art. IV.2** — all three link paths construct `DoelKoppeling(code, KoppelingStatus.Manueel)` with no AI motivation; `Manueel` round-trips at all levels; no AI client/`Voorgesteld` default. PASS.
- **Art. IX.2 (2–3 rule)** — upper bound hard-enforced in `Thema.VoegThemadoelToe` (MaxThemadoelen=3) → 400; lower bound advisory via `HeeftVoldoendeThemadoelen`, documented. PASS.
- **Art. VIII** — controllers thin (bind/delegate/map status); logic in Application+Infrastructure; central exception→ProblemDetails; one new dep `EFCore.InMemory` (test-only); no EPPlus; layering respected. PASS.
- **Art. VI** — no secrets, no AI key, no pupil data. No `[Authorize]` — but no auth is wired anywhere yet (roles = E6, deliberately later); not a regression. See open question.
- **Scope** — no jaarplan/kalender, coverage, AI, or shared-library logic; no half-built UI. Comprehensive tests (25 service + 5 entity + 4 HTTP). PASS.

## Ruling on the in-memory test substrate — acceptable for E1-10 (caveat recorded)
Mirrors E1-08's choice; keeps CI Docker-free. Level-scoping + read-only guarantees are enforced in domain ctor + service (faithfully exercised in-memory) AND backed by real FK/required-column mappings (inspected directly). The two things in-memory does NOT prove — Postgres FK/cascade behaviour for `KlasId`/`LeerplandoelCode` and Thema/Subthema delete cascades — are asserted only by mapping inspection. Known repo-wide gap (no test-container harness). Future recommendation: once a Postgres test-container lands, add a round-trip test that the DB FK refuses an unknown code and that deletes cascade.

## Open questions surfaced (non-blocking)
- **Auth sequencing:** these are the first public write endpoints and ship without authn/authz because roles (FR-10) are epic E6. Planned order, but confirm E6 (Entra ID + role matrix) lands before any deployment exposing these endpoints.

**Bottom line:** COMPLIANT. (Post-merge: orchestrator ran integrated `dotnet test` — 209 unit + 11 integration passing.)
