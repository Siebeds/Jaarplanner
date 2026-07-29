# E3-10 — Kalender wireframe + teacher feedback

**Story:** Low-fidelity wireframe of the kalender reviewed with directie/teachers **before** building E3-06/07.
**Done when:** a wireframe is approved and informs the build.
**Refs:** ADR-0017 (wireframes-first), `docs/ux/ui-ux-approach.md` §4, NFR-2, FR-6.1–6.5.

## Outcome

**Approved 2026-07-28.** The wireframe is the agreed basis for E3-06 (calendar view) and E3-07
(drag-and-drop), which ADR-0017 gates on exactly this approval.

## Artifact

- [`docs/ux/wireframes/e3-10-kalender.html`](../../../docs/ux/wireframes/e3-10-kalender.html) — self-contained,
  no build step, opens offline. Annotated 1–6 with intent, A–E with the review questions.
- [`docs/ux/wireframes/e3-10-kalender.md`](../../../docs/ux/wireframes/e3-10-kalender.md) — rationale, the
  FR-6 mapping, and the accessibility decisions.

## Design decisions the build inherits

1. **The year is a ribbon of unequal periods; vacations are literal gaps.** Block width is proportional to
   real teaching days. A uniform month grid was explicitly rejected: the year runs Sept→June and Belgian
   vacations fall mid-month, so a month grid would reintroduce the model Art. IX.3 forbids *through the
   picture* even though no code mentions a month.
2. **Low fidelity is the point.** Greyscale; doelsoort as lettered grey chips (`MD 4`, `G 6`) rather than the
   E0-09 colour tokens. Reviewers critique structure, and the letters double as the standing proof that
   colour is never the sole carrier of meaning (Art. XII / WCAG 2.2 AA).
3. **The keyboard route for drag-and-drop is printed on the screen**, not hidden in a shortcut sheet —
   keyboard-operable DnD is mandatory (E7-10), so it is part of the visible design, not an afterthought.
4. **Two knelpunten need two different treatments** (FR-6.4): an over-full period is flagged in place
   (border + ▲ + the words "Te vol"); goals placed *nowhere* get their own tray, because something absent
   cannot stand out inside the ribbon.
5. **`vergrendeld` lives on the card**, not in a menu, so a teacher sees what regeneration will preserve
   without hunting (E4-06).

## Carried forward — open at approval, to be decided at build time

Approval covers the structure, not these five. They move into E3-06/E3-07/E3-09:

- **A. Period rhythm** — 7 periods per year at ±5 weeks. Confirm against how the school actually plans.
- **B. May a thema span two periods?** Currently one period per thema. Affects the E3-01 data shape.
- **C. When is a period "te vol"?** Currently 3 thema's. Count of thema's, of goals, or scaled by the
  period's length? → **E3-09**.
- **D. Is the ongeplande-doelen tray usable at real volume?** Hundreds after a full import; filtering by
  discipline/doelsoort may be required → **E3-09** (and it duplicates the E2-06 gap-list concern about
  unpaged goal lists).
- **E. What belongs on a card?** Currently naam, doelsoortmix, coverage count.

## Process notes

- **A contradiction caught by self-critique during the build:** the first draft's scale strip was labelled
  `sep | okt | nov – dec`, sitting directly above an annotation that reads "Periodes, geen maanden". Replaced
  with a *lesperiode* grouping (the teaching stretches between vacations), which reinforces the model instead
  of undermining it.
- **It found a real model defect.** Feeding the actual 2026-2027 Belgian calendar through the E3-05
  derivation produced three **1-week "themaperioden"**, outside the ratified 4–6 week range. That is
  precisely what wireframes-first exists to catch, and it was fixed in E3-05 before any calendar UI was
  built. The wireframe therefore shows the *corrected* grid (7 periods, 4,4–6,0 weken).
- **Not verified:** narrow-width (phone) rendering. The stacking media query is written but was never
  visually checked — do not quote this artifact as responsive-verified.
