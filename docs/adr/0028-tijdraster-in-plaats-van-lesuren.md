# ADR-0028 — The agenda is a time grid: clock times replace numbered lesuren

- **Status:** Accepted (decision 5 superseded in part by [ADR-0038](0038-schooluren-per-weekdag.md): the school's
  hours are now school data, set by directie, and decide where the grid opens)
- **Date:** 2026-09-11
- **Deciders:** Project owner, in session, after seeing the week view beside his own Outlook calendar. He asked for
  "alle uren van de dag ... met een lijntje van waar we vandaag zitten", for teachers to "zelf de tijdstippen bepalen"
  instead of planning in lesuren, and for hoeken to be drawn on the day itself rather than in a band above it. The
  defaults below (the visible hours, the quarter-hour step, the default length, the rough conversion of existing rows)
  were proposed with their costs and accepted in the same session.
- **Relates to:** [ADR-0023](0023-activiteit-day-placement.md) — an activiteit is placed on a calendar **day**, which
  this decision leaves exactly as it was. It supersedes **only the `Volgorde` half** of that ADR's decision 1.
  [ADR-0013](0013-planningsblok-abstraction.md) and [ADR-0020](0020-planningsblok-derivation-rules.md) are untouched:
  the themaperiode/subthemaperiode grid is not a clock.
- **Supersedes:** the project owner's instruction of **2026-08-24** that the agenda shows *no* clock times, recorded in
  `frontend/src/features/activiteiten/lesuren.ts`. That instruction was right about its own reason and this decision
  removes the reason; see *Why it reverses*.
- **Realises:** FR-6.2 (drag-and-drop of activiteiten), FR-6.3 (the view levels FR-6.3 leaves open), FR-7.2.
  **Constitution:** Art. IX.3 (the planning grid is unchanged by this), Art. IV.2 (nothing here generates or discards a
  teacher decision), Art. V.1 (a time moves no dekkingscijfer), Art. II.3 (the refusals are Dutch, composed
  server-side), Art. XII + WCAG 2.2 AA (the now-line carries a time label, never colour alone).
- **Backlog:** E10-04. *(Filed as E10-03 and renumbered within the hour: session `algemene-fiches` pushed its own E10-03 two minutes earlier. Recorded rather than silently corrected, because the commit message of `6cd3d95` still says E10-03 and a reader chasing that id has to land somewhere.)*

## Context

A day was a row of **seven numbered lesuren**. `Activiteitplaatsing.Volgorde` was an ordinal into that row,
`Activiteit.LengteInLesuren` said how many of them a block filled, and `Hoekmoment.Volgorde` put a corner in one of
them. `lesuren.ts` held the seven, with a comment recording that clock times had been shown once and removed on the
owner's instruction of 2026-08-24, because **nothing in the model knew when the third lesuur starts**: the times were a
default dressed up as a fact.

That was a correct decision about a screen that only had to say *in which order* things happen. The owner's request of
2026-09-11 is a different screen: an Outlook-shaped grid where the hours of the day are the vertical axis, a teacher
drags a block to 10:15 and pulls its bottom edge to 11:00, and a line marks the current time. A slot number cannot
express any of that, and a grid drawn from slot numbers would have to invent the very clock the 2026-08-24 instruction
refused to invent.

## Decision

**1. A placement carries two clock times.** `Activiteitplaatsing` gains `Begin` and `Einde` (`TimeOnly`, PostgreSQL
`time`) and loses `Volgorde`. `Einde` must lie after `Begin`; the aggregate refuses the rest as programmer error and
`WeekplanningService` refuses the teacher's version as a Dutch 400.

**2. The duration lives on the placement, not on the activiteit.** `LengteInLesuren` said how long an activiteit is
*everywhere it is planned*, which was the honest shape when a length was a count of slots. A teacher who drags one
block's bottom edge on one Thursday is changing that Thursday, so the end time is stored per placement. The activiteit
keeps a **default** length, which is what a newly placed block gets.

> **Not yet renamed, and the gap is stated rather than hidden.** That default is still the column
> `lengte_in_lesuren`, read by the client as `× 50 minutes`. Turning it into `DuurInMinuten` touches
> `SchoolcontentBeheerService`, which is held by a **stale claim** from a session that ended on 2026-08-31; breaking a
> claim is the technical lead's, not a building session's. Until then the *model* is honest (the placement owns the
> real times) and one *default* is still expressed in lesuren. Owed on E10-04.

**3. The unit of "already placed" is the start time.** `Jaarplan.IsAlGeplaatstOp(activiteitId, datum, begin)` and the
unique index `(JaarplanId, ActiviteitId, Datum, Begin)`. Two *different* activiteiten may overlap in time — an agenda
draws them side by side — and the same activiteit may run twice in one day. Only the same row written twice is refused.

**4. Every hoekplaatsing has a time, and therefore has rows.** `Hoekmoment` gains `Begin`/`Einde` and loses
`Volgorde`. The sheet's answer "niet in het uurrooster" is gone (owner: *"elke hoek moet een tijdstip krijgen"*), so
the service writes one `Hoekmoment` per **teaching day** of the window, as it already did when a lesuur was given. A
window containing no teaching day is refused: it would be a corner with nowhere to appear.

**5. The school's bell schedule is still not modelled.** The server stores what the teacher chose, to the minute, and
knows nothing about when a lesuur starts. The grid's visible range (7:00–18:00, opening scrolled to 8:00), its
quarter-hour step and the 50-minute default are **client-side presentation constants**, in one module, and they are
not persisted per school. That is the 2026-08-24 instruction's reasoning honoured rather than reversed: the tool still
does not claim to know a school's hours; it draws the hours the teacher herself picked.

> **Amended 2026-09-11, later the same day. The principle above stands; three of its numbers do not.** The owner
> looked at the day view and asked for two things this decision had merged into one: *"ik wil wel de mogelijkheid voor
> de leerkrachten om op andere uren buiten 7u-18u dingen aan te duiden en in te plannen maar default moet gewoon
> 7u-17/18u zichtbaar zijn"*, and, when offered an expand control: *"ik wil gewoon kunnen scrollen maar default moet
> het wel op 7u-18u staan"*.
>
> **So the drawn range and the visible window are now two different facts.** The grid draws **0:00–24:00**
> (`HEEL_DE_DAG`), because an hour it does not draw is an hour a teacher cannot click, drag to or resize into; the
> window it opens is **7:00–18:00**, scrolled to **7:00**, sized to exactly those eleven hours. Read "the grid's
> visible range (7:00–18:00, opening scrolled to 8:00)" above as **"the grid's default window (7:00–18:00, opening
> scrolled to 7:00)"**; 8:00 was this decision's own default and the owner replaced it. The `Deciders` line naming
> "the visible hours" among the four defaults accepted on 2026-09-11 refers to the original three numbers and is
> superseded here for that clause only.
>
> **Nothing else in decision 5 moves.** The constants stay client-side, in `tijd.ts`, and are still not persisted per
> school, per klas or per schooljaar. Widening the drawn range to the whole day removes an assumption about school
> hours rather than adding one, so the 2026-08-24 reasoning is honoured harder than before.
>
> **One caveat the pixels impose.** The window is *at most* eleven hours: it is `clamp(24rem, 100dvh - 21rem, 616px)`,
> so from roughly 950px of viewport height it is the full 7:00–18:00, and on a 390×844 phone it is 508px, which is
> 7:00 to about 16:00. The rest of the default day is a scroll away there rather than on screen. Recorded because the
> owner's default is a promise about what he sees, and on a phone it is one the pixels cannot keep.
>
> Amended in place rather than superseded by a new ADR: the reasoning survives intact and only a parenthetical
> enumeration was falsified. Found by the antagonist round on the day-view fixes.

**6. Existing rows are converted roughly, and that is a ruling rather than an oversight.** The migration maps
`volgorde n` to `08:30 + n × 50 minutes` and the end to `begin + lengte_in_lesuren × 50 minutes`. It is arithmetic
about a bell schedule nobody recorded, so it cannot be right; the owner ruled it good enough because every row it
touches is demo data (*"de demo data maakt eigenlijk niet uit"*). A school with real rows would need its own mapping,
and this paragraph is where that reader should start.

**7. Hoeken are drawn in the grid, not above it.** A corner with a time is a block on its day like any other. The
all-day band over the week keeps the thema and subthema runs, which genuinely are facts about whole days.

## Why it reverses the instruction of 2026-08-24

The instruction removed times because **the model did not hold any**, so the screen was inferring them. This decision
puts the times *in the model*, sourced from the teacher rather than from a default. What was a guess printed beside a
slot number is now the stored answer to "when does this happen", and the two are not the same claim.

## Consequences

**What gets better.** A teacher plans the day she actually teaches: a 20-minute kring at 8:45, hoekenwerk from 13:30
to 14:20, two things at once drawn side by side. The now-line answers "where are we?" without arithmetic. Nothing has
to be expressed as a whole number of equal slots any more.

**What it costs.**

- **The swap rule of 2026-08-31 is gone.** It existed because two things could not share a lesuur: a drop onto an
  occupied slot exchanged the two. With a time axis there is no slot to contend for, so a drop simply lands, and
  overlapping blocks are drawn beside each other. `ruilen.ts`, its three `slepen.ruil*` strings and its test are
  deleted rather than left dormant.
- **A drag is now a two-dimensional gesture**, which needs a non-drag alternative (WCAG 2.2 SC 2.5.7): the activiteit
  sheet gains begin/end time fields, and they are the keyboard route to both moving and resizing.
- **`lengte_in_lesuren` survives as a default** under a name that no longer describes the model. Point 2 above.
- **The week view does not fit seven columns on a phone.** It shows three days below `sm`. That is a real reduction:
  the phone can no longer see a whole week at once in the time view. The month view, which does, is unchanged.

**What deliberately does not change.** An activiteit is still placed on a `DateOnly` (ADR-0023 decisions 1–4, 6, 7);
`Planningsblokniveau` still gains no member; a week is still a client-side grouping; and scheduling an activiteit
still moves no dekkingscijfer (Art. V.1).

## Alternatives considered

**Keep lesuren and show times beside them.** Rejected: the times would again be a default dressed up as a fact, and
the owner's request is precisely that a teacher may pick 8:45, which no numbering can express.

**Make the school's bell schedule a setting first, then plan in its slots.** This is the tidy version and it is what a
school with a rigid timetable would want. Rejected *for now* because it puts a configuration screen and a ratification
question (which hours? does Wednesday differ?) in front of a change the owner asked to see today, and because free
times are a superset: a school that later configures its hours can have the grid snap to them without moving a single
stored row.

**Store a duration instead of an end time.** Equivalent for the data and worse at the edges: every consumer would
compute the end, and the one question the grid asks constantly is "where does this block stop".

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| End after start | `Activiteitplaatsing`/`Hoekmoment` (programmer error, English); `WeekplanningService.VereisTijden` + `OngeldigeDagplanningFout.EindeNietNaBegin` (teacher input, Dutch 400) |
| One row per (plan, activiteit, day, start) | `Jaarplan.IsAlGeplaatstOp` + unique index in `ActiviteitplaatsingConfiguration` |
| Every hoekplaatsing has rows | `HoekplaatsingService.PlaatsAsync`, which refuses a window with no teaching day |
| A time moves no dekking (Art. V.1) | unchanged: `EfDekkingOpslag` never reads a placement's time, and `WeekplanningServiceTests` pins the absence of any figure on the read model |
| Dutch, teacher-actionable refusals (Art. II.3) | `OngeldigeDagplanningFout`, `Hoekmoment`, `Hoekplaatsing` |
| Colour never alone (Art. XII) | the now-line carries the current time as text in the hour gutter |
