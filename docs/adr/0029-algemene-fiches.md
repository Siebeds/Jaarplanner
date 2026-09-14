# ADR-0029 — Algemene fiches: recurring per-klas activities whose doelen count for dekking

- **Status:** Accepted (project owner ruling, 2026-09-11). Directie confirmation of the dekking half is outstanding.
- **Date:** 2026-09-11
- **Deciders:** Siebe De Saedeleir (projecteigenaar)
- **Amends:** [`CONSTITUTION.md` Art. V.1](../../CONSTITUTION.md#article-v--coverage-must-be-provable-dekking) (a second
  route to *gedekt*), recorded in its own amendment commit per Art. XI.1.
- **Relates to:** [ADR-0025](0025-subthema-per-leeftijd.md) (scoping), [ADR-0028](0028-tijdraster-in-plaats-van-lesuren.md)
  (the time grid these moments sit on), the hoeken model (`Hoek`, `Hoekplaatsing`, `Hoekmoment`).

## Context

The teachers' feedback of 2026-09-11 asked, in their words: *"Lesfiches algemene/terugkerende activiteiten (e.g. onthaal)
los staand van thema/subthema kunnen inplannen en dit ook kunnen linken aan doelen. Elke maandag turnen op dit uur."*
The owner named them **algemene fiches**, asked for "a similar option as the hoekenfiches, it may stand below them", and
ruled that a teacher creates them **per klas**, for her own class.

Before this, every activity in the model was an `Activiteit` inside a `Subthema` inside a `Thema`. A turnles belongs to
no thema, so the only way in was a fake "algemeen" thema, and a thema only counts when it is placed in a themaperiode
of the plan: a year-round activity would have had to be placed in every period, and would have distorted generation and
the te-vol signal.

The second half of the request, linking to doelen, raised the question the hoeken model had deliberately closed: a hoek
carries no doelkoppelingen, precisely so it cannot move a dekkingscijfer. The owner was asked whether a fiche's doel
counts and ruled that it does. Without that, bewegingsopvoeding goals that a class works on every Monday stand in the
gap-analyse as missing for the whole year.

## Decision

**1. `AlgemeneFiche` is school content per klas**, shaped like `Hoek`: an FK to `klassen` and nothing else, a unique
name per class, cascade on the klas. Not per leeftijd like a subthema: which hour a class has the gym is a fact about
that class's week.

**2. Its goal links are `DoelKoppeling`s that can only be `Manueel`.** `AlgemeneFiche.KoppelAanDoel` takes no status;
nothing proposes goals for a fiche, so a `Voorgesteld` row could only be a bug, and the dekking filter trusts the status.

**3. Planning is `AlgemeneFicheplaatsing` with one `AlgemeneFichemoment` per teaching day**, on the weekdays the teacher
chose, from a begin to an end time. The days are the school year's open weekdays filtered by weekday
(`AlgemeneFicheplaatsing.Herhalingsdagen`), so a Monday in a vakantie or on a studiedag gets no row. The weekdays are
not stored: after planning, the moments are the truth, and one Monday moved to Tuesday is still part of the run.
Clock times rather than lesuren, to match ADR-0028's decisions 4 and 5 on the same day.

**4. The placement is outside the `Jaarplan` aggregate**, for the reason `Hoekplaatsing` is: a (re)generation discards
only `Voorgesteld`, non-`vergrendeld` placements of the plan (Art. IX.3), and a turnles is neither.

**5. A planned fiche's goals count for dekking: the fifth layer.** A leerplandoel is also *gedekt* when it is linked
(`aanvaard`/`manueel`) to an algemene fiche of the klas that has at least one placement in that class's agenda.
`IDekkingOpslag.HaalFichekoppelingenAsync` reads it apart from the four thema layers, because a fiche has no placement
status and is not in the plan; folding it into the thema read would make that read's result depend on something its
`themaIds` argument does not describe. The evidence is a separate list, `LeerplandoelDekking.DekkendeFiches`, so a
reader can tell "gedekt door Turnen (algemene fiche)" from a thema. The vooruitzicht counts fiche goals in both halves.
The gap-analyse's causes stay thema-only; a goal carried only by an unplanned fiche is a gap like any other.

**6. Every other reader of the link layers learns the fifth table:** the Op.stap re-import reference count (the FK to
the leerplandoel is Restrict, so a missing entry would turn a dropped code into a 23503), the ongekoppelde doelen, and
the register, where `KoppelingHerkomst.AlgemeneFiche` rows carry the fiche's name in `ThemaNaam` and the klas in
`Onderdeel`, behind the same visibility gate as the other class-scoped layers.

**7. The frontend lands in two halves (owner, 2026-09-11).** The Instellingen section, where a teacher creates fiches
and links goals, ships now. The agenda half, a panel of fiches under the hoekenfiches and dragging them onto the time
grid, waits until ADR-0028's time grid is committed, so it is built once on the agenda it will live in.

> **Decision 7, amended 2026-09-14 (owner, in session).** The agenda half was built that day on `story/E10-03-agenda`
> (board card TB-002). A first version put the algemene fiches under the hoekenfiches in one panel called "Fiches",
> as this decision said. The owner looked at it and ruled: *"dit vind ik niet overzichtelijk, ik wil twee secties in
> het meest linkse side bar, hoekenfiches en algemene fiches, niet gegroepeerd als fiches"*. So the sidebar, and the
> agenda toolbar on a phone, carry **two switches**, *Hoekenfiches* and *Algemene fiches*. From `lg` each one opens its
> own list in the same side column: pressing the one that is on closes it, and pressing the other swaps the list. On a
> phone the chip opens that list as a sheet. The sentence above is kept as it was decided; this note is what ships.

## Consequences

- Until the agenda half lands, no screen can plan a fiche, so no fiche's goals count yet. The Instellingen row says so
  for a fiche with goals ("Staat nog niet in de agenda. Deze doelen tellen dus nog niet mee voor de dekking.").
- A delete of a planned fiche is refused with the count, as for a hoek; deleting its last placement withdraws its goals
  from the figure.
- The dekking payload and the Excel export gain the fiche evidence; any consumer that assumed "`dekkendeThemas` is empty
  exactly when not gedekt" must read both lists.

## Alternatives considered

- **An "algemeen" thema.** Rejected: it would have to be placed in every themaperiode to count, and would take part in
  generation, te-vol and the vooruitzicht as if it were subject content.
- **Give `Hoek` doelkoppelingen and reuse it.** Rejected: it reverses the owner's explicit ruling that a hoek carries
  none, and a corner and a lesson are different things that happen to recur.
- **Derive occurrences from a stored rule.** Rejected for the reason `Hoekmoment` records: a derived occurrence cannot
  be moved on one day.
- **Count a fiche's goals as soon as it exists.** Rejected: a fiche in the settings list is a plan for a plan and proves
  nothing is taught; placement is the evidence, as for a thema.

## Compliance trace

| Article | How |
| --- | --- |
| Art. III (autonomy) | Fiches are free school content, fully editable. |
| Art. IV.1 / IV.2 | No AI path; every link is a teacher's `manueel` decision, persisted. |
| Art. V.1 | **Amended**: second route to *gedekt*, computed on read, never stored. |
| Art. V.4 | The export names the covering fiche as evidence. |
| Art. V.6 | Unit tests on the service and the rule; Postgres tests on the fifth layer, the FKs and the endpoints. |
| Art. IX.2 / IX.3 | New per-klas entity; placement outside the Jaarplan aggregate. |
| Art. XI.1 | Amendment in a dedicated commit. |

Backlog: E10-03.
