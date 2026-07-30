# ADR-0021 — Frontend routing, and the URL as the selection source of truth

- **Status:** Accepted
- **Date:** 2026-07-29
- **Deciders:** Architect (Siebe De Saedeleir / team)

## Context

Until now the SPA (ADR-0003) had **no router**. `App.tsx` stacked every built feature in one flex column, and a class was selected by pasting a GUID into a text input. Each feature so far shipped that way deliberately — the alternative was a screen nobody could reach — but the backlog has since grown five more stories that each need a screen of their own (E1-13 import, E1-14 thema-beheer, E1-15 admin import trigger, E5-02 dekking, E6-03/04 beheer). **E0-10** was added to own the shell; this ADR records the two decisions it is not allowed to take by default.

Forces:

- **Nothing decided this before.** `router`/`routing` appears in **zero** of ADR-0001…0020 and nowhere in [`CONSTITUTION.md`](../../CONSTITUTION.md). This is genuinely undecided, not decided elsewhere.
- **Art. VIII fixes the stack** and says changing it requires an amendment. It enumerates React 18 + TS + Vite, Tailwind, Radix/shadcn, `@dnd-kit/core`, TanStack Query, Zustand — and says nothing about routing. Adding a router is therefore a stack **addition**, not a change to a fixed choice.
- **Art. VIII also says** *"this is a small app — favour clarity over ceremony; do not over-engineer."* Six nav destinations is small.
- **E0-10 clause 1 requires real URLs**: deep-linkable, with working browser back/forward.
- **[ADR-0014](0014-frontend-state-and-dnd.md) splits state by ownership** — TanStack Query owns server state, Zustand owns transient local UI state. A "currently selected klas/schooljaar" fits neither cleanly, and clause 1 adds the URL as a third candidate home.
- **NFR-2 / non-technical users.** A teacher will bookmark and share links; *"open your plan"* has to be a URL that works.

## Decision

**1. We will adopt `react-router-dom` (v7, declarative mode) rather than hand-rolling routing.**

Under Art. VIII we read a router as an **addition** to an unaddressed category, which needs an ADR — this one — and not an Art. XI amendment. We state that reading explicitly rather than leaning on it silently: if the architect reads Art. VIII's frontend list as *exhaustive*, this ADR must be accompanied by an amendment, and only the wording changes, not the decision.

**2. We will make the URL the single source of truth for the klas/schooljaar selection.**

The selection lives in the query string (`?schooljaar=<id>&klas=<id>`); components read it through one hook and write it by navigating. **Zustand does not hold a copy**, and neither does a React context. The primary navigation preserves the query string when moving between screens, so a chosen class survives Jaarplan → Dekking → Thema's.

The *lists* of schooljaren and klassen remain server state via TanStack Query — read from `GET /api/schooljaren`, which already returns each year **with the classes it contains**, so the containment invariant of Art. IX.3 is rendered from the server rather than re-assembled in the client. **No new endpoint.**

## Alternatives considered

- **A hand-rolled router** (~60–80 lines: `pushState`, a `popstate` listener, link interception, path parsing). Tempting under "do not over-engineer", and rejected: the cost is not the happy path but the edges — back/forward restoring the right state, focus moved to the new view for screen-reader users, and not swallowing modifier-clicks or middle-clicks. Those are WCAG 2.2 AA obligations (Art. XII, E7-10) on a UI for non-technical users, and they are exactly what a well-tested router already solves. Hand-rolling would be *fewer dependencies and more bespoke code to get right* — the more ceremonious option, not the less.
- **Hash routing** (`#/jaarplan`). No server config needed, but produces URLs that read as broken to a teacher and complicates deep links. The SPA is served same-origin with a fallback anyway.
- **TanStack Router.** A strong option with better type-safety, but a heavier concept load for a six-screen app, and TanStack Query being mandated is no argument for it — they are unrelated libraries.
- **Zustand as the selection source of truth, URL as a mirror.** Rejected: two writable homes for one value diverge, and the first symptom is a shared link that opens someone else's class. If the URL must be authoritative for deep links (clause 1), it must be authoritative always.
- **Selection in the route path** (`/jaarplan/:klasId`) rather than the query string. Cleaner-looking, rejected for now because the selection is **cross-cutting** — Dekking, Thema's and Beheer all need the same klas — and a path param would have to be repeated in every route and re-threaded on every nav. Revisit if a screen ever needs a klas-scoped URL to be canonical (e.g. an export link).
- **Defer the shell; keep appending to `App.tsx`.** This is what has been happening. It is the reason E0-10 exists.

## Consequences

**Positive**
- Screens are deep-linkable and shareable; back/forward work; a teacher can bookmark their jaarplan.
- New screens (E1-13, E1-14, E5-02, E6-03/04) get a destination instead of another block appended to `App.tsx`.
- One home for the selection means no divergence bug class.
- `NavLink`'s `aria-current` handling and focus behaviour come for free, serving E7-10.

**Negative / trade-offs**
- One more runtime dependency, and therefore one more thing E7-12's dependency hygiene must watch.
- The query string is now part of the app's contract: renaming `?klas=` breaks saved links.
- Query-string selection means every nav link must preserve it — a rule that is easy to forget in a new component. Mitigated by routing all nav through the shell's own nav component rather than raw `<Link>`s.
- Reading selection from the URL makes components depend on router context, so tests must render inside a router. Accepted; it is one wrapper in the test helper.
- **Real URLs oblige the host to serve an SPA fallback.** Any unmatched path must return `index.html`, or every deep link and bookmark 404s while the app still works when navigated from the root. `pnpm dev` does this for free and the API does not serve the frontend at all today, so nothing in the repo provides it yet and the gap cannot show up locally. Recorded as a binding constraint on **E7-04**, because a deferral recorded only where it was discovered is a deferral that gets lost.

**Follow-ups**
- **E0-10** implements this (routes, nav, selector, skip-link).
- **E6-02** filters the nav by role. Per functional analysis §3.2 *Toegangsrechten*, **Import** and **Beheer** are beheerder-only and another teacher's class is *lezen* — the nav is built to be filterable, and no filtering is built now because there is no authenticated user to filter by (E6-01, gated by **E7-11**).
- **E3-08**'s zoom level and **E3-07**'s drag state are the first genuinely transient UI state, and are where Zustand returns per ADR-0014. E0-10 removes the placeholder sidebar store, which was a control that only toggled its own label.
- If a klas-scoped canonical URL is ever needed, revisit path params.

## Compliance trace

- **Constitution:** Art. VIII (stack — router recorded as an addition to an unaddressed category; "do not over-engineer" weighed and answered), Art. II.3 (all nav copy from `nl.json`; no server-generated string rendered), Art. XII + WCAG 2.2 AA (focus, `aria-current`, skip-link), Art. IX.3 (Schooljaar↔Klas containment rendered from the server, not re-derived).
- **Backlog:** E0-10 (this shell); enables E1-13, E1-14, E1-15, E2-08, E5-02/03/05, E6-03/04; constrains E6-02 (nav filtering) and E3-07/E3-08 (Zustand's return).
- **FR/NFR:** FR-6 (kalender reachable per class), FR-9 (dekking), FR-10/§3.2 (role-scoped navigation, later); NFR-2 (non-technical usability), NFR-7 (browser support — back/forward, bookmarks).
