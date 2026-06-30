# E1-08 — Import preview + add/update-or-overwrite on re-import

## Build round 1 — school-content import-commit path (preview/diff + add/overwrite, non-destructive on teacher decisions)

- **FR / Article:** FR-1.3/1.4 · Art. IV.2 (never silently destroy human decisions — the headline) · Art. IX.2 (level-scoped persistence) · Art. III.4 stance (absence of input is not a change). Mirrors E1-05's proven Op.stap re-import pattern.

### What was built
A school-content import-commit service that consumes E1-07's `SchoolcontentParseResult` and persists it into the E1-02 themalaag, with a preview/diff + commit, explicit add vs update/overwrite modes, and a non-destructive guarantee on teacher-set `DoelKoppeling` statuses. The E1-07 parser contract is consumed unchanged; the A–M column mapping is not duplicated.

### Files changed
- `backend/src/Jaarplanner.Application/Schoolcontent/Import/SchoolcontentImportModus.cs` — the add (`Toevoegen`) vs update/overwrite (`Bijwerken`) mode enum.
- `backend/src/Jaarplanner.Application/Schoolcontent/Import/SchoolcontentImportOpties.cs` — mode + the Art. IV.2 safety switch `MenselijkeBeslissingenVerwijderen` (default false).
- `backend/src/Jaarplanner.Application/Schoolcontent/Import/SchoolcontentImportDiff.cs` — the reviewable preview/diff: per-thema/subthema/activiteit `WijzigingSoort` (Toegevoegd/Bijgewerkt/Ongewijzigd) + `BedreigdeBeslissingen` (teacher decisions an overwrite would discard) + skip/notice support.
- `backend/src/Jaarplanner.Application/Schoolcontent/Import/SchoolcontentImportResultaat.cs` — diff + `Toegepast` (preview vs committed), mirroring `OpstapImportResultaat`.
- `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/ISchoolcontentImportService.cs` — service contract (the school-content analogue of `IOpstapImportService`).
- `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/SchoolcontentImportService.cs` — the EF Core implementation: hierarchy build, match-keying, shared preview/commit diff, koppeling reconciliation.
- `backend/src/Jaarplanner.Domain/Schoolcontent/Thema.cs` — added `WerkBasisGegevensBij` (overwrite attrs) + `VerwijderThemadoel` (mutable autonomous content, Art. III).
- `backend/src/Jaarplanner.Domain/Schoolcontent/Subthema.cs` — added `WerkBasisGegevensBij` + `VerwijderSubdoel`.
- `backend/src/Jaarplanner.Domain/Schoolcontent/Activiteit.cs` — added `WerkGegevensBij` (attrs only; links untouched by import).
- `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — registered `ISchoolcontentImportService`; corrected the now-stale "preview/commit is E1-08" comment on the parser.
- `backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolcontentImportServiceTests.cs` — 15 tests (see below).

### Persistence design
Flat `SchoolcontentRij` rows are grouped into Thema → Subthema → Activiteit. Each subthema resolves its `klas` by naam to the required `KlasId`; a row naming an unknown klas is skipped with a Dutch notice (it cannot satisfy the structural class scoping of Art. IX.2 — better to skip-and-report than invent a klas). Level scoping is preserved: subthema/subdoel carry `klasId`+`leeftijd`; activiteit inherits via its subthema. Themadoel/subdoel codes from the file land as `DoelKoppeling(status = Voorgesteld)` (the file carries codes, not decisions). Activiteit goal links are not part of this import (made later via AI/CRUD), so an overwrite never touches them.

### Match keys (documented, stable identity within scope)
- **Thema** — `Naam` (school-wide), case-insensitive + trimmed.
- **Subthema** — `(themaId, Naam, KlasId, Leeftijd)` — the class/age scope is part of identity.
- **Activiteit** — `(subthemaId, Naam)`.
Names are the only natural key available for autonomous school content (no Op.stap-style code).

### Preview == commit guarantee (a Done-when criterion — made real)
Preview (`toepassen:false`) and commit (`toepassen:true`) run the **same** method `VerwerkAsync` over the same loaded state and the same plan; the only difference is whether EF changes are saved. Diff classification (including the `BedreigdeBeslissingen` warnings) is computed identically in both passes. Pinned by `Preview_matches_the_committed_result_for_the_same_input` (asserts equal per-level classification AND equal threatened-decision list, then verifies the store matches the preview).

### Add vs update/overwrite modes
- **Toevoegen (add)** — new content is inserted; content whose match key already exists is left *completely* untouched (attributes and koppelingen). An add re-import can never clobber, and never even threatens a decision.
- **Bijwerken (update/overwrite)** — matching content's attributes are refreshed if they differ (else reported `Ongewijzigd`), and new content is added. Goal links are reconciled (see below).

### CRUCIAL — how teacher `DoelKoppeling` statuses are protected on overwrite (Art. IV.2)
A "human decision" is a koppeling whose status is `Aanvaard`/`Geweigerd`/`Manueel` (as opposed to AI-only `Voorgesteld`). On overwrite, per content piece, links are reconciled against the file's incoming codes:
1. A teacher link the file **still carries** → kept, status untouched (never reset to voorgesteld).
2. A teacher link the file **no longer carries** → by default **preserved** (kept on the content) and surfaced in `BedreigdeBeslissingen` as a warning. It is discarded **only** when the caller explicitly sets `MenselijkeBeslissingenVerwijderen = true` (i.e. the teacher confirmed the warning).
3. An **AI-only `Voorgesteld`** link the file no longer carries → freely dropped (no human decision).
4. New codes are added as `Voorgesteld`.

So a re-import never *silently* destroys a human decision: it is either preserved-by-default with a visible warning, or discarded only on explicit confirmation. Add-mode never touches existing content at all.

### Migration
None. The story persists into the existing E1-02 tables; the new domain methods do not change the EF model. `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model since the last migration."

### Tests added (15, EF in-memory provider)
- `First_import_persists_the_full_hierarchy_with_level_scoping` — persistence + klasId/leeftijd scoping.
- `Subthema_referencing_an_unknown_klas_is_skipped_with_a_notice`.
- `Preview_does_not_write_anything`.
- `Preview_matches_the_committed_result_for_the_same_input` — the preview==commit guarantee.
- `Add_mode_leaves_existing_content_untouched`, `Add_mode_adds_genuinely_new_content_alongside_existing`.
- `Update_mode_overwrites_matching_content_attributes`, `Update_mode_reports_unchanged_when_nothing_differs`.
- `Overwrite_preserves_a_teacher_set_themadoel_status_that_is_still_in_the_file`.
- `Overwrite_warns_but_keeps_a_teacher_decision_the_file_no_longer_carries` — headline.
- `Overwrite_discards_a_teacher_decision_only_on_explicit_opt_in`.
- `Overwrite_freely_replaces_an_ai_only_voorgesteld_link` — voorgesteld not protected.
- `Overwrite_preserves_a_teacher_set_subdoel_status_the_file_no_longer_carries` — subdoel niveau.
- `Add_mode_never_threatens_a_teacher_decision`.
- `Empty_parse_result_skips_and_keeps_existing_content`.

### Gates
- `dotnet build` ✓ (0 warnings, 0 errors)
- `dotnet test` ✓ — 175 unit (was 160, +15) + 7 integration, all green
- `dotnet format --verify-no-changes` ✓ (clean)
- `dotnet ef migrations has-pending-model-changes` ✓ (no pending changes — no migration needed)
- Frontend gates: N/A — no UI added (service + tests only, per story scope).

### Branch
story/E1-08 (based on feature/e1-curriculum-content).

### Self-check vs acceptance criteria
- *preview matches committed result* → met: shared `VerwerkAsync`; `Preview_matches_the_committed_result_for_the_same_input`.
- *re-import modes work (add vs update/overwrite)* → met: `SchoolcontentImportModus`; add/update tests.
- *overwrite preserves (or explicitly warns before discarding) teacher-set DoelKoppeling statuses* → met: preserve-by-default + `BedreigdeBeslissingen` warning + explicit `MenselijkeBeslissingenVerwijderen` opt-in; four targeted tests cover preserve/warn/opt-in-discard/voorgesteld-not-protected at both themadoel and subdoel niveau.
- *never silently destroys human decisions* → met: there is no code path that drops an Aanvaard/Geweigerd/Manueel link without either keeping it (default, with warning) or an explicit caller opt-in.

### For the test-runner
Unit-level verification (no Playwright — no UI/endpoint in this story). Exercise `Jaarplanner.UnitTests/Schoolcontent/SchoolcontentImportServiceTests.cs`:
`dotnet test backend/tests/Jaarplanner.UnitTests --filter "FullyQualifiedName~SchoolcontentImportServiceTests"`.
Key behaviours to confirm: preview writes nothing and matches commit; add-mode never clobbers; overwrite refreshes attributes; an overwrite where the file no longer carries a teacher link reports it in `Diff.BedreigdeBeslissingen` and keeps it in the store, while opt-in discards it.

### Open questions / Art. XIV touched
- Klas matching is by `Naam` (the only available key on the minimal E1-02 `Klas`). If/when E1-10/E1-11 introduce a klas import or codes, the resolution key can move there without touching this service.
- The thema/activiteit Excel structure remains an Art. XIV open decision, fully isolated in the E1-07 parser; this story consumes the parse result and assumes nothing about columns.
