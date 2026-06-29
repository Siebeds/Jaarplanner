# Architecture Decision Records — Jaarplanner

This folder records the **architecturally significant decisions** for Jaarplanner and shows, for each, how it complies with the binding [`CONSTITUTION.md`](../../CONSTITUTION.md) and serves the [`backlog/`](../../backlog/README.md).

> ADRs are **subordinate to the constitution**. An ADR may *refine* how a principle is realised, but it can never override one. If an ADR ever conflicts with the constitution, the ADR is wrong — fix it or raise a constitution amendment (Art. XI). Every ADR ends with a **Compliance trace**, so the chain *principle → decision → backlog work* is auditable.

## How we work with ADRs
- One decision per file: `NNNN-short-title.md`, numbered sequentially.
- Use [`0000-template.md`](0000-template.md).
- **Status** lifecycle: `Proposed` → `Accepted` → (later) `Deprecated` / `Superseded by ADR-XXXX`.
- Superseding, not editing: when a decision changes, write a new ADR and mark the old one superseded.

## Index

| ADR | Title | Status |
| --- | --- | --- |
| [0001](0001-record-architecture-decisions.md) | Record architecture decisions in ADRs | Accepted |
| [0002](0002-pragmatic-layered-backend.md) | Pragmatic layered backend (Domain ← Application ← Infrastructure, thin Api) | Accepted |
| [0003](0003-spa-over-rest-json-api.md) | React SPA over a REST/JSON API | Accepted |
| [0004](0004-postgresql-efcore-npgsql.md) | PostgreSQL via EF Core + Npgsql | Accepted |
| [0005](0005-dutch-ubiquitous-language-i18n.md) | Dutch ubiquitous language & centralised i18n | Accepted |
| [0006](0006-opstap-readonly-import-closedxml.md) | Op.stap as read-only reference data via single-source ClosedXML import | Accepted |
| [0007](0007-curriculum-taxonomy-concordance.md) | Curriculum taxonomy & concordance model | Accepted |
| [0008](0008-themalaag-level-scoping.md) | Two-tier themalaag with level-based ownership/scoping | Accepted |
| [0009](0009-dekking-computed-not-stored.md) | Dekking is computed, never stored | Accepted |
| [0010](0010-ai-advisory-architecture.md) | AI advisory architecture (injectable client, server-side, structured+validated) | Accepted |
| [0011](0011-authn-authz-rbac-gdpr.md) | AuthN/AuthZ, RBAC & GDPR data minimisation | Accepted |
| [0012](0012-secrets-config-management.md) | Secrets & configuration management | Accepted |
| [0013](0013-planningsblok-abstraction.md) | Planningsblok abstraction for an open decision | Accepted |
| [0014](0014-frontend-state-and-dnd.md) | Frontend state management & drag-and-drop | Accepted |
| [0015](0015-testing-strategy.md) | Testing strategy & high-risk coverage | Accepted |
| [0016](0016-azure-hosting-eu-residency.md) | Azure hosting & EU data residency | Accepted |
| [0017](0017-ui-ux-design-system.md) | UI/UX approach & design system (shadcn/ui + Radix, WCAG 2.2 AA) | Accepted |

## Compliance traceability matrix

Each ADR → the Constitution article(s) it realises → the backlog epic(s) it enables.

| ADR | Constitution | Backlog | FR/NFR |
| --- | --- | --- | --- |
| 0002 | Art. VIII | E0 | all backend FRs; NFR-8 |
| 0003 | Art. VIII | E0, E3, E5 | FR-6, FR-9; NFR-2/3/7 |
| 0004 | Art. VIII | E0, E1 | FR-1/2/9; NFR-3/8/9 |
| 0005 | Art. II | E0-06, E7-01 | NFR-1 |
| 0006 | Art. III, VII | E1-03/04/05/06 | FR-2 |
| 0007 | Art. VII, IX.1 | E1-01/03/04 | FR-2.1/2.2/2.3 |
| 0008 | Art. III, IX.2 | E1-02/10/11, E2-07, E6-05 | FR-3 |
| 0009 | Art. V | E5-01..05/08, E4-01 | FR-9.1/9.2/9.3, FR-6.5; NFR-3 |
| 0010 | Art. IV | E2 (all), E3-01 | FR-4, FR-5; NFR-5 |
| 0011 | Art. VI | E6-01/02/09, E7-06 | FR-10, FR-12.2; NFR-5/6 |
| 0012 | Art. VI.4 | E0-07, E0-08, E7-05 | NFR-5 |
| 0013 | Art. IX.3, XIV | E3-05/08, E6-03 | FR-5.1, FR-6.1/6.3 |
| 0014 | Art. VIII | E0-05, E3-06/07, E4-01 | FR-6.2/6.5; NFR-2/3/7 |
| 0015 | Art. V.6, IV.6, X, VIII | E0-08, E1-03, E5-01, E2-01 | FR-2/4/9; NFR-3 |
| 0016 | Art. VI.3, VIII | E7-04/05/06/09 | NFR-4/5/6/9 |
| 0017 | Art. VIII, II, XII | E0-09, E3-06/07/10, E5-02/03/09, E6-05, E7-02/10 | FR-4/6/9; NFR-1/2/7 |

## Open decisions referenced by ADRs

Where an ADR depends on an unresolved [Art. XIV](../../CONSTITUTION.md#article-xiv--open-decisions-awaiting-directie) decision, it documents the **seam** rather than presupposing an answer. The clearest example is [ADR-0013 (planningsblok)](0013-planningsblok-abstraction.md).
