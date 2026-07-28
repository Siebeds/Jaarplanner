# E1-07 — Excel upload + validation + per-row errors

## Build round 1 — school-content (thema/subthema/activiteit) Excel parser + validator

- **FR / Article:** FR-1.1/1.2 · Art. III.3 (single-source column mapping), Art. V.6 (import is
  high-risk — test thoroughly), Art. IX.2 (school-content model + level scoping), Art. II (Dutch
  user-facing messages), Art. VIII (ClosedXML/MIT, no EPPlus), ADR-0006 (report-don't-drop per-row
  diagnostics). Art. XIV seam: the thema/activiteit Excel column structure is an open decision.

- **Files changed:**
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/SchoolcontentKolom.cs` — the SINGLE
    source of truth for the column→field mapping (1-based ClosedXML indices A–Q). Marked PROVISIONAL.
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/SchoolcontentKolommen.cs` — companion
    single source for the Dutch header labels and the *required* column set (mirrors the layout enum;
    also feeds E1-09's template generator).
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/ISchoolcontentParser.cs` — pure
    parser/validator port (mirrors `IOpstapParser`).
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/ClosedXmlSchoolcontentParser.cs` — the
    ClosedXML implementation: header validation + per-row field validation + mapping.
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/SchoolcontentRij.cs` — one validated,
    denormalised parsed row (one activiteit + its parent subthema + grandparent thema). Not an entity.
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/SchoolcontentParseResult.cs` — result
    object: `Rijen` + `Problemen` + `IsGeldig` (mirrors `OpstapParseResult`).
  - `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/SchoolcontentRijProbleem.cs` — per-row
    problem record with a clear **Dutch** `Melding` + optional `Kolom` (mirrors `OpstapRijProbleem`).
  - `backend/src/Jaarplanner.Domain/Schoolcontent/ActiviteitTypeCode.cs` — single source for the Dutch
    activiteit-type word ↔ `ActiviteitType` enum mapping (mirrors `DoelsoortCodes`); reused by the
    parser so the type vocabulary lives in one place.
  - `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` — registered
    `ISchoolcontentParser` → `ClosedXmlSchoolcontentParser` (singleton; it is stateless).
  - `backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolcontentWorkbookBuilder.cs` — in-memory
    `.xlsx` fixture builder writing through the single-source mapping (mirrors `OpstapWorkbookBuilder`).
  - `backend/tests/Jaarplanner.UnitTests/Schoolcontent/ClosedXmlSchoolcontentParserTests.cs` — the
    thorough test suite (~37 cases).

- **Where the single-source mapping lives:** `SchoolcontentKolom` (column→field) +
  `SchoolcontentKolommen` (header labels + required set). The parser reads a cell *only* via
  `(int)SchoolcontentKolom.X`; no literal column index/letter appears anywhere else. A column move is
  a one-line change there — exactly the Art. III.3 rigor of the E1-03 `OpstapKolom`.

- **Provisional column layout chosen (Art. XIV — refinable, NOT a committed contract):**
  one flat row = one activiteit, denormalised with its parent subthema + grandparent thema, because a
  flat sheet is what a non-technical teacher fills in most naturally and grouping back into the
  hierarchy is trivial (deferred to E1-08). Columns:
  A Thema · B Thema duur (weken) · C Invalshoeken · D Kernwoordenschat · E Rijke woordenschat ·
  F Themadoelen · G Subthema · H Subthema duur (weken) · I Klas · J Leeftijd · K Probleemstelling ·
  L Onderzoeksvraag · M Subdoelen · N Activiteit · O Type · P Hoek · Q Verwachte uitkomsten.
  List columns (woordenschat, themadoelen, subdoelen) are `;`-separated. Goal-link columns
  (Themadoelen/Subdoelen) carry leerplandoel **codes as raw text references** — not resolved to
  entities here (concordance/persist is E1-08+). The layout is isolated behind the mapping precisely
  so E1-09's template can refine it without touching parser logic.

- **Validation rules + per-row error design:**
  - The first non-empty row is the header. Every *required* header column must be present; a missing
    required header column is a file-level problem and **no data rows are processed** (the positional
    layout is unsafe to interpret) — all missing required columns are listed in one Dutch message.
  - Required fields per row: Thema naam, Thema duur, Subthema naam, Subthema duur, **Klas + Leeftijd**
    (the structural subthema scope, Art. IX.2), Activiteit naam, Activiteit type. duurWeken must be a
    positive integer. Activiteit type must resolve via `ActiviteitTypeCode`.
  - Every violation is reported as a `SchoolcontentRijProbleem(RijNummer, Dutch Melding, Kolom?)`; the
    offending row is excluded from `Rijen` but **never silently dropped** (ADR-0006 §4). Multiple
    problems on a single row are each reported so the teacher can fix them all at once.
  - Optional cells → null; list cells split on `;`, trimmed, empty entries dropped; blank rows skipped.

- **Tests added (~37, all green):** full multi-column mapping of a valid row; multi-level file with
  several subthemas/activiteiten; each `ActiviteitType` word + case-insensitive; unknown
  activiteittype reported; each required-text field missing reported with row number + column;
  Klas-missing and Leeftijd-missing (Art. IX.2 scope) reported; invalid duurWeken (null/empty/text/0/
  negative/decimal) reported; multiple problems per row all reported; report-don't-drop (good rows
  parse while bad rows are reported with correct row numbers); missing required header column (single
  + multiple) reported and data not processed; header omitting only optional columns accepted; blank
  rows skipped; whitespace trimming; whitespace required field treated as missing; whitespace optional
  cells → null; list columns split/trim/drop-empty; empty/header-only file handling; null stream rejected.

- **Gates:** `dotnet build` ✓ (0 warn/0 err) · `dotnet test` (UnitTests) ✓ **160 passed** (was 123;
  +37) · `dotnet format --verify-no-changes` ✓ (clean). Frontend untouched — no `pnpm` run needed.

- **Branch:** `story/E1-07` (based on `feature/e1-curriculum-content` @ 748272f).

- **Self-check vs acceptance criteria:**
  - *invalid rows are reported precisely* → met. Each invalid row yields a `SchoolcontentRijProbleem`
    with the exact 1-based row number, a clear Dutch message, and the offending column. Covered by the
    required-field, scope, duurWeken, unknown-type, multi-problem, and report-don't-drop tests.
  - *valid file proceeds* → met. A clean file yields `IsGeldig == true` and `Rijen` populated with the
    validated rows ready for E1-08's preview/commit. Covered by the valid-row and multi-level tests.

- **For the test-runner:** pure unit logic — no API/UI in this story. Verify via
  `cd backend && dotnet test tests/Jaarplanner.UnitTests` (filter
  `--filter FullyQualifiedName~ClosedXmlSchoolcontentParserTests`). No Playwright needed.

- **Open questions / Art. XIV touched:** the thema/activiteit Excel column structure is the Art. XIV
  open decision flagged on backlog E1-09. I picked a reasonable flat layout and isolated it behind the
  single-source `SchoolcontentKolom`/`SchoolcontentKolommen` mapping + documented it as provisional, so
  E1-09 can finalise columns without changing parser/validator logic. No layout assumption is baked deep.
