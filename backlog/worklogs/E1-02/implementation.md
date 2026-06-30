# E1-02 — School-content entities (autonomous, level-scoped)

## Build round 1 — autonomous themalaag + level scoping + EF mapping + migration

- **FR / Article:** FR-1/FR-3 (data model); Constitution **Art. IX.2** (school-content
  model + level-dependent scoping), **Art. IV.2/IV.3** (DoelKoppeling status + aiMotivatie,
  human-in-the-loop), **Art. III** (autonomous = mutable, vs read-only curriculum), **Art. II**
  (Dutch domain language).

### Files changed

Domain (new folder `Schoolcontent/`, plus minimal `Planning/Klas`):
- `backend/src/Jaarplanner.Domain/Schoolcontent/KoppelingStatus.cs` — status enum (Voorgesteld/Aanvaard/Geweigerd/Manueel).
- `backend/src/Jaarplanner.Domain/Schoolcontent/ActiviteitType.cs` — activity-form enum (experiment/prentenboek/hoek/uitstap/spel/waarneming/beweging/onderzoek).
- `backend/src/Jaarplanner.Domain/Schoolcontent/DoelKoppeling.cs` — the link entity (school-content↔leerplandoel) with status + aiMotivatie; mutable; `WijzigStatus` for teacher decisions.
- `backend/src/Jaarplanner.Domain/Schoolcontent/Thema.cs` — school-scoped; naam, invalshoeken?, duurWeken, kernwoordenschat[]/rijkeWoordenschat[]; owns 2–3 Themadoelen (guarded) + Subthemas.
- `backend/src/Jaarplanner.Domain/Schoolcontent/Themadoel.cs` — school-scoped; owns one DoelKoppeling.
- `backend/src/Jaarplanner.Domain/Schoolcontent/Subthema.cs` — class/age-scoped; **required** KlasId + Leeftijd; probleemstelling?/onderzoeksvraag?/duurWeken; owns Subdoelen + Activiteiten.
- `backend/src/Jaarplanner.Domain/Schoolcontent/Subdoel.cs` — class/age-scoped; per (subthema × leeftijd); owns one DoelKoppeling.
- `backend/src/Jaarplanner.Domain/Schoolcontent/Activiteit.cs` — class/age-scoped; activiteitType, hoek?, verwachteUitkomsten?; owns 0..n DoelKoppelingen.
- `backend/src/Jaarplanner.Domain/Planning/Klas.cs` — minimal (id, naam, leerjaar) to anchor the class scope.

Infrastructure (EF Core):
- `backend/src/Jaarplanner.Infrastructure/Persistence/AppDbContext.cs` — added DbSets (Klassen, Themas, Themadoelen, Subthemas, Subdoelen, Activiteiten); updated XML doc.
- `Persistence/Configurations/KlasConfiguration.cs`, `ThemaConfiguration.cs`, `ThemadoelConfiguration.cs`, `SubthemaConfiguration.cs`, `SubdoelConfiguration.cs`, `ActiviteitConfiguration.cs`.
- `Persistence/Configurations/DoelKoppelingMapping.cs` — single-source owned-type mapping for DoelKoppeling (FK to `leerplandoelen.Code`, status persisted by name).
- `Persistence/Migrations/20260630084646_SchoolContentEntities.cs` (+ Designer + updated snapshot).

Tests:
- `backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolContentEntitiesTests.cs` — entity invariants/scoping (16 tests).
- `backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolContentModelConfigurationTests.cs` — EF mapping/scoping (10 tests).

### Key decisions

- **Scoping is structural, not a flag (Art. IX.2).** School-scoped entities (`Thema`,
  `Themadoel`, and the woordenschat arrays) live on the school-wide `Thema` aggregate with no
  class association. Class/age-scoped entities require their scope:
  - `Subthema.KlasId` is a **required, non-nullable** FK to `Klas`, and `Subthema.Leeftijd`
    is **required** (constructor throws on `Guid.Empty`/blank; column `NOT NULL`).
  - `Subdoel` and `Activiteit` hang off `Subthema`, so they inherit the class scope; `Subdoel`
    additionally pins its own `Leeftijd` for the per-`(subthema × leeftijd)` differentiation.
  A class-scoped row therefore cannot exist school-wide (it must point at a `Klas`), and a
  school-scoped row carries no class column — the two cannot be confused.
- **DoelKoppeling is an owned type** of Themadoel/Subdoel (one) and Activiteit (many), via one
  shared `DoelKoppelingMapping`. It FKs to the read-only `Leerplandoel` by stable `code`
  (`ON DELETE RESTRICT`); minimumdoel-level coverage is reached through the leerplandoel's own
  concordance, not duplicated here.
- **Autonomous = mutable (Art. III).** Unlike the E1-01 curriculum entities, these expose
  authoring methods (add subthema/subdoel/activiteit, set woordenschat, WijzigStatus). The
  read-only curriculum entities were not touched.
- **2–3 themadoel bound** enforced as a domain invariant in `Thema.VoegThemadoelToe`
  (upper bound = 3). The 2-minimum is not DB-enforced (a thema is built up incrementally);
  left as an authoring-time concern for E1-10.
- **Enums persisted by name** (status, activiteitType) so adding a member never renumbers rows.
- **Woordenschat** mapped as Npgsql `text[]` primitive collections (school-wide two-tier).

### Gates

- `dotnet format --verify-no-changes` ✓ (clean)
- `dotnet build` ✓ (0 warnings, 0 errors)
- `dotnet test` ✓ — **73 unit** (49 prior + 24 new) + **7 integration**, all green
- Migration DDL validated via `dotnet ef migrations script --idempotent` (Docker/Postgres
  not used) — generates valid Postgres: `KlasId`/`Leeftijd NOT NULL`, `text[]` arrays, FKs to
  `leerplandoelen`/`klassen`, composite index `IX_subthemas_KlasId_Leeftijd`.
- **Branch:** story/E1-02

### Self-check vs acceptance criteria

- *"migrations created"* → met: `20260630084646_SchoolContentEntities` adds klassen, themas,
  themadoelen, subthemas, subdoelen, activiteiten, activiteiten_Doelkoppelingen.
- *"scoping enforced (Thema/Themadoel/kernwoordenschat school-wide; Subthema/Subdoel/Activiteit
  per class & age)"* → met: school-scoped entities have no class column; `Subthema` has a
  required FK to `Klas` + required `Leeftijd`; `Subdoel`/`Activiteit` are scoped via the owning
  `Subthema`. Enforced in the domain constructors (throw) and in the DB (NOT NULL + FK), pinned
  by `SchoolContentModelConfigurationTests` and `SchoolContentEntitiesTests`.

### For the test-runner

Unit verification only — no API/UI yet (CRUD is E1-10). Verify with:
```
cd backend
dotnet tool restore          # local EF 10.0.9
dotnet test                  # 73 unit + 7 integration
dotnet ef migrations script --idempotent \
  --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api
```
Inspect the SQL: `subthemas."KlasId"`/`"Leeftijd"` are `NOT NULL`; themas has `text[]`
woordenschat columns; all DoelKoppeling tables FK `leerplandoel_code → leerplandoelen("Code")`.

### Open questions / Art. XIV touched

- `Leeftijd` is a free `varchar(8)` (e.g. "K3"). Art. XIV leaves the jaar/fase code form open
  (1K/2K/3K vs JK/K2/K3) and graadklas handling unresolved — deliberately not constrained to an
  enum so the import (E1-07) and the open decision can settle it without a model change.
- The 2-minimum themadoel count is not DB-enforced (incremental authoring); upper bound (3) is.
- `Klas` is intentionally minimal; the full planning model (Schooljaar, Jaarplan, planningsblok
  granularity — an Art. XIV open decision) is out of scope for E1-02.
