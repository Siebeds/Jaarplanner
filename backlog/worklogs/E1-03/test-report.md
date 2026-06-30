# E1-03 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit) — no UI/Playwright (pure parser, no API surface)

## Criteria checked
- **AC1 — "A discipline Excel file produces correct `Leerplandoel` rows (+ minimumdoelRef from B+C / col D); A–M field mapping correct"** → PASS.
  `Maps_every_A_to_M_column_to_the_right_field` asserts all 13 fields (code, doelsoort, jaarFase, domein, subdomein, cluster, tekst, voorbeelden, toelichting, woordenschat, minimumdoelRef, disciplineNummer) land in the right property. minimumdoelRef from col D when present (`Uses_column_D_for_the_minimumdoelRef_when_present` → "K-5"), derived from B+C when col D empty (`Derives_the_minimumdoelRef_from_B_plus_C_when_column_D_is_empty` → "4-12"), null when no concordance (`Leaves_the_minimumdoelRef_null...`).
- **AC2 — "A–M mapping lives in exactly one place (Art. III.3); no duplicated column-index/letter logic"** → PASS.
  Column indices exist only in the `OpstapKolom` enum (A=1…M=13). Parser reads every cell via `row.Cell((int)kolom)` (the single `.Cell(` literal-free call, line 135). The test fixture builder `OpstapWorkbookBuilder` also writes cells exclusively via `(int)kolom`. The doelsoort code↔enum mapping is a separate single source (`Domain.Curriculum.DoelsoortCodes`). Grep for column literals in the parser returns only the indirected `row.Cell((int)kolom)`.
- **AC3 — "Hidden columns and empty/whitespace cells handled; cluster (col I) nullable/optional"** → PASS.
  `Tolerates_hidden_columns_and_still_reads_their_values` hides cols I and M and still reads them. `Treats_an_empty_cluster_as_null`, `Treats_whitespace_optional_cells_as_null` (cluster/voorbeelden/toelichting/woordenschat → null for "   ", "\t", " ", ""), `Trims_surrounding_whitespace_on_mapped_fields`. Cluster is an `Optional()` read → nullable.
- **AC4 — "High-risk logic thoroughly unit-tested (Art. V.6); edge cases covered, malformed rows reported not silently dropped"** → PASS.
  24 parser tests. Malformed rows are reported via `OpstapRijProbleem`, never dropped: unknown doelsoort in body (`Reports_an_unknown_doelsoort_code_in_the_body...`), missing code (`Reports_a_row_missing_a_required_field...`), missing tekst (`Reports_a_row_missing_the_tekst...`), and resilience (`Continues_after_a_bad_row_and_collects_every_good_row` → 3 good rows + 2 problems). Header/blank-row skipping, no-header file, empty sheet, blank discipline rejection, all six doelsoort codes, distinct minimumdoelRefs all covered. Required-field guard lives in the `Leerplandoel` constructor (`Require` throws `ArgumentException`), caught and surfaced by the parser.

## Commands run
- `cd backend && dotnet tool restore` → restored dotnet-ef 10.0.9, success.
- `dotnet test` (full suite) → **Passed 97 unit, 0 failed; Passed 7 integration, 0 failed.** Matches implementer's reported counts.
- `dotnet test tests/Jaarplanner.UnitTests --filter "FullyQualifiedName~ClosedXmlOpstapParserTests"` → **Passed 24, Failed 0.** Parser suite runs and passes.

## Evidence
- Single-source mapping: only `OpstapKolom.cs` carries column indices (1–13). Parser grep for `.Cell(`/`Column(` returns one hit: `ClosedXmlOpstapParser.cs:135  row.Cell((int)kolom).GetString().Trim();`. Fixture builder `OpstapWorkbookBuilder.Set` writes via `sheet.Cell(row, (int)kolom)`.
- Doelsoort code mapping single-sourced in `DoelsoortCodes` (MD/G/+/P/S/A), reused by parser via `TryFromCode`.
- Excel library: `ClosedXML` 0.105.0 referenced in `Jaarplanner.Infrastructure.csproj` (and test project). The only `EPPlus` occurrence in the backend is a comment stating it is forbidden — EPPlus is not referenced.
- Files: parser `backend/src/Jaarplanner.Infrastructure/OpstapImport/{ClosedXmlOpstapParser,OpstapKolom,IOpstapParser,OpstapParseResult,OpstapRijProbleem}.cs`; tests `backend/tests/Jaarplanner.UnitTests/Curriculum/{ClosedXmlOpstapParserTests,OpstapWorkbookBuilder}.cs`.

## Defects
None.
