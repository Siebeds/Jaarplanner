# Antagonist Review — E1-03 Op.stap Excel parser (ClosedXML), single-source mapping

**Verdict:** COMPLIANT (one MINOR + two QUESTIONs at audit time; the MINOR was fixed in a fix round before merge).
**Scope audited:** E1-03 commit `0f6b6e2` delta against parent `aac8480` on branch `story/E1-03`. Files: `OpstapKolom.cs`, `ClosedXmlOpstapParser.cs`, `IOpstapParser.cs`, `OpstapParseResult.cs`, `OpstapRijProbleem.cs`, two `.csproj` edits, `ClosedXmlOpstapParserTests.cs`, `OpstapWorkbookBuilder.cs`.

## Findings

### [MINOR — FIXED in fix round `36c7c5c`] Malformed first data row silently swallowed as presumed header
- **Article/FR:** Art. V.6 (parser is highest-risk; report, don't drop) + ADR-0006 §4.
- **Where:** `ClosedXmlOpstapParser.cs` header heuristic `if (!sawDataRow && problemen.Count == 0) continue;`.
- **Problem:** The first non-empty row with an unrecognised doelsoort was treated as a header and dropped silently — so a genuine first data row with a typo'd doelsoort would be dropped without an `OpstapRijProbleem`, the one place the "never silently drop" guarantee leaked.
- **Resolution:** Fix round rewrote header detection to be **structural** (`IsHeaderRow`: col A literally `"Doelsoort"`, only the first non-empty row is a header candidate). Malformed rows anywhere — including a headerless first row — are now reported. New test `Reports_a_malformed_FIRST_data_row_in_a_headerless_file_rather_than_dropping_it` pins it. Dead helper `MetRuweRij` removed.

### [QUESTION] Partial minimumdoelRef when only B or only C present → E1-04 seam (left as-is, behaviour pinned)
- `ResolveMinimumdoelRef` returns a partial key (e.g. `"6-"`) when col D empty and only one of B/C present. Defensible (preserve over discard) but won't match a real minimumdoel. Confirmed an E1-04 contract decision; pinned by test `Builds_a_partial_minimumdoelRef_from_whichever_of_B_or_C_is_present`. No logic change.

### [QUESTION → resolved] Unused test helper `MetRuweRij` — removed in fix round.

## Checks run (proof of thoroughness)
- **Art. III.3 — single-source mapping (headline).** A–M column→field map lives only in `OpstapKolom` enum (A=1…M=13). Every cell access in the parser goes through `(int)OpstapKolom.X`; the test fixture writes through the same enum. Grep found no stray literal column indices/letters. PASS.
- **Art. VII.0 / VII.1 — taxonomy.** Cluster nullable; identity = code; `(domein, subdomein)` grouping (neither assumed unique); A–M mapping matches the constitution table; col D = B+C with derivation when D empty. PASS.
- **Art. VII.1 — doelsoort via single source.** Resolves through existing `DoelsoortCodes.TryFromCode`, not re-implemented; all six codes MD/G/+/P/S/A pinned by a Theory. PASS.
- **Art. V.6 — thorough testing.** 24→ (post-fix) parser tests; real edge cases: full mapping, all codes, nullable/whitespace cluster, hidden columns, header/blank skip, no-header file, malformed rows reported with good rows still parsing, distinct refs, trimming, empty sheet. Genuine, not vacuous. PASS.
- **Art. VIII — stack/layering.** ClosedXML 0.105.0 (MIT) with explicit "EPPlus forbidden" comment; no EPPlus/OfficeOpenXml anywhere in source. Parser in `Infrastructure/OpstapImport`. PASS.
- **Art. III (read-only).** Parser only constructs `Leerplandoel` rows via validating ctor; no DB writes, no mutation. PASS.
- **Art. II — domain language.** Domain terms Dutch; infra/comments English; problem `Reden` is machine/log-facing by design (no nl.json obligation). PASS.
- **No secrets.** None. PASS.
- **Scope discipline.** No concordance graph (E1-04), re-import/diff (E1-05), discipline selection (E1-06), DB persistence, API, or UI. `MinimumdoelRefs` exposes refs *for* E1-04 without building the graph — correct seam. PASS.

## Post-merge verification
Orchestrator ran `dotnet test` on the integrated feature branch: **100 unit + 7 integration passing, 0 failed.**

**E1-03 is COMPLIANT** — the MINOR leak was closed before landing; the QUESTIONs are documented E1-04 seam decisions.
