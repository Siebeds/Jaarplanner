# E1-01 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (no UI/API surface — no Playwright)

## Criteria checked
- "Migrations create the tables `disciplines`, `leerplandoelen`, `minimumdoelen` (entities: Discipline, Leerplandoel, Minimumdoel)" → PASS — migration `20260630073510_CurriculumReadOnlyEntities.cs` `Up()` calls `CreateTable("disciplines")`, `CreateTable("minimumdoelen")`, `CreateTable("leerplandoelen")`. Idempotent script generates the matching `CREATE TABLE disciplines / minimumdoelen / leerplandoelen`. Unit test `Three_curriculum_entities_are_mapped` asserts all three entity types are in the EF model.
- "Leerplandoel.code is unique (identity = code); cluster is nullable; (domein, subdomein) is a queryable grouping" → PASS — migration sets `PrimaryKey("PK_leerplandoelen", x => x.Code)` (PK enforces uniqueness/identity), `Cluster` column is `nullable: true`, and `CreateIndex("IX_leerplandoelen_Domein_Subdomein", columns: ["Domein","Subdomein"])`. DDL confirms: `CONSTRAINT "PK_leerplandoelen" PRIMARY KEY ("Code")`, `"Cluster" character varying(256)` (no NOT NULL), `CREATE INDEX "IX_leerplandoelen_Domein_Subdomein" ON leerplandoelen ("Domein", "Subdomein")`. EF model tests pin all three: `Leerplandoel_code_is_the_primary_key` (single-property PK on Code), `Leerplandoel_cluster_is_nullable` (`IsNullable` true), `Leerplandoel_has_a_composite_domein_subdomein_grouping_index` (2-property index Domein→Subdomein).
- "Entities are immutable from app code paths (Art. III.1) — no app-layer mutation path; private setters / EF-only construction" → PASS — `Discipline`, `Leerplandoel`, `Minimumdoel` are all `sealed`, every property is `{ get; private set; }`, a single validating public constructor sets all values once, and a private parameterless constructor exists only for EF materialisation. Two reflection-based theory tests genuinely assert this across all three types: `Curriculum_entities_have_no_accessible_setters` (no public/internal setter via `SetMethod.IsPublic`/`IsAssembly`) and `Curriculum_entities_expose_no_public_mutator_methods` (no declared-only public non-special-name instance methods). No setter or void mutator exists; only EF's private path can write.

## Commands run
- `dotnet tool restore` → restored dotnet-ef 10.0.9
- `dotnet test` (whole backend solution) → Passed: 42 UnitTests + 7 IntegrationTests = 49 total, 0 failed, 0 skipped. Matches implementer's reported 49 (35 new unit tests in the E1-01 Curriculum/ folder + DoelsoortCodes tests).
- `docker compose up -d db` → FAILED: `docker: command not found` — Docker/Postgres unavailable in this environment.
- `dotnet ef migrations script --idempotent` → SUCCESS — produced valid idempotent Postgres DDL (transaction-wrapped, `__EFMigrationsHistory` guards) for all three tables, the PK on Code, nullable Cluster, and the composite (Domein, Subdomein) index.

## Evidence
- Migration: `backend/src/Jaarplanner.Infrastructure/Persistence/Migrations/20260630073510_CurriculumReadOnlyEntities.cs`
- Entities: `backend/src/Jaarplanner.Domain/Curriculum/{Discipline,Leerplandoel,Minimumdoel}.cs` (sealed, private setters, EF-only ctor)
- Tests: `backend/tests/Jaarplanner.UnitTests/Curriculum/{CurriculumEntitiesTests,CurriculumModelConfigurationTests,DoelsoortCodesTests}.cs`
- Generated idempotent DDL excerpt: `CONSTRAINT "PK_leerplandoelen" PRIMARY KEY ("Code")`; `"Cluster" character varying(256)`; `CREATE INDEX "IX_leerplandoelen_Domein_Subdomein" ON leerplandoelen ("Domein", "Subdomein")`.

## Live migration note
The **live `dotnet ef database update` was NOT exercised** — Docker is not installed in this environment, so Postgres could not be brought up. Verification fell back to `dotnet ef migrations script --idempotent`, which compiled the model and emitted valid Postgres DDL covering all three acceptance criteria. The EF model was also independently built against the Npgsql provider in `CurriculumModelConfigurationTests` (model build does not open a connection), giving provider-accurate assertions without a live DB. A live apply against Postgres remains unverified.

## Defects
None.
