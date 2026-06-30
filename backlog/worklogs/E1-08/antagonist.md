# Antagonist Review — E1-08 school-content import preview + add/update-or-overwrite re-import

**Verdict:** COMPLIANT
**Scope audited:** `git diff 65bab66..41290e2` (commit `41290e2`) — 4 Application DTOs, 3 Domain mutator additions, the Infrastructure service + interface, DI registration, 15 unit tests, worklog.

## Ruling on Art. IV.2 (the headline constraint) — SATISFIED

Traced the overwrite logic in source (not just tests), across all three koppeling levels:
- **Themadoel** (`SchoolcontentImportService.cs:337-396`): a human decision (`Aanvaard`/`Geweigerd`/`Manueel`, via `IsMenselijkeBeslissing`) that the file no longer carries is dropped **only** inside `if (opties.MenselijkeBeslissingenVerwijderen)`. The `else` branch only adds a `BedreigdeBeslissing` — the link is preserved. AI-only `Voorgesteld` dropped freely. **No path removes a human decision without explicit opt-in.**
- **Subdoel** (`:399-454`): identical protection.
- **Activiteit** (`:283-327`): `WerkActiviteitBij` touches attributes only; `Doelkoppelingen` never read/mutated — teacher decisions survive unconditionally.
- Opt-in defaults safe: `SchoolcontentImportOpties.MenselijkeBeslissingenVerwijderen = false`; the `Bijwerken` factory does not flip it.
- **Preview cannot under-report destruction:** preview and commit share one `VerwerkAsync`; only `SaveChangesAsync` is `toepassen`-gated. `bedreigd.Add(...)` runs outside that guard, so threatened decisions are enumerated identically in both passes. `VereistReview` surfaces `BedreigdeBeslissingen.Count > 0` before any destructive commit. Pinned by `Preview_matches_the_committed_result_for_the_same_input` (asserts equal classification AND equal threatened list).

Art. IV.2 is met: a re-import never silently destroys a human decision — preserved-by-default with a visible warning, or discarded only on explicit caller confirmation.

## Findings (no CRITICAL/MAJOR)

### [MINOR] Empty-file skip ignores `toepassen` and returns `toegepast:false` even when commit requested
- `SchoolcontentImportService.cs:54-65`. Safe direction (absence of input is not a delete-all), mirrors E1-05. Cosmetic: a `toepassen:true` caller gets `Toegepast:false`. Recommend documenting the "skip overrides toepassen" contract on `ISchoolcontentImportService` for the future E1-10 endpoint. Non-blocking.

### [QUESTION] Klas resolution by `Naam` is a soft match key
- `SchoolcontentImportService.cs:67-71`, `:220-226`. Subthema's resolve klas by case-insensitive name; unknown klas → row skipped with a Dutch notice (right call), structurally enforced by `Subthema.RequireKlas`. Latent identity-by-name assumption; revisit at E1-10/E1-11 if a klas code is introduced. Not a violation.

## Checks run (proof of thoroughness)
- **Art. IV.2** — traced all three reconciliation paths in source; preserve-by-default + explicit opt-in + preview==commit on threatened list. SATISFIED.
- **Art. II** — Dutch domain terms; infra/identifiers English; only Dutch `Opmerkingen` server-side diagnostics, no UI literals / nl.json surface added. Pass.
- **Art. III** — writes only the autonomous themalaag; never touches Leerplandoel/Minimumdoel; A–M mapping not duplicated (consumes E1-07 result). Pass.
- **Domain mutator invariants** — `WerkBasisGegevensBij` re-runs RequirePositive/Optional; `VerwijderThemadoel`/`VerwijderSubdoel` plain removes; Themadoel ≤3 still guarded on add; `WerkGegevensBij` retains enum Validate; match keys (naam/klas/leeftijd) never mutated. Pass.
- **Art. IX.2** — subthema inserted with required klasId+leeftijd; subdoelen pin subthema leeftijd; Thema/Themadoel school-wide. Asserted by `First_import_persists_the_full_hierarchy_with_level_scoping`. Pass.
- **Art. V.6** — 15 focused tests incl. four Art. IV.2 paths at themadoel + subdoel niveau, preview==commit, empty-file skip. Exercises destructive paths. Pass.
- **Art. VIII** — DTOs in Application; EF service in Infrastructure; interface placement matches `IOpstapImportService` precedent; no new deps; scoped DI. Pass.
- **Migration / drift** — no Persistence/config/migration files changed; no new EF-mapped properties (only methods); `has-pending-model-changes` clean. Verified. Pass.
- **Art. VI** — no secrets, no AI client, no pupil data. Clean.
- **Scope creep** — no template (E1-09), CRUD UI (E1-10), shared-library (E1-11), AI matching (E2), coverage (E5). New codes land as `Voorgesteld` (status, not coverage claim). Pass.

## Open questions surfaced (non-blocking)
- Klas identity-by-name (Art. XIV) — revisit at E1-10/E1-11.
- Thema/activiteit Excel structure (Art. XIV) — fully isolated in E1-07 parser; this service assumes nothing about columns.

**Conclusion:** COMPLIANT. The two MINOR/QUESTION items are advisory and forward-looking, not violations.
(Post-merge: orchestrator ran `dotnet test` integrated — 175 unit + 7 integration passing.)
