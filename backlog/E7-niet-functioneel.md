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

- [!] **E7-11 — Deployment gate: the API is entirely unauthenticated** — *added 2026-07-28 (antagonist audit); blocked on E6-01/E6-02 + [ADR-0011](../docs/adr/0011-authn-authz-rbac-gdpr.md)*
  There is **no authentication or authorisation anywhere** in `backend/src` — verified: no `[Authorize]`, no `AddAuthentication`, no `AddAuthorization`, no `UseAuthentication`. Every endpoint is anonymous, including destructive and irreversible ones: `DELETE /api/themas/{id}`, `DELETE /api/subthemas/{id}`, `DELETE /api/activiteiten/{id}`, `DELETE /api/klassen/{id}`, and `POST /api/schoolcontent-import` with `menselijkeBeslissingenVerwijderen=true`, which **by design discards teacher-set `aanvaard`/`manueel` goal links** — the exact guarantee Art. IV.2 calls headline.
  *Why this is logged as a gate, not a story note:* the drift is pre-existing and systemic (auth is E6/ADR-0011 work, not yet built), but it has been growing silently with every epic as new endpoints land. Art. VI.1/VI.5 require role-based access via a personal login; "no auth anywhere" is not a waiver the constitution grants, so the exposure must be **visible and tracked** rather than implicit.
  *Done when:* every mutating endpoint requires an authenticated principal and the Art. VI §3.2 role matrix is enforced; **and no deployment to a reachable environment happens before then.** Ref: Art. VI.1/VI.2/VI.5, Art. IV.2, NFR-5, ADR-0011.
