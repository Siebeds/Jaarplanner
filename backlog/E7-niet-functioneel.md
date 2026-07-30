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
  *Binding constraint added by E0-10 (2026-07-29) — an SPA fallback is now required:* the app uses real
  URLs (`/jaarplan`, `/dekking`, … — `BrowserRouter`, [ADR-0021](../docs/adr/0021-frontend-routing-and-url-selection.md)),
  so **whatever serves the built frontend must return `index.html` for any unmatched path.** Without it
  every deep link and every bookmark 404s, while the app still works perfectly when navigated from the
  root — a failure that is invisible in development and invisible to a smoke test that only opens `/`.
  It is invisible locally because `pnpm dev` (Vite) does the fallback for free, and **the API does not
  serve the frontend at all today** (no `UseStaticFiles`/`MapFallbackToFile` anywhere in `backend/src`),
  so nothing in the repo currently provides it. Decide at deploy time whether the API hosts the SPA
  (`MapFallbackToFile("index.html")`) or a static host does (Azure Static Web Apps handles it via
  `navigationFallback`); either is fine, but **one of them must**. *Done when (added):* a deep link to a
  non-root route, opened cold in a browser against the deployed app, renders that screen.

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
  *Measured miss, filed 2026-07-30 (E0-10 close-out) — **SC 1.4.11 Non-text Contrast**, app-wide.* Measured in a real browser and independently re-derived by the antagonist:
  - `--input` (`frontend/src/index.css:101`, `40 14% 84%` → `rgb(220,216,208)`) is **1.42:1 against `--card`** and **1.34:1 against `--paper`**, versus a **3:1** floor. It is the *sole* boundary of the thema-id field (`DoelsuggestieReview.tsx`) and of the `outline` button variant (`components/ui/button.tsx`, the *Weigeren* action).
  - The `secondary` variant (*Manueel aanpassen*) has **no border at all** and a fill measuring **1.16:1** against the white card it sits on (`--secondary: 40 20% 93%`).
  - Both controls are `bg-card` **on** a `bg-card` surface, so nothing but a failing hairline says "this is a field / this is a button".
  **The fix value is the point of this entry.** A figure of `40 14% 62%` circulated on the E2 branch as the remedy; it does **not** clear 3:1 (**2.50** on card, **2.36** on paper), so applying it would ship a "fix" that still fails and retire the finding falsely. 55% also fails on paper (2.91). **`40 14% 52%`** is the first value with real margin: **3.40** card / **3.21** paper. 53% clears by 0.09 — too thin to cite as evidence later.
  *The blast radius grew on 2026-07-30 (E3-07).* Two more `outline` buttons now depend on that hairline — *Uit deze periode halen* and *Annuleren* on every thema card in the kalender, i.e. up to one pair **per placement** rather than one per screen. Re-measured there in a browser at **1.42:1**, matching this entry exactly. E3-07 did not patch the token (app-wide re-measurement is this story's job) and deliberately did **not** route its own new control through it: the period picker uses `border-ink-zacht` at **6.08:1**, which is a usable precedent for what a compliant control boundary looks like against `--card`. Logged because the anchor screen most teachers will spend their time in is now the biggest single source of this failure.
  *A second thing E3-07 settled that belongs here:* this story's own summary line promises "**keyboard-operable drag-and-drop**". E3-07 deliberately did **not** make the drag keyboard-operable — dnd-kit's `KeyboardSensor` steps by pixels across a ribbon of unequal, horizontally scrolling columns, which is not an interaction a teacher can follow, and a tab stop that lifts a card but cannot reliably drop it is worse than none. It satisfied **SC 2.5.7** (and keyboard access) the way the success criterion actually asks — a single-pointer, fully keyboard-operable **alternative** (the `Aanpassen` period picker) — and hid the grip from assistive tech. So the phrase in the line above should be read as *"the drag's function is keyboard-reachable"*, not *"the drag gesture is keyboard-driven"*. Reword it when this story is worked, rather than building a KeyboardSensor to satisfy a paraphrase.
  *Attribution, because it was filed wrongly once:* the token is **E0-09**'s and E0-10 never touched it, so this is not an E0-10 defect. E0-10 is partially implicated only in that it changed `outline` from `bg-background` to `bg-card`, which made the fill match its surface and left the border carrying the whole signal. E0-10's own klas/schooljaar selects are **clean** — `border-transparent` at rest, identified by a chevron measuring 5.74:1 — so the earlier claim that this hit "E0-10's own control" was incorrect.
  *The evidence gap this exposes, which is the more durable lesson:* E0-10 recorded "24 distinct text/background pairs, 0 failures" and later "26 pairs, 0 failures". Both are true and both measure **SC 1.4.3** only — the three sub-3:1 *non-text* pairs above were never in that population, while the sentences read as *"the palette passes"*. This story's own *Done when* leans on axe, and **jsdom cannot evaluate colour**, so that gate will pass over all of this forever. The contrast script must be extended to component boundaries and state graphics, not just text.
  *Also filed here (E0-10 close-out):* a wrong measured figure in a token comment, since corrected — `--ink-zacht` was annotated *6.4:1 on paper* and is **5.74:1** (6.08:1 on card). No failure, but this file's ratios are cited as evidence elsewhere, so a wrong one devalues the rest.
  *Measured miss, filed 2026-07-30 (E2-08 integration audit) — **SC 1.4.11 Non-text Contrast**, app-wide:* `--input` (`frontend/src/index.css:101`, `40 14% 84%`) is the **only** boundary on every text input in the app, and it computes to **1.42:1 against `--card`** and **1.34:1 against `--paper`** — against a **3:1** floor. It was 1.49:1 under the pre-redesign palette, so the redesign made it marginally worse. This is **not** an E2-08 defect: E0-10's own thema-id input (`DoelsuggestieReview.tsx:49`) and every form control on the app fail identically, so it belongs to this story rather than to any feature. Note the related trap recorded by the E3-06 audit: **jsdom cannot evaluate colour**, so the axe gate in this story's *Done when* will pass over this forever — it has to be checked by arithmetic or by a real browser. Fixing it means darkening `--input` to ≥3:1 (roughly `40 14% 62%` or below) and re-checking the controls that use it.
  *Filed here rather than left in an audit transcript* per this repo's own rule — a deferral recorded only where it was discovered is one that gets lost.

- [!] **E7-11 — Deployment gate: the API is entirely unauthenticated** — *added 2026-07-28 (antagonist audit); blocked on E6-01/E6-02 + [ADR-0011](../docs/adr/0011-authn-authz-rbac-gdpr.md)*
  There is **no authentication or authorisation anywhere** in `backend/src` — verified: no `[Authorize]`, no `AddAuthentication`, no `AddAuthorization`, no `UseAuthentication`. Every endpoint is anonymous, including destructive and irreversible ones: `DELETE /api/themas/{id}`, `DELETE /api/subthemas/{id}`, `DELETE /api/activiteiten/{id}`, `DELETE /api/klassen/{id}`, and `POST /api/schoolcontent-import` with `menselijkeBeslissingenVerwijderen=true`, which **by design discards teacher-set `aanvaard`/`manueel` goal links** — the exact guarantee Art. IV.2 calls headline.
  *Why this is logged as a gate, not a story note:* the drift is pre-existing and systemic (auth is E6/ADR-0011 work, not yet built), but it has been growing silently with every epic as new endpoints land. Art. VI.1/VI.5 require role-based access via a personal login; "no auth anywhere" is not a waiver the constitution grants, so the exposure must be **visible and tracked** rather than implicit.
  *Done when:* every mutating endpoint requires an authenticated principal and the Art. VI §3.2 role matrix is enforced; **and no deployment to a reachable environment happens before then.** Ref: Art. VI.1/VI.2/VI.5, Art. IV.2, NFR-5, ADR-0011.
  *Blast radius grew again, and along a new dimension (2026-07-29, E2-08).* Two more anonymous routes:
  `POST /api/themas/{id}/doelsuggesties/genereer` and `PUT /api/themas/{id}/doelsuggesties/{id}/leerplandoel`
  (the latter overwrites a suggestion's leerplandoel irreversibly, with no audit trail — same shape as the
  deletes below). The new dimension is **AI cost**: `…/doelsuggesties/genereer` is the first anonymous
  endpoint that triggers a **billable external call**, and its candidate list is uncapped by default
  (`LeerdoelSelectie.Alles`, see E1-15), so an unauthenticated caller can bill the school in a loop. The
  Art. VI.1 exposure is pre-existing and gated here; what was missing was this line.
  *Blast radius grew (2026-07-29, E3-01 audit).* E3-01 added four anonymous routes: `POST /api/schooljaren`, and on a class's jaarplan `POST …/generatie`, the status/vergrendeling PUTs and `DELETE …/plaatsingen/{id}`. The last one destroys an accepted, locked placement — and there is **no soft-delete and no audit trail anywhere**, so it is unrecoverable. More precisely, and worth knowing when sizing this gate: **the strongest anonymous stop in the codebase is now two calls instead of one.** Before E3-01's fix round, `DELETE /api/klassen/{id}` was a hard refusal while any placement held a human decision; now an anonymous caller deletes the placements first, then the class. That is not a security *regression* — the guard was never access control, it exists to stop incidental loss — but this enumeration is what a reader uses to judge the exposure, so it must say so.

- [~] **E7-12 — Dependency vulnerability hygiene: nothing owns it today** — *added 2026-07-29 (surfaced by the E3-01 test-runner); clause 1 of 3 landed 2026-07-29*
  Keep third-party dependencies free of known advisories, and make CI say so rather than mentioning it in passing.
  *The concrete trigger:* every backend build emits `warning NU1903: Package 'Microsoft.OpenApi' 2.0.0 has a known **high severity** vulnerability` ([GHSA-v5pm-xwqc-g5wc](https://github.com/advisories/GHSA-v5pm-xwqc-g5wc)), on `Jaarplanner.Api` and `Jaarplanner.IntegrationTests`. It has been in the log for weeks. A grep of the whole backlog for `NU1903|vulnerab|CVE|dependency scan` returned **zero hits before this story** — no epic owned dependency hygiene at all, so the advisory was visible in every build and tracked nowhere. That is the "growing silently" pattern E7-11 was written about, one layer down.
  *Done when:* `Microsoft.OpenApi` is on a patched version (or the advisory is documented as not applicable, with the reasoning); `dotnet list package --vulnerable --include-transitive` is a **CI step that fails the build** on a new high-severity advisory rather than a warning nobody reads; and the frontend has the equivalent (`pnpm audit`). Ref: NFR-5, Art. VI.5, Art. X (a warning in the definition of done is not a warning).
  *Note:* a build warning is exactly as easy to ignore as a skipped test — and this project has already reopened an epic over crediting skipped tests. Same failure mode, different channel.
  *Partially addressed 2026-07-29 (cleanup pass):* clause 1 of three is done — the advisory is cleared. `Microsoft.OpenApi` is pinned to **2.11.0** in `Jaarplanner.Api.csproj`; `dotnet list package --vulnerable --include-transitive` now reports **no vulnerable packages in all six projects** and the backend builds with **0 warnings**. Note *why* a pin and not a bump: `Microsoft.AspNetCore.OpenApi` still resolves `Microsoft.OpenApi` 2.0.0 as of its latest stable **10.0.10**, so upgrading the framework package does not help — verified against its nuspec. The advisory ([CVE-2026-49451](https://github.com/advisories/GHSA-v5pm-xwqc-g5wc), uncontrolled recursion on circular schema refs) patches the 2.x line at **2.7.5**; 3.x is deliberately avoided while the framework package asks for 2.x. `Jaarplanner.IntegrationTests` inherits the pin through its ProjectReference, so no second pin is needed.
  *A second, unrelated instance filed here 2026-07-30 (E0-10 close-out):* `frontend/pnpm-workspace.yaml` carries `minimumReleaseAgeExclude: [react-router-dom@7.18.2, react-router@7.18.2]`, waiving pnpm 11's publish-age quarantine for a version that was younger than the threshold at install time. It is the **only** block in that file with no explanatory comment (every neighbour has three lines of rationale), ADR-0021 does not mention it, and no `minimumReleaseAge` value is set anywhere — so this exclusion is the only trace that the guard exists at all. The waiver is now obsolete (the version is far past the window): drop it and re-run install to prove nothing depends on it, or keep it with the same comment discipline as its neighbours. Supply-chain policy is bound by no article today, which is precisely why it lands here rather than being a violation.
  **Clauses 2 and 3 remain open, and they are the ones that stop this recurring:** there is still no CI step that *fails* on a new advisory (backend or `pnpm audit`), so the next one will again sit in the log unnoticed. Deliberately left to this story rather than bolted on in a cleanup pass — turning an advisory into a build failure is a CI policy change that deserves the story's own audit.
  > *Marker corrected `[ ]` → `[~]` (antagonist audit of the cleanup commit).* It was left `[ ]` to avoid over-claiming, but `[ ]` means **not started** in the legend, and `CLAUDE.md` tells readers to scan the checkboxes — so under-claiming by one notch printed a different falsehood. Not `[!]`: nothing blocks this, no directie ruling is owed. **The real hazard the audit named:** the NU1903 warning was this story's only recurring prompt, and clearing it removed the nag while the recurrence-prevention clauses stayed undone. Detection is degraded, not destroyed — NU1903 still fires for any *newly* vulnerable package — but nothing now reminds anyone that clauses 2 and 3 exist.
  *Guarded 2026-07-29:* the pin's only real failure mode was runtime-only (the Api references no `Microsoft.OpenApi` type, so an incompatible surface would throw on document generation rather than fail the build). `OpenApiDocumentTests` now GETs `/openapi/v1.json` and asserts a parseable document, so CI defends the pin instead of a one-off manual check.

- [ ] **E7-13 — `ISchoolcontentParser` is an Application port living in Infrastructure** — *added 2026-07-29 (surfaced by the antagonist audit of the cleanup commit `d8a47f5`)*
  Move the port to `Jaarplanner.Application`; leave the ClosedXML implementation in `Jaarplanner.Infrastructure`, so `Jaarplanner.Api` depends on the abstraction and not on the adapter package.
  *The concrete defect:* `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/ISchoolcontentParser.cs:11` defines the interface in **Infrastructure**, and `backend/src/Jaarplanner.Api/Controllers/SchoolcontentImportController.cs:2` does `using Jaarplanner.Infrastructure.SchoolcontentImport;` to constructor-inject it. Art. VIII says `Api` is thin; the E0-04 audit ratified `Api → Infrastructure` **explicitly and only** as *"a thin composition root, no data-access logic in Api"* (`backlog/worklogs/E0-04/antagonist.md:11`). A controller taking an Infrastructure-owned port as a constructor dependency is past that line — the ratification covers `Program.cs`'s `AddInfrastructure(...)` call, not this.
  *Why it is filed rather than fixed:* it was found while auditing a cleanup pass, and three uncommitted csproj edits had just tried to force the same point by deleting the `Infrastructure` ProjectReference outright — which broke the build with 85 errors and was reverted. **That attempt was the wrong remedy for a real defect.** Moving one interface (plus its DTOs, if they are equally misplaced) is the right one, and it is a source change that deserves its own story and its own audit rather than being smuggled into a cleanup commit.
  *Watch for:* the test projects reference Infrastructure legitimately (they test `OpstapImportService`, `AppDbContext`, the parser itself) — do **not** try to remove those references. Check whether `ISchoolcontentImportService` and `ISchoolcontentTemplateGenerator`, injected by the same controller, have the same problem.
  *Done when:* the port lives in `Application`, `Api` no longer imports `Jaarplanner.Infrastructure.*` outside `Program.cs`, and the build + 449 tests stay green. Ref: Art. VIII, ADR-0002 (layering).

- [ ] **E7-14 — The Postgres test fixture leaks a database when `DROP … WITH (FORCE)` is denied** — *added 2026-07-30 (root-caused by the test-runner during the E2-08 gates)*
  `PostgresTestDatabase.DisposeAsync` drops its scratch database with `WITH (FORCE)`, which calls `pg_terminate_backend` under the hood. The `jaarplanner` role is **not** a superuser and lacks **`pg_signal_backend`**, so whenever an autovacuum worker (owned by `postgres`) happens to be attached at drop time, the DROP aborts with `42501: permission denied to terminate process`.
  *Two consequences, both observed:*
  1. **It reads as a test failure.** xUnit attributes an `IAsyncLifetime.DisposeAsync` fault to the **last test in the class**, so the suite reports a failure in an arbitrary, unrelated test whose body passed. It was seen on `SchoolcontentImportEndpointsTests` and, in a separate run, on `JaarplanPersistentieTests.Een_klas_heeft_ten_hoogste_een_jaarplan` — neither related to the change under test at the time.
  2. **The scratch database leaks permanently**, fully migrated. Two orphans (`jp_test_import_…`, `jp_test_jaarplan_…`) were found and dropped by hand during the E2-08 rounds.
  *Frequency:* roughly **1 run in 5** (2 of 8 observed across two machines/sessions). Provably not caused by any feature story — `git diff` over `backend/tests/Jaarplanner.IntegrationTests/Postgres/` was empty for the change it first appeared under, and the cause is a server privilege property that application code cannot introduce.
  *Why it matters more than a flake usually would:* this repo reopened an epic over crediting skipped tests, and CI was changed to **fail rather than skip** when no database is configured. An intermittent red that is really a teardown permission fault trains readers to re-run instead of read — the same desensitising failure mode as E7-12's ignorable warning.
  *Candidate fixes (pick deliberately, do not stack them):* grant `jaarplanner` the `pg_signal_backend` role; retry the DROP; `ALTER DATABASE … ALLOW_CONNECTIONS false` then drop; and/or sweep leftover `jp_test_%` databases at suite start, which also reclaims anything already leaked. The sweep is the only option that cleans up history as well as preventing recurrence.
  *Done when:* the teardown either succeeds or fails loudly as *setup/teardown* rather than as an unrelated test, no `jp_test_%` database survives a full run, and the documented local-Postgres setup in `docs/dev-setup-secrets.md` states whatever privilege the chosen fix requires. Ref: Art. X.1, NFR-7.
