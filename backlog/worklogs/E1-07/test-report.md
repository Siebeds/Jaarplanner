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

---

## Round 2 — 2026-07-28

**Executed locally:** `dotnet test backend/Jaarplanner.sln` → **302 unit passed, 0 failed**;
integration **19 passed, 16 skipped**. `dotnet format --verify-no-changes` clean. No migration drift.
Frontend gates untouched by this story but re-run green.

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| Upload `.xlsx` of thema's/subthema's/activiteiten | ⏳ **unverified locally** | Endpoint exists (`POST /api/schoolcontent-import`); covered by `SchoolcontentImportEndpointsTests.Geldig_bestand_wordt_geimporteerd` — **skipped here, needs CI** |
| Validate required columns | ✅ PASS | `Verwisselde_kolommen_worden_geweigerd`, `Standaard_kolomindeling_blijft_geldig` + the pre-existing missing-header tests |
| Clear per-row error messages | ✅ PASS (unit) / ⏳ (HTTP) | Existing parser tests; HTTP shape via `Ongeldige_rij_wordt_precies_gerapporteerd_en_geldige_rij_gaat_door` — skipped here |
| Invalid rows reported precisely | ✅ PASS | Row number + column asserted; unknown-code and cap paths now report instead of throwing |
| Valid file proceeds | ✅ PASS (unit) / ⏳ (HTTP) | `Onbekende_doelcode_...` and cap tests prove good content still lands |

**Why the gap.** The 6 Postgres-backed endpoint tests require a real server (deliberately — the EF
in-memory provider enforces no FKs, which is how these defects passed CI for two epics). No Docker or
local PostgreSQL is available on this machine, so they skip. `PostgresAvailabilityTests` guarantees CI
cannot skip them silently: a missing `JAARPLANNER_TEST_POSTGRES` on CI is a hard failure.

**Verify on CI / with a database:**
```
docker compose up -d db
export JAARPLANNER_TEST_POSTGRES="Host=localhost;Port=5433;Database=postgres;Username=<user>;Password=<pw>"
dotnet test backend/Jaarplanner.sln
```

---

## CI round — 2026-07-28 (story closed)

**Run [30357426252](https://github.com/Siebeds/Jaarplanner/actions/runs/30357426252) — green.**
`Failed: 0, Passed: 42, Skipped: 0` integration · `Failed: 0, Passed: 328, Skipped: 0` unit.
The Postgres-backed endpoint tests above are executed evidence now, not pending evidence.

**What the previous round got wrong.** It recorded the endpoint tests as *skipped locally, awaiting CI*.
They were in fact **failing in CI** — from the first push of 2026-07-28 09:11 through 11:33, five
consecutive red runs, all four failures `KeyNotFoundException` on `isGeldig`. This story's own audit fix
(finding 3) had split the response into `isBestandGeldig` + `isVolledigVerwerkt` and updated the
controller without updating these assertions. Nobody read the CI log; the backlog said "awaiting CI" for
five pushes while CI had already answered.

| Test | Was | Now |
| --- | --- | --- |
| `Voorbeeld_wijzigt_niets` | FAIL (`isGeldig`) | ✅ asserts both flags true, `toegepast` false |
| `Geldig_bestand_wordt_geimporteerd` | FAIL (`isGeldig`) | ✅ asserts both flags true, `toegepast` true |
| `Ongeldige_rij_wordt_precies_gerapporteerd_en_geldige_rij_gaat_door` | FAIL (`isGeldig`) | ✅ both flags false; rij 3 + "Klas" reported; good row landed |
| `Verwisselde_koprij_importeert_niets` | FAIL (`isGeldig`) | ✅ `isBestandGeldig` false, "kolomindeling", nothing imported |
| `Sjabloon_is_downloadbaar_als_xlsx`, `Niet_xlsx_bestand_geeft_400` | passing | ✅ unchanged |
| `Geldig_bestand_dat_inhoud_laat_vallen_is_niet_volledig_verwerkt` | **did not exist** | ✅ new |

**The new test is the one that matters.** The two flags existed to be different, and no test made them
differ — all four cases had them agreeing, so the split was untested and a regression collapsing them back
into one would have passed. It uploads a workbook naming a klas that does not exist: the cell is filled, so
the parser reports nothing (`isBestandGeldig` true, `problemen` empty), but the import skips the subthema
and says so in `diff.opmerkingen` (`isVolledigVerwerkt` false). That is precisely the scenario finding 3
described — an upload that answers "fine" while content vanishes — and it is now pinned.

**Lesson carried forward.** A test that can only run against real PostgreSQL is not evidence of anything
until CI has run it *and the log has been read*. This is the same root cause as the E1 reopening (defects
hidden by the in-memory provider), one level up: not "the tests can't see it" but "nobody looked".
