# FB-076 — antagonist, round 1

**Verdict: COMPLIANT.** No CRITICAL, no MAJOR. Four MINOR notes; two fixed, one recorded, one is the owner's.

| # | finding | what was done |
|---|---|---|
| 1 | The code claimed a card "says nothing rather than claiming an activiteit is planned nowhere" on a failed read. It does not: an unmarked card reads as "not planned", which is the mistake the ticket exists to prevent. The absent-versus-empty distinction is real on the wire and invisible on screen. | Fixed, as honesty rather than behaviour. Both comments now say what is actually true, and why it is accepted: a per-card "niet gelezen" line on every activiteit while the read is in flight is noise on the ordinary path for a case a retry fixes. |
| 2 | Criterion 1 asks for a "kleurstreep links"; shipped is a 2px achromatic rule, so the rule is the least salient of the three signals and the sentence carries the meaning. Defensible under Art. XII and the ticket's own *Open vragen*, but a departure from the wording. | **Left to the owner**, together with the same question on FB-077. The reasoning is in `Activiteitensectie.tsx` and in the Werklog; the wording of the criterion is his to keep or change. |
| 3 | A year-scoped read on a service whose every other member is range-scoped, so every fake must now stub it. Art. VIII is not breached; a read on the jaarplan side would have matched the route better. | Recorded, not changed. The route creates and deletes these placements through this same service, and splitting the read from the writes it mirrors would have put two seams on one aggregate for a naming reason. |
| 4 | `GeplandeActiviteit` (backend) versus `GeplandeActiviteitdagen` (frontend). | Fixed by saying why: the frontend name is taken by the week view's planned activiteit, which is a different thing with a time, a subthema and doelcodes. |

**What the audit added rather than found.** The gate run reported to it covered only `WeekplanningEndpointsTests`, so
the two convention sweeps that prove this route's right had not run. They have now, on this branch against the local
Postgres: `ElkeWijzigendeRouteVraagtEenRechtTests` and `ElkeRouteVraagtEenSessieTests`, **8 passed, 0 failed**. The
first enumerates every GET carrying a `klasId` and demands a 403 for a gebruiker without read access to the planning,
so the new route is proven to refuse one, and the second that it demands a session.
