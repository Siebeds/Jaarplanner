# E3-05 — Planningsblok model & calendar grid

**Story:** Model the school year as configurable planningsblokken; **do not hard-assume months** — support
themaperiode (4–6 wk) / subthemaperiode (~2 wk). Belgian school year Sept→June.
**Done when:** the block unit is configurable behind a seam; default is documented, not compiled-in.
**Refs:** Art. IX.3, Art. XIV, Gap A.6, [ADR-0013](../../../docs/adr/0013-planningsblok-abstraction.md).
**Directie decision (2026-07-14):** two-tier default — themaperiode (4–6 wk, coarse) + subthemaperiode
(~2 wk, fine); zoom levels (E3-08) map to these tiers; unit configurable behind the seam.

## Approach

ADR-0013 already settled the architecture, so this story implements it rather than re-deciding it. Its
binding requirements were: a `Planningsblok` abstraction that presupposes **no unit**, granularity as
**configuration** derived from the schooljaar's vacation/period structure, **nothing** referencing "month"
anywhere in planning, and a default that is **documented, not compiled-in**.

The seam deliberately mirrors `IDisciplineSelectie` / `GeconfigureerdeDisciplineSelectie`
([ADR-0019](../../../docs/adr/0019-discipline-selection-config-seam.md)) — the pattern the project already
accepted for an Art. XIV open decision: same shape, same guarantee, so there is one idiom for "this answer
lives in configuration".

## What was built

**Domain (`Jaarplanner.Domain/Planning`)**
- `Planningsblokniveau` — `Themaperiode` | `Subthemaperiode`. **No `Maand` member, and there must never be
  one**; a test asserts the enum's exact membership so adding one fails the build's test gate.
- `Planningsblok` — a record of (niveau, ordinaal, start, eind). Knows no month, week number or term name.
  Identity is the **ordinal within its tier**, not the dates, so a plan's thema attachments survive a school
  shifting its vacation dates by a few days.
- `Schoolvakantie` — a named, inclusive date range.
- `Schooljaar` — naam + span + owned vacations, with the invariants (vacation inside the year, no overlaps)
  and `Lesperiodes()`, which decomposes the year into the teaching stretches between vacations. That
  decomposition is the raw material the grid is built from.

**Application (`Jaarplanner.Application/Planning`)**
- `IPlanningsblokIndeling` — the single question the rest of the system asks: "given this school year, what
  are its blocks?" Plus an `Omschrijving` for surfacing the configured grain, as the discipline seam does.

**Infrastructure (`Jaarplanner.Infrastructure/Planning`)**
- `PlanningsblokOptions` — bound from `Planning:Blokindeling`. Holds the **documented default in
  configuration space**: themaperiode 5 weeks (the midpoint of the ratified 4–6 range), subthemaperiode 2
  weeks, and a 5-day minimum block. Expressed in **weeks, never months**.
- `GeconfigureerdePlanningsblokIndeling` — derives the grid from exactly two inputs: the schooljaar's own
  teaching stretches and the configured lengths. Contains no period length and no calendar unit.

**Persistence** — `SchooljaarConfiguration` + migration `SchooljaarEnVakanties` (`schooljaren`,
`schoolvakanties` as an owned collection, cascade-deleted with the owner; unique schooljaar name).

## Two decisions worth recording

1. **Blocks are derived, not stored.** There is deliberately no `planningsblokken` table and no
   `DbSet<Planningsblok>`. Persisting blocks would bake the granularity into rows and defeat ADR-0013's
   whole purpose — the grain would then be a data migration rather than a config change. What is persisted
   is only the input: the year's span and its vacations.
2. **Blocks break on vacations, and short tails are absorbed.** A themaperiode interrupted by the
   kerstvakantie is not one period a teacher can plan a thema into, so each teaching stretch is chopped
   independently. A stretch's remainder shorter than `MinimumBlokDagen` joins the preceding block instead of
   becoming a two-day stub. Consequence: **block spans vary** — the grid is pedagogical, not arithmetic.
   This is also the concrete demonstration of why the grid cannot be months: Belgian vacations fall
   mid-month and split the year unevenly.

## Acceptance criteria

- *the block unit is configurable behind a seam* → **met**. `Grain_volgt_configuratie_zonder_codewijziging`
  drives the same code with 5-week and 3-week options and gets different grids; `Omschrijving` follows.
- *default is documented, not compiled-in* → **met**. The default lives in `PlanningsblokOptions` (i.e. what
  an unconfigured deployment resolves to) and is documented there against the directie decision;
  `Standaard_indeling_gebruikt_de_geratificeerde_twee_tier_cadans` pins it.
- *do not hard-assume months* → **met, structurally**. No `Maand` type or enum member exists;
  `Geen_enkel_niveau_is_een_kalendereenheid` fails if one is added.
- *Belgian school year Sept→June* → **met**. `Schooljaar_overspant_twee_kalenderjaren` plus the fixture year.

## Tests

15 unit tests, **all executed and passing locally** (`Planning/PlanningsblokIndelingTests`,
`Planning/SchooljaarTests`): the two-tier default, config-driven grain, blocks never spanning a vacation,
blocks staying inside the year with gapless 1-based ordinals, short-tail absorption, invalid config
rejected with the section name in the message, the no-calendar-unit guard, and the `Schooljaar` invariants +
`Lesperiodes()` decomposition.

3 PostgreSQL tests (`Postgres/SchooljaarPersistentieTests`): owned-collection round-trip with `DateOnly` →
`date`, unique schooljaar name, and cascade delete of the vacations. ⏳ **These skip on this machine** (no
Docker / no local PostgreSQL) — the persistence mapping is unverified until CI runs them. The story's own
acceptance criteria do not depend on them.

## Not in this story (deliberately)

- **No calendar UI.** E3-05 is the model + seam; the rendered grid is E3-06, and ADR-0017's
  wireframes-first rule puts **E3-10** (kalender wireframe, reviewed with directie/teachers) before
  E3-06/E3-07.
- **No `Jaarplan` entity yet.** Art. IX.3's "per planningsblok a list of thema's, with a `vergrendeld` flag"
  is E3-01/E3-06 work; this story provides the block vocabulary it will attach to.
- **Where the grain is configured per school.** ADR-0013 anticipates the schooljaar's period structure
  driving the unit (E6-03). Today the lengths are per-deployment config and the *breaks* are per-schooljaar
  data; making lengths per-schooljaar is an E6-03 extension of this seam, not a change to its consumers.
