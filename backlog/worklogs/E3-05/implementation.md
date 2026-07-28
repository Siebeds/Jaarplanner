# E3-05 — Planningsblok model & calendar grid

**Story:** Model the school year as configurable planningsblokken; **do not hard-assume months** — support
themaperiode (4–6 wk) / subthemaperiode (~2 wk). Belgian school year Sept→June.
**Done when:** the block unit is configurable behind a seam; default is documented, not compiled-in.
**Refs:** Art. IX.3, Art. XIV, Gap A.6, [ADR-0013](../../../docs/adr/0013-planningsblok-abstraction.md).
**Directie decision (2026-07-14):** two-tier default — themaperiode (4–6 wk, coarse) + subthemaperiode
(~2 wk, fine); zoom levels (E3-08) map to these tiers; unit configurable behind the seam.

> ⚠️ **Round 1 below is a historical record and is superseded in three places** — read
> [Round 2](#round-2--2026-07-28-antagonist-findings-fixed) for what the code actually does now. Specifically,
> round 1 describes greedy chopping with a `MinimumBlokDagen` tail-absorption knob (both **removed**), claims
> `Planningsblok`'s identity is its ordinal (it is **`(Niveau, Start)`**), and counts 15 unit tests (now 22).
> Kept rather than rewritten, because the audit trail matters more than a tidy document.

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

---

## Round 2 — 2026-07-28: antagonist findings fixed

The audit returned **VIOLATIONS FOUND** (6 MAJOR, 5 MINOR, 1 QUESTION). Verdict recorded in
[`antagonist.md`](antagonist.md). All findings are now addressed; nothing was waived.

### MAJOR 1 + 6 — even distribution replaces greedy chopping
`VerdeelGelijkmatig` divides each teaching stretch into `max(1, round(dagen / doeldagen))` near-equal blocks,
spreading the remainder one day at a time over the leading blocks. The old code took a target-length bite off
the front and left the remainder as its own block, which on the fixture year produced three **1-week
"themaperioden"**. The corrected grid for 2026-2027 is **7 periods, all 4,4–6,0 weeks** — inside the ratified
range, and identical to what the approved E3-10 wireframe shows.

`MinimumBlokDagen` is **removed**, not re-tuned. It existed only to absorb the tail that greedy chopping
created; with even distribution there is no tail. That also disposes of MAJOR 6 by deletion rather than by
adding a strategy knob — the invented policy is gone instead of being made configurable, since only one
candidate policy actually satisfies Art. IX.3's ratified range.

### MAJOR 2 — the fine tier nests inside the coarse tier
`Blokken(…, Subthemaperiode)` now derives subperiods **within each themaperiode**, and each carries
`OuderOrdinaal`. Previously both tiers were independent chops of the same stretches, so a subthemaperiode
could straddle a themaperiode boundary — which would have made E3-08's zoom incoherent and left the approved
wireframe's zoom strip unimplementable. A new test asserts every fine block lies in exactly one coarse block
*and* that the children tile their parent exactly (no gap, no overlap).

### MAJOR 3 + the record-equality MINOR — honest identity
`Planningsblok` is no longer a `record`; it is a sealed class with equality on **`(Niveau, Start)`**, matching
its documented identity. The claim that `Ordinaal` "stays stable when a school later shifts its vacation
dates" is **deleted** — it was false, and I had repeated it in the entity doc, the worklog and the commit
message. `Ordinaal` is now documented as a display position, and a test asserts the instability rather than
denying it. Re-anchoring after a vacation edit is logged as an open decision that **gates E3-07**.

### MAJOR 4 + the binding-test MINOR — the default is now genuinely documented in configuration
`appsettings.json` carries a `Planning:Blokindeling` section with the values and a `_comment`, in the same
style as `Opstap:DisciplineSelectie`. Two tests were added: one binds the options from a real
`IConfiguration` using the section path and property names a deployer would write, and one pins the section
name. Without those, a wrong path would have shipped silently while the object-level tests still passed.

### MAJOR 5 — the deviation is recorded as an ADR
[**ADR-0020**](../../../docs/adr/0020-planningsblok-derivation-rules.md) records the derivation rules and
**supersedes ADR-0013's "granularity is configuration on the `Schooljaar`" clause**: lengths are
per-deployment config, the schooljaar owns where blocks *break*. ADR-0013's index entry is annotated and
ADR-0020 is registered in the traceability matrix.

### Remaining MINORs
- `AantalDagen`'s doc no longer claims a span may include a vacation (it cannot, by construction).
- The short-stretch case is now **asserted by test** (a stretch too short for a full themaperiode yields one
  short block) and the pedagogical question is logged as an open decision instead of being silently decided.
- A new guard rejects `SubthemaperiodeWeken > ThemaperiodeWeken`, since the fine tier subdivides the coarse.
- Art. IX.3's "`Schooljaar` contains multiple klassen" was unowned by any story; **assigned to E3-01** along
  with the `Jaarplan` entity and its `vergrendeld` flag.
- `Omschrijving`'s Dutch prose: the auditor ruled it not a violation today (identical in kind to the accepted
  `GeconfigureerdeDisciplineSelectie.Omschrijving`). The preventive constraint is noted — if E3-06/E3-08
  renders it as a UI label, the label must come from `nl.json` with the numbers as parameters.

### Gates after the fixes
326 unit passed / 0 failed (22 of them planning); integration 19 passed / 22 skipped; `dotnet format` clean;
no migration drift. Still `[~]`: the 3 PostgreSQL persistence tests remain unrunnable on this machine.

### One thing worth noting about the process
The instability test I wrote first **failed** — it asserted that ordinal 3 moves when the kerstvakantie
shifts, and it did not, because even distribution leaves blocks *before* the edited vacation untouched. The
property is real but only holds after the edit point, so the test now asserts it generally ("some ordinal now
denotes a different span") instead of at a hand-picked ordinal. A spot-check would have been a fragile way to
state it.
