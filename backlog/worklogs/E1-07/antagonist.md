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

---

## Round 2 — 2026-07-28: SELF-AUDIT (not the antagonist subagent)

**Provenance, stated plainly:** the `antagonist` subagent was **not** spawned for this round — the user
has a standing instruction in this session not to invoke subagents unless they ask. What follows is the
implementer's own constitution check and carries **less weight than an independent audit**. Re-run the
real antagonist before treating E1-07 as audited.

| Article | Check | Verdict |
| --- | --- | --- |
| III.1 read-only curriculum | Import only *reads* `Leerplandoelen` to validate codes; never inserts/mutates curriculum | ✅ |
| III.3 single-source mapping | Positional header check reads `SchoolcontentKolom`/`Kolommen`; no second column map (the test builder uses the same source) | ✅ |
| III.5 identity by code | Goal links validated against `Leerplandoel.Code` before construction | ✅ |
| IV.1/IV.2 AI advisory, decisions preserved | Import still writes links as `voorgesteld`; the discard opt-in is unchanged and still defaults false | ✅ |
| IX.2 level scoping + 2–3 themadoelen | Cap enforced in the service in both passes; subthema still requires klas + leeftijd | ✅ |
| ADR-0006 §4 report-don't-drop | Unknown codes, capped themadoelen, corrupt workbook and wrong layout all *reported*, never a silent drop or a 500 | ✅ |
| VI.4 no secrets | No config/keys touched | ✅ |
| GDPR / no pupil data | Endpoint accepts thema/activiteit content only | ✅ |
| II.3 Dutch UI strings in `nl.json` | ⚠️ **Noted** — new Dutch messages are produced at the parser/service layer, consistent with `SchoolcontentRijProbleem`'s documented design. No frontend strings were added. When the SPA surfaces these, Art. II.3 requires the UI copy to come from `nl.json`. |
| X Definition of Done | Tests/format/lint green **except** the 6 endpoint tests are unexecuted locally — story deliberately left `[~]` | ⚠️ |
