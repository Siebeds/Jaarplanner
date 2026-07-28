# ADR-0018 — Concordance is a one-to-many nullable FK (M:N rejected)

- **Status:** Accepted
- **Date:** 2026-06-30
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

[ADR-0007](0007-curriculum-taxonomy-concordance.md) introduced the curriculum taxonomy and described the concordance as a **"many-to-many-capable link Leerplandoel ↔ Minimumdoel via `minimumdoelRef` (= Excel B+C)"**. When E1-04 implemented the concordance and made it queryable, the actual Op.stap artifact contradicted that cardinality: the per-discipline goal Excel emits **exactly one** column D (`minimumdoelRef` = LfMD + nrMD) **per leerplandoel row**. The Constitution itself describes a single ref — Art. VII.1 maps column D to "`minimumdoelRef`" (singular), and Art. IX.1 lists `Leerplandoel` as carrying "`minimumdoelRef` (concordance)" (singular).

E1-01 had already modelled this faithfully: a **single nullable FK** `Leerplandoel.MinimumdoelRef → Minimumdoel.Ref`. E1-04 kept that FK and added the queryable seam, so the **shipped system is one-to-many, not many-to-many**. ADR-0007's "many-to-many-capable" wording therefore misdescribes the realised architecture, and the ADR log must be kept accurate ("supersede, never rewrite" — ADR index, CLAUDE.md).

## Decision

We will model the minimumdoel↔leerplandoel concordance as a **nullable one-to-many foreign key** `Leerplandoel.MinimumdoelRef → Minimumdoel.Ref`:

- A `Leerplandoel` concords to **at most one** `Minimumdoel` (one column D per row; the FK is nullable for the unconcorded case).
- A `Minimumdoel` may be concorded by **many** leerplandoelen (**Minimumdoel 1 — \* Leerplandoel**).

We **reject** a many-to-many `Concordantie` join table as unwarranted over-provisioning: Op.stap emits a single `minimumdoelRef` per leerplandoel (Art. VII.1 / IX.1), so a join would add a degree of freedom the source data never uses, without changing the `code`/`Ref` identities.

**Forward-compatibility.** If Op.stap ever emits multiple D-columns per leerplandoel, the change is isolated behind the **`IConcordantieQuery`** seam in the Application layer (E1-04): only its Infrastructure implementation (and the FK/migration) changes — consumers (E5 coverage) are unaffected, since they already depend on the interface, not the FK.

**Coverage support.** Minimumdoel-level coverage (E5) is fully supported. The coverage-critical direction *minimumdoel → leerplandoelen* is `IConcordantieQuery.LeerplandoelenVoorMinimumdoelAsync`, which feeds [ADR-0009](0009-dekking-computed-not-stored.md)'s roll-up `minimumdoelGedekt(m) = ∃ d ∈ concordantie(m) : leerplandoelGedekt(d)`. A leerplandoel ref that matches no known minimumdoel (e.g. a partial B-only/C-only key) yields **no** concordance link — never phantom coverage (Art. III.5, V.6).

This ADR **supersedes the concordance clause of [ADR-0007](0007-curriculum-taxonomy-concordance.md)** (the "many-to-many-capable" bullet); all other ADR-0007 decisions (discipline numbering, `(domein, subdomein)` grouping, `code` identity, nullable `cluster`) remain in force.

## Alternatives considered

- **Keep ADR-0007's many-to-many `Concordantie` join** — contradicts the single-`minimumdoelRef` data (Art. VII.1 / IX.1); adds an unused join row per link, extra migration surface, and a needless query indirection. Rejected as over-provisioning.
- **Silently leave ADR-0007 as-is** — leaves the binding architecture log misdescribing the shipped system; violates the "supersede, never rewrite" discipline. Rejected.
- **Edit ADR-0007 in place to say one-to-many** — would rewrite an Accepted decision rather than supersede it, erasing the decision history. Rejected per the ADR lifecycle.

## Consequences

**Positive**
- The model matches the Op.stap artifact and the Constitution's singular `minimumdoelRef`; the FK enforces referential integrity, so phantom links are impossible at the database level.
- Simpler than a join: no extra table, no migration churn; coverage roll-up reads one indexed column.
- The architecture log is now accurate and auditable.

**Negative / trade-offs**
- If a future Op.stap revision puts multiple refs on a row, a migration (FK → join) is required. Mitigated: the change is confined behind `IConcordantieQuery`; consumers do not change.

**Follow-ups**
- E5 coverage consumes `IConcordantieQuery.LeerplandoelenVoorMinimumdoelAsync` (per ADR-0009).
- E1-05 (re-import/diff) should surface orphaned/partial refs (the `VerweesdeMinimumdoelRef` set from the E1-04 `ConcordantieBouwer`) for review.

## Compliance trace

- **Constitution:** Art. VII.1 (column D → singular `minimumdoelRef`), Art. IX.1 (`Leerplandoel` carries a single `minimumdoelRef`), Art. III.5 (codes/refs are stable identity; no phantom links), Art. V.1–2/V.6 (minimumdoel-level coverage roll-up; coverage-critical, well-tested).
- **Backlog:** E1 — story E1-04 (concordance built & made queryable); enables E5 (coverage).
- **FR/NFR:** FR-2.2/2.3; prerequisite for FR-9.3 (minimumdoel coverage).
- **Supersedes:** the concordance clause of [ADR-0007](0007-curriculum-taxonomy-concordance.md).
