# Antagonist Review — E1-05 Re-import without clobbering plans

## Verdict: COMPLIANT (audit of build commit `d137c52`; conservative-default fix `f274b72` applied after)

**Scope audited:** `git diff f24977a..d137c52` — 13 files: domain flag on `Leerplandoel`, Application diff/result DTOs, Infrastructure `OpstapImportService` + interface, EF config, additive migration + snapshot, two test files, worklog.

## Rulings on the two scrutiny points

### SCRUTINY 1 — `NietMeerInOpstap` flag on the read-only `Leerplandoel`: ACCEPTABLE (not a violation)
- The flag is **not decreed Op.stap content** — it's the tool's own review marker about a goal's *presence*, analogous to the "internal labels and ordering" Art. III.2 explicitly permits.
- The **single-writer boundary is genuinely preserved**: property keeps `private set`; the only writer is `OpstapImportService.ZetReviewVlag` via EF metadata (`EntityEntry.Property(...).CurrentValue`), not a CLR setter. No public/internal mutator exists, so ordinary app code cannot flip it. This does not open a general mutation seam.
- Correctly cleared when a code reappears (tested). **Ruled compliant.**

### SCRUTINY 2 — default purge of disappeared *unreferenced* goals
- The "no clobber" guarantee is about jaarplannen + teacher links, and those are rigorously protected: a disappeared goal is deleted only when reference count across themadoelen/subdoelen/activity koppelingen is zero; anything referenced is flagged, never removed (FK `Restrict`, tested).
- Deletion was isolated behind a one-flag seam with a documented flip — satisfying Art. XIV "isolate behind a seam". **Ruled not a violation.** But raised as a QUESTION: the *shipped default* being destructive is a directie policy call, and flag-first is the safer posture.

## Findings (from audit)
- **[QUESTION] Destructive default for unreferenced disappeared goals** — recommend flipping default to flag-don't-delete, or record an explicit decision. → **RESOLVED in fix round** `f274b72`: default flipped to non-destructive (`VerwijderVerweesdeNietGekoppeldeStandaard = false`); a disappeared unreferenced goal is now flagged & kept by default; destructive purge preserved as an explicit opt-in via constructor policy flag. New test pins the purge path with the flag = true.
- **[MINOR] Disappearance classification correct only for a complete per-discipline file** — a partial/empty/wrong-discipline upload could classify omissions as disappearances. → **RESOLVED in fix round**: empty/parse-failed incoming result is now **skipped** (nothing flagged/deleted), surfaced via `Overgeslagen = true` + Dutch `Opmerkingen` notice; new test `Empty_or_parse_failed_re_import_skips_and_keeps_existing_rows`.

## Checks run (proof of thoroughness)
- **Art. II** Dutch domain language (OpstapHerimportDiff, Toegevoegd, Gewijzigd, Verdwenen, VerdwenenMaarGekoppeld, NietMeerInOpstap, VeldWijziging); no user-facing strings → no nl.json obligation. PASS.
- **Art. III.1/III.2** read-only content preserved; flag via EF metadata only; private setters intact. PASS.
- **Art. III.3/VII** no duplicated A–M mapping; reuses E1-03 `OpstapParseResult`; doelsoort via single-source `DoelsoortCodes`. PASS.
- **Art. III.4** reviewable diff; preview writes nothing; changed official text updated AND reported field-level. PASS.
- **Art. III.5** diff/upsert key on `Code`; EF key is `Code` (no surrogate) so `SetValues` cannot alter identity. PASS.
- **Art. IV.2** import path writes only curriculum rows; never adds/updates/removes DoelKoppeling; teacher status survives text refresh (tested). PASS.
- **Art. V.6** high-risk logic genuinely tested (insert, idempotent re-import, field-change reporting, preview no-op, referenced-flag-not-delete, status survival, full classification pass, flag-clear-on-reappear; + fix-round purge-opt-in and empty-file guard). PASS.
- **Art. VIII** layering: Application DTOs, Infrastructure service; additive migration matches snapshot. PASS.
- **Art. IX** additive boolean only; link model untouched. PASS.
- **Art. X** small/reviewable; no secrets. PASS.
- **Art. XIV** removed-but-unreferenced policy behind a seam; no month/planningsblok assumption. PASS.
- **Scope** no thema/activiteit upload (E1-07/08), discipline selection (E1-06), coverage (E5), API/UI. PASS.

## Open questions surfaced (carried forward, non-blocking)
- **File↔discipline completeness contract** — the empty-file guard mitigates the worst case; the broader "is this the right/complete discipline file" contract relates to the E1-06 discipline-selection seam.

**Conclusion:** COMPLIANT. Both scrutinized decisions ruled acceptable; the QUESTION (destructive default) and MINOR (mass-disappearance on partial file) were both resolved in fix round `f274b72`, making the re-import non-destructive by default. Post-merge: orchestrator ran `dotnet test` on the integrated branch → 123 unit + 7 integration passing.
