# ADR-0009 — Dekking is computed, never stored

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

Coverage is the product's reason to exist and its proof to the inspectorate. The constitution (Art. V) is categorical: **Dekking is computed, not stored.** A leerplandoel is *gedekt* when linked (status `aanvaard`/`manueel`) to a thema placed in the plan; a minimumdoel is *gedekt* when ≥1 concorded leerplandoel is gedekt. Coverage must be shown at both levels, filterable by doelsoort, and exportable as proof. This logic is highest-risk (Art. V.6).

## Decision

We will compute coverage **on read**, as a pure function of current state — never persist a "covered" flag. The coverage service lives in **Application** (pure, dependency-free, fully unit-testable) and takes the relevant `Jaarplan`, `DoelKoppeling`s, and `Concordantie` as inputs:
- `leerplandoelGedekt(d) = ∃ thema ∈ jaarplan : link(thema, d).status ∈ {aanvaard, manueel}`.
- `minimumdoelGedekt(m) = ∃ d ∈ concordantie(m) : leerplandoelGedekt(d)`.
- Outputs: per-class coverage, percentage, missing-goals list, doelsoort filter, minimumdoel-level view.
Binary gedekt/niet-gedekt is the **MVP definition** (a deliberate simplification, Art. IX.3); a seam is left for later herhaling/opbouw (verticale samenhang).

## Alternatives considered

- **Persisted coverage flags / denormalised counters** — fast reads, but stale-by-construction and a direct constitution violation; every plan edit would risk drift. Rejected.
- **Materialised view in Postgres** — a *cache* could come later for performance, but the source of truth stays the computed function; we will not introduce one until profiling (NFR-3) demands it, and even then it is derived, not authoritative.

## Consequences

**Positive**
- Coverage can never lie or drift; edits reflect instantly (E4-01). The pure function is trivially testable with crafted graphs.

**Negative / trade-offs**
- Recomputation cost on large plans; mitigated by scoping the computation per class and, if needed, a derived cache behind the same function.

**Follow-ups**
- E5-01 (computed, high-risk, well-tested), E5-02/03/04/05 (views), E4-01 (live reflection), E5-08 (binary-MVP seam).

## Compliance trace

- **Constitution:** Art. V (all clauses, incl. V.6 testing), Art. IX.3 (binary-MVP seam).
- **Backlog:** E5-01..05/08, E4-01.
- **FR/NFR:** FR-9.1/9.2/9.3, FR-6.5; NFR-3 (performance seam).
