# TB-002 / E10-03 agenda half: antagonist round 2

- **Audited:** `93deb20..4f102c0` on `story/E10-03-agenda`, 2026-09-14.
- **Verdict:** VIOLATIONS FOUND. No CRITICAL, no MAJOR; 4 MINOR and 1 QUESTION. All round-1 findings resolved; round-1 finding 6 was withdrawn.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | MINOR | The server's "geen school" sentence and its `nl.json` twin (`fichedetail.geenSchooldag`) were not pinned against each other (Art. II.3 as amended, CLAUDE.md). | The backend test asserts the full literal with `Assert.Equal`, and the frontend weekend test asserts the same literal as rendered text. A comment on each side names the twin. |
| 2 | MINOR | The owner's two-switch ruling contradicted ADR-0029 decision 7 and the E10-03 criterion, and the story did not mention TB-002. | ADR-0029 has a dated amendment note under decision 7. E10-03's agenda criterion is rewritten with the owner's words and links to TB-002, and the entry's header says the agenda half is built. |
| 3 | MINOR | A failed request showed "Deze klas heeft nog geen algemene fiches." plus a link to make them (the E5-03 rule; the hoek list had the same flaw on `main`). | `Fichelijst` has an error branch (`hoekenpaneel.mislukt`), with no link, before the empty branch, for both lists. A test covers it. |
| 4 | MINOR | The store comment said the kept `soort` keeps the list during the fade, but the query is disabled on close. | The comment is narrowed to what holds: the reopen list and the title. |
| Q | QUESTION | Did the 390 px pass happen? | Yes. Three screenshots are in the session scratchpad: `e1003-390-week.png`, `e1003-390-lijst.png` and `e1003-390-plaatsing.png`. They show the week at 390 with both chips on their own row, the *Algemene fiches* sheet, and the placement sheet with only the real Mondays and Wednesdays outlined. `scrollWidth == clientWidth == 390`, so there is no horizontal scroll. The brief to round 2 left it out of its summary; the werklog line was correct. |

**Answers to the owner-level questions, passed on to the owner:**
- The hoek's own `VerplaatsMoment` has the same missing school-day guard. No screen reaches it today, so it belongs in a separate TB ticket, not in this change.
- The ticket for a story is sufficient as a one-off. If the owner wants it as a standing rule, ADR-0033 decision 8, `backlog/TICKETS.md` and CLAUDE.md need dated amendment notes.
- The phone chips extending the existing pressed/hover accent pattern is acceptable; no finding.
