# E1-07 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit; no UI/Playwright — parser+validator, no API surface in this story)

## Criteria checked

- "A valid .xlsx of thema's/subthema's/activiteiten parses into structured rows ready to proceed."
  → PASS — `Maps_every_column_of_a_valid_row_to_the_right_field` asserts all 17 columns map to the
  right `SchoolcontentRij` field (thema/subthema/activiteit levels, durations, list columns,
  activiteittype). `Parses_a_multi_level_file_with_several_subthemas_and_activiteiten` parses a
  3-row multi-level file (`IsGeldig == true`, 3 rows). `SchoolcontentParseResult.IsGeldig` is the
  "ready to proceed" signal; `SchoolcontentRij` is the structured, persistence-free output.

- "Invalid rows are reported precisely — per-row errors identify the 1-based row, the problem, ideally
  the column; clear Dutch messages; required columns/fields validated; bad rows reported but good rows
  still parse (report-don't-drop)."
  → PASS — `SchoolcontentRijProbleem(int RijNummer, string Melding, SchoolcontentKolom? Kolom)` carries
  1-based row + Dutch message + column. Verified by tests:
  - Required text field missing → reported with row 2 + correct column (`Reports_a_missing_required_text_field_with_the_row_number`, theory over ThemaNaam/SubthemaNaam/ActiviteitNaam).
  - Subthema klas scope (Art. IX.2) missing → reported, column `SubthemaKlas`, message contains "Klas".
  - Subthema leeftijd scope missing → reported, column `SubthemaLeeftijd`, message contains "Leeftijd".
  - `duurWeken` invalid → theory over null/""/"nul"/"0"/"-3"/"2,5" all reported on `ThemaDuurWeken` (non-positive AND non-integer both covered).
  - Unknown activiteittype "knutselen" → reported (not dropped), column `ActiviteitType`, message contains the bad value.
  - Multiple problems per row → `Reports_every_problem_on_a_row...`: 3 distinct problems (ThemaNaam, SubthemaKlas, ActiviteitType) all on row 2.
  - Report-don't-drop → `Continues_after_a_bad_row...`: good rows "Goed 1/2/3" parse while bad rows 3 and 5 are reported.
  - Missing required header column → reported at row 1 with the missing label; data rows NOT processed (`Reports_a_missing_required_header_column...`, `Lists_all_missing_required_header_columns`).
  - Dutch messages confirmed in source ("Verplicht veld '...' ontbreekt.", "moet een positief geheel getal zijn", "Onbekend activiteittype", "Verplichte kolom(men) ontbreken in de koprij").

- "The column→field mapping is single-source (Art. III.3) — no duplicated column-index logic."
  → PASS — Column indices live only in `SchoolcontentKolom` (enum A=1…Q=17). The parser reads every
  cell via the single helper `Cell(IXLRow row, SchoolcontentKolom kolom) => row.Cell((int)kolom)...`.
  Grep for stray literal column indices/letters in the parser returned NO matches; the only
  `row.Cell(` call site is the single mapping helper (line 242). The test workbook builder writes via
  the same `(int)kolom` mapping (no second column map). Required-set + header labels are co-located in
  `SchoolcontentKolommen`.

## Commands run
- `dotnet tool restore` → success (dotnet-ef 10.0.9)
- `dotnet test` (full solution) → Passed: 160 unit, 0 failed; Passed: 7 integration, 0 failed
- `dotnet test --filter "FullyQualifiedName~ClosedXmlSchoolcontentParserTests"` → Passed: 37, Failed: 0
- Grep `row.Cell\([0-9]|Column|[A-Z][0-9]` in parser → no stray literals
- Grep `EPPlus|OfficeOpenXml` in backend → only forbidden-mention comments; package ref is `ClosedXML 0.105.0`

## Evidence
- Tests: 160 unit + 7 integration green; the 37 schoolcontent parser tests run and pass.
- Single-source: `ClosedXmlSchoolcontentParser.cs:241-242` sole cell accessor; `SchoolcontentKolom.cs`
  sole index source; `SchoolcontentKolommen.cs` labels + `Verplicht` required set.
- ClosedXML confirmed: `Jaarplanner.Infrastructure.csproj` references ClosedXML 0.105.0 (MIT); no EPPlus.
- Scope confirmed (git diff 748272f..b8ceb8e): only parser/validator types, `ActiviteitTypeCode`
  mapping helper (Domain), one DI registration (`AddSingleton<ISchoolcontentParser>`), and tests.
  NO migration, NO DbContext change, NO endpoint, NO preview/commit, NO template — those are E1-08/E1-09.
  `ActiviteitType` enum pre-existed (E1-02); not modified here.

## Defects
- None.
