# Jaarplanner — UI/UX Approach

The working UX guideline for Jaarplanner. It implements [ADR-0017](../adr/0017-ui-ux-design-system.md) and is **subordinate to** [`CONSTITUTION.md`](../../CONSTITUTION.md) (NFR-1/2, Art. II, Art. VIII, Art. XII). On any conflict, the constitution wins.

> Audience: non-technical **teachers** (per class) and **directie**. The UX *is* the product for them. Everything here serves one goal: a calm, Dutch, low-training tool that makes coverage provable.

## 1. Design principles

1. **Rust & duidelijkheid** — one primary task per screen; generous whitespace; progressive disclosure over dense forms.
2. **Nederlands, voor leerkrachten** — all copy from `nl.json`; plain teacher language, no technical jargon, no English leakage.
3. **AI is zichtbaar adviserend** — every AI output looks provisional (status badge + motivatie), is accept/reject/adjustable, and is never presented as final (Art. IV).
4. **Dekking in één oogopslag** — the dekkingsoverzicht answers "zijn we in orde voor de inspectie?" at a glance, down to minimumdoel level.
5. **De leerkracht houdt controle** — manual override is always one obvious action away; nothing the AI did is irreversible.
6. **Toegankelijk by default** — WCAG 2.2 AA; colour is never the only signal.

## 2. Design system

- **Styling:** Tailwind CSS (Art. VIII) with design tokens in `tailwind.config`.
- **Primitives:** Radix UI (accessible dialog, menu, tabs, toast, tooltip, popover, select) + **shadcn/ui** components copied into `frontend/src/components/ui/` and restyled. We own the code.
- **Drag-and-drop:** `@dnd-kit/core` with the keyboard sensor enabled (DnD must be operable without a mouse).
- **Catalog:** Storybook for every shared component, with a Dutch-content story and a keyboard/contrast note.
- **Icons:** one consistent set (e.g. lucide), always paired with a text label for meaning.

### 2.1 Visual language (tokens — defined once, reused)

**Doelsoort** (Art. XII conventions; always colour **+ label/abbrev**, never colour alone):

| Doelsoort | Colour | Note |
| --- | --- | --- |
| MD — minimumdoel | blue | the decreed, inspection-level goals |
| G — gemeenschappelijk | neutral/grey | |
| + — verdieping | green | |
| P / S — illustratief | pink | precurriculum / specifiek |
| A — anderstalige nieuwkomers | yellow | |

**Suggestion status** (the `DoelKoppeling` lifecycle — badge + icon + colour):
`voorgesteld` (provisional/outline) · `aanvaard` (confirmed/solid) · `geweigerd` (muted/struck) · `manueel` (teacher-made marker).

**Coverage state:** `gedekt` · `deels` · `niet gedekt` — colour + pattern/icon so it survives colour-blindness and printing.

### 2.2 Typography

**IBM Plex Sans** for all UI text, **IBM Plex Mono** for leerplandoel codes and other identifiers. Both are
**self-hosted** as npm packages (`@fontsource-variable/ibm-plex-sans`, `@fontsource/ibm-plex-mono`) and imported in
`frontend/src/main.tsx`, deliberately **not** loaded from a CDN: a font request to a third party would send every
teacher's IP and referring URL out of the EU on every page load, which Art. VI.2's data-minimisation posture does not
support for a cosmetic dependency. Licence is **OFL 1.1**, which permits bundling and redistribution — worth naming,
because this repo already treats dependency licensing as a first-class constraint (Art. VIII rejects EPPlus on exactly
that ground).

Why Plex specifically: the users read dense Dutch curriculum prose, so the priorities were a large x-height, unambiguous
`1`/`l`/`I` (leerplandoel codes are alphanumeric and get read aloud in meetings), and a companion mono that shares the
same skeleton so a code sitting inside a sentence does not jump. Base size is **15px**, not 14, for the same reason.

> *Filed retroactively at the E0-10 close-out (2026-07-30).* The fonts shipped with this reasoning living only in a
> `main.tsx` docstring, while E0-10's own decision list had demanded the router be documented **before** installing on
> the explicit ground that *"a library installed first gets documented never."* The fonts went in the other way round;
> this section is the correction. Restarting the Vite dev server after adding a font or editing `tailwind.config.js` is
> mandatory — a running server keeps the old config and silently generates no CSS for the new `fontFamily`.

## 3. Information architecture

Primary navigation (per role, per the §3.2 matrix):
- **Doelen** — browse/filter Op.stap leerplandoelen + minimumdoelen (read-only).
- **Thema's** — the shared thema-bibliotheek + the goal-first thema-opbouw wizard.
- **Jaarplan** — the kalender (anchor screen) per class.
- **Dekking** — the dekkingsoverzicht (anchor screen) + gap-analyse + export.
- **Import** — Op.stap goals (beheerder) and thema/activiteit Excel.
- **Beheer** — schooljaren, klassen, leerkrachten, rechten (beheerder).

## 4. Anchor screen — Kalender (FR-6)

Wireframe-first (E3-10), then built. Key UX:
- A school-year timeline of **planningsblokken** — **unit-agnostic** (ADR-0013: no "maand" baked in; label comes from the schooljaar's period structure). Zoom: *jaar ↔ periode/blok*.
- Thema cards show naam, doelsoort mix (colour chips), and a coverage hint; drag between blocks (mouse **and** keyboard).
- **Knelpunt-signalering:** an over-full block and a goal that appears nowhere are both visibly flagged (FR-6.4).
- **Vergrendeld** thema's carry a lock affordance (excluded from regeneration, E4-06).
- Every edit **saves immediately** and the **dekking updates live** (FR-6.5; query invalidation per ADR-0014).
- (Re)generation shows a **preview/diff before applying**, with cancel (FR-8.3).

## 5. Anchor screen — Dekkingsoverzicht (FR-9)

- Two togglable levels: **leerplandoel** and **minimumdoel** (the inspection level, FR-9.3).
- **Dekkingspercentage** prominent; **gap list** of missing goals, grouped by discipline/domein.
- **Filter by doelsoort** (e.g. only MD), using the doelsoort tokens.
- Each gap is **actionable** — jump to where it should be planned in the kalender.
- **Export as proof of coverage** (FR-9.5) — layout TBD with directie (Art. XIV export decision).
- Coverage is **render-only**: the client shows what the server computes (ADR-0009); the UI never authors coverage.

## 6. Other key flows

- **AI-suggesties (FR-4):** a review list — each suggestion shows the goal, a one-line **motivatie**, and accept / reject / adjust. Bulk-review supported; status persists and feeds dekking.
- **Thema-opbouw wizard (FR-3, committed MVP — Art. IV.8):** the 10-step goal-first flow; AI assist offered at step 2 (themadoelen) and step 6 (subdoelen), always advisory.
- **Excel import (FR-1/2):** upload → **per-row validation errors** → **preview** → commit; downloadable template.

## 7. Accessibility (WCAG 2.2 AA — E7-10)

- Keyboard path for **every** interaction, including drag-and-drop.
- Contrast ≥ AA; **colour never the sole carrier** of doelsoort/status/coverage meaning.
- Labelled form controls, visible focus, logical focus order, ARIA via Radix.
- Automated **axe** checks in CI + manual keyboard/screen-reader passes on the anchor screens.

## 8. Validation (NFR-2)

- Lightweight usability checks with **real teachers** on the core journeys (import → suggesties → kalender → dekking) before each anchor screen is "done" (E7-02).
- Success = a teacher completes the journey with minimal guidance and can read coverage unaided.

## 9. Open UX decisions (track in Art. XIV)

- Calendar zoom levels / planningsblok unit (gated on the planningsblok decision, ADR-0013).
- Export layout(s) for jaarplan & dekking (inspectie / klassenmap).
- Whether/when to grow into a full Figma design system (deferred; tokens already live in code, so low rework).
