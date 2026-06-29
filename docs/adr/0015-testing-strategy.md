# ADR-0015 — Testing strategy & high-risk coverage

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The constitution names the **Op.stap Excel parser** and the **coverage calculation** as the highest-risk logic and requires them well-covered (Art. V.6); the AI matching/plan logic must be testable with a **faked AI client** (Art. IV.6); and the Definition of Done requires the relevant tests to pass (Art. X). The backlog's E0-08 wires CI gates.

## Decision

We will adopt a layered test strategy aligned to ADR-0002:
- **Domain/Application unit tests (xUnit):** pure logic — the **coverage function** (ADR-0009) against crafted thema↔doel↔minimumdoel graphs, and the **import mapping** (ADR-0006) against representative/edge Excel rows (hidden/empty columns, nullable cluster, the 9.x disciplines, repeated subdomein names). These are the **highest-priority** tests.
- **AI logic tests:** run the matching/generation use cases against the **`FakeAiClient`** — deterministic, offline, asserting grounding, validation, and that nothing is auto-applied.
- **Integration tests (xUnit + Postgres testcontainer):** the API against a real Postgres, covering migrations, import commit/preview, and coverage endpoints.
- **Frontend tests (Vitest + Testing Library):** the kalender (drag-and-drop), suggestion accept/reject, and the dekkingsoverzicht.
- **CI gates (E0-08):** `dotnet test`, `dotnet format --verify-no-changes`, `pnpm test`, `pnpm lint`, `pnpm build` — all green to merge.

## Alternatives considered

- **Manual/Smoke testing only** — unacceptable for the inspection-grade coverage logic; a coverage bug is a compliance failure.
- **Mocking the DB in integration tests** — hides provider-specific behaviour; a Postgres testcontainer tests the real thing.
- **E2E (Playwright) as the primary net** — slow and brittle as the main guarantee; we prioritise fast unit tests for the risky logic and keep E2E thin/optional.

## Consequences

**Positive**
- The two riskiest components are protected by fast, deterministic tests; AI is testable without network/keys; CI enforces the DoD.

**Negative / trade-offs**
- Testcontainer integration tests need Docker in CI; slightly slower pipeline.

**Follow-ups**
- E0-08 (CI gates), E1-03 (parser tests), E5-01 (coverage tests), E2-01 (fake AI client), E3/E5 frontend tests.

## Compliance trace

- **Constitution:** Art. V.6 (test parser + coverage), Art. IV.6 (faked AI client), Art. X (DoD), Art. VIII (xUnit/Vitest stack).
- **Backlog:** E0-08, E1-03, E5-01, E2-01, E3/E5 UI stories.
- **FR/NFR:** quality enabler for FR-2, FR-4, FR-9; NFR-3.
