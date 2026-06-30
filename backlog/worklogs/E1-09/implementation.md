# E1-09 — Downloadable import template

## Build round 1 — template .xlsx generator from the single-source column mapping

- **FR / Article:** FR-1.5, Gap A.4 · Art. III.3 (single-source mapping), Art. II (Dutch), Art. VIII (ClosedXML/MIT), Art. XIV (provisional thema/activiteit Excel structure — consumed, not invented).

- **Files changed:**
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/ISchoolcontentTemplateGenerator.cs` — new interface; returns the template as a seekable `MemoryStream`.
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/ClosedXmlSchoolcontentTemplateGenerator.cs` — ClosedXML generator. Emits the header row by iterating `Enum.GetValues<SchoolcontentKolom>()` and labelling each via `SchoolcontentKolommen.Label(kolom)` — the SAME single source the E1-07 parser reads. Writes one worked example row keyed per `SchoolcontentKolom` so it follows the layout too.
  - `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — registered `ISchoolcontentTemplateGenerator` as a singleton (stateless), beside the parser.
  - `backend/tests/Jaarplanner.UnitTests/Schoolcontent/ClosedXmlSchoolcontentTemplateGeneratorTests.cs` — new test class incl. the headline round-trip test.

- **Key decisions:**
  - **No second source of truth (Art. III.3).** The template never lists columns or letters/indices itself. Headers come from `SchoolcontentKolommen.Label` over the `SchoolcontentKolom` enum; the example row is a dictionary keyed by `SchoolcontentKolom` (not by position), written through `(int)kolom`. A column move/rename is a one-line change in the E1-07 enum and both parser and template follow automatically. The activiteittype example value is taken from the single-source `ActiviteitTypeCode` (`ActiviteitType.Uitstap.ToCode()`), not a hard-coded string.
  - **Provisional layout (Art. XIV).** The generator reflects exactly the provisional structure isolated in E1-07's `SchoolcontentKolom`; it invents no divergent layout. XML doc comments call this out.
  - **Example row is valid by construction** so the round-trip holds: required fields non-empty, both duurWeken positive integers, a valid activiteit type word, ';'-separated lists. The parser does not check klas existence (that is the E1-08 import service), so a descriptive klas string round-trips cleanly.
  - **No API endpoint / no frontend** added — the story's *Done when* (downloads + round-trips through E1-07) is fully satisfied by the generator service + round-trip test. An endpoint returning a file would be thin and need no nl.json; left out to keep the change minimal and reviewable. The generator is DI-registered so an endpoint is a trivial follow-up.

- **What the example row contains (Dutch, Art. II):**
  Thema "Herfst" (5 wk), invalshoeken "natuur; seizoenen", kernwoordenschat "blad; tak; boom", rijke woordenschat "fotosynthese; bladval", themadoelen "NC-1.1; NC-1.2"; subthema "Bladeren" (2 wk), klas "K3 — derde kleuterklas", leeftijd "5-6", probleemstelling + onderzoeksvraag, subdoelen "WO-2.3"; activiteit "Bladeren zoeken in het bos", type "uitstap", hoek "ontdektafel", verwachte uitkomsten. This exercises every field the story names: themadoelen, subthema onderzoeksvraag, two-tier woordenschat (kern + rijk), activiteittype, duurWeken.

- **Tests added (4):**
  - `Generated_template_round_trips_cleanly_through_the_E1_07_parser` — **headline**: generator output → `ClosedXmlSchoolcontentParser` → `IsGeldig == true`, no problems, one parsed row.
  - `Header_row_carries_exactly_the_single_source_labels_in_column_order` — re-reads the workbook and asserts each header cell equals `SchoolcontentKolommen.Label(kolom)` (drift guard).
  - `Example_row_demonstrates_the_story_fields_after_parsing` — themadoelen/onderzoeksvraag/two-tier woordenschat/activiteittype/duurWeken all present & well-formed.
  - `Every_required_column_is_filled_in_the_example_row` — no required-column problems.

- **Gates:** `dotnet format --verify-no-changes` ✓ · `dotnet build` ✓ (0 warnings, 0 errors) · `dotnet test` (UnitTests) ✓ **179 passed / 0 failed** (was 175; +4 new). Integration suite untouched. No frontend touched (no `pnpm lint` needed).

- **Branch:** story/E1-09 (based on `feature/e1-curriculum-content` tip b1de06b).

- **Self-check vs acceptance criteria:**
  - *Template .xlsx matching the import structure* → met: header emitted from the single-source `SchoolcontentKolommen` (proven by `Header_row_carries_exactly_the_single_source_labels...`).
  - *incl. themadoelen, subthema onderzoeksvragen, two-tier woordenschat, activiteittype, duurWeken* → met: these are columns in E1-07's mapping; emitting from the single source includes them; the example row demonstrates each (proven by `Example_row_demonstrates_the_story_fields...`).
  - *template downloads and round-trips through E1-07* → round-trip met & pinned by the headline test; "downloads" = generator returns a ready `.xlsx` stream (an HTTP endpoint is an optional thin follow-up, not required by *Done when*).
  - *final columns gated on Art. XIV* → respected: layout consumed from E1-07's provisional enum, not invented.

- **For the test-runner:** Unit only — no Playwright. Run `dotnet test backend/tests/Jaarplanner.UnitTests`; the headline assertion is `ClosedXmlSchoolcontentTemplateGeneratorTests.Generated_template_round_trips_cleanly_through_the_E1_07_parser`. To eyeball the artefact: resolve `ISchoolcontentTemplateGenerator` (or `new ClosedXmlSchoolcontentTemplateGenerator()`), call `GenereerTemplate()`, write the stream to `template.xlsx`, open in Excel — header + one valid example row.

- **Open questions / Art. XIV touched:** None new. The template intentionally mirrors the provisional E1-07 column layout; when Art. XIV ("Thema/activiteit Excel structure") settles, the change lands in `SchoolcontentKolom`/`SchoolcontentKolommen` and the template + parser follow with no edit here.
