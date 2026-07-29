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
  *Blast radius grew (2026-07-29, E3-01 audit).* E3-01 added four anonymous routes: `POST /api/schooljaren`, and on a class's jaarplan `POST …/generatie`, the status/vergrendeling PUTs and `DELETE …/plaatsingen/{id}`. The last one destroys an accepted, locked placement — and there is **no soft-delete and no audit trail anywhere**, so it is unrecoverable. More precisely, and worth knowing when sizing this gate: **the strongest anonymous stop in the codebase is now two calls instead of one.** Before E3-01's fix round, `DELETE /api/klassen/{id}` was a hard refusal while any placement held a human decision; now an anonymous caller deletes the placements first, then the class. That is not a security *regression* — the guard was never access control, it exists to stop incidental loss — but this enumeration is what a reader uses to judge the exposure, so it must say so.

- [ ] **E7-12 — Dependency vulnerability hygiene: nothing owns it today** — *added 2026-07-29 (surfaced by the E3-01 test-runner)*
  Keep third-party dependencies free of known advisories, and make CI say so rather than mentioning it in passing.
  *The concrete trigger:* every backend build emits `warning NU1903: Package 'Microsoft.OpenApi' 2.0.0 has a known **high severity** vulnerability` ([GHSA-v5pm-xwqc-g5wc](https://github.com/advisories/GHSA-v5pm-xwqc-g5wc)), on `Jaarplanner.Api` and `Jaarplanner.IntegrationTests`. It has been in the log for weeks. A grep of the whole backlog for `NU1903|vulnerab|CVE|dependency scan` returned **zero hits before this story** — no epic owned dependency hygiene at all, so the advisory was visible in every build and tracked nowhere. That is the "growing silently" pattern E7-11 was written about, one layer down.
  *Done when:* `Microsoft.OpenApi` is on a patched version (or the advisory is documented as not applicable, with the reasoning); `dotnet list package --vulnerable --include-transitive` is a **CI step that fails the build** on a new high-severity advisory rather than a warning nobody reads; and the frontend has the equivalent (`pnpm audit`). Ref: NFR-5, Art. VI.5, Art. X (a warning in the definition of done is not a warning).
  *Note:* a build warning is exactly as easy to ignore as a skipped test — and this project has already reopened an epic over crediting skipped tests. Same failure mode, different channel.
