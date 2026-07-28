# Antagonist Review — E1-07 School-content Excel parser + validation + per-row errors

**Verdict:** COMPLIANT
**Scope audited:** `git diff 748272f..b8ceb8e` on `story/E1-07` — 12 files (9 source, 2 test, 1 worklog), +1206/-0, all under `backend/`.

## Findings

### [MINOR — fixed on landing] Doc-comment column count stale (P=16 vs actual Q=17)
- `SchoolcontentKolom.cs:24` doc said "A = 1 … P = 16" but the enum defines 17 members ending at `ActiviteitVerwachteUitkomsten = 17` (Q). Cosmetic only — every cell read via `(int)kolom`, so no runtime effect. The class summary + worklog correctly say A–Q. **Fixed by the orchestrator on landing** (doc comment now reads "Q = 17"). Non-blocking.

No other findings. Clean, exemplary implementation.

## Checks run (proof of thoroughness)
- **Art. III.3 / VII.1 (single-source mapping).** `SchoolcontentKolom` is the sole column→field map; grep confirms every access is `row.Cell((int)kolom)` — no literal index/letter elsewhere. Header labels + required set in companion `SchoolcontentKolommen`. Test fixture writes through the same enum. Mirrors E1-03's `OpstapKolom` rigor. PASS.
- **Art. IX.2 (level scoping).** `SubthemaKlas` (col I) and `SubthemaLeeftijd` (col J) in the `Verplicht` set and validated per row; dedicated tests pin both. Denormalised `SchoolcontentRij` carries Thema school-wide attrs, Subthema class/age attrs, Activiteit attrs — matches Art. IX.2. PASS.
- **Art. V.6 (high-risk thoroughly tested).** ~37 test cases: full-column mapping, multi-level file, each activiteittype + case-insensitive, unknown type reported, each required field missing (row number + column), klas/leeftijd scope, invalid duurWeken (null/empty/"nul"/"0"/"-3"/"2,5"), multiple problems per row, report-don't-drop (good rows survive, correct row numbers), missing required header (single + multiple), blank-row skip, whitespace handling, list split/trim, no-header/header-only/null-stream. Report-don't-drop cited to ADR-0006 §4. PASS.
- **Art. II (Dutch).** Code/comments English; domain nouns Dutch; all per-row error messages Dutch. No frontend/API added (no .tsx/.ts/nl.json changes) → Art. II.3 i18n obligation correctly deferred; `SchoolcontentRijProbleem` documents that UI surfacing must go via nl.json. PASS.
- **Art. VIII (stack/layering).** ClosedXML only (already referenced — no new dep); EPPlus only appears in "forbidden" comments. Parser in Infrastructure behind `ISchoolcontentParser`; Domain gets only `ActiviteitTypeCode` (pure mapping). No EF/persistence. PASS.
- **Art. XIV (open decision not hard-baked).** Thema/activiteit Excel structure isolated behind the `SchoolcontentKolom`/`SchoolcontentKolommen` seam, explicitly documented PROVISIONAL/refinable — correct non-assuming move; no layout baked into logic. PASS.
- **Scope creep.** No DB persistence, preview/commit/overwrite (E1-08), template (E1-09), CRUD (E1-10), shared-library (E1-11), or Op.stap parsing. `SchoolcontentRij` is a pure parse result; goal-link columns kept as raw code strings (resolution deferred). PASS.
- **Art. III (curriculum integrity).** Goal-link columns reference leerplandoel codes as text without resolving/mutating any `Leerplandoel` — correct read-only posture. PASS.

## Open questions surfaced (non-blocking)
- **Art. XIV — Thema/activiteit Excel structure**: provisional, seam-isolated. The `;`-separated list convention and `(thema, subthema)` denormalisation need directie confirmation when the real template is settled at E1-09.

**Conclusion:** COMPLIANT. Satisfies FR-1.1/1.2 (precise per-row errors; valid file proceeds). The lone MINOR was cosmetic and fixed on landing.
