# ADR-0004 — PostgreSQL via EF Core + Npgsql

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

We persist school years, classes, the read-only Op.stap curriculum (with concordance), the autonomous themalaag, and jaarplannen. The data is relational and integrity-heavy: unique leerplandoel codes, concordance keys, `(domein, subdomein)` grouping, level-scoped ownership. The constitution (Art. VIII) fixes PostgreSQL + EF Core + Npgsql, local Postgres via Docker.

## Decision

We will use **PostgreSQL** as the single relational store, accessed via **EF Core with the Npgsql provider**. Schema evolves through **EF Core migrations**. Local development uses Dockerised Postgres (`docker compose up -d db`). Reference data (Op.stap) and autonomous data live in the same database but are governed by different write rules (see ADR-0006/0008).

## Alternatives considered

- **SQL Server** — fine technically, but heavier licensing/footprint and not the mandated choice; Postgres is free and EU-hostable cheaply.
- **A document store (e.g. Mongo)** — the domain is strongly relational (concordance, joins for coverage); we would re-implement referential integrity ourselves.
- **Dapper / raw SQL** — more control, but EF Core's change tracking + migrations fit the team and keep the high-risk logic in C#.

## Consequences

**Positive**
- Strong relational integrity for codes/concordance; migrations give reproducible schema; EU-hostable.
- Coverage queries (joins across thema ↔ doel ↔ minimumdoel) are natural in SQL.

**Negative / trade-offs**
- EF Core abstraction can hide query cost; we mitigate with targeted profiling for coverage/aggregation (NFR-3).

**Follow-ups**
- E0-03 (Docker Postgres), E0-04 (EF wiring), E1-01/02 (migrations). Integration tests run against a Postgres testcontainer (ADR-0015).

## Compliance trace

- **Constitution:** Art. VIII; supports Art. III (immutable reference data via guarded write paths) and Art. V (coverage joins).
- **Backlog:** E0-03/04, E1-01/02.
- **FR/NFR:** FR-1, FR-2, FR-9; NFR-3, NFR-9 (backups), NFR-8.
