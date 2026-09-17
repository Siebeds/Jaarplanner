# ADR-0055 — The AI jaarplan generation proposes thema's with a start week; the calendar sets the days

- **Status:** Accepted
- **Date:** 2026-09-17
- **Deciders:** Project owner, in session on TB-053. Rulings of 2026-09-17: the model picks thema's and a start week,
  the server places each on free days (option "AI kiest volgorde + startweek"); regenerating part of the year (FR-8.2)
  does not come back; the kept startthema's and vaste momenten are removed (FR-5.4).
- **Realises:** TB-053. **Constitution:** Art. I.1, IV.1 to IV.5, IX.3, XII.
- **Builds on:** [ADR-0053](0053-themaplaatsing-met-eigen-datums.md), whose decision 9 switched the generation off and
  left this rework its open points: the fate of the `IPlanningsblokIndeling` seam, the prompt builder's blocks, the
  kept parameters, and the regeneration of one period.

## Context

Since ADR-0053 a thema placement has its own first and last day, no two share a day, and a vacation splits one into
parts. The generation asked the model for thema's per themaperiode, several per period, so it was switched off.
Nothing on the plan screen sets startthema's or vaste momenten any more; they lived only in a table and a GET endpoint.

## Decision

1. **The model answers with thema's and a start week.** The contract is
   `{"plaatsingen": [{"thema", "startweek", "motivatie"}]}`; `startweek` is an ISO date, read as the Monday of the week
   it falls in. The prompt lists every lesweek by its Monday, marked *vrij*, *deels vrij* or *bezet* by the placements
   that stay, the vacations, the thema's that stay, and the school's thema's with their duration and decided goals
   (Art. IV.4). It names no month and no planningsblok.
2. **The calendar sets the days.** In order of start week, each proposal starts on the first free schooldag from that
   week on (owner ruling). Three rules are defaults of this ADR, not the owner's ruling, and are his to tune: the free
   stretch must hold at least one whole lesweek; a shorter stretch is skipped for a later one; and the search stops at
   the end the thema would have if it started in the chosen week. It ends at `Themakalender.VoorgesteldEinde`, cut before the next placement, and is split at
   every vacation, as a hand-placement is. Every part is stored `Voorgesteld` with the model's motivation.
3. **What is not placed is reported, never stored or moved elsewhere:** a thema the school does not have
   (`OnbekendThema`), a thema already in the plan or proposed twice (`AlGepland`), a start week that is no lesweek
   (`GeenLesweek`), and weeks with no room (`GeenPlaats`). The screen names the last two; the first two are not the
   teacher's to act on.
4. **A run covers the whole year and replaces only open, unlocked proposals** (Art. IX.3, unchanged). The screen asks
   first when there are any, counting thema's, not parts. The parts' days are not offered to the model.
5. **An unreadable answer changes nothing** (422, Art. IV.5). A school without thema's, a plan without a free lesweek
   and a prompt over the ceiling (TB-007, advice: the server setting) are refused before the model is called.
6. **FR-8.2 (one period) does not come back.** A whole-year run already keeps every decided placement; a teacher keeps
   a proposal by accepting it. `BouwVoorPeriode` and `BestaandePlaatsing` are removed.
7. **FR-5.4's kept parameters are removed**: `Generatieparameters` with its startthema's and vaste momenten, its three
   tables (a migration drops them and their rows), the `GET …/jaarplan/parameters` endpoint and the request type. The
   plan itself, with what the teacher accepted or placed, is what steers a run.
8. **The planningsblok seam is removed**: `IPlanningsblokIndeling`, its configured implementation and the
   `Planning:Blokindeling` configuration, `Planningsblok` and `Planningsblokniveau`. Nothing in the app derives a grid
   any more. ADR-0013 and ADR-0020 are fully superseded.

## Alternatives considered

- **The model gives exact days, and the server refuses any overlap.** Rejected by the owner: a model that miscounts a
  vacation week loses the proposal.
- **The model gives only an order, and the server packs the thema's back to back.** Rejected by the owner: the model
  then has no say in the season a thema falls in.
- **Keep the startthema's as a hint with a form beside the button.** Rejected by the owner: more screen for a setting
  nobody had used since it lost its form.
- **Place a thema in a free stretch shorter than one lesweek.** Rejected here: a thema of five weeks shrunk to one day
  is not a proposal a teacher can use; reporting it as not fitting is honest.

## Consequences

- The generation is back on: the button on the plan screen and `POST …/jaarplan/generatie`, which answers the run's
  report with the plan.
- Existing kept parameters are deleted by the migration. They had no screen and no reader since ADR-0053.
- A thema the model places late in the window may end later than the model expected; the teacher sees the days on the
  card and can move it.
- FR-5.4 and FR-8.2 are recorded as lapsed in the functional analysis (A.6).

## Compliance trace

- **Constitution:** Art. I.1 items 4 and 6 (amended: regenerate the whole plan, on free days), Art. IV.5 (amended: the
  plan-generation answer is thema's with a start week and a motivation), Art. II.1 (example updated), Art. IX.3 (amended: the
  generation is on; the Generatieparameters entity is gone), Art. XII (amended: *startthema*, *vast moment* and
  *bewaarde generatieparameters* removed), Art. IV.1 to IV.4 unchanged (a proposal, a motivation, a teacher's decision,
  grounded).
- **Backlog:** TB-053.
- **FR/NFR:** FR-5.1, FR-5.2, FR-5.3, FR-8.1, FR-8.3 (the proposals are the preview), FR-8.4 (per placement, A.10);
  FR-5.4 and FR-8.2 lapsed.
