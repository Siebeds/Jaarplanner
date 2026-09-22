# ADR-0060 — Before a thema starts, the cat proposes own activiteiten on the leerplandoelen no subthema carries

- **Status:** Accepted; D3's last clause superseded by [ADR-0062](0062-de-ai-stelt-het-moment-voor-de-tool-corrigeert.md), which gives the choice of the moment to the AI
- **Date:** 2026-09-18
- **Deciders:** Project owner, in the sparring session of 2026-09-18 on the agentic extension. Directie has not been
  asked.
- **Supersedes in part:** [ADR-0056](0056-ai-stelt-activiteiten-voor.md) D6, for the proposals the cat brings only.
- **Relates to:** [ADR-0047](0047-dekkingsprognose-en-dekking.md) (the dekkingsprognose), [ADR-0049](0049-eigen-activiteit-van-de-leerkracht.md)
  (the own activiteit an accepted proposal becomes), [ADR-0059](0059-de-kat-proactieve-agent.md) (the cat).
- **Realises:** TB-056; FB-070; FR-14.8. **Constitution:** Art. IV.1, IV.4, IV.5, IV.8, VI.1, IX.2 and XII (amended); V.1
  unchanged.

## Context

Some disciplines a klas hardly touches: their leerplandoelen are in no subthema, fiche or activiteit of the klas. An
activiteitvoorstel under a subthema (ADR-0056) cannot help, because it links only the subthema's subdoelen, and those
already count through the subthema (Art. V.1). What does count, for one klas, is an own activiteit linked to the goal
and planned in its agenda (ADR-0049).

## Decision

The owner's rulings:

- **G1. Own activiteiten for the leerkracht, past the subdoelen.** The cat proposes activiteiten that link leerplandoelen
  which are no subdoel; an accepted one is the leerkracht's own activiteit and counts for her klas once planned. The
  hoofdleerkracht is not involved. For this one klas the AI goes past the goal-first order (Art. IV.8 amended).
- **G2. The aanbod-gat.** For a klas and a discipline: the leerplandoelen of the klas's jaarfase in that discipline that
  are in no dekkingsprognose of the klas (no subdoel of a subthema at its leeftijd, no link on a shared activiteit
  there, no algemene fiche of the klas, no own activiteit of its leerkrachten at that leeftijd). A discipline is *low*
  by the share of its leerplandoelen in the aanbod-gat. A goal that is in the prognose but not planned is a
  *gepland-gat*, which the cat answers with "plaats subthema …" (ADR-0059), not with activiteiten.
- **G3. The moment:** five schooldagen before a thema placement starts in the klas's agenda, once per placement. The
  cat takes the discipline with the largest share in its aanbod-gat and brings two or three proposals.
- **G4. It may say nothing fits.** The motivation says why the goal fits *this* thema; when none fits, the cat brings
  nothing.
- **G5. With a suggested day**, a free moment in the thema's period within the schooluren: an activiteit that is not
  planned counts for nothing.
- **G6. Minimumdoelen are not in it:** a minimumdoel counts only through a thema (Art. V.1).

Defaults of this session, which the owner may change on their own:

- **D1. The same entity, another source.** An `Activiteitvoorstel` gains `Bron` (`Gevraagd` or `KatAanbodgat`), and for
  the cat's `KlasId`, `ThemaplaatsingId` and a suggested `Datum`, `Begin` and `Einde`. For that source the candidate
  goals are the discipline's leerplandoelen in the klas's aanbod-gat, not the subthema's subdoelen: this replaces
  ADR-0056 D6 for it. Everything else of ADR-0056 holds (validation D7, accepting D8, lifetime D9).
- **D2. To whom.** The proposals are addressed to the klas's leerkrachten ("LK eigen") and seen by them and an admin
  (ADR-0056 A3). Whoever accepts one becomes the owner of the own activiteit it makes, and the proposal is decided for
  all of them. A vervanger does not get them.
- **D3. What the AI is sent:** the thema, its subthema's at the klas's leeftijd with their onderzoeksvragen, the names
  of the activiteiten already there, and the aanbod-gat's leerplandoelen of the chosen discipline. It picks the subthema
  each proposal goes under; ~~the tool picks the moment, fitting it into the free time of that day as FB-027 does~~ —
  [ADR-0062](0062-de-ai-stelt-het-moment-voor-de-tool-corrigeert.md) gives the day and the hour to the AI and leaves the
  tool only the correction of a moment the school cannot give.
- **D4. Accepting** creates the own activiteit with the accepted goals (`aanvaard`, or `manueel` when edited) and plans
  it on the suggested moment, which she may change first. A moment no longer free is refused with a sentence.
- **D5. Rejected stays out:** a rejected proposal's goals are not proposed again for that klas in that schooljaar.
- **D6. When nothing fits,** the cat does not try the next discipline; it waits for the next thema.

## Alternatives considered

- **Propose the goal as a subdoel to the hoofdleerkracht** (ADR-0050). Rejected by G1: slower and someone else's call.
- **Both, the hoofdleerkracht after repeated own activiteiten.** Rejected by G1 for now.
- **Measure *low* by the dekking itself.** Rejected by G2: early in the year the later subthema's are not in the agenda
  yet, and every discipline would look low.

## Consequences

**Positive:** a gap in the klas's aanbod gets concrete, placeable activiteiten a week before they are useful.

**Negative / trade-offs:** goals now reach a klas's dekking past the subdoelen the hoofdleerkracht chose, through the
own activiteiten of one leerkracht; the thema's goal structure no longer shows everything a klas covers in it.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| Only leerplandoelen in the aanbod-gat, never a minimumdoel (G2, G6, D1) | the validator for the cat's source; unit tests |
| The aanbod-gat is computed from the dekkingsprognose (G2) | the signal layer, reusing the dekking service; unit tests against the dekking tests' fixtures |
| Once per placement, five schooldagen before (G3) | the signal's key; a job test |
| Accepted counts only when planned (G5, D4, Art. V.1) | the existing own-activiteit route of the dekking; its tests |
