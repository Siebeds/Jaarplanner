# E1-08 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit) — no UI surface, no Playwright needed

Worktree: `C:\source\Jaarplanner\Jaarplanner\.claude\worktrees\agent-a22d4c8d3b6d22dbc` (branch `story/E1-08`, head `41290e2`).

## Test counts
- Unit suite: **175 passed**, 0 failed, 0 skipped.
- Integration suite: **7 passed**, 0 failed, 0 skipped.
- `SchoolcontentImportServiceTests` runs and passes: **15 passed**, 0 skipped (filtered run confirmed it is not vacuously skipped).
- `dotnet ef migrations has-pending-model-changes` → "No changes have been made to the model since the last migration." → **no model drift / no migration needed.**

## Criteria checked
- **(1) Preview matches committed result for same input + mode; preview writes nothing** → PASS
  - `Preview_does_not_write_anything` asserts `preview.Toegepast == false`, the diff classifies the thema as `Toegevoegd`, AND `_context.Themas.CountAsync() == 0` after a preview — nothing persisted.
  - `Preview_matches_the_committed_result_for_the_same_input` seeds an existing thema, then runs the SAME re-import twice (preview then commit) and asserts the per-level classification sequences are equal (`Themas`, `Subthemas`, `Activiteiten` by (Naam, Soort)) AND `preview.Diff.BedreigdeBeslissingen == commit.Diff.BedreigdeBeslissingen`, then verifies the store reflects the promise (2 themas, "Herfst".DuurWeken == 6). Non-vacuous: the input deliberately mixes an update (duur 4→6) and an add ("Winter").

- **(2) Re-import modes work** → PASS
  - add adds new only, leaves existing untouched: `Add_mode_leaves_existing_content_untouched` re-imports the SAME thema/subthema/activiteit in Toevoegen mode with changed `themaDuur` (4→9) and `uitkomsten` ("origineel"→"GEWIJZIGD"), asserts the diff is `Ongewijzigd` and the persisted `DuurWeken` stays 4 and `VerwachteUitkomsten` stays "origineel". `Add_mode_adds_genuinely_new_content_alongside_existing` confirms a genuinely new thema is added (`Toegevoegd`, count 2).
  - update/overwrite refreshes matching attributes: `Update_mode_overwrites_matching_content_attributes` re-imports with `themaDuur` 4→6 and `subthemaDuur` 2→3 in Bijwerken mode, asserts `Bijgewerkt` and the persisted values become 6 and 3. `Update_mode_reports_unchanged_when_nothing_differs` asserts `Ongewijzigd` + `IsLeeg` on an identical re-import.

- **(3) HEADLINE Art. IV.2 — overwrite never silently destroys teacher-set DoelKoppeling statuses** → PASS
  - Preserved when still in the file: `Overwrite_preserves_a_teacher_set_themadoel_status_that_is_still_in_the_file` sets LP-1 to `Aanvaard`, overwrites carrying LP-1, asserts the persisted status is still `Aanvaard`.
  - Preserved + warned when the file drops it (default behaviour): `Overwrite_warns_but_keeps_a_teacher_decision_the_file_no_longer_carries` sets LP-1 to `Geweigerd`, re-imports a file that carries LP-9 instead. Asserts a single `BedreigdeBeslissing` with `LeerplandoelCode == "LP-1"`, `Status == Geweigerd`, `Niveau == Themadoel`, AND `Diff.VereistReview == true`. Then asserts LP-1 is STILL persisted with `Geweigerd` status, and LP-9 added. The teacher decision is provably kept, not lost.
  - Discard only on explicit opt-in: `Overwrite_discards_a_teacher_decision_only_on_explicit_opt_in` sets LP-1 to `Manueel`, re-imports with `verwijderBeslissingen: true`, asserts `BedreigdeBeslissingen` empty and LP-1 is gone, LP-9 present. This is the ONLY path that removes a human decision.
  - AI-only `Voorgesteld` replaceable freely: `Overwrite_freely_replaces_an_ai_only_voorgesteld_link` leaves LP-1 as `Voorgesteld`, re-imports LP-9, asserts no `BedreigdeBeslissing` and LP-1 dropped / LP-9 added.
  - Subdoel-level analogue: `Overwrite_preserves_a_teacher_set_subdoel_status_the_file_no_longer_carries` proves the same guarantee at `KoppelingNiveau.Subdoel`.
  - Add-mode never threatens a decision: `Add_mode_never_threatens_a_teacher_decision` — re-import in Toevoegen with different codes leaves the existing thema and its `Aanvaard` decision entirely alone (no BedreigdeBeslissing).
  - Empty-file guard: `Empty_parse_result_skips_and_keeps_existing_content` — an empty parse is skipped (`Overgeslagen`, not applied) and the teacher's `Aanvaard` status survives, so absence of input is never read as a destructive change.

## Preview == commit is structural (not two drifting code paths)
Confirmed in `SchoolcontentImportService`: `ImporteerAsync` calls the SINGLE private `VerwerkAsync` for both preview and commit; the only difference is the trailing `if (toepassen) await SaveChangesAsync()`. Inside `VerwerkAsync` and its helpers, the same branches build the diff regardless of `toepassen`; EF graph mutations are gated behind `if (toepassen)` while the classification (Toegevoegd/Bijgewerkt/Ongewijzigd) and `BedreigdeBeslissing` collection run unconditionally. The `WerkXBij` helpers compute `gewijzigd` first and only apply when `toepassen` — so the "would change" classification is identical to the committed change. There is no separate preview computation that could diverge.

The Art. IV.2 reconciliation lives in `ReconcileThemadoelen` / `ReconcileSubdoelen`: a link still in the file is kept untouched; a teacher link (`IsMenselijkeBeslissing` = Aanvaard/Geweigerd/Manueel) absent from the file is added to `bedreigd` and only removed when `MenselijkeBeslissingenVerwijderen` is set; an AI-only `Voorgesteld` link absent from the file is dropped freely. Activiteit-level links are never carried by this import, so an overwrite never touches them.

## Commands run
- `dotnet tool restore` → dotnet-ef 10.0.9 restored.
- `dotnet test` (full) → Unit 175/175, Integration 7/7.
- `dotnet test --filter SchoolcontentImportServiceTests` → 15/15.
- `dotnet ef migrations has-pending-model-changes` → no changes (no drift, no migration).

## Defects
None.
