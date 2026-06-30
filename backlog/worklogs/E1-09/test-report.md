# Test Report — E1-09 Downloadable import template

**Verdict: PASS**
**Mode:** unit/integration (xUnit) — no UI/Playwright, correct for this backend/logic story.

## Criteria → result

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | Template `.xlsx` matches import structure: themadoelen, subthema onderzoeksvraag, two-tier woordenschat (kern + rijk), activiteittype, duurWeken | PASS | `Example_row_demonstrates_the_story_fields_after_parsing` asserts each field on the **parsed** row: `NotEmpty(Themadoelen)`, `!IsNullOrWhiteSpace(SubthemaOnderzoeksvraag)`, `NotEmpty(Kernwoordenschat)`, `NotEmpty(RijkeWoordenschat)`, `Enum.IsDefined(ActiviteitType)`, `ThemaDuurWeken > 0`, `SubthemaDuurWeken > 0` |
| 2 | **(HEADLINE)** Round-trips through E1-07 parser: `IsGeldig == true`, no per-row problems, ≥1 row | PASS | `Generated_template_round_trips_cleanly_through_the_E1_07_parser` pipes `Generator.GenereerTemplate()` straight into the real `new ClosedXmlSchoolcontentParser().Parse(...)` (no stubs/mocks) and asserts `IsGeldig == true`, `Empty(Problemen)`, `Single(Rijen)` |
| 3 | Generated from the SAME single-source column definition — no second hard-coded list (Art. III.3) | PASS | Header built by `foreach (SchoolcontentKolom kolom in Enum.GetValues<>())` → `SchoolcontentKolommen.Label(kolom)` at column `(int)kolom`; example keyed by the enum dict; activiteittype value = `ActiviteitType.Uitstap.ToCode()` which the parser reads back via `ActiviteitTypeCode.TryFromCode` (closed loop). `Header_row_carries_exactly_the_single_source_labels_in_column_order` re-reads and asserts every header equals the single-source label |

## Key facts
- **Test counts (actual):** full `dotnet test` → 179 unit + 7 integration, 0 failed.
- **Template tests:** `ClosedXmlSchoolcontentTemplateGeneratorTests` 4/4 passing.
- **Headline round-trip is genuine**, not vacuous — production generator into production parser with real `IsGeldig`/`Problemen`/`Rijen` assertions.
- **ClosedXML, not EPPlus:** ClosedXML 0.105.0 (MIT); "EPPlus" appears only in constitution-citing comments.
- **Scope clean:** diff = generator + interface + one-line DI registration + test + worklog (224 insertions). No CRUD, persistence, shared-library, or migrations.
- **HTTP download endpoint: DEFERRED** (informational) — no API controller references the generator. The *Done when* is satisfied at the generator-service + round-trip level; the service is DI-registered so an endpoint can be wired later trivially.

No defects.
