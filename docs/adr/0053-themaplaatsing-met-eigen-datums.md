# ADR-0053 — A thema placement carries its own dates; the themaperiodes leave the planning

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Siebe De Saedeleir (projecteigenaar), in session on FB-035
- **Supersedes:** [ADR-0013](0013-planningsblok-abstraction.md) and [ADR-0020](0020-planningsblok-derivation-rules.md)
  for the jaarplan: a placement no longer keys on a derived block. Their derivation stays in the code only for the
  generation prompt, which is parked (decision 9).

## Context

A `Themaplaatsing` stored one thing about time: the start date of the themaperiode it sat in (ADR-0020 §3). A placed
thema therefore always filled a whole period. The owner asked (FB-035, 2026-09-15) how to plan a thema of 5 weeks in a
period of 6, with the next thema starting in the free week. The tool could not say where in the period a thema ran,
and a thema that ran on into the next period had to be placed twice.

Refining the ticket on 2026-09-16, the owner did not choose a start week inside the period. He ruled that thema's are
**not planned in fixed periods at all**: every placement has its own begin and end date. That replaces the two-tier
block model directie settled on 2026-07-14 (Art. IX.3) for the jaarplan. The owner ruled on that himself. He also
chose, from a mockup, a week timeline as the plan screen, and ruled the conversion of existing plans and what the AI
generation does meanwhile. The rulings are quoted in the ticket; the ones this ADR rests on are:

- **R1** A placement has a begin and an end date, per day. The themaperiodes leave the planning.
- **R2** The teacher picks the begin; the tool proposes the end from the thema's duration in school weeks; the
  teacher may change the end.
- **R3** A vacation inside a placement splits it: the tool stores the parts, together as long as the thema.
- **R4** Two thema's never run on the same day, the same thema twice included.
- **R5** A thema that would end after the last school day stops on it, with a warning.
- **R6** When the vacations change, nothing moves: a placement that no longer fits carries a lasting notice and the
  dekking reads *te herzien* (the directie rule of 2026-07-28, kept).
- **R7** *Te vol* goes. The tool shows school weeks without a thema, a year balance, and a thema whose end differs
  from its duration.
- **R8** The plan screen is a timeline per week (mockup option A); a bar can be dragged.
- **R9** Existing plans: a thema gets its period's first and last day; several thema's in one period are put one
  after another in their current order; a thema left with no free day is deleted from the plan.
- **R10** The AI generation is reworked in a separate ticket and is switched off until then.
- **R11** A vast moment blocks no placement any more; only a vacation interrupts a thema.
- **R12** Rejected placements are deleted by the conversion; rejecting an open proposal deletes it.
- **R13** Less is more (after looking at the build): no "Geen thema" markers on the timeline, no notice or attention
  border for a changed end, and no week or lock buttons on the card. R7's year balance stays.

## Decision

1. **`Themaplaatsing` stores `Van` and `Tot`** (inclusive dates) instead of `BlokNiveau` and `BlokStart`. Status,
   motivation and lock are unchanged. Changing the dates makes the placement `Manueel` and clears the motivation, as a
   move always did.
2. **The calendar rules live in one domain type, `Themakalender`**, built from the `Schooljaar`:
   - a **schooldag** is a weekday on which `Schooljaar.IsLesdag` holds;
   - a **lesweek** is a Monday-to-Friday week holding at least one schooldag;
   - the **proposed end** of a thema of *n* weeks starting on *b* is the last schooldag before the same weekday *n*
     lesweken later; a week without a schooldag is skipped. Past the last school day the count goes on over virtual
     full weeks, and an end beyond the year is cut to the last schooldag (R5);
   - **splitting** cuts a range at every closure of kind `Vakantie` and trims each part to schooldagen; a `VrijeDag`
     and a weekend do not split (R3);
   - a **shift** keeps the number of schooldagen and walks them from the new begin, over vacations, then splits.
3. **The aggregate refuses overlap.** `Jaarplan` rejects a placement that shares a calendar day with another one
   (R4). The service checks first and refuses in Dutch, naming the other thema; the aggregate's guard is the
   backstop for a programmer error.
4. **A reeks is derived, never stored.** Consecutive placements of the same thema with no schooldag between them form
   one reeks: the parts around a vacation. The read model numbers the parts, and says whether the year cut the reeks
   short (R5). It also still reports whether the end differs from the thema's duration; the screen does not show that
   since R13, and the generation's rework may use it.
5. **A placement is *vervallen* when a vacation lies inside it or it leaves the school year** (R6). Nothing moves it.
   Saving it again, with new dates or a shift, splits it anew and clears the state. Dekking keeps withholding its
   figures while one is unresolved, exactly as before.
6. **The plan read carries the lesweken and the balance.** `JaarplanWeergave` drops the block spreading, the block
   description and the blocked periods, and gains the school year's bounds, every lesweek with whether a thema runs
   in it, and the balance. The rooster read drops its blocks and keeps the year and its vacations.
7. **Endpoints.** `GET …/jaarplan/voorstel` proposes an end (and the parts) for a thema and a begin; `POST
   …/plaatsingen` takes a thema, a begin and an end; `PUT …/plaatsingen/{id}/datums` sets both dates;
   `PUT …/plaatsingen/{id}/verschuiving` shifts a placement to a new begin, keeping its schooldagen (the drag).
   `PUT …/blok` and `POST …/periodes/{blokStart}/generatie` are gone. The status PUT accepts `Aanvaard` and `Manueel`
   only; a proposal is rejected by deleting it (R12).
8. **The conversion is one EF migration with the rules written in PL/pgSQL.** It derives each school year's
   themaperiodes with the same arithmetic the seam used (5 weeks, the only configured value), deletes the rejected
   placements, gives a lone placement its period's first and last schooldag, puts several in a row from the period's
   first schooldag, each with its proposed end, cut before the next occupied period and split at vacations, and
   deletes a placement with no free day (R9). A lone placement is cut before the next occupied period too, so no two
   rows share a day. A placement whose start matches no period is treated like one of
   several: it starts on the first schooldag from that date. The helper functions live in `pg_temp` and vanish with
   the migration's session. An integration test pins the SQL against dates worked out by hand.
9. **Generation is switched off, and its orchestration is removed.** `POST …/generatie` answers 409 with a Dutch
   sentence, and the plan screen shows the button disabled with the same reason. The run itself, the spreading report,
   the parameter report and their tests are deleted, since they assumed blocks and two thema's per block. Kept for the
   AI ticket: the prompt builder, the response parser, the generation parameters and their endpoint, and the
   `IPlanningsblokIndeling` seam the prompt builder describes blocks with. That ticket decides whether blocks survive
   as a hint for the model.
10. **Vaste momenten block nothing** (R11). The kept parameters stay stored, unchanged, for the AI ticket.
11. **The agenda follows the placements.** Where it looked up "the themaperiode of this day", it now looks up the
    placement running on that day: the thema's days are the days of that placement. `ValtBuitenThemaperiode` keeps its
    name and now means: outside every placement of the activiteit's thema.

## Alternatives considered

- **A start week inside the period, the period kept as the grid** (the ticket as first written). Rejected by the
  owner on 2026-09-16: it kept the periods teachers do not think in, and still needed special cases for a thema
  running across two periods.
- **Keep the generation running, writing dates.** Rejected: the owner switched it off (R10), and a run that proposes
  two thema's per period would contradict R4 on every call.
- **Convert existing plans at application start in C#.** Rejected: migrations are applied with
  `dotnet ef database update` before a deploy, the columns must be non-null for the domain type, and a half-converted
  database between two steps is worse than one migration that carries its own arithmetic.
- **Keep the rejected placements in a list** (R12's other option). Rejected by the owner: they only served the AI's
  memory, and that AI is being reworked.

## Consequences

**Positive**
- A plan says what a teacher means: this thema from this day to that day.
- The timeline shows gaps and overlaps at a glance; the rule against overlap makes a gap the only thing to look for.
- One domain type answers every calendar question the plan asks, so the screen and the server cannot disagree.

**Negative / trade-offs**
- The AI generation is unavailable until its ticket lands.
- The migration repeats the block arithmetic in SQL once. It is dropped with the migration's helper functions and is
  never run again.
- A thema's proposed end counts whole lesweken; a school that wants half days counted has no rule for it, as before.
- Periods were also the unit a vast moment blocked. Until the AI ticket decides, a kept vast moment means nothing.

**Follow-ups**
- A TB ticket reworks the AI generation on dates, including the startthema's and vaste momenten, and decides the fate
  of the seam and the prompt builder's blocks.

## Compliance trace

- **Constitution:** Art. IX.3 (amended: the jaarplan holds placements with dates; no planningsblok grain), Art. XII
  (amended: themaperiode, subthemaperiode, startthema, vast moment, jaarplan), Art. IV.2 (amended: a rejected thema
  placement is removed rather than stored as `geweigerd`), Art. IV.1 unchanged (a proposal is still decided by the
  teacher), Art. V.1 unchanged (a placed thema counts as before; a *vervallen* one withholds the figures).
- **Backlog:** FB-035; the AI generation ticket that follows.
- **FR/NFR:** FR-6.1, FR-6.2, FR-6.4, FR-7.2; FR-5 and FR-8 are paused.
