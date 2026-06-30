# E1-03 — Op.stap Excel parser (ClosedXML), single-source mapping

## Build round 1 — pure ClosedXML parser with a single-source A–M mapping

- **FR / Article:** FR-2; Art. III.3 (single-source Op.stap→model mapping), Art. VII.0/VII.1
  (taxonomy + A–M column mapping; cluster nullable; identity = code), Art. V.6 (highest-risk
  logic — test the parser thoroughly), Art. VIII (ClosedXML/MIT — EPPlus forbidden). ADR-0006.

- **Files changed:**
  - `backend/src/Jaarplanner.Infrastructure/Jaarplanner.Infrastructure.csproj` — add `ClosedXML` 0.105.0 (MIT).
  - `backend/src/Jaarplanner.Infrastructure/OpstapImport/OpstapKolom.cs` — **the single source of
    truth for the A–M column layout** (enum, 1-based ClosedXML indices). The mapping lives here and only here.
  - `backend/src/Jaarplanner.Infrastructure/OpstapImport/IOpstapParser.cs` — the parser port (pure parser; no persistence).
  - `backend/src/Jaarplanner.Infrastructure/OpstapImport/ClosedXmlOpstapParser.cs` — the ClosedXML implementation.
  - `backend/src/Jaarplanner.Infrastructure/OpstapImport/OpstapParseResult.cs` — result: parsed
    `Leerplandoel` rows + per-row problems + distinct `MinimumdoelRefs` (for E1-04's concordance build).
  - `backend/src/Jaarplanner.Infrastructure/OpstapImport/OpstapRijProbleem.cs` — a per-row parse problem (row no., reason, code).
  - `backend/tests/Jaarplanner.UnitTests/Jaarplanner.UnitTests.csproj` — add `ClosedXML` 0.105.0 (build in-memory fixtures).
  - `backend/tests/Jaarplanner.UnitTests/Curriculum/OpstapWorkbookBuilder.cs` — in-memory `.xlsx` fixture builder (writes via `OpstapKolom` — no second column map in tests).
  - `backend/tests/Jaarplanner.UnitTests/Curriculum/ClosedXmlOpstapParserTests.cs` — 24 parser tests.

- **Where the single-source A–M mapping lives:** `OpstapKolom.cs` — one enum, values are the
  1-based column indices A=1…M=13. The parser reads **every** cell through `(int)OpstapKolom.X`;
  there is no literal column index/letter anywhere else. A column shift in Op.stap is a one-line
  edit to this enum (Art. III.3). The doelsoort code→enum decision is **not** duplicated — it
  delegates to the existing `Domain.Curriculum.DoelsoortCodes.TryFromCode` (the single source for
  code↔doelsoort). The fixture builder in tests also writes through `OpstapKolom`, so test and
  parser cannot drift apart.

- **Key decisions:**
  - **Pure parser, no persistence/diff/concordance graph.** `IOpstapParser.Parse(Stream, disciplineNummer)`
    returns an `OpstapParseResult`. DB wiring, re-import/diff, discipline selection are out of scope
    (E1-04/05/06). The port lives in Infrastructure (not Application) to avoid adding premature
    Application surface; E1-04 orchestration can lift/inject it then.
  - **`minimumdoelRef` (col D) — produced, not built into a graph.** Column D used when present;
    otherwise derived from B+C (LfMD+nrMD) per Art. VII.1. `OpstapParseResult.MinimumdoelRefs`
    exposes the distinct keys so E1-04 can build the concordance without re-reading the file.
    The goal Excel carries **no** decreed minimumdoel *omschrijving* (Art. III), so this story yields
    the *references*, not full `Minimumdoel` entities — matching the story's "Minimumdoel reference via the B+C key".
  - **Header / blank-row handling.** A leading row whose doelsoort cell is not a recognised code is
    treated as a header and skipped; the same in the body is a reported problem. Fully empty rows are
    skipped silently. Files without a header parse too.
  - **Malformed rows are reported, never dropped** (ADR-0006 §4). Unknown/missing doelsoort and
    missing required fields (caught from the `Leerplandoel` constructor's guard) become
    `OpstapRijProbleem` entries; good rows on the same sheet are still collected.
  - **Read-only contract untouched.** Rows are constructed via the existing public `Leerplandoel`
    constructor; no curriculum entity contract was changed.
  - **Open decision (Art. XIV) isolated behind the seam.** Discipline is passed in as context (the
    file is per-discipline); discipline *selection* config is deferred to E1-06.

- **Tests added (24, in `ClosedXmlOpstapParserTests`):**
  - `Maps_every_A_to_M_column_to_the_right_field` — full A–M field mapping.
  - `Maps_each_doelsoort_short_code_via_the_single_source` — MD/G/+/P/S/A → enum.
  - `Treats_an_empty_cluster_as_null`, `Treats_whitespace_optional_cells_as_null` — nullable cluster + optional cells → null.
  - `Uses_column_D_for_the_minimumdoelRef_when_present`, `Derives_the_minimumdoelRef_from_B_plus_C_when_column_D_is_empty`,
    `Leaves_the_minimumdoelRef_null_when_the_row_carries_no_concordance` — the B+C concordance key.
  - `Tolerates_hidden_columns_and_still_reads_their_values` — hidden columns tolerated.
  - `Skips_the_header_row_and_blank_rows`, `Parses_a_file_with_no_header_row`, `Returns_an_empty_result_for_an_empty_sheet`.
  - `Reports_an_unknown_doelsoort_code_in_the_body_rather_than_dropping_it`,
    `Reports_a_row_missing_a_required_field_rather_than_dropping_it`,
    `Reports_a_row_missing_the_tekst_rather_than_dropping_it`,
    `Continues_after_a_bad_row_and_collects_every_good_row` — malformed rows reported, not dropped.
  - `Exposes_distinct_minimumdoelRefs_for_the_concordance_builder`, `Carries_the_supplied_discipline_number_onto_every_row`,
    `Trims_surrounding_whitespace_on_mapped_fields`, `Rejects_a_blank_discipline_number`.

- **Gates:** `dotnet format --verify-no-changes` ✓ (clean) · `dotnet build` ✓ (0 warnings, 0 errors) ·
  `dotnet test` ✓ (97 unit + 7 integration pass; was 73+7, added 24 unit). pnpm gates N/A (backend-only story).

- **Branch:** `story/E1-03` (based on `feature/e1-curriculum-content` @ aac8480 — E1-01 + E1-02 present).

- **Self-check vs acceptance criteria (*Done when:* a discipline file produces correct
  `Leerplandoel`/`Minimumdoel` rows; high-risk logic unit-tested thoroughly):**
  - Correct `Leerplandoel` rows → `Maps_every_A_to_M_column_to_the_right_field` pins all 13 fields. ✓
  - `Minimumdoel` reference via B+C key → three `minimumdoelRef` tests + `MinimumdoelRefs` exposure. ✓
  - Thoroughly unit-tested (Art. V.6) → 24 tests covering mapping, nullable cluster, empty/whitespace→null,
    hidden columns, all 6 doelsoort codes, header/blank rows, and malformed-row reporting. ✓

- **For the test-runner:** Unit-only — no API route or UI yet (pure parser; persistence is E1-04).
  Verify via `cd backend && dotnet test tests/Jaarplanner.UnitTests`; the parser tests are
  `Jaarplanner.UnitTests.Curriculum.ClosedXmlOpstapParserTests`. No Playwright needed.

- **Open questions / Art. XIV touched:** None resolved here. The `cluster`-presence and
  discipline-selection open decisions are honoured by keeping cluster nullable and accepting the
  discipline number as a caller-supplied parameter (no hard-coded discipline list).
