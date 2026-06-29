# ADR-0014 — Frontend state management & drag-and-drop

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

The SPA (ADR-0003) has two demanding screens: a drag-and-drop kalender that must persist edits immediately and reflect them in coverage (FR-6.5), and a dekkingsoverzicht driven by server-computed coverage (ADR-0009). We must distinguish **server state** (authoritative, fetched/mutated via the API) from **local UI state** (transient interactions). The constitution (Art. VIII) fixes TanStack Query, Zustand, and `@dnd-kit/core`.

## Decision

We will split state by ownership:
- **TanStack Query** owns all **server state** — jaarplan, doelen, thema's, coverage — including caching, mutations, and **invalidation after edits** so the dekkingsoverzicht updates without manual refresh.
- **Zustand** owns transient **local UI state** — drag state, selected period, view zoom, dialogs.
- **`@dnd-kit/core`** powers drag-and-drop in the kalender; a drop dispatches a mutation, and on success the relevant queries invalidate (driving live coverage).
- No coverage is computed client-side — the client only renders what the server returns (preserves Art. V/IX.3 as the single source of truth).

## Alternatives considered

- **Redux Toolkit for everything** — conflates server and UI state, more boilerplate; TanStack Query handles caching/invalidation better for our REST surface.
- **react-dnd / native HTML5 DnD** — `@dnd-kit` is the mandated, accessible choice and fits keyboard/non-technical-user needs (NFR-2/7).
- **Compute coverage in the client for snappiness** — would duplicate (and risk diverging from) the authoritative server computation. Rejected.

## Consequences

**Positive**
- Clear separation; immediate-save + live coverage fall out of query invalidation; accessible DnD.

**Negative / trade-offs**
- Two state libraries to learn; the boundary (what is server vs UI state) must be applied consistently.

**Follow-ups**
- E0-05 (providers + libs), E3-06/07 (calendar + DnD), E4-01 (immediate persistence + invalidation), E5-02 (coverage view consumes server state).

## Compliance trace

- **Constitution:** Art. VIII (TanStack Query, Zustand, @dnd-kit), Art. V (client never authors coverage).
- **Backlog:** E0-05, E3-06/07, E4-01.
- **FR/NFR:** FR-6.2/6.5; NFR-2, NFR-3, NFR-7.
