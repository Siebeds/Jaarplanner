# Antagonist Review — E1-09 Downloadable import template (commit 95f6eac)

**Verdict:** COMPLIANT
**Scope audited:** `git diff b1de06b..95f6eac` — `ClosedXmlSchoolcontentTemplateGenerator.cs`, `ISchoolcontentTemplateGenerator.cs`, `DependencyInjection.cs`, the new test class, worklog. Cross-checked against the unchanged single-source files.

## Findings — no violations

- **Art. III.3 — single-source mapping (the crux): PASS.** No second column list, literal header labels, or positional/letter ordering in the generator. Headers produced by iterating `Enum.GetValues<SchoolcontentKolom>()` + `SchoolcontentKolommen.Label(kolom)` — the identical source the parser reads. Example row is a `Dictionary<SchoolcontentKolom, string>` keyed by the enum, written via `sheet.Cell(2, (int)kolom)`. Activiteit type example uses `ActiviteitType.Uitstap.ToCode()` (single-source `ActiviteitTypeCode`), not a literal. A column move/rename is a one-line enum/label change both parser and template follow. `Voorbeeld` holds example *content*, not column identity. `Header_row_carries_exactly_the_single_source_labels_in_column_order` pins it.
- **Art. II — Dutch user-facing strings: PASS.** Header labels (single source) + Dutch example content. No API endpoint or frontend button added (no `frontend/*` or `nl.json` in the diff), so the nl.json rule isn't yet triggered; the endpoint is explicitly deferred as a thin follow-up.
- **Art. VIII — stack: PASS.** `ClosedXML.Excel` (already referenced, MIT, v0.105.0); no EPPlus, no new package (no `.csproj` change). Generator in `Jaarplanner.Infrastructure/SchoolcontentImport`. Interface + impl + singleton DI is proportionate.
- **Art. XIV — provisional layout: PASS.** Consumes the provisional `SchoolcontentKolom`/`SchoolcontentKolommen` from E1-07; invents no divergent layout; doc comment repeats the provisional caveat.
- **Round-trip integrity: PASS — genuinely, not trivially.** Generator emits a populated example row (row 2); the parser only counts a parsed row when all required fields validate. The example fills every required column with values passing positive-integer and `ActiviteitTypeCode.TryFromCode` checks. Test asserts `IsGeldig`, `Empty(Problemen)`, `Single(Rijen)` — an empty/headers-only sheet would yield zero rows and fail `Single`. Parser reads the first worksheet regardless of name, so the `"Schoolcontent"` sheet name doesn't break the round-trip.
- **Scope: PASS.** No CRUD (E1-10), shared-library (E1-11), persistence, Op.stap work, entity/migration changes, or AI. Pure stateless generator + tests + worklog.

## Open questions surfaced
- None new. Correctly defers to the existing Art. XIV "Thema/activiteit Excel structure" open decision; when it lands, the edit belongs in `SchoolcontentKolom`/`SchoolcontentKolommen` and the generator follows automatically.

**Conclusion:** COMPLIANT for the E1-09 scope. (Post-merge: orchestrator ran `dotnet test` integrated — 179 unit + 7 integration passing; `dotnet format` clean.)
