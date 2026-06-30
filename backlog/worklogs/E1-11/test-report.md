# Test Report — E1-11 Gedeelde thema-bibliotheek

**Verdict: PASS** — meets all acceptance criteria.
**Mode:** unit/integration (xUnit). No Playwright (UI deferred; backend-only story).

**Test counts:** Full suite green — **222 unit + 12 integration**. `GedeeldeThemaBibliotheekTests` runs and passes (13/13).

## Criteria → result

| Criterion | Result | Evidence |
|---|---|---|
| 1. Bibliotheek returns school-wide thema + themadoelen + woordenschat, NO class subthema's | PASS | DTO `ThemaBibliotheekItem` has **no subthema field** (compile-time guarantee). `HaalThemaBibliotheekOpAsync` Includes only `Themadoelen`; class-count is a distinct-KlasId SQL count without materialising content. `Bibliotheek_returns_school_wide_themadoelen_and_woordenschat` + `Bibliotheek_item_carries_no_subthema_field_and_counts_deriving_classes` (count=2). |
| 2. Two classes derive same thema independently; no cross-class bleed | PASS | `HaalThemaVoorKlasAsync` uses filtered Include `Subthemas.Where(s => s.KlasId == klasId)` on both ThenIncludes. `Two_classes_derive_the_same_thema_with_independent_subthemas` asserts each side sees only its own subthema + `Assert.DoesNotContain` the other class's both directions. |
| 3. HEADLINE — class-level edit/add/delete never mutates shared thema nor another class; shared changes only via school ops | PASS | `Editing_class_A_subthema_leaves_shared_thema_and_class_B_unchanged` checks shared thema byte-for-byte unchanged + B untouched + A's edit took effect. Add/delete/subdoel/activiteit variants present and non-vacuous. `Shared_themadoelen_and_woordenschat_change_only_via_school_level_ops` shows `WijzigThemaAsync`/`VoegThemadoelToeAsync` as the sole mutation path. |

**Query-shape:** bibliotheek query does NOT Include subthema's; per-klas query scoped to `klasId` via filtered Include. Controllers thin (one-line delegations).

**Substrate note:** Integration tests run on the EF Core in-memory provider (Factory swaps out Npgsql), not live Postgres.

No defects.
