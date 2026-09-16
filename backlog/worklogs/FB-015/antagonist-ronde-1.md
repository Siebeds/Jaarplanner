# FB-015 — antagonist, round 1

**Verdict:** COMPLIANT (0 CRITICAL, 0 MAJOR, 5 MINOR, 1 QUESTION). Scope: `git diff origin/main...HEAD` at dabfa21c.
The agent is read-only; the build session saved this summary of its report.

Holds: rights on an own activiteit only for its owner and directie (`Rechtenmatrix.StaatToe`); planning someone else's
own activiteit refused and fail-closed (`WeekplanningService.PlanActiviteitAsync`); dekking computed, the subthema and
candidate reads skip own activiteiten and the new read is tested against Postgres; the FR-1 import never matches an own
activiteit; `EigenaarId` set only at creation, SetNull on a removed gebruiker; no pupil data, no secrets, copy in
`nl.json` without em dashes.

## MINOR findings and what was done

| # | Finding | Outcome |
|---|---|---|
| 1 | `Activiteitblad` said "verwijderd of verplaatst" when themabeheer opens a placed own activiteit it may not read | Fixed: the sentence now names both reasons it can have (`periode.activiteitWeg`). |
| 2 | `subthemabalans.ts` counted own activiteiten, against its doc comment and D9 | Fixed: own activiteiten are skipped; test added. |
| 3 | The wizard AI context is client-sent, so D9's "the wizard reads shared only" was not true | Fixed in wording: ADR-0049 D9 now says the wizard takes what its screen sends, for a thema it builds from scratch. |
| 4 | No test pins "the FR-1 import never matches an own activiteit" | Listed, not fixed: the rule is one filter in `SchoolcontentImportService.VerwerkActiviteiten`. |
| 5 | The doel detail (`LeerplandoelenQuery`) hides an own activiteit from its owner too | Listed, not fixed: D3 allows it, it does not require it. |

## QUESTION for the owner

D9: a hoofdleerkracht who deletes a subthema also deletes the own activiteiten of leerkrachten under it (as it does for
woordwebs, ADR-0043 D4). Should such a delete be refused, or warn first? Written under *Open vragen* in the ticket.
