# ADR-0038 — The school's hours are school data: one set per weekday, set by directie

- **Status:** Accepted
- **Date:** 2026-09-15
- **Deciders:** Project owner, in session on 2026-09-15: the hours are set **per school**, by directie, per weekday
  (FB-023's *Beslissing*); the agenda shows them, opening at the start of the school day and shading the hours
  outside it; **one set for the school**, not per schooljaar. Both answers were given to FB-023's two open questions.
- **Supersedes:** [ADR-0028](0028-tijdraster-in-plaats-van-lesuren.md) decision 5 **in part**: its sentence that the
  grid's constants "are not persisted per school", and its statement that the tool "does not claim to know a school's
  hours". The rest of decision 5 stands (see *What does not change*).
- **Realises:** FB-023; FR-12.1 (the beheerder sets up the school's structure). **Constitution:** Art. VI.1, II.3,
  XII, IV.2, V.1.
- **Backlog:** FB-023; enables FB-027 (the AI fits a week's activiteiten between these hours).

## Context

ADR-0028 turned the agenda into a time grid and deliberately modelled no school hours: the grid opens at a
client-side 7:00 and every time is the teacher's own. FB-027 now asks the tool to place activiteiten *"rekening
houdend met start en eindtijd van schooldag"*, which needs the hours as data, and a setting that only feeds a future
feature would be a control that does nothing. The owner answered both: directie sets the hours per weekday for the
whole school, and the agenda uses them now.

## Decision

1. **`Schooldaguren` is one row per weekday**, Monday to Friday: `Begin`, `Einde`, and an optional
   `MiddagpauzeBegin`/`MiddagpauzeEinde` pair (both or neither), all `TimeOnly`. A unique index on `Weekdag` makes
   it one set; there is no school id because each school has its own database (ADR-0036). A weekday without a row has
   no hours set.
2. **The domain refuses** a weekend day, an end not after its start, half a pause, and a pause that does not lie
   strictly inside the day, each in a Dutch sentence that names the weekday (Art. II.3).
3. **`GET /api/schooluren` is open to every session; `PUT` replaces the whole set and requires `Beheer`**, the
   directie-only row of ADR-0030 §3 that already covers schooljaren. The owner's ruling is what places it there; the
   matrix row's wording is not changed. A replace is all or nothing.
4. **The agenda uses them.** The time grid opens at the whole hour in which the earliest school day on screen begins
   (falling back to 7:00 when none has hours), hatches the hours before and after the school day and the middagpauze,
   and labels each stretch in words (`begin 8:30`, `middagpauze`, `einde 15:30`); the day heading says the same to a
   screen reader. The hatch is ink on the ground colour, never a hue (Art. XII, ADR-0024's rationed accent), and a
   different mark from a closed day's flat tint.
5. **Instellingen gets a part *Schooluren*.** Directie sees five rows of time fields with a tick box for the
   middagpauze and one save button; everyone else sees the same days as text.

## What does not change

- The grid still **draws the whole day** and every hour stays plannable: the hatch catches no click. The school's
  hours are not a bell schedule and no stored time is snapped or moved.
- Changing the hours moves nothing already planned, and they are not per klas and not per schooljaar (the owner's
  ruling).
- Nothing here counts for dekking (Art. V.1) or touches a teacher's decision (Art. IV.2).

## Alternatives considered

- **Per schooljaar.** Rejected by the owner: more work each year for directie, and a choice about what a new year
  inherits, for hours that rarely change.
- **Per klas.** Rejected by the owner (FB-023 *Buiten scope*).
- **Store the setting now, use it only with FB-027.** Rejected: a setting nothing reads is a control that does
  nothing.

## Consequences

**Positive:** FB-027 has its input; a teacher's agenda opens where the school day starts; directie states the
school's hours once.

**Negative / trade-offs:** the grid's opening hour now depends on a request; while it loads the grid opens at 7:00 and
moves once to the school's hour when the answer arrives. It moves only when the opening hour changes, so a refetch
does not pull a teacher back.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| One set, weekdays only, pause inside the day (Dutch refusals) | `Schooldaguren` (domain), `SchoolurenService`; `SchooldagurenTests`, `SchoolurenServiceTests` |
| Directie writes, everyone reads (Art. VI.1) | `SchoolurenController` (`Rechtenmatrix.Beleid.Beheer` on `PUT`); `SchoolurenEndpointsTests`, `ElkeWijzigendeRouteVraagtEenRechtTests` |
| Unique weekday on PostgreSQL | migration `Schooluren`, `SchooldagurenConfiguration` |
| Never colour alone (Art. XII) | `Schooltijdlagen` and `urenZin` in `Tijdraster.tsx`; `Tijdraster.test.tsx` |
| Every hour stays plannable (ADR-0028) | the hatch is `pointer-events-none` under the empty column's button; `Tijdraster.test.tsx` |
| The screen offers fields to directie only | `SchoolurenScherm` (`mag.beheer`); `SchoolurenScherm.test.tsx` |
