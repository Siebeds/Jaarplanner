# Antagonist Review — E1-11 Gedeelde thema-bibliotheek (school-wide thema's)

**Verdict:** COMPLIANT
**Scope audited:** `git diff 1c8bdf3..2989566` (commit `2989566`) — 7 files, 578 insertions, 0 deletions. Production: `ThemasController.cs`, `ISchoolcontentBeheerService.cs`, `SchoolcontentBeheerDtos.cs`, `SchoolcontentBeheerService.cs`. Tests + worklog.

## Ruling on the crux (cross-class isolation + shared-thema protection) — structural, not convention
1. **No subthema leakage into the shared library — DTO/compile-time AND query level.** `ThemaBibliotheekItem` has **no subthema field** (impossible to leak). `HaalThemaBibliotheekOpAsync` omits `.Include(Subthemas)`, Includes only `Themadoelen`, computes `AantalAfgeleideKlassen` as SQL-side `Select(KlasId).Distinct().Count()` without materialising subthema content.
2. **Class A's subthema's cannot appear under class B.** `HaalThemaVoorKlasAsync` uses EF Core **filtered includes** `.Include(t => t.Subthemas.Where(s => s.KlasId == klasId))` — genuine server-side WHERE, not in-memory filter over a fully-loaded collection. Scope anchored on required `Subthema.KlasId`.
3. **Editing a class's subthema does not mutate the shared thema.** No mutation path touched; both new methods are `AsNoTracking` reads. `Editing_class_A_subthema_leaves_shared_thema_and_class_B_unchanged` proves shared thema (naam/duur/invalshoeken/woordenschat/themadoelen) + class B intact.

No-migration claim verified: diff touches no Domain entity, no `.csproj`, no migration/snapshot; `dotnet ef migrations has-pending-model-changes` = no pending changes. E1-10 scoping (`Subthema.KlasId`) sufficed.

## Findings — no CRITICAL/MAJOR/MINOR violations

### [QUESTION] Tests exercise EF Core InMemory provider, not Npgsql
- The production filtered `.Include(...Where...)` is correct and translates to server-side SQL under Npgsql, but tests validate against InMemory (LINQ-to-objects), which doesn't prove the Npgsql SQL translation. Pre-existing E1-10 test-infra choice, not introduced here. Confirm a Testcontainers-Postgres run of the scoping queries exists in the roadmap (Art. V.6). Not an E1-11 defect.

### [QUESTION] New GET endpoints carry no `[Authorize]`/role check
- The two new endpoints follow the project-wide pre-E1-11 state (entire `ThemasController` has no auth; RBAC is epic E6 per ADR-0011). Neither introduces nor regresses an auth gap. Must inherit role gating when RBAC lands. Not attributable to E1-11.

## Checks run
- **Art. II** — Dutch domain types (`ThemaBibliotheekItem`, `HaalThemaVoorKlasAsync`, `AantalAfgeleideKlassen`); infra English; no frontend/nl.json (no UI built); backend Dutch exception messages follow E1-10 pattern (not Art. II.3 UI strings). PASS.
- **Art. III** — no curriculum mutation; both methods `AsNoTracking` reads. PASS.
- **Art. VIII** — controller thin; query in Infrastructure; interface + DTO in Application; filtered Include is correct server-side EF; no new deps; no over-engineering. PASS.
- **Art. IX.2** — Thema/Themadoel/kernwoordenschat school-wide; Subthema/Subdoel/Activiteit class-filtered by KlasId. PASS.
- **Art. IX / no drift** — no entity changes; no pending model changes. PASS.
- **Art. X** — 234 passed (222 unit + 12 integration), 0 failed; build clean; small additive reviewable diff. PASS.
- **Art. XIV** — invokes the resolved per-level scoping (Art. IX.2), no re-opening; no planningsblok assumption. PASS.
- **Scope** — no AI matching (E2), jaarplan/kalender (E3), coverage (E5), import re-work, half-built UI, or pupil data. PASS.

**Conclusion:** COMPLIANT. Cross-class isolation + shared-thema protection enforced structurally and proven by targeted tests. The two QUESTIONs are roadmap-sequencing confirmations, not defects.
