# ADR-0020 — Planningsblok derivation rules (refines ADR-0013)

- **Status:** Accepted
- **Date:** 2026-07-28
- **Deciders:** Architect (Siebe De Saedeleir / team), prompted by the antagonist audit of E3-05
- **Refines:** [ADR-0013](0013-planningsblok-abstraction.md) — supersedes its "granularity is configuration
  on the `Schooljaar`" clause; everything else in 0013 stands.

## Context

ADR-0013 established that a `Jaarplan` is a sequence of `Planningsblok`ken whose granularity is
configuration, never a compiled-in calendar unit. It deliberately did **not** specify *how* blocks are
derived from a school year. E3-05 had to choose, and its first implementation chose badly in three ways that
an audit (plus building the E3-10 wireframe against a real Belgian calendar) exposed:

1. Blocks were produced by taking a target-length bite off the front of each teaching stretch and leaving the
   remainder as its own block. On the 2026-2027 calendar that yielded **three 1-week "themaperioden"** —
   outside the 4–6 week range directie ratified on 2026-07-14.
2. The two tiers were chopped **independently** from the same teaching stretches, so a subthemaperiode could
   straddle a themaperiode boundary. That makes E3-08's "zoom into this period" incoherent and E3-01's
   "a thema in a period, its subthema's in that period's subperiods" unimplementable.
3. A block's `Ordinaal` was documented as a stable key that survived a school editing its vacation dates. It
   is not: the grid is derived, so changing a vacation reshapes it and can re-point later ordinals.

These are derivation rules, not restatements of 0013, and one of them contradicts 0013's text. Per
`CLAUDE.md` a significant decision gets its own ADR and supersedes rather than rewrites.

## Decision

**1. Blocks are distributed evenly across each teaching stretch.** For a stretch of *d* days and a target
block length of *t* days, the stretch is divided into `max(1, round(d / t))` near-equal blocks, with any
remainder spread one day at a time over the leading blocks. Choosing the *count* first and then splitting
evenly keeps every block close to the target; taking target-length bites off the front leaves a tail whose
length is an accident of arithmetic.

**2. The fine tier nests inside the coarse tier.** `Subthemaperiode` blocks are derived *within* each
`Themaperiode`, never as a second independent chop of the year. Every subthemaperiode therefore lies entirely
within exactly one themaperiode and carries its `OuderOrdinaal`. The tiers tile: a coarse block's children
cover it exactly, with no gap and no overlap.

**3. A block's identity is `(Niveau, Start)`; `Ordinaal` is a display position.** A persisted placement keys
on the start date, which is a real calendar anchor. `Ordinaal` remains for display ("periode 3") and ordering
within a single derivation, and is explicitly **not** stable across derivations.

**4. Block lengths are per-deployment configuration, not per-`Schooljaar` data.** This is the clause that
supersedes ADR-0013. The lengths live in `Planning:Blokindeling` (`appsettings.json`, documented there with a
comment, plus overridable by any standard .NET config source); what lives on the `Schooljaar` is the
**vakantie-/periodestructuur** that decides where blocks *break*. So one deployment currently applies one
cadence to all of its school years.

**5. Blocks never span a *vakantie*; they may contain a *vrije dag*.** Each teaching stretch is derived
independently, and stretches are cut only at closures the school classified as a `Vakantie`. A closure
classified as a `VrijeDag` — Hemelvaart, Pinkstermaandag, a pedagogische studiedag — is a non-teaching day
*inside* a block. Without that distinction (directie 2026-07-28) every closure broke a period, and the 5
teaching days between Hemelvaart and Pinksteren became their own one-week "themaperiode". The classification
is **data the school owns**, entered with the calendar, rather than a threshold ("interruptions of ≤ 3 days
don't count") compiled into planning logic.

## Alternatives considered

- **Keep greedy chopping with a minimum-tail threshold** (the original). Rejected: the threshold cannot
  express the ratified range — a 7-day tail passes a 5-day minimum — and the policy was an invented answer to
  a pedagogical question. Removing the knob removed the invention.
- **Make the distribution policy a configured strategy** (greedy | even | …). Rejected as false generality:
  only one of the candidates satisfies the ratified 4–6 week range, so offering the others as configuration
  would be offering a way to violate Art. IX.3. If directie later wants a genuinely different rhythm, that is
  a new decision and a new ADR.
- **Per-`Schooljaar` block lengths** (what ADR-0013 assumed, and E6-03 anticipated). Deferred, not rejected:
  it is a strictly larger surface (schema, CRUD, and a per-year override resolution order) than E3-05 needed,
  and the seam's consumers do not change when it arrives — `IPlanningsblokIndeling` already takes the
  `Schooljaar` as a parameter, so the lengths can start coming from it without touching E3-01/06/07/08.
- **Persist the derived blocks** so ordinals become durable keys. Rejected: it bakes the granularity into
  rows, which is exactly what ADR-0013 exists to prevent, and it turns a config change into a data migration.

## Consequences

**Positive**
- Every themaperiode on a realistic Belgian year falls inside the ratified 4–6 weeks, asserted by test.
- The zoom levels (E3-08) and per-period generation (E3-01) have a coherent tier relationship to build on.
- The identity story is honest, so E3-07 cannot accidentally persist an unstable key.

**Negative / trade-offs**
- Block spans vary (4,4–6,0 weeks on 2026-2027) rather than being uniform. This is deliberate and is what the
  E3-10 wireframe makes visible; a teacher sees why one period is shorter than another.
- One cadence per deployment until E6-03 (see decision 4).
- **A teaching stretch shorter than roughly two-thirds of the target still yields one short block** — a school
  closing for three weeks mid-year cannot have a 4-week themaperiode around it. Asserted by test. The
  `Vakantie`/`VrijeDag` distinction removed the *routine* cause of this (scattered single free days), leaving
  it a rare edge that is accepted rather than tracked as open.
- `AantalDagen` is a **calendar** span, not a count of teaching days, since a block may contain vrije dagen.

**Follow-ups**
- **Resolved (directie 2026-07-28):** the routine cause of unplannable short stretches was every closure
  breaking a period. Closures are now classified `Vakantie` (breaks) vs `VrijeDag` (does not) — see decision 5.
  Rejected alternatives: a day-count threshold (an invented number, and the audit flagged exactly this class of
  invention in this code), leaving 1-week periods in the calendar, and excluding short stretches from planning
  (goals taught that week would then appear nowhere and coverage would understate).
- **Resolved (directie 2026-07-28), shapes E3-07/E3-09/E5:** when a school edits its vacation dates and the
  grid reshapes, an affected jaarplan placement is **never silently moved**. It keeps its stored date and
  raises a **persistent, non-dismissible** notification naming the affected thema's, to be resolved by a human
  as soon as possible. While any placement is unresolved, dekking is reported as *onbetrouwbaar / te herzien*
  rather than as a number — a thema whose period is unknown is not demonstrably taught, and an inspectie-facing
  figure must not overstate (Art. V.2, mirroring Art. III.4's review report).
- **E6-03** may move block lengths onto the `Schooljaar`, superseding decision 4.
- Art. IX.3's "`Schooljaar` contains multiple klassen" is still unimplemented; assigned to **E3-01**.

## Compliance trace

- **Constitution:** Art. IX.3 (no month assumption; the ratified two-tier cadence), Art. XIV (the remaining
  choices stay open rather than being answered in code), Art. XI.2/XI.3 (supersede, never rewrite; code and
  docs must not disagree).
- **Backlog:** E3-05, E3-01, E3-07, E3-08, E6-03.
- **FR/NFR:** FR-5.1, FR-6.1/6.2/6.3.
