# E1-10 — CRUD for thema/subthema/activiteit + goal links

## Build round 1 — backend CRUD + manual goal links over the existing themalaag

- **FR / Article:** FR-3.1/3.2 · Art. IX.2 (level scoping), Art. IV.2 (DoelKoppeling status incl. `manueel`),
  Art. III (read-only curriculum referenced by code), Art. II (Dutch domain language), Art. VIII (thin Api).

### Files changed
- **Domain (new mutators only — reuse, don't rebuild):**
  - `backend/src/Jaarplanner.Domain/Schoolcontent/Thema.cs` — add `WijzigNaam`, `VerwijderSubthema`,
    `HeeftVoldoendeThemadoelen` (advisory 2-min check), `MinThemadoelen = 2`.
  - `backend/src/Jaarplanner.Domain/Schoolcontent/Subthema.cs` — add `WijzigNaam`, `WijzigScope`
    (re-scope but never clear klas/leeftijd), `VerwijderActiviteit`.
  - `backend/src/Jaarplanner.Domain/Schoolcontent/Activiteit.cs` — add `WijzigNaam`, `VerwijderDoelkoppeling`.
- **Application (use-case contract + DTOs + exceptions):**
  - `backend/src/Jaarplanner.Application/Schoolcontent/Beheer/ISchoolcontentBeheerService.cs` — CRUD use cases.
  - `.../Beheer/SchoolcontentBeheerDtos.cs` — create/update payloads (scoping made explicit in the types) + read views.
  - `.../Beheer/SchoolcontentBeheerExceptions.cs` — `SchoolcontentNietGevondenFout` (→404),
    `SchoolcontentValidatieFout` (→400).
- **Infrastructure (EF Core impl + DI):**
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs` — the CRUD service
    over `AppDbContext` (sibling of the import service; drives the domain mutators).
  - `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — register `ISchoolcontentBeheerService` (scoped).
- **Api (thin controllers + exception mapping + JSON):**
  - `backend/src/Jaarplanner.Api/Controllers/ThemasController.cs`,
    `SubthemasController.cs`, `ActiviteitenController.cs` — thin REST controllers (delegate only).
  - `backend/src/Jaarplanner.Api/Infrastructure/SchoolcontentExceptionHandler.cs` — `IExceptionHandler` → ProblemDetails.
  - `backend/src/Jaarplanner.Api/Program.cs` — `AddControllers` (+ `JsonStringEnumConverter`), `AddProblemDetails`,
    `AddExceptionHandler`, `UseExceptionHandler`, `MapControllers`.
- **Tests:**
  - `backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolcontentBeheerServiceTests.cs` — 25 service tests (in-memory provider).
  - `backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolContentEntitiesTests.cs` — +5 domain-mutator tests.
  - `backend/tests/Jaarplanner.IntegrationTests/SchoolcontentBeheerEndpointsTests.cs` — 4 HTTP end-to-end tests.
  - `backend/tests/Jaarplanner.IntegrationTests/Jaarplanner.IntegrationTests.csproj` — add EF in-memory + Domain/Infra refs.

### Key decisions
- **CRUD drives the existing domain mutators**, never reaches into entities — so the 2–3 themadoel bound and the
  required klas/leeftijd scope are enforced in one place (the domain), exactly like the E1-08 import service.
- **Where goal links live (followed the E1-02 model exactly):** a themadoel owns one `DoelKoppeling`
  (school-scoped); a subdoel owns one (class/age-scoped); an activiteit owns a *collection*. So:
  - linking a **subthema** to a leerdoel = create a manual **subdoel** at the subthema's own `Leeftijd`
    (the per-(subthema × leeftijd) carrier of the link);
  - linking an **activiteit** = add a `DoelKoppeling` to its collection (one or more).
- **Manual links land as `KoppelingStatus.Manueel`** with no `aiMotivatie` (Art. IV.2) — these are not AI suggestions.
- **Leerplandoel codes are validated to exist** before linking (`VereisLeerplandoelAsync`, Art. III.5) and the
  read-only curriculum is never mutated.
- **2–3 themadoel rule:** upper bound (3) is the hard domain invariant in `Thema.VoegThemadoelToe` — adding a 4th
  throws → mapped to 400. The **2-minimum is advisory** (`HeeftVoldoendeThemadoelen`, surfaced in `ThemaWeergave`):
  a thema under construction may temporarily have fewer; the flag lets the UI show "nog niet compleet" without
  blocking. Documented in the domain XML doc.
- **Delete cascades** reuse the existing EF config: deleting a thema cascades themadoelen + subthema's (and through
  the subthema cascade, subdoelen + activiteiten + their owned links); deleting a subthema cascades its children but
  leaves the school-wide thema untouched.
- **Open-decision seam (Art. XIV):** `Leeftijd` stays a free string (no hard-coded `JK/K2/K3` vs `1K/2K/3K`
  enum) — the jaarFase-code question is unresolved, so CRUD does not hard-assume it.
- **No new migration** — no schema change; all entities/tables already exist from E1-02.

### How level scoping is enforced (the core acceptance criterion, Art. IX.2)
- **Thema / Themadoel inputs carry no klas/leeftijd** → school-wide by construction.
- **Subthema create/update requires a real klas + leeftijd:** the domain ctor/`WijzigScope` reject an empty klas
  (`Guid.Empty`) or blank leeftijd, and the service additionally verifies the `Klas` row exists (`VereisKlasAsync`).
  A subthema can therefore never be created/edited into a school-wide state.
- **Activiteit/Subdoel inherit the subthema's class/age scope** structurally (they hang off the subthema).
- **Editing a subthema never touches the school-wide thema** (covered by a dedicated test).

### Goal links — persistence with status (incl. `manueel`)
- Persisted via the existing owned `DoelKoppeling` mapping (`status` stored by name). A manual link is created with
  `KoppelingStatus.Manueel`; round-trips on `GET /api/themas/{id}` with its status intact (asserted in both the
  service tests and the HTTP end-to-end test).

### Gates
- `dotnet format --verify-no-changes` ✓ (exit 0)
- `dotnet build` ✓ (0 warnings, 0 errors)
- `dotnet test` ✓ — **UnitTests 209 passed** (was 179; +25 service, +5 domain), **IntegrationTests 11 passed** (was 7; +4 endpoints)
- Frontend: **not touched** (no UI in this story) → `pnpm` gates not run.

### Branch
`story/E1-10` (based on `feature/e1-curriculum-content` @ 095bf8e).

### Self-check vs acceptance criteria ("Done when: CRUD respects level scoping; goal links persist with status")
- *CRUD at each level* → met: thema/subthema/activiteit + nested themadoel/subdoel create/read/update/delete, all
  green (service + HTTP tests).
- *Level scoping respected* → met: subthema without klas/leeftijd rejected (400); editing a subthema leaves the
  school-wide thema unchanged; thema/themadoel never carry a class scope. Evidence: `Maak_subthema_requires_a_klas_and_leeftijd`,
  `Editing_a_subthema_does_not_affect_school_wide_thema`, `Wijzig_subthema_cannot_clear_the_scope`,
  `Creating_a_subthema_without_a_klas_is_rejected_with_400`.
- *Goal links persist with status (manueel)* → met: `Themadoel_link_persists_with_manueel_status`,
  `Koppel_subthema_creates_a_manueel_subdoel_at_the_subthema_leeftijd`, `Activiteit_links_to_multiple_leerdoelen_each_manueel`,
  and the HTTP round-trip `Full_crud_flow_with_goal_links_round_trips` (asserts "Manueel" at all three levels).
- *2–3 themadoel rule* → met: `Adding_a_fourth_themadoel_is_rejected`, `Thema_with_two_themadoelen_reports_voldoende_a_single_one_does_not`.
- *Read-only curriculum integrity* → met: unknown leerplandoel code rejected, curriculum unchanged
  (`Activiteit_link_to_unknown_code_is_rejected_and_curriculum_untouched`).

### For the test-runner (how to verify)
- **Unit:** `cd backend && dotnet test tests/Jaarplanner.UnitTests` — see `SchoolcontentBeheerServiceTests` (25) and
  the +5 in `SchoolContentEntitiesTests`.
- **Integration (no Docker needed — uses EF in-memory):** `dotnet test tests/Jaarplanner.IntegrationTests` — see
  `SchoolcontentBeheerEndpointsTests`.
- **By hand (needs a Postgres for the live API):** with the API running and a seeded `Klas` + `Leerplandoel`:
  1. `POST /api/themas` `{ "naam":"Water","duurWeken":5 }` → 201.
  2. `POST /api/themas/{id}/themadoelen` `{ "leerplandoelCode":"<bestaande code>" }` → 200 (status `Manueel`); a 4th → 400.
  3. `POST /api/themas/{id}/subthemas` `{ "naam":"Regen","duurWeken":2,"klasId":"<klas>","leeftijd":"K3" }` → 201;
     with `klasId` empty → 400.
  4. `POST /api/subthemas/{id}/doelkoppelingen` `{ "leerplandoelCode":"<code>" }` → 200 (creates a `Manueel` subdoel).
  5. `POST /api/subthemas/{id}/activiteiten` `{ "naam":"Meten","activiteitType":"Waarneming" }` → 201;
     `POST /api/activiteiten/{id}/doelkoppelingen` `{ "leerplandoelCode":"<code>" }` → 200 (`Manueel`).
  6. `GET /api/themas/{id}` → the whole subtree with all statuses; `DELETE` cascades.

### Notes / deferrals
- **UI deferred** to the frontend/UX pass (per the story's "Do NOT build a full React UI"). No React, no `nl.json`
  change. The only Dutch text added is server-side domain/validation messages on the API (domain language is Dutch
  by Art. II.1/II.2; Art. II.3's "no hard-coded Dutch in components" governs the React layer, which is untouched).
- **Postgres test container:** the repo's integration harness runs against `WebApplicationFactory<Program>` with **no**
  Postgres (the existing tests assert the app stays up *without* a DB). I therefore integration-tested the full
  HTTP→controller→service→EF stack on the **EF Core in-memory provider** (matching the proven E1-08 unit-test choice),
  so it runs in CI/dev with zero Docker dependency. The level-scoping FK that backs the guarantee is pinned by the
  existing model-config tests; a real Postgres-container suite can be added later without changing this code.
- **E1-11 preview:** school-wide vs per-class separation is already correct here (the scoping tests prove it), but the
  shared thema-bibliotheek *derivation* logic was intentionally not built.
