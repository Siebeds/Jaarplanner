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

## Amendment (2026-07-31) — the kalender's zoom and drag state live in component state

**Owner ruling, taken on the E3-08 antagonist audit.** The clause above assigns *drag state* and *view zoom* to
Zustand. Both are in fact **plain `useState` in `Jaarplankalender`**, and that stands. Appended rather than edited into
the Decision, per the repo rule that an ADR is superseded or amended and never rewritten.

- **What is amended:** "drag state, selected period, view zoom" as Zustand's. The zoom tier (E3-08) and the dragged
  card (E3-07) are component state; the rest of the clause is unchanged, and Zustand remains the home for local UI
  state that genuinely has more than one reader.
- **Why:** a module-scoped store **outlives the component**. It would carry one class's chosen grain into the next class
  (the klas selector lives above the router outlet, so switching class re-renders rather than remounts) and it leaks
  between tests, where a store initialised at import time is shared by every case in the file. Both values have exactly
  one reader tree, rooted in the component that already owns the fetch and passes the grid down as props, so a store
  would add a second home for a value with a single owner.
- **This also covers E3-07.** Its drag state made the identical call one day after ADR-0021 repeated this clause, was
  never ratified, and no audit noticed — including the audit of E3-07 itself. Recording it here is the point of the
  amendment: the deviation existed either way, and an unrecorded one is indistinguishable from an accident.
- **The consequence the owner accepted:** the zoom therefore **does not survive a reload and is not shareable**. A
  teacher who sends a colleague their URL sends the coarse tier whatever they were looking at. That is a real loss, not
  an oversight, and the cheaper alternative (a `?niveau=` search param per ADR-0021's own mirror pattern) was weighed
  and left for a story that needs it.
- **Trace:** E3-07, E3-08; ADR-0021 §Follow-ups carries the same amendment; Art. VIII (the stack is unchanged — this is
  about which of two already-mandated homes a value uses).

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
