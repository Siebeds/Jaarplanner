# E1-05 — Re-import without clobbering plans

## Build round 1 — non-destructive Op.stap (re-)import service + reviewable diff

- **FR / Article:** FR-2.5; Constitution Art. III.1/III.4/III.5 (read-only, stable code identity,
  non-destructive re-import), Art. IV.2 (never silently destroy human decisions), Art. IX (data
  model). ADRs: ADR-0006 §3 (re-import is non-destructive + emits a review report — this story is
  its follow-up), ADR-0018 (one-to-many concordance FK; the diff surfaces `minimumdoelRef` changes).

### What was built
This story owns the **import-persistence path** for Op.stap reference data plus its re-import safety.
There was no service persisting parsed rows yet (E1-03 only parses to `OpstapParseResult`).

1. **`IOpstapImportService` + `OpstapImportService`** (Infrastructure/OpstapImport) — the *single
   sanctioned writer* of official curriculum content (Art. III.1). It takes a parsed
   `OpstapParseResult` for one discipline and **idempotently upserts** keyed on `Leerplandoel.Code`:
   first import inserts, re-import updates only changed rows, identical rows are left untouched.
   Official content is refreshed via `EntityEntry.CurrentValues.SetValues(...)`, which writes through
   EF property metadata — so the domain entity keeps its private setters and stays immutable to
   ordinary app code; no general mutation seam was opened.
2. **Reviewable diff** — `OpstapHerimportDiff` (Application/Curriculum/Import) classifies every code
   as `Toegevoegd` / `Gewijzigd` (with per-field `VeldWijziging` old→new) / `Ongewijzigd` /
   `Verdwenen` (gone & unreferenced) / `VerdwenenMaarGekoppeld` (gone but still linked). Wrapped in
   `OpstapImportResultaat` with a `Toegepast` flag for **preview-then-apply** (FR-2.5 "signal what
   must be reviewed"): `toepassen: false` computes the diff and writes nothing.
3. **Non-destructive guarantee** — a code present in the DB for the discipline but absent from the
   new file is only removed when **nothing references it**. If any teacher `DoelKoppeling` points at
   it (FK `Restrict` across `themadoelen` / `subdoelen` / `activiteiten_Doelkoppelingen`), it is
   **flagged** (`Leerplandoel.NietMeerInOpstap = true`) and kept, so the link — and any future
   jaarplan built on it — survives. The import path only ever writes curriculum rows; teacher
   statuses (`aanvaard`/`geweigerd`/`manueel`) are never touched. A re-import that re-introduces a
   code clears the flag.

### Diff structure
`OpstapHerimportDiff { DisciplineNummer; Toegevoegd: string[]; Gewijzigd: LeerplandoelWijziging[]
(Code + VeldWijziging[Veld,OudeWaarde,NieuweWaarde]); Ongewijzigd: string[]; Verdwenen: string[];
VerdwenenMaarGekoppeld: VerdwenenGekoppeldDoel[](Code, AantalKoppelingen) }` with `IsLeeg` /
`VereistReview` convenience flags for the UI notice.

### Non-destructive policy + "removed but referenced" decision (Art. XIV seam)
- **Referenced-and-disappeared → flag, never delete.** This is fixed (Art. III.4 / IV.2), not a
  directie option.
- **Unreferenced-and-disappeared → remove the stale row** is the *default* (`true`), isolated behind
  the single seam `OpstapImportService.VerwijderVerweesdeNietGekoppelde`. A directie may later choose
  a "never delete, only flag" policy by flipping that one constant — the diff and the link model do
  not change. The safe non-destructive default never deletes anything still in use.

### Key decisions
- The import service lives in **Infrastructure** because it consumes `OpstapParseResult` (an
  Infrastructure type) and `AppDbContext`; the diff/result DTOs live in **Application** (layering:
  Domain ← Application ← Infrastructure) so a future Api/use case can return them.
- `Minimumdoel` upsert is out of scope here: the goal Excel carries only minimumdoel *refs*, not the
  decreed `omschrijving` (per `OpstapParseResult` / Art. III). This story persists/diffs the
  leerplandoel reference data; concordance refs ride along on each leerplandoel's `MinimumdoelRef`
  and a change to it is reported as a field change.

### Files changed
- `backend/src/Jaarplanner.Domain/Curriculum/Leerplandoel.cs` — add import-managed `NietMeerInOpstap`
  review flag (private setter; defaults false; documented as not decreed content).
- `backend/src/Jaarplanner.Application/Curriculum/Import/OpstapHerimportDiff.cs` — diff model.
- `backend/src/Jaarplanner.Application/Curriculum/Import/OpstapImportResultaat.cs` — result wrapper.
- `backend/src/Jaarplanner.Infrastructure/OpstapImport/IOpstapImportService.cs` — service port.
- `backend/src/Jaarplanner.Infrastructure/OpstapImport/OpstapImportService.cs` — upsert + diff +
  non-destructive flagging.
- `backend/src/Jaarplanner.Infrastructure/Persistence/Configurations/LeerplandoelConfiguration.cs` —
  map `niet_meer_in_opstap` (NOT NULL DEFAULT false).
- `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — register `IOpstapImportService`.
- `backend/src/Jaarplanner.Infrastructure/Persistence/Migrations/20260630094541_LeerplandoelNietMeerInOpstapFlag.cs`
  (+ Designer + snapshot) — `ALTER TABLE leerplandoelen ADD niet_meer_in_opstap boolean NOT NULL DEFAULT FALSE`.
- `backend/tests/Jaarplanner.UnitTests/Curriculum/OpstapImportServiceTests.cs` — new test class.
- `backend/tests/Jaarplanner.UnitTests/Curriculum/CurriculumModelConfigurationTests.cs` — flag mapping test.

### Tests added (all green)
`OpstapImportServiceTests`:
- `First_import_inserts_all_leerplandoelen`
- `Re_import_of_the_same_file_is_idempotent_and_changes_nothing`
- `Re_import_updates_a_changed_leerplandoel_and_reports_the_field_change`
- `Preview_does_not_write_anything`
- `Disappeared_unreferenced_leerplandoel_is_removed_by_default_policy`
- `Disappeared_leerplandoel_that_is_still_linked_is_flagged_not_deleted` (headline AC)
- `Teacher_doelkoppeling_status_survives_a_re_import` (Art. IV.2)
- `Diff_classifies_added_changed_unchanged_and_removed_in_one_pass`
- `Reappearing_leerplandoel_clears_the_review_flag`
`CurriculumModelConfigurationTests.Leerplandoel_niet_meer_in_opstap_is_a_required_flag_defaulting_false`.

### Gates
- `dotnet build` ✓ (0 warnings, 0 errors)
- `dotnet test` ✓ — **121 unit + 7 integration green** (was 111 + 7; +10 new).
- `dotnet format --verify-no-changes` ✓ (no changes).
- Migration: `dotnet ef migrations add` succeeded; `dotnet ef migrations script --idempotent`
  produced valid Postgres DDL (`ALTER TABLE leerplandoelen ADD niet_meer_in_opstap boolean NOT NULL
  DEFAULT FALSE`). **Docker/Postgres was not run** (none available); the column has a server default
  so existing rows backfill to false. Tests use the EF Core in-memory provider (CI-safe, no Docker).
- **Branch:** story/E1-05 (rebased onto feature/e1-curriculum-content tip f24977a).

### Self-check vs acceptance criteria
- *A re-import diff/notice is produced* → `OpstapImportResultaat.Diff` (added/changed/unchanged/
  removed/removed-but-linked), with preview mode. Evidence: the diff-classification &
  field-change tests.
- *Existing plans intact* → referenced leerplandoelen are never deleted (flagged instead); teacher
  `DoelKoppeling` status survives a content update. Evidence:
  `Disappeared_leerplandoel_that_is_still_linked_is_flagged_not_deleted` and
  `Teacher_doelkoppeling_status_survives_a_re_import`.

### For the test-runner
Unit/integration only — **no UI, no API endpoint** in this story (deliberately service + tests).
Verify with `cd backend && dotnet test` (in-memory provider, no Docker). The data-integrity proof is
in `OpstapImportServiceTests`. No Playwright applicable.

### Open questions / Art. XIV touched
- "Removed-from-Op.stap-but-unreferenced" purge policy is isolated behind
  `OpstapImportService.VerwijderVerweesdeNietGekoppelde` (default: remove). A directie may want
  "never delete, only flag" — flip the constant; nothing else changes. Referenced goals are always
  kept regardless.
- No API/UI surface yet: the diff is built to be returned by a future FR-2 import endpoint.
