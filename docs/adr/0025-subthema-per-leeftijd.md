# ADR-0025 — A subthema is scoped by leeftijd alone; a klas states its jaar/fase

- **Status:** Accepted
- **Date:** 2026-08-30
- **Deciders:** Project owner (ruling of 2026-08-30). Built the same day by session `verbeteringen`;
  recorded here on 2026-08-30 by session `hoeken`, which found the code shipped and the decision unwritten.
- **Relates to:** [ADR-0008](0008-themalaag-level-scoping.md) (two-tier themalaag with level-based scoping),
  whose **per-class scoping of `Subthema`/`Subdoel`/`Activiteit` this ADR supersedes**; the school-wide half
  (`Thema`, `Themadoel`, kernwoordenschat) stands unchanged, and so does the principle ADR-0008 exists for, that
  scope is prescribed by pedagogy per level rather than by one shared/per-class flag. Also
  [ADR-0004](0004-postgresql-efcore-npgsql.md) (the persistence this migration is written against) and
  [ADR-0023](0023-activiteit-day-placement.md) (the day-placement axis, which stays per klas and is what makes
  this change safe). It amends **Art. IX.2** of the constitution, which described a `Subthema` as scoped per
  class *and* age.
- **Realises:** FR-3 (thema-/activiteitenbeheer). **Constitution:** Art. III (school content is autonomous),
  Art. IX.2 (level-dependent scoping), Art. IX.3 (a klas has one jaarplan), Art. V (coverage denominators).
- **Backlog:** E1 (curriculum & content), E10 (eigenaarsvergadering).

> **This ADR is written after the fact, and says so.** The code, the migration and the frontend landed on
> 2026-08-30 citing "ADR-0025" in their own comments while no such file existed. Art. XI.3 makes the
> constitution win over code by default, so for a few hours the repository held an implementation that its own
> governing document contradicted. Recording it late is better than leaving it unrecorded, and the lateness is
> part of the record: `Subthema.cs` cited a decision a reader could not look up.

## Context

A `Subthema` required **both** a `KlasId` (a real foreign key) and a `Leeftijd` (free text). Both were declared
structural: a subthema could not exist school-wide.

That is one scope too many, and the cost showed up as soon as a school ran parallel classes of the same age. A
school with K3 groen, K3 blauw and K3 geel authored *"de speelhoek"* three times, once per class, and the three
copies then drifted: each carried its own subdoelen, its own activiteiten and its own goal links. A teacher who
built a subthema under K3 groen found it **unreachable** from K3 blauw, and the only way to share it was to
retype it. Nothing pedagogical justified the duplication. What a school actually authors once is the content
for an **age**.

The second half of the problem was that `Leeftijd` was **free text**. Real rows held `"5"`, `"5-6"`, `"8-9"`
and `"K3"`. As long as the `KlasId` carried the real scope this was merely untidy; the moment the age becomes
the scope, a row saying `"5-6"` is a row no class can ever match.

## Decision

1. **A subthema is scoped by `Leeftijd` alone.** The `KlasId` leaves the entity, the table and the index. A
   subthema on `K3` holds for **every** class that teaches K3, and its `Subdoelen` and `Activiteiten` come with
   it.
2. **`Leeftijd` holds one of the nine Op.stap jaar/fase codes** (`JK`, `K2`, `K3`, `L1`–`L6`) — the same
   vocabulary a `Klas` records. That the two agree is what makes *"is this subthema this class's?"* answerable
   at all now that the foreign key is gone.
3. **A `Klas` states its `Jaarfase`, and it is required.** `Leerjaar` is **derived** from it
   (`Jaarfasen.LeerjaarVoor`) rather than supplied. A class states one thing about its level, not two that can
   disagree. The creation and update payloads take `jaarfase`; they no longer take `leerjaar`.
4. **The join replaces the foreign key in exactly one place**, `Infrastructure/Persistence/Klasleeftijden.cs`,
   so every screen that asks "which subthema's does this class hold" asks the same question the same way.
5. **What stays per klas is the planning, not the content.** A `Jaarplan` belongs to one klas, and so do its
   themaplaatsingen, subthemaplaatsingen and activiteitplaatsingen. Two K3 classes share a subthema and still
   put its activiteiten on different days in a different order. **The klas remains what a teacher plans *in*;
   it is no longer what content belongs *to*.**
6. **The migration converts before it drops** (`20260830173622_SubthemaPerLeeftijd`). Each subthema whose
   `Leeftijd` is not already one of the nine codes takes the age of the class it hung on, read through that
   class's own `Jaarfase` or, failing that, the code its `Leerjaar` implies. Only then is `KlasId` dropped.

## Consequences

**Good.** Three parallel classes author one subthema. The Doelenregister can say *"K3 werkt hieraan"*, which is
true of a year group, where it used to say *"K3 blauw werkt hieraan"*, which was true only of whichever of three
rows happened to hold the link. A coverage denominator narrows to one jaar/fase instead of all three kleuter
codes, because a class now says which kleuterjaar it is.

**A klas that cannot state its age is now a called-out state, not a blank.** The requirement is new, so it can
only be missing on a row that predates it, and the Instellingen screen names those rows rather than letting them
sit. The ordinal fallback (`Jaarfasen.VoorLeerjaar`) stays live **for exactly those rows** and is tested by
writing the legacy shape directly, because the constructor can no longer produce it.

**Rows the migration could not answer for are left exactly as they are.** A subthema under a kleutergroep that
recorded no jaar/fase keeps its `"5-6"` and becomes unreachable from every screen. That is deliberate: the
alternative is a migration inventing an age for a teacher's content. Every screen now says out loud when a
class holds nothing.

**Duplicates are not merged, on purpose.** Two classes of the same age may each hold a subthema of the same name
under the same thema, and after this change those rows are indistinguishable by scope. Merging them would mean
choosing whose activiteiten, subdoelen and goal links survive, which is a teacher's decision about their own
content and not a migration's. They appear as two rows with the same name: visible and fixable, where a silent
merge would be neither.

**The bad consequence, stated because it is still open.** Eleven integration tests still encode the abolished
concept *"a subthema of another klas"*, and behind three of them sit **live guards and endpoints that were not
updated with the model**: an activiteit-verhuizing still refused with *"Een activiteit kan alleen verhuizen naar
een subthema van dezelfde klas."* (a sentence that no longer describes anything, and a guard that no longer
fires), and `/api/subthemas/voor-klas/{id}` answers an unknown klas with a bare 404 where it used to answer a
deliberate Dutch 400. What each should now assert is a decision about intended behaviour, so they are named in
commit `ba4a68a` and escalated rather than adjusted in passing.

## Alternatives considered

**Keep both scopes and add sharing on top** — a "copy this subthema to K3 blauw" button. Rejected: it makes the
duplication a feature. The three copies still drift, and the school now maintains three subthema's it believes
are one.

**Keep the `KlasId` and make `Leeftijd` a real enum only.** Rejected: it fixes the free-text half and none of
the duplication, which is the half teachers feel.

**Scope the subthema to the klas and hang the age off the subdoel alone.** Rejected: it is where the model
already was in spirit, and it makes an activiteit's age unanswerable without walking its subdoelen, which not
every activiteit has.

**Merge same-named duplicates during the migration.** Rejected on the ground given above: it destroys one
teacher's links to tidy another's list.
