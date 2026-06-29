# ADR-0002 — Pragmatic layered backend (Domain ← Application ← Infrastructure, thin Api)

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The domain is rich (Op.stap taxonomy, concordance, the two-tier themalaag, computed coverage) and uses a Dutch ubiquitous language that must not leak away. But the app is small and serves one school. We need a structure that protects domain invariants without enterprise ceremony. The constitution (Art. VIII) already mandates a pragmatic layered backend and warns "do not over-engineer".

## Decision

We will structure the backend in four projects with a strict one-way dependency rule:

```
Jaarplanner.Domain          ← entities, value objects, invariants (Dutch ubiquitous language). No EF/AI/web deps.
Jaarplanner.Application      ← use cases, AI orchestration, mapping, coverage logic. Depends on Domain only.
Jaarplanner.Infrastructure   ← EF Core/Npgsql, ClosedXML import, Azure AI client. Implements Application ports.
Jaarplanner.Api              ← thin: endpoints, DI wiring, auth. Depends on Application (+ Infrastructure at composition root).
```

Cross-cutting external dependencies (DB, AI, Excel) are reached through **interfaces (ports) defined in Application/Domain** and implemented in Infrastructure, so the domain and use cases stay testable in isolation.

## Alternatives considered

- **Single-project / transaction-script** — fast to start, but the coverage and import logic (highest-risk) would entangle with EF and web concerns, hurting testability (Art. V.6).
- **Full Clean/Hexagonal with CQRS + MediatR everywhere** — over-engineered for one school; ceremony the constitution explicitly discourages.
- **Vertical slices only** — viable, but a clear Domain boundary better protects the Dutch ubiquitous language and invariants here.

## Consequences

**Positive**
- Domain invariants (read-only curriculum, computed coverage, advisory AI status) live where nothing can bypass them.
- The high-risk parser and coverage logic are unit-testable without a DB or network.

**Negative / trade-offs**
- Four projects + port interfaces is slightly more upfront structure than a single project.

**Follow-ups**
- E0-01 enforces the layering and the dependency direction in the solution.

## Compliance trace

- **Constitution:** Art. VIII (pragmatic layering, thin Api, no over-engineering); enables Art. III/IV/V invariants to be enforced in Domain/Application.
- **Backlog:** E0-01 (structure), and underpins E1/E2/E5 logic placement.
- **FR/NFR:** all backend FRs; NFR-8 (scalability seam).
