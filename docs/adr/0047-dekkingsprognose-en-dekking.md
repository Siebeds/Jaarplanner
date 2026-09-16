# ADR-0047 — Dekking in two steps: the dekkingsprognose and the dekking

- **Status:** Accepted; S2 and the doelsuggestie half of D4 superseded by [ADR-0050](0050-doelsuggesties-zijn-minimumdoelen.md)
- **Date:** 2026-09-16
- **Deciders:** Project owner, 2026-09-16: the rulings D1 to D7 below, given after the demo and in the FB-045 session.
  Directie has not been asked.
- **Supersedes:** the Art. V.1 rules that a leerplandoel is gedekt through any decided link under a placed thema, and
  that a minimumdoel is gedekt when one concorded leerplandoel is.
- **Relates to:** [ADR-0029](0029-algemene-fiches.md) (algemene fiches count), [ADR-0046](0046-themadoelen-zijn-minimumdoelen.md)
  (themadoelen are minimumdoelen).
- **Realises:** FB-045; FR-9.1, FR-9.2, FR-9.3. **Constitution:** Art. V.1, V.2, IX.3 and XII (amended).

## Context

The dekkingsoverzicht knew one kind of dekking per klas. A leerplandoel was gedekt when a decided link anywhere under
a placed thema carried it, and a minimumdoel when one of its concorded leerplandoelen was. The owner described two
steps instead: what the school's thema's and subthema's aim at, and what a klas actually put in its agenda. A school
does not plan the whole year at once, so both are worth showing, and the second is what the agenda proves.

## Decision

The owner's rulings:

- **D1.** Two steps, both shown: the **dekkingsprognose** and the **dekking**.
- **D2.** A **minimumdoel** is in the prognose when it is a themadoel of a thema (ADR-0046), and gedekt when such a
  thema is placed in the klas's plan. It counts **only** through such a thema, never through a concorded leerplandoel.
- **D3.** A **leerplandoel** is in the prognose when it is a subdoel of a subthema at the klas's leeftijd, and gedekt
  when that **subthema** is placed in the klas's agenda; placing the thema above it is not enough.
- **D4.** Also counting: doelen on activiteiten, accepted doelsuggesties and planned algemene fiches.
- **D5.** Not counting: a themadoel that links a leerplandoel (only the FR-1 import writes one now).
- **D6.** The leerplandoelen a minimumdoel brings along to a thema do not count for dekking.
- **D7.** The words are *Dekkingsprognose* and *Dekking*.

Defaults the build follows until the owner changes one (FB-045, *Open vragen*):

- **S1.** A doel on an activiteit is in the prognose when its subthema is at the klas's leeftijd, and gedekt when that
  subthema is placed, whether or not the activiteit itself has a day.
- **S2.** An accepted doelsuggestie is in the prognose, and gedekt when its thema is placed.
- **S3.** A thema counts as placed when its placement is decided (`aanvaard` or `manueel`) and not stale, as before.
- **S4.** A klas is measured against the minimumdoelen of its mijlpaal: `K-` for JK, K2 and K3, `4-` for L1 to L4, `6-`
  for L5 and L6. *Heel het curriculum* measures every minimumdoel. A klas whose jaar/fase is not known is measured
  against every minimumdoel, as its leerplandoelen already are.

## How it is built

- **One computation, two sets.** `DekkingService` asks `IDekkingOpslag` for the prognose sources and the placed
  sources of the klas and gives every goal a `Dekkingsstap`: `Geen`, `Prognose` or `Gedekt`. `IsGedekt` stays, and
  means `Gedekt`, so the export and the agenda's bar keep their meaning.
- **Placed subthema** means a `Subthemaplaatsing` in the klas's jaarplan. It carries no status: putting a subthema in
  the agenda is the teacher's own act.
- **Minimumdoelen** get their own list in the payload, each with the thema's that aim at it and the placed thema's
  that cover it, next to the leerplandoelen.
- **The lacune reasons** follow the new sources: a leerplandoel in the prognose is *not planned yet* and names its
  subthema's or thema's; one with only undecided links is *not decided*; one with nothing is *without subthema*.
- **Dekkingsvooruitzicht** ("what the plan could cover") counts the leerplandoelen that would be gedekt if the
  proposed thema placements were accepted. With D3 only accepted doelsuggesties still depend on a thema placement, so
  the two figures now differ only through them.

## Consequences

- A klas that placed its thema's but not yet their subthema's sees its leerplandoel dekking drop to the doelsuggesties
  and fiches until the subthema's are in the agenda.
- A minimumdoel no longer reads as gedekt because some leerplandoel under it is; a school that wants it counted links
  it to a thema.
- The export keeps one column of dekking (`IsGedekt`); a prognose column follows when the export is reworked (FB-045,
  *Buiten scope*).
- The mijlpaal mapping (S4) is a new place where a klas meets the curriculum; it sits with `Jaarfasen`, beside the
  jaar/fase mapping, so a graadklas ruling (Art. XIV) changes both in one file.
