# E7 — Niet-functioneel & overkoepelend

**Phase:** cross-cutting (applies throughout; verified before MVP complete)
**Goal:** The quality, privacy, security, and operability requirements that hold regardless of feature. Most are validated continuously, not built once.
**Covers:** NFR-1..NFR-9. **Constitution:** [Art. VI](../CONSTITUTION.md#article-vi--roles-privacy--security), [Art. X](../CONSTITUTION.md#article-x--definition-of-done-every-task).

---

- [ ] **E7-01 — Dutch UI end-to-end (NFR-1)**
  All user-facing text Dutch, sourced from `nl.json`; no hard-coded literals.
  *Done when:* a lint/check passes repo-wide. Ref: NFR-1, Art. II.3.

- [ ] **E7-02 — Usability for non-technical teachers (NFR-2)**
  Calm, clear UI; minimal training; sensible defaults.
  *Done when:* key flows (import, accept suggestions, edit calendar, read coverage) pass a usability review.

- [ ] **E7-03 — Performance (NFR-3)**
  Plan generation within seconds–tens of seconds; snappy calendar.
  *Done when:* generation and calendar interactions meet the target on representative data.

- [ ] **E7-04 — Cloud hosting, EU region (NFR-4, Art. VI.3)**
  Web app on Azure, EU region; no local install.
  *Done when:* deployed to an EU region; reachable via browser.

- [ ] **E7-05 — Security: encryption + server-side AI keys (NFR-5, Art. VI.4/VI.5)**
  TLS in transit, encryption at rest; AI keys via Key Vault, never in frontend or repo.
  *Done when:* a security review confirms no key exposure and encryption everywhere.

- [ ] **E7-06 — Privacy/GDPR: no pupil data, processing register, retention (NFR-6, Art. VI.2)**
  Staff/curriculum data only; verwerkingsregister + bewaartermijnen documented.
  *Done when:* no pupil PII path exists; register & retention written down.

- [ ] **E7-07 — Browser support (NFR-7)**
  Recent Edge, Chrome, Firefox, Safari.
  *Done when:* smoke tests pass on all four.

- [ ] **E7-08 — Scalability seam (NFR-8)**
  One school, many classes now; extensible to multiple schools later.
  *Done when:* no single-school assumption blocks a later multi-school move.

- [ ] **E7-09 — Backup & restore (NFR-9)**
  Regular DB backups; documented restore.
  *Done when:* a restore is demonstrated from a backup.

- [ ] **E7-10 — WCAG 2.2 AA conformance**
  App-wide WCAG 2.2 AA: keyboard-operable drag-and-drop, AA contrast, colour-plus-label encoding (doelsoort/status/coverage), labelled controls, focus order; **axe** checks gated in CI + manual keyboard/screen-reader passes on the anchor screens.
  *Done when:* axe is clean on core screens and a keyboard-only pass completes the main journeys. Ref: ADR-0017, `docs/ux/ui-ux-approach.md` §7; NFR-2, NFR-7.
