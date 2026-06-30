# E1-10 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit + API/HTTP integration (xUnit). No Playwright — UI deferred, none built.

Verified on branch `story/E1-10` in worktree
`C:\source\Jaarplanner\Jaarplanner\.claude\worktrees\agent-a2fe25599b525a881`.

## Test substrate note (read first)
The integration tests run on the **EF Core in-memory provider, NOT a live Postgres
container** (no Docker substrate available here). The `WebApplicationFactory<Program>`
boots the *real* API host — real DI, controllers, MVC pipeline, RFC7807 exception
handler — and only swaps the Npgsql `AppDbContext` for the in-memory provider. So the
HTTP -> controller -> service -> EF stack is genuinely exercised end-to-end; what is NOT
exercised is Postgres-specific behaviour (real FK enforcement, cascade delete semantics,
provider SQL). The Discipline FK is not enforced in-memory (noted in test comments). This
is an acceptable, clearly-flagged substitute for E1-10; a Postgres-container integration
pass is still owed before relying on cascade/FK behaviour in production.

## Criteria checked

### AC1 — CRUD respects level scoping
- "add/edit/delete works for Thema, Subthema, Activiteit (+ nested Themadoel/Subdoel)" -> PASS.
  Service tests cover Maak/Wijzig/Verwijder at every level (Maak_thema_*, Wijzig_thema_*,
  Verwijder_thema_cascades_its_whole_subtree, Maak_subthema_*, Wijzig_subthema, Verwijder_subthema_*,
  Maak_activiteit_*, Wijzig_activiteit_*, Verwijder_activiteit_*, themadoel add/remove, subdoel link/unlink).
- "Creating a Subthema without a valid Klas + Leeftijd must be rejected" -> PASS.
  - Unit `Maak_subthema_requires_a_klas_and_leeftijd`: empty klas (Guid.Empty) and blank leeftijd ("  ")
    both throw `SchoolcontentValidatieFout`. Enforced structurally in `Subthema` ctor via `RequireKlas`/`Require`.
  - Unit `Maak_subthema_rejects_an_unknown_klas`: a non-existent klas id is rejected (service `VereisKlasAsync`).
  - Integration `Creating_a_subthema_without_a_klas_is_rejected_with_400`: POST `/api/themas/{id}/subthemas`
    with `klasId = Guid.Empty` returns HTTP 400.
- "a class-scoped item can never become school-wide" -> PASS.
  `Subthema.WijzigScope` re-applies `RequireKlas` + `Require(leeftijd)`, so re-scoping can never clear the
  scope. Unit `Wijzig_subthema_cannot_clear_the_scope`: WijzigScope with Guid.Empty throws.
- "editing a class's subthema must not mutate the school-wide thema" -> PASS.
  Unit `Editing_a_subthema_does_not_affect_school_wide_thema`: after WijzigSubthema (name/duur/leeftijd
  changed), the parent thema's Naam="Water", DuurWeken=5, Kernwoordenschat=["plas"] are asserted unchanged,
  while the subthema's own attributes did change. `Verwijder_subthema_cascades_children_but_leaves_thema`
  asserts the thema row survives a subthema delete.

### AC2 — Goal links persist with status Manueel, reference read-only Leerplandoel by code
- "manual links persist `DoelKoppeling` with status Manueel" -> PASS.
  `DoelKoppeling` is always constructed as `new DoelKoppeling(code, KoppelingStatus.Manueel)` in the
  service for all three manual link paths (themadoel, subdoel, activiteit).
  - Unit `Themadoel_link_persists_with_manueel_status`: asserts Status == Manueel and AiMotivatie == null.
  - Unit `Koppel_subthema_creates_a_manueel_subdoel_at_the_subthema_leeftijd`: subdoel link Status == Manueel,
    leeftijd == subthema leeftijd, and round-trips Manueel after re-load.
  - Unit `Activiteit_links_to_multiple_leerdoelen_each_manueel`: two links, both Manueel, count == 2 after reload.
- "unknown code rejected; curriculum never mutated" -> PASS.
  Service `VereisLeerplandoelAsync` checks existence via `_context.Leerplandoelen.AsNoTracking().AnyAsync(...)`
  (read-only) and throws `SchoolcontentValidatieFout` for an unknown code.
  - Unit `Themadoel_link_to_unknown_code_is_rejected` and `Activiteit_link_to_unknown_code_is_rejected_and_curriculum_untouched`
    (the latter asserts `Leerplandoelen.CountAsync() == 3`, i.e. the 3 seeded codes are untouched).
  - Integration `Linking_to_an_unknown_leerplandoel_is_rejected_with_400`: POST themadoel with
    `leerplandoelCode = "BESTAAT-NIET"` returns HTTP 400.
- "round-trips with status intact" -> PASS.
  Integration `Full_crud_flow_with_goal_links_round_trips` creates thema -> themadoel -> subthema -> subdoel
  link -> activiteit -> activiteit link over HTTP, then GETs `/api/themas/{id}` and asserts
  `detail.Themadoelen[0].Koppeling.Status == "Manueel"`, `sub.Subdoelen.Single().Koppeling.Status == "Manueel"`,
  and `act.Doelkoppelingen.Single().Status == "Manueel"` — manual status persists at all three levels and
  survives the HTTP read round-trip.

### AC3 — 2–3 themadoel rule (a 4th is rejected)
- PASS. Upper bound (3) is a hard invariant in `Thema.VoegThemadoelToe` (throws InvalidOperationException at
  MaxThemadoelen=3), mapped to `SchoolcontentValidatieFout` -> 400 by the service.
  - Unit `Adding_a_fourth_themadoel_is_rejected`: 3 themadoelen added, the 4th throws `SchoolcontentValidatieFout`.
  - Unit `Thema_with_two_themadoelen_reports_voldoende_a_single_one_does_not`: HeeftVoldoendeThemadoelen is
    false at 1, true at 2 (lower bound advisory, as documented).

## Thin-controller / single-source-of-truth confirmation -> PASS
- `ThemasController`, `SubthemasController`, `ActiviteitenController` are pure delegators: each action binds
  the request and calls one `ISchoolcontentBeheerService` method, returning Ok/Created/NoContent. No business
  logic, no status-code plumbing in controllers.
- Level scoping lives in the domain mutators, in one place: `Subthema` ctor + `WijzigScope` (`RequireKlas`,
  `Require(leeftijd)`); the 2–3 bound in `Thema.VoegThemadoelToe`. The service drives these mutators rather
  than reaching into entity internals; it adds only the cross-aggregate checks (klas exists, leerplandoel
  code exists) that need the DbContext.
- HTTP status mapping is centralised in `SchoolcontentExceptionHandler` (404 for NietGevonden, 400 for
  Validatie), keeping controllers thin (Art. VIII).

## Commands run
- `dotnet tool restore` -> dotnet-ef restored, success
- `dotnet test` (full backend suite) -> PASS: UnitTests 209/209, IntegrationTests 11/11 (matches implementer's report)
- `dotnet test ...IntegrationTests --filter SchoolcontentBeheerEndpointsTests` -> PASS 4/4
- `dotnet test ...UnitTests --filter SchoolcontentBeheerServiceTests` -> PASS 25/25

## Evidence
- Service tests: backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolcontentBeheerServiceTests.cs
- Endpoint tests: backend/tests/Jaarplanner.IntegrationTests/SchoolcontentBeheerEndpointsTests.cs
- Domain mutators / scoping: backend/src/Jaarplanner.Domain/Schoolcontent/{Subthema,Thema,DoelKoppeling}.cs
- Service: backend/src/Jaarplanner.Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs
- Thin controllers + handler: backend/src/Jaarplanner.Api/Controllers/*.cs, .../Infrastructure/SchoolcontentExceptionHandler.cs

## Defects
None. Assertions are substantive (not vacuous) — each test pins the behaviour the criteria describe.
Only follow-up (not a defect, deferred): a Postgres-container integration pass to validate real FK/cascade
behaviour, since these tests ran on the in-memory provider.
