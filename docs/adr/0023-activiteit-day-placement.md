# ADR-0023 — An activiteit is placed on a calendar day, not on a planningsblok

- **Status:** Accepted
- **Date:** 2026-08-19
- **Deciders:** Architect (Siebe De Saedeleir / team), prompted by the project owner's change requests from the directie review of 2026-08-19
- **Relates to:** [ADR-0013](0013-planningsblok-abstraction.md) (the planningsblok abstraction) and
  [ADR-0020](0020-planningsblok-derivation-rules.md) (derivation rules). It **refines neither and supersedes nothing**:
  both continue to govern the planning grid unchanged. This ADR governs a *second, independent* placement axis they
  never spoke to.
- **Realises:** FR-6.2 (the "en activiteiten" half), FR-6.3 (which left the view levels undecided), FR-7.2.
  **Constitution:** Art. IX.2 (class/age scoping), Art. IX.3 (planningsblok granularity), Art. IV.2 (human-in-the-loop),
  Art. V.1 (coverage computed, never stored).
- **Backlog:** E9-03 (built), E9-04 / E9-05 (build on it).

## Context

The directie review of 2026-08-19 asked for something the build could not do: a teacher clicks a themaperiode and
plans the subthema's and activiteiten of that thema **per week, and where they want to, per day**.

Nothing below a thema had a position in time. `Jaarplanner.Domain/Planning/` held exactly one placement type,
`Themaplaatsing`, and the `Subthemaperiode` tier introduced by E3-08 only redraws the *same* thema placements at a
finer grain across the whole year. That is why the owner's verdict was that the themaoverzicht is fine and the
subthema overview is not: the fine tier answers "what is the rhythm of the year?" when the question asked was "what am
I doing on Tuesday?".

This is **not** new scope. FR-6.2 already reads *"De leerkracht kan thema's **en activiteiten** verslepen
(drag-and-drop) tussen periodes"*, and FR-6.3 explicitly leaves the view levels open (*"exacte niveaus ter
beslissing"*). E3 implemented the first noun and stopped.

The obvious implementation — a third `Planningsblokniveau`, `Week` or `Dag` — had to be ruled out explicitly, because
it is what anyone reaching for "a finer view" will reach for first.

## Decision

**1. An activiteit is placed on a `DateOnly`.** `Activiteitplaatsing { Id, JaarplanId, ActiviteitId, Datum, Status,
Volgorde }` hangs off the `Jaarplan` aggregate. There is no block key, no tier and no ordinal on it, and a test asserts
the absence of all four.

**2. `Planningsblokniveau` gains no member.** The planning grid stays the ratified two-tier themaperiode /
subthemaperiode pair, configurable behind the E3-05 seam (Art. IX.3, ADR-0013). A test pins the enum's membership.

**3. A week is a rendering grouping of dates, not a tier.** The server returns *days*; the client groups them into
weeks. Weeks start on Monday, decided in one method (`WeekplanningService.Week`) rather than configured, because unlike
the block grain nobody has asked for it to vary.

**4. A subthema is not placed at all.** Its span is derived from the activiteiten placed under it. There is no
`Subthemaplaatsing` and there should not be one.

**5. `Activiteitplaatsing` is a plain entity, not an EF owned collection** — unlike `Themaplaatsing`, which stays
owned.

**6. Scheduling an activiteit onto a day does not affect dekking.** Art. V.1 makes a leerplandoel gedekt through the
*thema's* placement in the plan. The day-level read model carries `doelcodes` for display and no figure of any kind.

**7. An activiteit may be scheduled outside its thema's themaperiode.** The mismatch is *reported*
(`ValtBuitenThemaperiode`), never refused.

## Rationale

**Why not a third tier (decisions 1–3).** Three independent reasons, any one of which is sufficient:

- **It would compile in an assumption the constitution keeps out.** A week is a calendar unit. `Planningsblokniveau`
  has a test whose only job is to fail when one appears in it, precisely because Art. IX.3 and ADR-0013 make the grain
  ratified configuration rather than a compiled-in calendar.
- **A block boundary moves; a Tuesday does not.** `Themaplaatsing.BlokStart` keys on a *derived* boundary, so editing
  one vakantie can leave it pointing at a date that is no longer any block's start. That single fact costs this
  codebase `IsVervallen`, a persistent notice, a re-placement route and a withheld dekkingscijfer (directie ruling
  2026-07-28). A concrete teaching day inherits none of it: edit the calendar and a date either stays a lesdag or
  becomes a closure, which is a smaller and locally repairable problem.
- **They answer different questions.** Collapsing "which stretch of the year does this thema live in?" and "which day
  does this activiteit happen on?" into one ordinal space is the *two views disagree about the same period* defect the
  E3-02/E3-06 review had to repair twice.

**Why no `Subthemaplaatsing` (decision 4).** A second placed thing is a second thing to keep in step with the first,
and the two would eventually disagree about the same fortnight. Deriving the subthema's span from its activiteiten
gives one source of truth for free.

**Why a plain entity (decision 5).** Ownership buys the lifetime cascade, which `OnDelete(Cascade)` gives anyway, and
it costs the ability to query the type independently of its owner. Two queries this feature needs are exactly that:
one week's days without loading a year of them, and one activiteit's placements for a delete guard. E5-01's worklog
records paying for that limitation with `Themaplaatsing`; there was no reason to buy it a second time. `Themaplaatsing`
stays owned because un-owning it would surrender the cascade its own delete guards depend on.

**Why dekking is untouched (decision 6).** A doel is covered because the thema carrying it is in the plan. Letting a
day-level placement raise a figure would grant coverage twice for the same content, and would let the *calendar* rather
than the *plan* decide what an onderwijsinspectie is shown.

**Why a mismatch is reported and not refused (decision 7).** A teacher who front-loads one activiteit before its thema
formally starts is not making a mistake. Refusing it would be the tool inventing a rule the school never stated, which
is the class of decision Art. XIV reserves for the school.

## Consequences

- **There are now two placement axes in `Jaarplan`.** Anything reasoning about "the plan" must say which. In
  particular, `MenselijkBeslotenPlaatsingen` and `MenselijkBeslotenActiviteitplaatsingen` are two questions, and a
  guard that asks only the first protects only half a plan.
- **A new Restrict FK is reachable from three delete paths.** `activiteitplaatsingen.ActiviteitId` is `Restrict`, and
  the cascades above it mean an *activiteit*, a *subthema* **and** a *thema* delete can all reach it — the latter two
  from two levels away. All three now guard with a Dutch message naming a real remediation; without them the database
  raised a bare `23503` that surfaced as a 500 on an ordinary teacher action. **Any new delete path that cascades into
  activiteiten must add the same guard.**
- **The class delete guard for day placements is unreachable in ordinary use**, because a scheduled activiteit implies
  a subthema of that klas and the subthema guard fires first. It is kept as a backstop for **E1-19**'s open re-scoping
  hole, which is the only route that reaches it; closing E1-19 is what would make it genuinely dead.
- **The Restrict is a deliberate trade against convenience.** Cascading would match the expectation "I deleted it, of
  course it left my calendar". It was rejected because it destroys scheduling work with no record and no warning. **A
  later story may revisit this** — the friendlier design is a cascade plus a confirmation that states what will be
  removed, and that belongs with the screen (E9-04), not with the schema.
- **`Schooljaar.IsLesdag` counts weekends**, so a "day" here is not the same as a "school day" a teacher would count.
  That is a live problem for **E9-02**, which must not print `aantalOpenDagen` as *schooldagen*, and must not fix it by
  changing `IsLesdag` — `beschikbareWeken = ceil(TelOpenDagen / 7)` is the sole definition of *te vol* (owner ruling
  2026-07-31), and excluding weekends would make every nominal 5-week thema overload the 5-week period built for it.
- **No AI generates day schedules.** FR-5 generates thema's onto periods and says nothing about days. `Status` exists
  on the placement anyway, so the guards ask a predicate rather than a hard-coded "all of them" the day that changes.

## Alternatives considered

- **A third `Planningsblokniveau` (`Week` / `Dag`).** Rejected: see Rationale. It is the reading this ADR exists to
  close off.
- **Reusing `Themaplaatsing` with a nullable `Datum`.** Rejected: one row would then answer two different questions
  depending on which column is null, and every consumer would need to know which kind it had.
- **A `Subthemaplaatsing` alongside the activiteit one.** Rejected: two placed things to keep in step (decision 4).
- **Cascade instead of Restrict on the activiteit FK.** Rejected for now, with the revisit condition stated above.
