# FB-035 — antagonist, round 1

**Verdict:** VIOLATIONS FOUND (2 MAJOR, 5 MINOR, 2 QUESTION). Scope: `git diff 129ee5a8...6ccc209a`.
The antagonist is read-only; this file records its report as the session received it, with how each finding was
handled.

## Blocking

1. **[MAJOR] The migration can leave two placements on the same days.** A period holding one placement gave it the
   period's last schooldag and ignored the next group's start, so a stale start inside that period overlapped it; if
   both starts rolled to the same schooldag, creating `IX_themaplaatsingen_JaarplanId_Van` would abort the migration.
   *Fixed:* the lone placement is cut before the next group (and deleted when no day is left);
   `Een_losse_begindatum_in_een_periode_met_een_thema_overlapt_niet` covers both cases.
2. **[MAJOR] Rejecting by deleting contradicts Art. IV.2, which the diff left unchanged.** *Fixed:* Art. IV.2 gains
   the exception for a proposed thema placement; ADR-0049's compliance trace, the ADR index and the constitutie-log
   row name IV.2.

## Not blocking

- [MINOR] An open proposal looked like any other bar on the timeline. *Fixed:* the bar's second line starts with
  "Voorgesteld".
- [MINOR] Stale doc references (`Themaplaatsing.BlokStart` in `Activiteitplaatsing`, the subthema configuration).
  *Fixed.* `EfJaarplanOpslag` names the `BlokStart` of a kept startthema, which still exists; `Jaarplan`'s note on
  regeneration states the rule that still holds. Both left as they are.
- [MINOR] Code kept without a caller (`ProbeerGeneratieparametersToeTeVoegenAsync`, `BestaandePlaatsing`,
  `BouwVoorPeriode`). *Listed in TB-045.*
- [MINOR] Art. I.1 items 4 and 6 still promise regeneration of a single period. *Listed in TB-045.*
- [MINOR] The migration orders several thema's of one period by `ThemaId::text`, which matches .NET ordering under the
  usual collations only. *Not changed:* the ids are lowercase hex with hyphens, which every deterministic collation
  orders like .NET; noted here.
- [QUESTION] A vacation that is shortened or removed leaves the parts of a thema apart, without a *vervallen* notice.
  *Put to the owner.*
- [QUESTION] Directie has not been asked about planning with dates; should `docs/besluiten-gevraagd.md` get a question?
  *Put to the owner.*

## Checked and found compliant

Rights on the new endpoints (with a 403 test), dekking still computed and withheld for a vervallen placement, copy in
`nl.json` without em dashes, text beside every colour, the disabled generation button with its reason and the 409,
the lossy but working Down path, the dependent text in step, and no pupil data, secrets or new dependencies.
