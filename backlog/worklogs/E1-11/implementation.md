# E1-11 — Gedeelde thema-bibliotheek (school-wide thema's)

## Build round 1 — explicit shared-library vs per-class-derivation queries on the existing scoping

### FR / Article
- **FR-3.3** (resolved per-level), **Art. IX.2** (level scoping: Thema/Themadoel/kernwoordenschat are a
  school-wide shared library; Subthema/Subdoel/Activiteit are per-class & per-age derivations — no
  cross-class bleed), **Gap A.5**. Touched also Art. II (Dutch domain language), Art. VIII (thin Api / layering).

### How the shared library vs per-class derivation is modelled & queried
The level scoping already holds structurally in the E1-02 model (a `Subthema` requires `KlasId` + `Leeftijd`;
`Thema`/`Themadoel`/kernwoordenschat carry no class). **No schema change / migration was needed** — confirmed
the model can already express "the same shared thema derived by multiple classes without bleed" (each subthema
points at its `Thema` and pins its own `KlasId`). This story makes the two derivation views **explicit** as
query use-cases on top of that scoping:

1. **`HaalThemaBibliotheekOpAsync()`** — the shared thema-bibliotheek. Returns a new `ThemaBibliotheekItem`
   per thema: naam/duur/invalshoeken + the two-tier woordenschat + the 2–3 themadoelen, **plus a derived
   `AantalAfgeleideKlassen`** (distinct count of classes that have derived a subthema). It **structurally
   cannot carry subthema's** (the DTO has no subthema field), and the EF query deliberately does **not**
   `Include` the subthema's — so no class's per-class content can leak into the school-wide library view.
2. **`HaalThemaVoorKlasAsync(themaId, klasId)`** — a thema *as derived for one klas*: the shared thema
   (school-wide layer, reusing `ThemaWeergave`) plus **only that klas's** subthema's/subdoelen/activiteiten,
   via a **filtered Include** (`Include(t => t.Subthemas.Where(s => s.KlasId == klasId))`, EF Core 10). The
   klas is validated up-front (reuses `VereisKlasAsync`); an absent thema → `SchoolcontentNietGevondenFout`.

The two views are coherent: both project the same single school-wide layer; only the class-scoped derivations
differ (filtered in the per-klas view, omitted in the bibliotheek view).

### How cross-class bleed is prevented
Class scope lives on the `Subthema.KlasId` (and flows down to subdoelen/activiteiten). The per-klas query
filters the subthema Include by `KlasId`, so class A's subthema's are physically never materialised under
class B and vice versa. Two classes deriving the same shared thema each get their own independent subthema set.

### How the shared thema is protected from class-level edits
This is inherent in the model + the E1-10 service: class-level mutators (`WijzigSubthemaAsync`,
`MaakSubthemaAsync`, `VerwijderSubthemaAsync`, `Koppel/OntkoppelSubdoel`, activiteit ops) only touch the
class-scoped subtree; none reach into the thema's naam/duur/invalshoeken/themadoelen/woordenschat. The shared
layer is editable **only** via the school-level thema ops (`WijzigThemaAsync`, `StelKernwoordenschatIn`,
`VoegThemadoelToe`, …). E1-11 adds tests that pin this guarantee explicitly.

### Files changed
- `backend/src/Jaarplanner.Application/Schoolcontent/Beheer/SchoolcontentBeheerDtos.cs` — added the
  `ThemaBibliotheekItem` read view (school-wide only; no subthema field; carries `AantalAfgeleideKlassen`).
- `backend/src/Jaarplanner.Application/Schoolcontent/Beheer/ISchoolcontentBeheerService.cs` — added
  `HaalThemaBibliotheekOpAsync` + `HaalThemaVoorKlasAsync` to the use-case contract.
- `backend/src/Jaarplanner.Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs` — implemented
  both queries (no-subthema bibliotheek query with a distinct-class count; filtered-Include per-klas query)
  and the `MapBibliotheekItem` mapper.
- `backend/src/Jaarplanner.Api/Controllers/ThemasController.cs` — added thin `GET /api/themas/bibliotheek`
  and `GET /api/themas/{themaId}/voor-klas/{klasId}` endpoints (the `:guid` constraint keeps `bibliotheek`
  unambiguous against the `{themaId:guid}` detail route).
- `backend/tests/Jaarplanner.UnitTests/Schoolcontent/GedeeldeThemaBibliotheekTests.cs` — new test class (13 tests).
- `backend/tests/Jaarplanner.IntegrationTests/SchoolcontentBeheerEndpointsTests.cs` — added 1 endpoint test
  exercising both new routes end-to-end.

### Key decisions
- **No migration.** The scoping is already structural; adding schema would be over-engineering (Art. VIII).
- **Bibliotheek item has no subthema field** — compile-time guarantee that the shared-library view cannot
  carry class content, on top of the query-level omission.
- `AantalAfgeleideKlassen` is a *derived* uptake count (distinct `KlasId`s), computed in SQL without
  materialising any class's subthema content — gives the directie visibility without exposing class data.
- Did not change the existing `HaalThemasOpAsync` (full-subtree CRUD list) — it serves the beheerpagina admin
  flow; the bibliotheek/voor-klas queries are additive views.
- Kept `leeftijd` a free string (no Art. XIV jaarFase code-form assumption).

### Tests added (what they pin)
- `Bibliotheek_returns_school_wide_themadoelen_and_woordenschat` — library view has the school-wide layer.
- `Bibliotheek_item_carries_no_subthema_field_and_counts_deriving_classes` — no subthema's; distinct-class count.
- `Bibliotheek_is_ordered_and_lists_every_school_wide_thema`.
- `Two_classes_derive_the_same_thema_with_independent_subthemas` — no cross-class bleed.
- `Thema_voor_klas_shows_only_that_class_subdoelen_and_activiteiten`.
- `Thema_voor_klas_with_no_derivation_yields_the_shared_thema_and_no_subthemas`.
- `Thema_voor_klas_rejects_an_unknown_klas` / `_throws_when_thema_absent`.
- `Editing_class_A_subthema_leaves_shared_thema_and_class_B_unchanged` — the headline Done-when.
- `Adding_class_A_subthema_does_not_appear_under_class_B`.
- `Deleting_class_A_subthema_leaves_shared_thema_and_class_B_intact`.
- `Editing_class_A_subdoel_or_activiteit_does_not_touch_class_B_derivation`.
- `Shared_themadoelen_and_woordenschat_change_only_via_school_level_ops` — coherence + edit-path guarantee.
- Integration: `Bibliotheek_returns_school_wide_thema_without_subthemas_and_voor_klas_filters_by_class`.

### Gates
- `dotnet build` ✓ (0 warnings, 0 errors)
- `dotnet test` ✓ — **222 unit** (was 209; +13) + **12 integration** (was 11; +1), all green.
- `dotnet format --verify-no-changes` ✓ (exit 0)
- Frontend gates: N/A — no frontend changes (UI deferred to the frontend pass; no new user-facing strings,
  so no `nl.json` change). Integration tests run on the EF Core in-memory provider (no Postgres container),
  as the repo currently does.

### Branch
`story/E1-11` (based on the tip of `feature/e1-curriculum-content`, commit `1c8bdf3`).

### Self-check vs acceptance criteria
- *Editing a class's subthema does not mutate the shared thema* → met; pinned by
  `Editing_class_A_subthema_leaves_shared_thema_and_class_B_unchanged` and the add/delete/subdoel variants.
- *List the shared bibliotheek (school-wide, without class subthema's)* → met (`HaalThemaBibliotheekOpAsync`).
- *Get a thema as derived for a given klas (shared + only that klas's content)* → met (`HaalThemaVoorKlasAsync`).
- *No cross-class bleed; two classes derive independently* → met (`Two_classes_derive_the_same_thema_*`).
- *Shared themadoelen/woordenschat only via school-level ops* → met (`Shared_..._only_via_school_level_ops`).

### For the test-runner
Unit/integration only — no Playwright (no UI in this story).
- `cd backend && dotnet test` — run the whole suite; the E1-11 evidence is in
  `Jaarplanner.UnitTests` → `GedeeldeThemaBibliotheekTests` and the new integration test.
- API smoke (optional, needs Postgres or the in-memory test host): `GET /api/themas/bibliotheek` (school-wide
  list, no subthema's) and `GET /api/themas/{themaId}/voor-klas/{klasId}` (shared thema + that klas's subthema's).

### Open questions / Art. XIV touched
None. `leeftijd` stays a free string (no jaarFase code-form assumption). Planningsblok granularity untouched.
