# E5 — Dekking & export

**Phase:** 5 · **Milestone:** M5 — Bewijs van dekking
**Goal:** Prove coverage — per class, down to minimumdoel level via concordance — with a gap list, doelsoort filtering, and export as proof. The dekkingsoverzicht is the second anchor screen.
**Covers FR:** FR-9 (9.1–9.3, 9.5), FR-11. **Constitution:** [Art. V](../CONSTITUTION.md#article-v--coverage-must-be-provable-dekking) (the core invariant).
**UX & a11y:** this is an anchor screen — follow [`docs/ux/ui-ux-approach.md` §5](../docs/ux/ui-ux-approach.md) and [ADR-0017](../docs/adr/0017-ui-ux-design-system.md); doelsoort/coverage use colour **+ label**; WCAG 2.2 AA.

---

- [ ] **E5-01 — Coverage computation (computed, never stored)**
  Leerplandoel *gedekt* ⇔ linked (status `aanvaard`/`manueel`) to a thema placed in the plan. Minimumdoel *gedekt* ⇔ ≥1 concorded leerplandoel gedekt.
  *Done when:* coverage is derived on read, not persisted. **High-risk logic — unit-tested thoroughly.** Ref: Art. V.1/V.6.

- [ ] **E5-02 — Per-class coverage view (gedekt / niet gedekt)**
  Show, per class, which leerplandoelen are covered and which are not.
  *Done when:* the view matches the plan state live. Ref: FR-9.1.

- [ ] **E5-03 — Coverage % + missing-goals list + doelsoort filter**
  Show dekkingspercentage, list ontbrekende doelen, filter by doelsoort (e.g. only minimumdoelen).
  *Done when:* filtering by MD shows minimumdoel-only coverage. Ref: FR-9.2.

- [ ] **E5-04 — Minimumdoel-level coverage (inspection level)**
  Surface coverage at minimumdoel level via concordance — the level the onderwijsinspectie tests.
  *Done when:* a minimumdoel shows covered iff ≥1 concorded leerplandoel is covered. Ref: FR-9.3, Art. V.2.

- [ ] **E5-05 — Gap-analyse presentation**
  Clear missing-goals overview, grouped by discipline/domein, actionable from the calendar.
  *Done when:* a gap can be traced to where it should be planned. Ref: FR-9, Art. XII (gap-analyse).

- [ ] **E5-06 — Export coverage overview (proof of coverage)**
  Export the dekkingsoverzicht as evidence.
  *Done when:* an export reproduces the on-screen coverage faithfully. Ref: FR-9.5, FR-11.2.

- [!] **E5-07 — Export jaarplan (PDF/Excel, layout)** — *blocked: Art. XIV export formats & layout*
  Export a class year plan for print / klassenmap / inspectie.
  *Done when:* format(s) and layout chosen with directie; export matches the plan. Ref: FR-11.1.

- [ ] **E5-08 — Coverage depth note (binary for MVP)**
  Keep binary gedekt/niet-gedekt for MVP as a deliberate simplification; leave a seam for later herhaling/opbouw (verticale samenhang).
  *Done when:* the simplification is documented in code/UX; no false "fully built up" claims. Ref: Art. IX.3, Gap GAP 11.

- [ ] **E5-09 — Dekkingsoverzicht wireframe + teacher feedback (wireframes-first)**
  Low-fidelity wireframe of the dekkingsoverzicht (leerplandoel + minimumdoel levels, gap list, doelsoort filter) reviewed with directie/teachers **before** building E5-02/03.
  *Done when:* a wireframe is approved and informs the build. Ref: ADR-0017, `docs/ux/ui-ux-approach.md` §5; NFR-2.
