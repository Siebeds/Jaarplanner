# ADR-0017 — UI/UX approach & design system

- **Status:** Accepted
- **Date:** 2026-06-29
- **Deciders:** Architect (Siebe De Saedeleir / team)
- **Ratified:** 2026-06-29 — directie/auteur chose shadcn/ui + Radix, wireframes-first, and WCAG 2.2 AA.

## Context

The users are **non-technical teachers and directie**; for them the UX *is* the product. The constitution binds the relevant forces: a fully **Dutch** UI (NFR-1, Art. II), a **calm, clear interface usable with minimal training** (NFR-2), **Tailwind CSS** for styling and **@dnd-kit** for drag-and-drop (Art. VIII), the two **anchor screens** (kalender + dekkingsoverzicht), recent-browser support (NFR-7), and the doelsoort colour conventions (Art. XII). Tailwind gives us utility styling but **no accessible component primitives** (dialogs, menus, tabs, toasts, tooltips) — which a school tool needs to be keyboard- and screen-reader-operable. We must also decide how design feedback happens before we burn build time.

## Decision

We will adopt a **small, owned, accessible design system on top of Tailwind**, and a **wireframes-first** process for the two anchor screens, targeting **WCAG 2.2 AA app-wide**:

1. **Primitives: Radix UI** (unstyled, accessible — focus management, keyboard, ARIA) **+ shadcn/ui** components **copied into the repo** (`frontend/src/components/ui/`), styled with Tailwind. We own and restyle the code; no heavy runtime, no vendor lock. This *complements* Art. VIII's Tailwind choice — it does not replace it.
2. **Design tokens in Tailwind config** for the shared visual language (see `docs/ux/ui-ux-approach.md`): doelsoort colours (MD blue, G neutral, + green, P/S pink, A yellow), suggestion-status colours (voorgesteld/aanvaard/geweigerd/manueel), coverage states (gedekt/niet/deels). Defined once, reused everywhere; never inline hex.
3. **Process:** low-fidelity **wireframes of the kalender and dekkingsoverzicht first**, reviewed with directie/teachers, then build in React with a **Storybook** component catalog and iterate live.
4. **Accessibility: WCAG 2.2 AA across the app** — keyboard-operable drag-and-drop (@dnd-kit keyboard sensor), sufficient contrast (colour never the *only* signal — pair with label/icon, critical for doelsoort/coverage coding), labelled controls, sensible focus order. Verified with automated checks (axe) in CI plus manual keyboard passes.
5. **Layout target:** laptop/desktop-first (teachers plan on a computer), gracefully usable on tablet; not a mobile-first app.
6. **All copy in Dutch via `nl.json`** (ADR-0005) — microcopy written for teachers, not developers.

## Alternatives considered

- **Headless UI + Tailwind** — lighter, Tailwind-native, but fewer primitives; we'd hand-build more accessible components (more a11y risk for a small team).
- **Full kit (MUI / Mantine)** — fastest start, but fights Tailwind's model (Art. VIII), ships a large runtime and an opinionated look that undercuts the calm/custom NFR-2 goal. Rejected.
- **Hand-rolled primitives on raw Tailwind** — maximal control but re-implementing accessible dialogs/menus is exactly where a11y bugs hide. Rejected; Radix solves this.
- **Code-first, no wireframes** — fastest to pixels, but loses early non-technical feedback the product depends on. Rejected in favour of lightweight wireframes.
- **Full Figma design system** — most polished, but heavier/slower than the short timeline allows. Deferred; can be adopted later without rework since tokens live in code.

## Consequences

**Positive**
- Accessible-by-default primitives; full visual control for a calm, Dutch, custom UI; small bundle; tokens make the visual language consistent and themeable.
- Wireframes de-risk the anchor screens before code; Storybook makes components reviewable in isolation.
- Colour-plus-label encoding keeps doelsoort/coverage legible for colour-blind users (AA).

**Negative / trade-offs**
- shadcn/ui copy-in means we maintain the component code ourselves (the price of ownership/no lock-in).
- WCAG 2.2 AA is a real, testable bar that adds review effort (axe in CI mitigates regressions).

**Follow-ups**
- E0-09 (design-system foundation: Radix + shadcn + tokens + Storybook + axe), E3-10 (kalender wireframe + teacher feedback), E5-09 (dekkingsoverzicht wireframe + feedback), E7-10 (WCAG 2.2 AA conformance + axe gate). UX specs live in `docs/ux/ui-ux-approach.md`.

## Compliance trace

- **Constitution:** Art. VIII (Tailwind + @dnd-kit; Radix/shadcn complement, not replace), Art. II (Dutch UI), Art. XII (doelsoort colours), Art. IV (AI visibly advisory in the UI).
- **Backlog:** E0-09, E3-06/07/10, E5-02/03/09, E6-05, E7-02/10.
- **FR/NFR:** FR-4 (review UX), FR-6 (kalender), FR-9 (dekkingsoverzicht); NFR-1, NFR-2, NFR-7.
