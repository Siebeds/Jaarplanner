# ADR-0005 — Dutch ubiquitous language & centralised i18n

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The domain has no clean English equivalents (*leerplandoel* vs *minimumdoel*, *doelsoort*, *dekking*); translating loses meaning. The UI is for non-technical Dutch-speaking teachers and must be fully Dutch (NFR-1). The constitution (Art. II) binds: Dutch domain names in code, English for generic/infrastructure code, and all user-facing strings centralised in `frontend/src/i18n/nl.json`.

## Decision

We will:
1. Name **domain entities/concepts in Dutch** in code (`Leerplandoel`, `Minimumdoel`, `Doelsoort`, `Thema`, `Themadoel`, `Subdoel`, `DoelKoppeling`, `Jaarplan`, `Planningsblok`, `Dekking`, `Concordantie`, …).
2. Keep **infrastructure/technical code, identifiers, tooling, and comments in English**.
3. Put **every user-facing string in `nl.json`** behind a `t()` lookup — never hard-coded in components.
4. Add a **lint/CI check** that fails on hard-coded Dutch literals in `.tsx`/`.ts`.

## Alternatives considered

- **English domain model with a translation glossary** — actively discouraged by the constitution; invites mistranslation of legally-loaded terms.
- **Inline Dutch strings in components** — fast, but uncontrollable; blocks consistency, review, and any later multilingual move (Art. XIV).

## Consequences

**Positive**
- The ubiquitous language is preserved end-to-end; code reads like the domain.
- A single place to review/curate copy; future i18n (Art. XIV "multilingual?") is a smaller step.

**Negative / trade-offs**
- Mixed-language codebase (Dutch domain + English infra) needs discipline; the lint check enforces it.

**Follow-ups**
- E0-06 scaffolds `nl.json` + the lint; E7-01 enforces it repo-wide.

## Compliance trace

- **Constitution:** Art. II (all clauses), Art. XII (glossary is authoritative).
- **Backlog:** E0-06, E7-01.
- **FR/NFR:** NFR-1; enabler for Art. XIV multilingual decision.
