# ADR-0013 — Planningsblok abstraction for an open decision

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

Planningsblok granularity is an **unresolved directie decision** (Art. XIV). The original analysis defaulted to "maand", but the ratified gap-analysis (GAP 6) showed the real pedagogical cadence is **themaperiode (4–6 wk)** and **subthemaperiode (~2 wk)**, which do not align to month boundaries. The constitution explicitly forbids hard-assuming months (Art. IX.3). The calendar (ADR-0003/E3) and generation (E3-01) both depend on this unit.

## Decision

We will introduce a **`Planningsblok` abstraction** that does not presuppose a unit. A `Jaarplan` is a sequence of planningsblokken whose **granularity is configuration on the `Schooljaar`** (E6-03), derived from the school's vacation/period structure. Blocks expose a start/end and an ordinal; nothing in generation, the calendar, drag-and-drop, or coverage references "month" directly. The default unit is **documented, not compiled-in**, and switchable when the directie decides. The calendar's zoom levels are expressed as "jaar ↔ periode/blok", never "maand".

## Alternatives considered

- **Hard-code months (original default)** — directly violates Art. IX.3/XIV and would force a rewrite once the cadence is chosen. Rejected.
- **Hard-code 2-week subthema blocks** — presupposes the other end of the open decision; same problem inverted.
- **Defer all calendar work until the decision lands** — blocks the M3 milestone unnecessarily; the abstraction lets us build now and pick the unit later.

## Consequences

**Positive**
- We can build the calendar and generation immediately without betting on the decision; switching units is a configuration change, not a refactor.

**Negative / trade-offs**
- A little extra indirection (no `Month` type in the domain); date math is block-relative.

**Follow-ups**
- E3-05 `[!]` (planningsblok model + grid, blocked on the decision but the seam is built), E3-08 (unit-agnostic zoom), E6-03 (schooljaar period structure drives the unit).

## Compliance trace

- **Constitution:** Art. IX.3 (no month assumption), Art. XIV (open decision behind a seam), Art. XI.2 (resolving it updates the article, not a refactor).
- **Backlog:** E3-05, E3-08, E6-03.
- **FR/NFR:** FR-5.1, FR-6.1/6.3.
