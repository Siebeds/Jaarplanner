# E1-05 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit; EF Core in-memory). No UI/Playwright (story has no API/UI surface).

## Criteria checked

- AC1 "Re-import produces a diff/notice: added / changed (field-level) / unchanged / removed; preview writes nothing"
  → PASS. `OpstapHerimportDiff` exposes `Toegevoegd`, `Gewijzigd` (each `LeerplandoelWijziging` carries a list of `VeldWijziging{Veld, OudeWaarde, NieuweWaarde}`), `Ongewijzigd`, `Verdwenen`, `VerdwenenMaarGekoppeld`, plus `IsLeeg`/`VereistReview`.
    - `Diff_classifies_added_changed_unchanged_and_removed_in_one_pass` asserts NEW→Toegevoegd, EDIT→Gewijzigd, KEEP→Ongewijzigd, DROP→Verdwenen, and `VereistReview` true — in a single import pass.
    - `Re_import_updates_a_changed_leerplandoel_and_reports_the_field_change` asserts the single Gewijzigd entry has a `VeldWijziging` for `Tekst` with OudeWaarde "oude tekst" / NieuweWaarde "nieuwe, herziene tekst" — genuine field-level diff.
    - `Preview_does_not_write_anything` (toepassen:false) asserts `Toegepast==false`, the diff still reports LP-2 added + 1 changed, yet the store is untouched: `Leerplandoelen.Count()==1` and LP-1.Tekst still "oude tekst". Preview is non-vacuous.

- AC2 "Existing plans/teacher data intact: do NOT delete a Leerplandoel still referenced by a DoelKoppeling — flag it (NietMeerInOpstap); teacher statuses survive a re-import incl. text refresh"
  → PASS.
    - `Disappeared_leerplandoel_that_is_still_linked_is_flagged_not_deleted`: LP-2 linked via Aanvaard DoelKoppeling, then disappears from the file. Asserts `Verdwenen` empty, single `VerdwenenMaarGekoppeld` for LP-2 with AantalKoppelingen==1, and the persisted `lp2.NietMeerInOpstap == true` (kept, not deleted).
    - `Teacher_doelkoppeling_status_survives_a_re_import`: link set to Geweigerd, then LP-1's official text is refreshed on re-import. Asserts the Themadoel.Koppeling.Status is still Geweigerd AND lp1.Tekst is "herziene tekst" — teacher decision survives the content refresh.
    - DB-level guarantee corroborated: FK DoelKoppeling.LeerplandoelCode → Leerplandoel is `OnDelete(Restrict)` (migration 20260630073510 / 20260630084646 + model snapshot).

- AC3 "Idempotent upsert keyed on identity (Leerplandoel.code, Minimumdoel.ref): first inserts, re-import updates only changed rows"
  → PASS.
    - `First_import_inserts_all_leerplandoelen`: two new codes inserted, Count==2.
    - `Re_import_of_the_same_file_is_idempotent_and_changes_nothing`: identical re-import yields empty Toegevoegd/Gewijzigd, both codes in Ongewijzigd, `IsLeeg` true.
    - Upsert keyed on `Leerplandoel.Code` (GroupBy code; dictionary lookup); changed rows refreshed via `entry.CurrentValues.SetValues`. Note on Minimumdoel.ref: per Art. III the goal Excel carries only the concordance *reference* (col D), not a full Minimumdoel entity; identity travels as the `MinimumdoelRef` field on Leerplandoel and is included in the field-level diff (`VeldVerschillen` compares `MinimumdoelRef`). So a changed minimumdoel reference is reported and upserted as part of the leerplandoel — consistent with the existing data model.

## Commands run
- `dotnet tool restore` → dotnet-ef 10.0.9 restored
- `dotnet test` → Passed 121 unit (Failed 0, Skipped 0); Passed 7 integration (Failed 0, Skipped 0). Matches implementer's reported counts.
- `dotnet test --filter ~OpstapImportServiceTests` → Passed 9 (the 5 named + 4 supporting), 0 failed.
- `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model since the last migration." (no model drift)
- `dotnet ef migrations script --idempotent` → emits `ALTER TABLE leerplandoelen ADD niet_meer_in_opstap boolean NOT NULL DEFAULT FALSE;`
- `docker version` → command not found (Docker unavailable in this environment, as in prior runs)

## Evidence
- Migration 20260630094541_LeerplandoelNietMeerInOpstapFlag.Up: AddColumn<bool> "niet_meer_in_opstap" on table "leerplandoelen", nullable:false, defaultValue:false → matches required DDL exactly. Down drops the column.
- Upsert path (OpstapImportService.cs) only ever Add/Remove/SetValues on `_context.Leerplandoelen` and sets the `NietMeerInOpstap` flag; it never reads, writes, or removes any `DoelKoppeling`/Themadoel/Subdoel/Activiteit row. The koppeling tables are read solely to COUNT references (KoppelingAantallenAsync). This is the structural basis of the "teacher status survives" guarantee.
- LIVE DB APPLY: NOT RUN — Docker is unavailable in this environment. Verified instead via the idempotent migration script (DDL correct) and `has-pending-model-changes` (no drift). The migration is well-formed; a live `database update` could not be executed here.

## Defects
None.
