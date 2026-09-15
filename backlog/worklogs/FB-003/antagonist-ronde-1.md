# Antagonist, round 1: FB-003 rapport invullen

**Verdict:** COMPLIANT
**Scope:** `git diff origin/main...HEAD` on `ticket/FB-003-rapport-invullen` (build commit d778018; 789790a and e91f473
only move the ticket's status).

The antagonist is read-only; the session saved its report here as returned.

No CRITICAL or MAJOR findings. This is the one round (ADR-0037); the MINOR findings start none.

## Not blocking, and what was done with them

| # | Finding | Done |
|---|---|---|
| M1 | `frontend/src/obj/Jaarplanner.Infrastructure.EntityFrameworkCore.targets` was committed by accident: an EF tooling artefact from a `dotnet ef` run in the wrong directory. | Removed from the branch. |
| M2 | "Dit rapportdoel bestaat niet meer…" and "Deze ster staat niet meer in de sterrenschaal…" were also returned for an id that never existed, so they claimed more than the lookup proves (the conditional-sentence rule). | Now "Dit rapportdoel is niet gevonden. Vernieuw de pagina." and "Deze ster is niet gevonden in de sterrenschaal. Vernieuw de pagina en kies opnieuw." Tests updated. |
| M3 | The one retry covered only a unique violation on `ontwikkelingsrapporten`. Two first writes of the same rapportdoel on an existing report collided on the `rapportbeoordelingen` key and answered 500. | The retry now covers both tables; the later write wins. New integration test `Twee_eerste_bewaringen_van_hetzelfde_rapportdoel_tegelijk_geven_geen_fout`. |

## Checked and clean

- **Rights (Art. VI.1, VI.7; ADR-0030 §3 footnote ⁶; R16, R17, R26):** all three routes carry
  `[RechtOp(..., Rechtbron.Leerling, "leerlingId")]`; `RapportInvullen` uses `Kolom.LeerkrachtRapportInvullen`
  (the klas's schooljaar has not ended); directie passes both rows. Integration tests cover 403 for a teacher of another
  K3 klas, a K2 teacher, a hoofdleerkracht with themabeheer and a user with no right, on GET and PUT and by address; a
  past-year teacher reads but does not write; directie writes after the schooljaar. The frontend matrix mirrors the
  backend's, and both matrix tests are updated.
- **Pupil data in logs and faults (VI.7, ADR-0035 §3.8):** the service logs nothing; no request-body logging,
  `EnableSensitiveDataLogging` or `Include Error Detail`; domain exceptions name the field and never the value
  (unit-tested); server sentences name no child; the GET is `no-store` (tested); test data is fictional.
- **Dekking (Art. V.1, FR-13.9):** nothing outside the new service, `RapportsetService` and the DbContext reads the new
  tables; an integration test checks the dekking payload is identical before and after filling in.
- **D1, D2, D8:** D1 refused with a Dutch sentence and backed by Restrict foreign keys, and a rename shows on the report
  (R7), both tested; D2 because the read starts from the set (tested); D8 by cascade (tested).
- **Data model (Art. IX.4):** one report per (leerling, moment) with a unique index and a 1..3 check constraint; one
  beoordeling per (report, rapportdoel) with an optional star; a typed text or besluit is `Manueel` and an unchanged text
  keeps its status; the `geweigerd` mark is left to FB-004 and documented in `Tekststatus.cs`.
- **Art. I.2:** no points, totals, averages or comparisons; the only count on screen is the number of subdoelen.
- **Copy (Art. II.3, II.5):** every new string in `nl.json`, no em dash; "Dit schooljaar is voorbij…" only under
  `rapportAlleenNogLezen`; "De sterrenschaal is nog leeg…" only when the user may fill in and the scale is empty.
- **Autosave and folded subdoelen:** no rule conflict; one save in flight at a time, a flush on unmount to the old
  report's endpoint, `Manueel` only when the text changed; the subdoelen are in the app only (R11).
- **Art. VIII:** no new dependency; the layering is respected and the controller is thin.
