# ADR-0003 — React SPA over a REST/JSON API

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The two anchor screens — the **kalender + drag-and-drop** and the **dekkingsoverzicht** — are highly interactive and stateful. Users are non-technical teachers who need a calm, responsive UI (NFR-2/NFR-3). The backend must keep AI keys and logic server-side (Art. IV/VI). The constitution (Art. VIII) fixes React 18 + TypeScript + Vite on the frontend and a .NET Web API on the backend.

## Decision

We will build a single-page application (React 18 + TS + Vite) that talks to the backend over a **REST/JSON API**. The frontend is organised **by feature** (`jaarplan`, `doelen`, `themas`, `dekking`). The API is the only trust boundary: all authorisation, AI orchestration, and coverage computation happen server-side; the SPA renders and edits state it is allowed to see.

## Alternatives considered

- **Server-rendered MVC (Razor)** — weaker fit for rich drag-and-drop and live coverage updates; more full-page round-trips.
- **GraphQL** — flexible querying, but adds schema/tooling overhead disproportionate to a single-school app and a small, well-known set of screens.
- **Next.js/SSR** — SEO/SSR benefits are irrelevant for an authenticated internal tool; would pull the stack away from the mandated Vite SPA.

## Consequences

**Positive**
- Clean separation: interactive client, secure server. Matches the anchor-screen UX needs.
- REST is simple to test, cache, and reason about for a small surface.

**Negative / trade-offs**
- Some over-fetching/endpoint shaping work vs. GraphQL; acceptable at this scale.

**Follow-ups**
- E0-05 bootstraps the SPA; E3/E5 build the anchor screens against the REST API.

## Compliance trace

- **Constitution:** Art. VIII (stack + anchor screens), Art. IV/VI (server-side trust boundary).
- **Backlog:** E0-05, E3 (kalender), E5 (dekkingsoverzicht).
- **FR/NFR:** FR-6, FR-9; NFR-2, NFR-3, NFR-7.
