# ADR-0001 — Record architecture decisions in ADRs

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

Jaarplanner already has a strong governance spine: a binding [`CONSTITUTION.md`](../../CONSTITUTION.md), a scope document (the functional analysis), and a [`backlog/`](../../backlog/README.md). What is missing is a record of the **technical decisions** that turn those principles into an implementable architecture — and, crucially, evidence that the architecture *complies* with the constitution and serves the backlog rather than drifting from them.

## Decision

We will capture every architecturally significant decision as an ADR in `docs/adr/`, using a lightweight Nygard/MADR-style template. Each ADR ends with a **Compliance trace** linking it to the Constitution article(s) it realises and the backlog epic(s) it enables. ADRs are immutable once Accepted; we supersede rather than rewrite.

## Alternatives considered

- **No ADRs, rely on CLAUDE.md + code comments** — decisions and their rationale get lost; compliance is unprovable.
- **A single "architecture.md"** — becomes a stale monolith; no per-decision status or supersession history.
- **Heavyweight RFC process** — disproportionate for a small app (the constitution itself says "favour clarity over ceremony", Art. VIII).

## Consequences

**Positive**
- Architecture-to-principle traceability is explicit and auditable (incl. by the Antagonist agent).
- New contributors see *why*, not just *what*.

**Negative / trade-offs**
- Small ongoing discipline cost to write an ADR per significant decision.

**Follow-ups**
- The Antagonist (Art. XIII) audits ADRs for constitution fidelity like any significant change.

## Compliance trace

- **Constitution:** Art. XI (deliberate, recorded change) and Art. XIII (auditable against the constitution).
- **Backlog:** all epics — ADRs underpin the build plan.
- **FR/NFR:** governance enabler; no single FR.
