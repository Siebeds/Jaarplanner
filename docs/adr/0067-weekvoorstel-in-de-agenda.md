# ADR-0067 — The AI proposes a week's activiteiten; the tool fits them into the free time, as proposed placements

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Project owner (the ticket's ruling of 2026-09-15); the defaults below are this session's, while FB-027
  was being built. Directie has not been asked.
- **Relates to:** [ADR-0038](0038-schooluren-per-weekdag.md) (the school's hours), [ADR-0049](0049-eigen-activiteit-van-de-leerkracht.md)
  (own activiteiten), [ADR-0062](0062-de-ai-stelt-het-moment-voor-de-tool-corrigeert.md) (the free-moment search it
  reuses), [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md) (how an open proposal looks).
- **Realises:** FB-027; enables FB-032 ("stel mijn week voor" in the cat's chat). **Constitution:** Art. IV.5 and V.1
  amended the same day (see [`docs/constitutie-log.md`](../constitutie-log.md)); Art. IV.1 to IV.4 and VI.1 unchanged.

## Context

A leerkracht can already spread all activiteiten of a subthema over chosen days, without AI, at a fixed 8:30 and
without regard to the school's hours or the fiches (the Subthemaplanner). The owner asked for the AI to propose her
week instead: *"jouw activiteiten voor dat subthema laten voorstellen (ook terug goedkeuren/afkeuren) en laten rekening
houden met start en eindtijd van schooldag en algemene fiches"*. His ruling on the ticket: **the AI chooses** which
activiteiten, in which order and on which day; **the code fits them** into free moments within the schooluren, around
the fiches and the hoeken; the leerkracht accepts or rejects.

`Activiteitplaatsing` has carried a `Status` and an `IsVervangbaar` predicate since E9-03, with a note that nothing
generated placements yet and that the predicate existed for the day a generator appeared. This is that day.

## Decision

- **W1. A proposed block is an `Activiteitplaatsing` with status `Voorgesteld` and an `AiMotivatie`.** Not a separate
  proposal entity: the block has to sit in the agenda where she decides it, between what is already planned, and a
  second table would be a second thing for every reader of the agenda to merge. The column `AiMotivatie` is new.
- **W2. The AI chooses; the tool fits** (owner, 2026-09-15). The model is sent the candidate activiteiten under short
  keys (`A1`, `A2`, …) with their name, soort, expected outcomes, length and subthema, and the schooldagen of the week
  with their free stretches. It answers with the activiteiten it picks, in order, each with a day and a one-line
  motivation, **and no hour**: the tool puts each on the first free quarter of an hour of that day, in the model's
  order, with the activiteit's own length (`LengteInLesuren` × 50 minutes), inside the schooluren, never across the
  middagpauze, never over a fiche, a hoekmoment or another block. It is the `Vrijmoment` search of ADR-0062.
- **W3. The candidates** are the activiteiten of every subthema whose window (`Subthemaplaatsing`) overlaps the week at
  a leeftijd the klas teaches: the shared ones and the asker's own (ADR-0049), minus those already planned by a person
  inside that window. A week in which no subthema runs is refused in Dutch, naming what to do: plan a subthema first.
- **W4. Only a decided placement is planned.** A `Voorgesteld` placement counts for no dekking (Art. V.1 as amended),
  is not "already planned" anywhere the tool says so (FB-076), and does not widen a subthema band. Accepting it sets
  `Aanvaard`; rejecting it removes it, so it *verdwijnt* as the ticket asks. Moving or resizing it is her deciding the
  moment herself: it becomes `Manueel` and loses the motivation, as a moved thema placement does.
- **W5. Asking again replaces only the open proposals of that week**, and only when the new answer keeps at least one,
  so none vanish without a replacement (the ADR-0056 D4 rule). Accepted and manual placements, fiches and hoeken stay
  where they are; the new proposals fit around them.
- **W6. Rights.** Asking, accepting and rejecting is the klas's planning, `KlasplanningBewerken` (a leerkracht of the
  klas or an admin, Art. IV.1 "for a generated plan"). An own activiteit is proposed only to its owner, and accepted
  only by its owner or an admin (ADR-0049 D6, the same check as planning it by hand).

Defaults of this session, which the owner may change on their own:

- **D1. A day the model names that is full, or outside the subthema's window, is corrected, not dropped.** The search
  starts on the day it named and walks on through the week's other days (ADR-0062 D1). Only an activiteit with room on
  **no** day of the week is reported as not fitting, by name, and nothing is planned for it: the ticket's "past een
  gekozen activiteit nergens, dan zegt de tool dat".
- **D2. Only days from today on.** A proposal on a day that has passed is a record of something that did not happen.
- **D3. A rejection is not remembered.** The block is removed; asking again may bring the same activiteit back. A
  remembered rejection would need a row per rejected block, for a list of candidates that is short and entirely hers.
- **D4. An unknown key, a repeated key or a day that is not a schooldag of the week is dropped or ignored per item**,
  never the whole answer; an answer that is not the JSON asked for is a 422 with no change (Art. IV.5).
- **D5. The existing distributor stays** (ticket, out of scope), and so does placing by hand.

## Alternatives considered

- **A `Weekvoorstel` entity beside the placements**, turned into a placement on acceptance, as FB-070's
  activiteitvoorstel is. Rejected by W1: that entity proposes an activiteit that does not exist yet; here the
  activiteit exists and only its moment is proposed, which is exactly what a placement with a status is.
- **The model picks the hour too** (ADR-0062 M1). Rejected by the owner's ruling for this ticket: the day is the
  pedagogical choice, the hour is arithmetic over a timetable.
- **Store a rejected block as `Geweigerd`.** Rejected by D3 and by the ticket ("dan verdwijnt het").

## Consequences

**Positive:** one agenda, one kind of block; the free-moment rule is the cat's, so the two cannot disagree about when a
school day has room.

**Negative / trade-offs:** every reader of placements has to decide what an open one means; the three that matter
(dekking, the "already planned" list, the subthema band) now filter it, and a new reader must too. Deleting an
activiteit, subthema or thema is still refused while an open proposal of it stands in an agenda: she rejects it first.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| The model answers with keys, days and a motivation, no hour (W2, Art. IV.5) | `WeekvoorstelPromptBuilder`, `WeekvoorstelResponseParser`; unit tests |
| Fitting stays inside the schooluren, off the pauze, fiches, hoeken and blocks (W2, D1) | `Weekinpassing.Pas` over `Vrijmoment`; unit tests |
| Candidates and rights (W3, W6) | `WeekvoorstelService`; `WeekvoorstelEndpointsTests` |
| An open proposal counts for no dekking (W4, Art. V.1) | `EfDekkingOpslag.HaalEigenActiviteitkoppelingenAsync`; integration test |
| Asking again replaces only open proposals (W5) | `WeekvoorstelService.StelVoorAsync`; integration test |
| Accept, reject, move (W4) | `Activiteitplaatsing.Aanvaard`, `VerplaatsNaar`; `WeekplanningService.BeslisAsync`; tests |
