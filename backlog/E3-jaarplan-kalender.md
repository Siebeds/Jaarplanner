# E3 — Jaarplan-generatie & kalender

**Phase:** 3 · **Milestone:** M3 — Plan & kalender
**Goal:** Generate a full year plan per class (thema's with their goals spread across the school year) and show it in an interactive drag-and-drop calendar — one of the two anchor screens.
**Covers FR:** FR-5, FR-6. **Constitution:** [Art. IV](../CONSTITUTION.md#article-iv--ai-is-advisory-human-in-the-loop), [Art. VIII](../CONSTITUTION.md#article-viii--tech-stack--architecture-binding-choices) (anchor screens), [Art. IX.3](../CONSTITUTION.md#article-ix--core-data-model-functional).
**UX & a11y:** this is an anchor screen — follow [`docs/ux/ui-ux-approach.md` §4](../docs/ux/ui-ux-approach.md) and [ADR-0017](../docs/adr/0017-ui-ux-design-system.md); WCAG 2.2 AA incl. keyboard-operable DnD.

---

### FR-5 — Generation

- [ ] **E3-01 — Jaarplan generation service (structured JSON, advisory)**
  Generate a per-class plan: thema's + goals across planningsblokken; returned as validated JSON; persisted as a proposal (not auto-applied).
  *Done when:* a class yields a reviewable generated plan via the faked + real AI client. Ref: FR-5.1, Art. IV.

- [ ] **E3-02 — Spreading heuristics**
  Respect number of available blocks, logical order (e.g. seasonal thema's in season), and balanced goal distribution.
  *Done when:* generated plans place seasonal thema's sensibly and spread goals. Ref: FR-5.2.

- [ ] **E3-03 — Aim for full coverage over the year**
  Generation targets complete dekking of the leerdoelen across the school year.
  *Done when:* a freshly generated plan reports high coverage in E5 (gaps surfaced, not hidden). Ref: FR-5.3.

- [ ] **E3-04 — Pre-generation parameters**
  Teacher supplies parameters before generation (vakanties, vaste momenten, gewenste startthema's).
  *Done when:* parameters measurably influence the result. Ref: FR-5.4.

### FR-6 — Calendar

- [!] **E3-05 — Planningsblok model & calendar grid** — *blocked: Art. XIV planningsblok granularity*
  Model the school year as configurable planningsblokken; **do not hard-assume months** — support themaperiode (4–6 wk) / subthemaperiode (~2 wk). Belgian school year Sept→June.
  *Done when:* the block unit is configurable behind a seam; default is documented, not compiled-in. Ref: Art. IX.3, Gap A.6.

- [ ] **E3-06 — Calendar/agenda view of the plan**
  Render the year plan as a calendar/agenda over the school year.
  *Done when:* a generated plan renders per block. Ref: FR-6.1.

- [ ] **E3-07 — Drag-and-drop (`@dnd-kit/core`)**
  Drag thema's/activiteiten between periods.
  *Done when:* dragging moves an item and persists immediately (links to E4-01). Ref: FR-6.2.

- [ ] **E3-08 — Zoom levels (jaar ↔ periode/blok)**
  Switch the view between a year overview and a finer period/block view. **No unit hard-named** — follows the planningsblok seam from E3-05; do not presuppose months while Art. XIV is open.
  *Done when:* level switching works without losing state. Ref: FR-6.3 (exact levels: open), Art. IX.3/XIV.

- [ ] **E3-09 — Knelpunt-signalering**
  Visually flag overloaded blocks and goals that appear nowhere. Signal with icon/label, not colour alone (a11y).
  *Done when:* an over-full block and an unplaced goal are both visibly flagged. Ref: FR-6.4, ADR-0017.

- [ ] **E3-10 — Kalender wireframe + teacher feedback (wireframes-first)**
  Low-fidelity wireframe of the kalender reviewed with directie/teachers **before** building E3-06/07.
  *Done when:* a wireframe is approved and informs the build. Ref: ADR-0017 (wireframes-first), `docs/ux/ui-ux-approach.md` §4; NFR-2.
