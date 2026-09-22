# ADR-0062 — The AI proposes the day and hour of a cat's activiteit; the tool corrects a moment the school cannot give

- **Status:** Accepted
- **Date:** 2026-09-22
- **Deciders:** Project owner, while FB-070 was being built. Directie has not been asked.
- **Supersedes in part:** [ADR-0060](0060-activiteitvoorstellen-op-een-aanbod-gat.md) D3, for the sentence "the tool picks
  the moment, fitting it into the free time of that day as FB-027 does". Everything else of D3 stands: what the AI is
  sent, and that it picks the subthema each proposal goes under.
- **Relates to:** [ADR-0059](0059-de-kat-proactieve-agent.md) (the cat), [ADR-0038](0038-schooluren-per-weekdag.md)
  (the school's hours), [ADR-0053](0053-themaplaatsing-met-eigen-datums.md) (the thema's period).
- **Realises:** FB-070. **Constitution:** Art. IV.5 (amended the same day, see
  [`docs/constitutie-log.md`](../constitutie-log.md)); Art. IV.1, IV.4 and V.1 unchanged.

## Context

ADR-0060 G5 says a cat's activiteitvoorstel carries a moment, because an own activiteit that is not planned counts for
nothing (Art. V.1). D3 gave the choosing of that moment to the tool: the AI picked the subthema, and the tool took the
first free quarter of an hour inside the thema's period. Art. IV.5's list of what the AI answers with was written to
match, and names no day and no hour.

FB-070's own ticket text said the opposite from the start ("een voorgesteld dag en uur in de periode van het thema"),
and the build followed the constitution and D3. The owner, asked which of the two he meant, chose the ticket: the AI
proposes the day and the hour.

His reason is pedagogical rather than technical. Which day an activiteit belongs on is part of the activiteit: a
waterproef on the morning the thema opens is a different lesson from the same proef on the last Friday, and the tool,
which knows only which quarters of an hour are free, cannot tell those apart.

## Decision

The owner's rulings:

- **M1. The AI proposes the day and the starting hour.** It is sent the schooldagen of the thema's period with the
  school's hours for each and what is already planned on them, and answers with a day and a starting hour per
  activiteit, beside the subthema it already chose (D3, unchanged).
- **M2. The leerkracht plans it herself when she sees a better moment.** Accepting a proposal takes a day and hours of
  her own, which makes the decision `manueel` ([ADR-0060](0060-activiteitvoorstellen-op-een-aanbod-gat.md) D4,
  unchanged and now the ordinary way to overrule the model).

Defaults of this session, which the owner may change on their own:

- **D1. A moment the school cannot give is corrected, never stored and never dropped.** ADR-0060 G5 still requires a
  free moment inside the schooluren and inside the thema's period, and a language model is poor at arithmetic over a
  timetable. So the model's answer is a *preference*, not an instruction: the tool keeps the day it named and takes the
  first free quarter of an hour from the hour it named; when that day has no room left, it walks on to the next
  schooldag of the period, as it did before this ADR. Dropping the proposal instead would lose a good activiteit over a
  wrong hour, and storing the moment unchecked would put an activiteit in the middagpauze.
- **D2. A day outside the period is no day.** The model may name only a day it was sent; anything else falls back to the
  period's first free moment, because a day outside the thema's run is not a smaller mistake than a wrong hour, it is a
  different thema.
- **D3. The correction is silent.** Nothing in the proposal records that the tool moved the moment: what the leerkracht
  decides on is one moment, and a note about the model's arithmetic is not something she can act on (Art. I.2).

## Alternatives considered

- **Drop a proposal whose moment does not fit.** Rejected by D1: it makes the cat quieter the worse the model is at
  timetables, which is the wrong way round.
- **Store the model's moment unchecked.** Rejected by D1 and by ADR-0060 G5: an activiteit in the middagpauze is not a
  moment the school can teach, and every proposal would need checking by hand before it was usable.
- **Keep D3 as it was and correct the ticket instead.** Rejected by the owner, who wants the day to be a pedagogical
  choice.

## Consequences

**Positive:** the day an activiteit lands on carries the model's judgement about the activiteit, not the tool's
arithmetic about free quarters.

**Negative / trade-offs:** a longer prompt, which now carries the klas's planned hours for the thema's period; a second
place where a model's answer is corrected rather than refused, which is a softer contract than the rest of Art. IV.5;
and a moment on screen that is not always exactly the one the model named, with nothing saying so (D3).

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| The model answers with a day and a starting hour (M1, Art. IV.5) | `AanbodgatPromptBuilder`; the parser's `dag` and `beginuur`; unit tests |
| Only a day it was sent counts (D2) | `AanbodgatValidator`; unit tests |
| The stored moment is free, inside the schooluren and inside the period (D1, ADR-0060 G5) | `Vrijmoment.Zoek` from the preferred moment; unit tests; `AanbodgatEndpointsTests` |
| She may plan it herself (M2) | `ActiviteitvoorstelService.KiesMomentAsync`; the accept route's `datum`/`begin`/`einde` |
