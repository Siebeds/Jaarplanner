# ADR-0006 — Op.stap as read-only reference data via single-source ClosedXML import

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

Op.stap leerplandoelen and the decreed minimumdoelen are **decretale, read-only reference data** — the school must never mutate their official content (Art. III). They arrive as one Excel file per discipline, and Op.stap is still rolling out, so columns may change (Art. VII). The constitution mandates ClosedXML (MIT) and forbids EPPlus (commercial). This import + the coverage calc are the highest-risk logic in the system (Art. V.6).

## Decision

We will import Op.stap goals from per-discipline Excel files using **ClosedXML**, behind an `IOpstapImporter` port in Infrastructure, with these rules:
1. The **A–M column→model mapping lives in exactly one place** (a single mapping type), so a column change is a one-line fix (Art. III.3, VII.1).
2. Imported `Leerplandoel`/`Minimumdoel` are **write-once reference data**: no application code path exposes mutation of official content; teachers may only add internal labels/ordering (separate, non-official fields).
3. **Re-import is non-destructive to jaarplannen**: it refreshes reference data and emits a *review report* of what changed, never silently overwriting plans (Art. III.4 / FR-2.5).
4. Validation produces clear, per-row diagnostics before commit.

## Alternatives considered

- **EPPlus** — richer API, but a commercial licence the constitution explicitly rejects.
- **CSV instead of XLSX** — loses the discipline's native format and forces manual conversion by non-technical staff.
- **Scatter the column mapping across the parser** — would make Op.stap's evolving columns a multi-site change and invite drift; rejected for Art. III.3.
- **Mutable curriculum with an "official" flag** — too easy to violate read-only; we keep official content on an immutable write path instead.

## Consequences

**Positive**
- A single, well-tested seam absorbs Op.stap's churn; read-only integrity is structurally enforced, not just promised.
- Teacher decisions in plans survive curriculum refreshes.

**Negative / trade-offs**
- Manual per-discipline upload remains (an automated source is an open decision, Art. XIV); the importer is built to accept either feed later.

**Follow-ups**
- E1-03 (parser + single-source mapping, heavily unit-tested), E1-04 (doelsoort + concordance), E1-05 (non-destructive re-import), E1-06 `[!]` (discipline selection seam).

## Compliance trace

- **Constitution:** Art. III (read-only, single-source mapping, non-destructive re-import), Art. VII (mapping table), Art. VIII (ClosedXML, no EPPlus), Art. V.6 (test the parser well).
- **Backlog:** E1-03/04/05/06.
- **FR/NFR:** FR-2 (all), FR-1 reuses the same import discipline.
