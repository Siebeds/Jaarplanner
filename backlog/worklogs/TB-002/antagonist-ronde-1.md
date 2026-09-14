# TB-002 / E10-03 agenda half: antagonist round 1

- **Audited:** `93deb20` (code) and `d8ac897` (ticket) on `story/E10-03-agenda`, 2026-09-14.
- **Verdict:** VIOLATIONS FOUND. 2 MAJOR, 5 MINOR, 2 QUESTION.
- **Fixed in:** `9c16feb` plus the follow-up commit that clears a stale refusal in the detail sheet.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | MAJOR | The fiche calendar outlined whole windows as "de fiche staat dan al in de agenda". A fiche runs only on its chosen weekdays, so the sentence was false on four days out of five (E5-03 rule). The test pinned the false behaviour. | `Algemeneficheplaatsingblad` now outlines the days the fiche actually stands on, one per occurrence. The test now asserts a day inside the window with no occurrence is ordinary. |
| 2 | MAJOR | The detail sheet's date field could move one occurrence onto a weekend or a closure. The domain accepted it and the run then counted it among its "schooldagen". The drag route refused such a day and ADR-0029 decision 3 says it cannot exist. | `AlgemeneFicheplaatsing.VerplaatsMoment` takes the `Schooljaar` and refuses a day without school. The service loads the year. A unit test covers a Saturday, a closed week and a vrije dag. The sheet refuses a weekend before sending. Verified in a browser: 2026-11-04 (demo herfstvakantie) is refused with the server's sentence. |
| 3 | MINOR | The accessible name of a grid block did not say its kind (hoek or fiche). | `aria-label` now carries the kind for hoek and fiche blocks, and the comment is corrected. |
| 4 | MINOR | The weekday toggles hovered in the accent, which is not one of its five uses. | They hover in ink, like the other form toggles. |
| 5 | MINOR | E10-03's Art. V.1 box was still open, and so was the ticket's "Buiten scope" line, although `7fc20bc` was on main. | Box ticked with the reference, and the ticket text corrected. |
| 6 | MINOR | `opgepakt-door: E10-03` is not a session. | Not changed: `E10-03` is this session's groepschat session id. That convention is in the groepschat skill. |
| 7 | MINOR | No tests on the invalidations or on the panel. | `gegevens.test.tsx` covers what placing, removing and moving refetch. `Hoekenpaneel.test.tsx` covers each list and both widths. `Navigatie.test.tsx` covers the second switch. |
| Q1 | QUESTION | A ticket for a story, against ADR-0033 decision 8. | The owner asked for it in session ("ik wil ook zien in het kanban board dat je hier mee bezig bent"). This is recorded in the ticket, and the owner decides whether ADR-0033 gets a note. |
| Q2 | QUESTION | The owner-named "Hoekenfiches" switch was renamed "Fiches". | Resolved by the owner in session: two separate switches, "Hoekenfiches" and "Algemene fiches", not one grouped panel. |

**Gates after the fix:**
- Backend unit tests: 1133 passed, 4 skipped.
- Integration tests on real PostgreSQL: 357 passed, 1 skipped (the live Op.stap test).
- `dotnet format`: clean.
- Frontend: lint clean, Vitest green.
- Browser: checked at 1440 and 390 on a throwaway database.
