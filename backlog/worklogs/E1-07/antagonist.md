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

---

## Round 3 — 2026-07-28: REAL ANTAGONIST RUN (supersedes the round-2 self-audit)

**Scope:** `git diff origin/main...HEAD` — the two commits `f7615ea` + `7a42bee`, 30 files, audited as one
change set against a freshly-read `CONSTITUTION.md`.

**Verdict: VIOLATIONS FOUND** — 6 MAJOR, 7 MINOR, 2 QUESTION.

The round-2 self-audit in this file returned "compliant with two ⚠️ notes". It **missed every one of the
three concrete code defects below.** That is the cost of self-auditing, and it is why the real run was
worth doing. Recording it here rather than quietly overwriting it.

### The three real defects (all now fixed in commit following this audit)

1. **MAJOR — unescaped user input used as an `ILIKE` pattern.** `KlasBeheerService.VereisVrijeNaamAsync`
   passed the request-body class name straight in as the LIKE *pattern*, so `%` and `_` acted as
   wildcards: creating `"K3_groen"` matched an existing `"K3-groen"` and was refused with a factually
   false "this name already exists". Also invalidated the mitigation the code itself documented.
   → **Fixed:** replaced with `lower(naam) = lower(@naam)` (no pattern semantics at all), plus a genuine
   functional unique index on `lower("Naam")` via migration `KlasNaamCaseInsensitiefUniek` — the
   antagonist correctly pointed out that "EF cannot express a functional index" is true of the *model*
   but not of a *migration*, so the original deferral was unjustified.
2. **MAJOR — the themadoel cap silently dropped codes on the overwrite path.** The fix claimed in the
   previous commit applied only to the create branch. `ReconcileThemadoelen` skipped over-cap codes with
   a bare `continue` and **no opmerking**, and its guard read `thema.Themadoelen.Count`, which the removal
   loop mutates *only* when `toepassen` is true — so preview and commit walked different arithmetic. The
   previous commit message and worklog overclaimed "both paths".
   → **Fixed:** single shared `PasThemadoelCapToe` helper used by both branches; the retained count is
   derived from a predicate, never from `toepassen`-mutated state. Two new tests cover the overwrite path
   and its preview/commit agreement — it previously had none.
3. **MAJOR — `isGeldig: true` on imports that dropped content.** The flag was populated from the parse
   result alone, while unknown codes and capped themadoelen are reported on a different branch of the
   payload (`diff.opmerkingen`), so an upload that discarded a typo'd code answered "geldig".
   → **Fixed:** the response now carries two precisely documented flags — `IsBestandGeldig` (parsing) and
   `IsVolledigVerwerkt` (nothing dropped).

### Also fixed from this audit
- **MAJOR — bookkeeping applied inconsistently.** E1-01/E1-02 were left `[x]` with notes *asserting* the
  seed and Klas CRUD as fixed, on evidence of exactly the same strength (skipped tests) for which E1-07
  was held at `[~]`. → Both notes now carry an explicit ⏳ "claimed-but-unproven until CI" qualifier.
- **MAJOR — `WijzigKlasAsync` and the successful-delete path had zero coverage.** → Added endpoint tests
  for rename (incl. rename-to-own-name and rename-to-taken-name), successful delete, and a
  wildcard-bearing name.
- **MAJOR — five new anonymous endpoints, two destructive.** → Logged as **E7-11**, an explicit `[!]`
  deployment gate, rather than left implicit.
- **MINOR — `Discipline.cs` doc contradicted the seeded data** (claimed the 9.x parent "is set"). → Doc
  corrected to state no row sets it and why.
- **MINOR — `Klas` mutated through EF property metadata**, duplicating its invariant. → Added
  `Klas.Wijzig(naam, leerjaar)`; the service no longer re-implements validation.
- **MINOR — ADR-0006 §4 misquoted** as "report, never silently drop" in ~9 places; its actual text is
  "Validation produces clear, per-row diagnostics before commit." → Citations corrected to quote it
  accurately and mark the extension as such.
- **MINOR — inline Postgres password in `ci.yml`** against the repo's own `docker-compose.yml`
  convention. → Kept (it credentials an ephemeral job-scoped container) but annotated with why, so it is
  not read as licence for a real credential.

### Deliberately NOT actioned — routed to directie instead of guessed
Recorded under "Surfaced by the antagonist audit" in [`backlog/README.md`](../../README.md):
- **Art. II.3 ruling** on server-generated Dutch diagnostics vs `nl.json` vs `api.ts`'s "never echo a
  backend message" policy — three documents that cannot all hold. Needs an amendment, not a code change.
- **Discipline 9's official name** / whether 9.1–9.3 are top-level.
- **Whether seeding all 13 disciplines pre-empts the "disciplines first" decision** (ADR-0019 seam).
- **Whether Art. IX.2's "2–3" lower bound is an invariant or a guideline** — only the maximum is coded.

### Findings acknowledged but not fixed
- **MINOR — `Schoolcontent*Fout` reused as the fault vocabulary for a `Klas` (Planning) entity.** Correct
  criticism: the names now assert something false about the domain, and the handler mapping them is
  literally documented as the *school-content* handler. Not fixed because the mechanical rename touches
  the whole E1-10 surface plus the handler, which is churn better done as its own change. **Requires a
  user waiver or a follow-up story before E1-07 is called done.**
- **Noted, not raised by the audit:** the audit also observed that `SchoolcontentImportController` takes
  constructor dependencies on Infrastructure types (`ISchoolcontentParser` et al. live in
  `Jaarplanner.Infrastructure.SchoolcontentImport`). Pre-existing placement, but the new controller makes
  it part of the HTTP surface's type graph. Worth moving those ports to Application later.

**Gates after the fixes:** 304 unit passed / 0 failed; integration 19 passed / 19 skipped (the
Postgres-backed suite, unrunnable on this machine); `dotnet format` clean; no migration drift.
