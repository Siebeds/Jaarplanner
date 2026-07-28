# E3 — Jaarplan-generatie & kalender

**Phase:** 3 · **Milestone:** M3 — Plan & kalender
**Goal:** Generate a full year plan per class (thema's with their goals spread across the school year) and show it in an interactive drag-and-drop calendar — one of the two anchor screens.
**Covers FR:** FR-5, FR-6. **Constitution:** [Art. IV](../CONSTITUTION.md#article-iv--ai-is-advisory-human-in-the-loop), [Art. VIII](../CONSTITUTION.md#article-viii--tech-stack--architecture-binding-choices) (anchor screens), [Art. IX.3](../CONSTITUTION.md#article-ix--core-data-model-functional).
**UX & a11y:** this is an anchor screen — follow [`docs/ux/ui-ux-approach.md` §4](../docs/ux/ui-ux-approach.md) and [ADR-0017](../docs/adr/0017-ui-ux-design-system.md); WCAG 2.2 AA incl. keyboard-operable DnD.

---

### FR-5 — Generation

- [~] **E3-01 — Jaarplan generation service (structured JSON, advisory)** — *claimed 2026-07-28*
  Generate a per-class plan: thema's + goals across planningsblokken; returned as validated JSON; persisted as a proposal (not auto-applied).
  *Done when:* a class yields a reviewable generated plan via the faked + real AI client. Ref: FR-5.1, Art. IV.
  *Also owns (assigned 2026-07-28):* Art. IX.3's "**`Schooljaar` contains multiple klassen**". E3-05 implemented only the vakantie-/periodestructuur half of `Schooljaar`; the Schooljaar↔Klas containment (and the `Jaarplan` entity itself, with its `vergrendeld` flag per thema) belongs here. Flagged by the E3-05 audit as previously unowned by any story.

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

- [x] **E3-05 — Planningsblok model & calendar grid** — *audited 2026-07-28 (VIOLATIONS FOUND), findings fixed, CI green 2026-07-28*
  Model the school year as configurable planningsblokken; **do not hard-assume months** — support themaperiode (4–6 wk) / subthemaperiode (~2 wk). Belgian school year Sept→June.
  *Done when:* the block unit is configurable behind a seam; default is documented, not compiled-in. Ref: Art. IX.3, Gap A.6.
  *Decision (directie 2026-07-14, Art. XIV resolved):* default is the **two-tier** model — themaperiode (4–6 wk, coarse) + subthemaperiode (~2 wk, fine); zoom levels (E3-08) map to these tiers; unit configurable behind the seam, default documented not compiled-in.
  *Built (2026-07-28):* `Planningsblokniveau` (Themaperiode | Subthemaperiode — **no `Maand` member, guarded by a test**), `Planningsblok` (niveau/ordinaal/start/eind, no calendar unit), `Schooljaar` + owned `Schoolsluiting` (named `Schoolvakantie` when first built; renamed later that day when it had to cover Hemelvaart and studiedagen too) with `Lesperiodes()`, the `IPlanningsblokIndeling` seam and its config-driven implementation (`Planning:Blokindeling`, default themaperiode 5 wk / subthemaperiode 2 wk documented in configuration space), plus migration `SchooljaarEnVakanties`. **Blocks are derived, never stored** — persisting them would bake the granularity into rows. See [worklog](worklogs/E3-05/implementation.md).
  *Audit + fixes (2026-07-28):* the antagonist returned **VIOLATIONS FOUND** (6 MAJOR). Fixed: blocks are now **distributed evenly** per teaching stretch (greedy chopping produced 1-week "themaperioden" outside the ratified 4–6 wk range), the **fine tier nests inside the coarse tier** (they were independent chops, so a subthemaperiode could straddle a boundary), identity is now **`(Niveau, Start)`** and the false "`Ordinaal` is stable" claim is gone, the default is documented in **`appsettings.json`**, and the derivation rules are recorded in **[ADR-0020](../docs/adr/0020-planningsblok-derivation-rules.md)** (superseding ADR-0013's "configuration on the `Schooljaar`" clause). 22 unit tests pass locally — including the three properties the audit showed were unasserted (block duration, tier nesting, ordinal instability); 3 persistence tests still need CI.
  *Closed (2026-07-28), CI run [30357426252](https://github.com/Siebeds/Jaarplanner/actions/runs/30357426252):* the 3 `SchooljaarPersistentieTests` (vakantie round-trip, unique schooljaarnaam, cascade delete) run green against real PostgreSQL — 42 integration passed / 0 skipped, 328 unit passed. Note they had in fact been passing since the first push; the red CI that appeared to block this story was four unrelated E1-07 assertions left stale by that story's audit fix, now corrected. The story was gated on a failure it did not cause.

- [ ] **E3-06 — Calendar/agenda view of the plan**
  Render the year plan as a calendar/agenda over the school year.
  *Done when:* a generated plan renders per block. Ref: FR-6.1.

- [ ] **E3-07 — Drag-and-drop (`@dnd-kit/core`)**
  Drag thema's/activiteiten between periods.
  *Done when:* dragging moves an item and persists immediately (links to E4-01). Ref: FR-6.2.
  *Binding constraints from [ADR-0020](../docs/adr/0020-planningsblok-derivation-rules.md) + the directie ruling of 2026-07-28:*
  - A placement **keys on the block's start date**, never on `Ordinaal`. The ordinal is a display position and shifts when the schooljaar's vacations change; keying on it would silently relocate a teacher's thema.
  - When a vacation edit reshapes the grid, a placement whose stored date is no longer a block boundary becomes **stale**. The application **must not guess** a new period for it.
  - A stale placement raises a **persistent, non-dismissible** notification that names the affected thema's and offers re-placement inline. The UI offers no "later" — see E3-09 for the rendering.
  - While any placement is stale the jaarplan is *te herzien*, and **E5 must not report a dekking figure** for it (Art. V.2).
  *Done when (added):* a vacation edit that invalidates a placement produces the flag, no thema has moved on its own, and coverage refuses to report a number until it is resolved.

- [ ] **E3-08 — Zoom levels (jaar ↔ periode/blok)**
  Switch the view between a year overview and a finer period/block view. **No unit hard-named** — follows the planningsblok seam from E3-05; do not presuppose months while Art. XIV is open.
  *Done when:* level switching works without losing state. Ref: FR-6.3 (exact levels: open), Art. IX.3/XIV.

- [ ] **E3-09 — Knelpunt-signalering**
  Visually flag overloaded blocks and goals that appear nowhere. Signal with icon/label, not colour alone (a11y).
  *Done when:* an over-full block and an unplaced goal are both visibly flagged. Ref: FR-6.4, ADR-0017.
  *Third signal (added 2026-07-28, directie ruling):* a **stale placement** after a vakantie-edit (see E3-07). Unlike the other two knelpunten this one is **not dismissible** and must persist until a human resolves it — an over-full period is a judgement call a teacher may accept, a placement pointing at a date that no longer exists is not.
  *From the approved E3-10 wireframe:* an over-full period is flagged in place (border + icon + the word "Te vol"); goals placed nowhere get their own tray, because something absent cannot stand out inside the ribbon. Open from the review: **what makes a period "te vol"** — a count of thema's, of goals, or scaled by the period's length — and whether the ongeplande-doelen tray needs filtering at real volume (hundreds after a full import).

- [x] **E3-10 — Kalender wireframe + teacher feedback (wireframes-first)** — *wireframe **approved** 2026-07-28*
  Low-fidelity wireframe of the kalender reviewed with directie/teachers **before** building E3-06/07.
  *Done when:* a wireframe is approved and informs the build. Ref: ADR-0017 (wireframes-first), `docs/ux/ui-ux-approach.md` §4; NFR-2.
  *Drafted (2026-07-28):* [`docs/ux/wireframes/e3-10-kalender.html`](../docs/ux/wireframes/e3-10-kalender.html) (open in a browser, no build step) with the rationale and the five review questions in [`e3-10-kalender.md`](../docs/ux/wireframes/e3-10-kalender.md). Low-fidelity by design — greyscale, doelsoort as lettered grey chips, so reviewers critique structure not palette. Central idea: the year is a **ribbon of unequal periods with vacations as literal gaps**, block width proportional to teaching days — a uniform month grid is refused (Art. IX.3 / ADR-0013).
  *Approved (2026-07-28):* the wireframe is approved as the basis for E3-06/E3-07. The five open questions (period rhythm, thema spanning two periods, what "te vol" means, the ongeplande-doelen tray, what belongs on a card) were **not** individually answered at approval — they stay open as build-time decisions and are carried into E3-06/E3-09; see [worklog](worklogs/E3-10/implementation.md).
  *It already earned its keep:* feeding real 2026-2027 dates through the E3-05 grid exposed three **1-week "themaperioden"** — outside the ratified 4–6 wk range. See E3-05's antagonist verdict.
