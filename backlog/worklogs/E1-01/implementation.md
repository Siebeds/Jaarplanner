# E1-01 — Curriculum entities (read-only)

## Build round 1 — read-only Op.stap curriculum entities, EF mapping, migration, tests

- **FR / Article:** Art. IX.1 (curriculum data model), Art. VII.0 (taxonomy: Discipline→Domein→Subdomein, nullable cluster, `(domein, subdomein)` grouping, `code` identity), Art. III.1/III.3/III.5 (read-only reference data, single-source doelsoort mapping, code as stable identity). ADR-0007, ADR-0006, ADR-0004.

- **Files changed:**
  - `backend/src/Jaarplanner.Domain/Curriculum/Doelsoort.cs` — the MD/G/+/P/S/A enum (descriptive English member names; official short codes live in the mapping type because `+` is not a valid identifier).
  - `backend/src/Jaarplanner.Domain/Curriculum/DoelsoortCode.cs` — single-source mapping (Art. III.3) between the enum and the official short codes; `ToCode`/`FromCode`/`TryFromCode`. The E1-04 parser reuses this.
  - `backend/src/Jaarplanner.Domain/Curriculum/Discipline.cs` — `Nummer` (string PK), `Naam`, optional `ParentDisciplineNummer` (9.x split). Immutable.
  - `backend/src/Jaarplanner.Domain/Curriculum/Minimumdoel.cs` — `Ref` (PK, = Excel B+C), `Leeftijd`, `Nr`, `Omschrijving`. Immutable.
  - `backend/src/Jaarplanner.Domain/Curriculum/Leerplandoel.cs` — `Code` (PK), `Doelsoort`, `JaarFase`, `Domein`, `Subdomein`, `DisciplineNummer`, nullable `Cluster`, `Tekst`, optional `Voorbeelden`/`Toelichting`/`Woordenschat`/`MinimumdoelRef`. Immutable.
  - `backend/src/Jaarplanner.Infrastructure/Persistence/AppDbContext.cs` — added `Disciplines`/`Leerplandoelen`/`Minimumdoelen` DbSets + `ApplyConfigurationsFromAssembly`.
  - `backend/src/Jaarplanner.Infrastructure/Persistence/Configurations/{Discipline,Minimumdoel,Leerplandoel}Configuration.cs` — keys, lengths, nullable cluster, composite `(Domein, Subdomein)` index, doelsoort value-converter (stored as short code), discipline self-reference FK (9.x), optional concordance FK Leerplandoel→Minimumdoel.
  - `backend/src/Jaarplanner.Infrastructure/Persistence/Migrations/20260630073510_CurriculumReadOnlyEntities*.cs` + `AppDbContextModelSnapshot.cs` — EF migration creating the three tables.
  - `backend/src/Jaarplanner.Api/Jaarplanner.Api.csproj` — added `Microsoft.EntityFrameworkCore.Design` (10.0.9, PrivateAssets=all) for migration tooling.
  - `backend/.config/dotnet-tools.json` — local tool manifest pinning `dotnet-ef` 10.0.9 (the machine-global tool was 8.0.x; EF 10 is required for net10/EF Core 10).
  - `backend/tests/Jaarplanner.UnitTests/Curriculum/{DoelsoortCodesTests,CurriculumEntitiesTests,CurriculumModelConfigurationTests}.cs` — tests (see below).

- **Key decisions:**
  - **Doelsoort persisted as its official short code** (varchar(4)) via a value converter routed through the single-source `DoelsoortCodes` mapping — legible in the DB, stable across enum re-ordering, and reuses the one mapping place (Art. III.3).
  - **`MinimumdoelRef` modelled as an optional FK** to `Minimumdoel.Ref`. The entity in this story carries a single ref (per Art. IX.1's `minimumdoelRef`); ADR-0007's "many-to-many-capable concordance" is built out in E1-04 and can supersede this without breaking the identity (`code`).
  - **Discipline number is a string PK** with a self-referencing FK for the 9.x nesting (`OnDelete: Restrict`).
  - **Open decision (Art. XIV) not hard-assumed:** which disciplines are imported is NOT encoded here — disciplines are plain rows; the selection seam is E1-06.
  - Kept the FK/cluster-presence assumptions out of roll-ups: cluster is nullable everywhere (no code assumes it is present).

- **Immutability enforcement (Art. III.1) — how:**
  - Every entity property has a **`private set`**; there are **no public/internal setters** and **no public mutator methods**. The only public construction path is a validating constructor that assigns once. EF Core materialises via a **private parameterless constructor** (reflection), which is not reachable from application code.
  - There is **no application code path** that updates official content: the DbContext exposes only `DbSet`s (queries + future inserts for import seeding in E1-03); no update/edit service exists.
  - Two reflection-based unit tests pin this structurally so a future regression (adding a setter or mutator) fails the build's test gate.

- **Tests added (xUnit, 35 new cases):**
  - `DoelsoortCodesTests` — every enum value maps to the correct official short code; case-insensitive/trimmed parsing; full round-trip; unknown code throws; `TryFromCode` semantics.
  - `CurriculumEntitiesTests` — construction sets identity/content; required fields throw `ArgumentException`; blank optionals normalise to null (incl. nullable cluster); undefined doelsoort throws; **no accessible setters** and **no public mutator methods** on all three entities (immutability).
  - `CurriculumModelConfigurationTests` — builds the EF model (no DB needed) and asserts: `code`/`Nummer`/`Ref` are the PKs, `Cluster` and `MinimumdoelRef` are nullable, the composite `(Domein, Subdomein)` index exists, doelsoort uses the short-code value converter, and all three entities are mapped.

- **Gates:**
  - `dotnet format --verify-no-changes` ✓ (exit 0)
  - `dotnet build` ✓ (0 warnings, 0 errors)
  - `dotnet test` ✓ — **49 passed** (42 UnitTests incl. 35 new, 7 IntegrationTests), 0 failed
  - `dotnet ef migrations add` ✓; `dotnet ef migrations script --idempotent` ✓ (produces valid Postgres DDL — three tables, PK on code/nummer/ref, composite index, nullable cluster). **Note:** no Docker/Postgres available in this environment, so the migration was validated by generating the SQL script, not by applying it to a live DB. It must be applied against the E0 Dockerised Postgres (`docker compose up -d db` then `dotnet ef database update`) during verification.

- **Branch:** story/E1-01

- **Self-check vs acceptance criteria:**
  - *"migrations create the tables"* → met: migration `CurriculumReadOnlyEntities` creates `disciplines`, `minimumdoelen`, `leerplandoelen`; idempotent SQL script validates as well-formed Postgres DDL. (Live-apply pending a DB — see note.)
  - *"entities are immutable from app code paths (Art. III.1)"* → met: private setters, private EF ctor, no mutators, no update service; pinned by two reflection tests.
  - *Discipline string `nummer` + optional `parentDiscipline`, 9.x split* → met (string PK + self-ref FK).
  - *Leerplandoel code unique + identity, doelsoort enum, cluster nullable, all listed fields* → met (PK on code; nullable cluster column; converter-backed enum).
  - *Minimumdoel ref/leeftijd/nr/omschrijving* → met.
  - *Grouping key `(domein, subdomein)`; identity `code`* → met (composite index; PK on code).

- **For the test-runner (unit, not Playwright — no UI/API surface in this story):**
  - Run `cd backend && dotnet tool restore && dotnet test` → expect 49 passing.
  - To verify the migration against a live DB: `docker compose up -d db`, then
    `cd backend && dotnet dotnet-ef database update --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api`
    (needs `ConnectionStrings:Postgres` via user-secrets, per ADR-0012). Confirm tables `disciplines`, `leerplandoelen`, `minimumdoelen` exist with a unique PK on `leerplandoelen.Code`, a nullable `Cluster`, and the `IX_leerplandoelen_Domein_Subdomein` composite index.
  - Inspect generated SQL without a DB: `dotnet dotnet-ef migrations script --idempotent`.

- **Open questions / Art. XIV touched:**
  - `jaarFase` code form (1K/2K/3K vs JK/K2/K3) is stored as a free string (max 8) — no enum committed, so either form imports cleanly (Art. XIV open decision left open).
  - Concordance cardinality: modelled as a single optional ref now; E1-04 may promote it to a many-to-many `Concordantie` table (ADR-0007). Identity (`code`) is unaffected.
  - Discipline selection (which disciplines imported) deliberately NOT encoded — that is the E1-06 seam.
