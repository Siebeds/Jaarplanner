# E1-21 — test-runner report (round 1, 2026-09-13, on `5397e98`)

*Pasted by the orchestrator: the test-runner could not write files in its harness and returned its report as a message.*

**Verdict: FAIL** — every criterion passes except the done-when's last clause, "minimumdoel-level coverage returns real
results", which is **not demonstrable**: nothing computes coverage per minimumdoel (that is E5-04, unbuilt). No defect in
E1-21's own code. *Owner ruling of 2026-09-13, taken after this report:* E1-21, E1-12, E1-03 and E1-04 close on the
**input** (goals concorded to loaded minimumdoelen); the clause "minimumdoel-level coverage returns real results" moves to
E5-04, which owns the computation.

**Mode:** unit + integration tests, plus a live run (real API against KOV, own PostgreSQL container), an independent count
of the live data, and an old-vs-new HTML-converter comparison.

| Criterion | Result | Evidence |
|---|---|---|
| G goals of every in-scope discipline import through a preview and an apply | PASS | Live: preview (`{}`) named version 1.2, 13 disciplines, 0 problems, wrote nothing (0 keys, 0 version rows). Apply (`1.2`): 5,582 added + 253 updated in place = 5,835. A second apply changed nothing. `OpstapApiLiveImportTests` 1/1. |
| Concorded to the imported minimumdoelen | PASS | DB: 4,983 goals concorded to 992 distinct minimumdoelen. Independent count of the live data: 5,835 G, 0 with two refs, 0 unresolved, same six unreached. Leerplandoelen before minimumdoelen: **409**, nothing written. |
| Proven against PostgreSQL | PASS | Full integration suite: 336 passed, 1 skipped (live), 0 failed. Rollback on a refusal in a later discipline passes. |
| Minimumdoel-level coverage returns real results | NOT DEMONSTRABLE → FAIL (moved to E5-04 by owner ruling) | No computation exists (`DekkingController.cs:74-76`, `DekkingWeergave.cs:169-172`, E5-04 `[ ]`). Input only: a covered G goal carries its ref; the register finds `4-2.1.7` and returns 0 for `K-1.2.6` and `6-7.1.6`. |
| G only, skipped sets counted per set | PASS | `+ 105, A 67, P 762, S 436, V 247, Z 28`, matching the independent count. |
| Mapping in one place (`9-1`→`9.1`, jaarFase, ref from `minimumGoals[0]`) | PASS | Disciplines stored `9.1/9.2/9.3`, codes keep `9-1.…`; jaarFase distribution matches exactly. |
| Description split | PASS | voorbeelden 2,272 / woordenschat 284 / toelichting 1,905 in the DB, as claimed. The no-words-lost check was not redone. |
| `OpstapHtml` faithful (the 43 previously refused) | PASS | Old converter refuses 43 G goals, new 0; only `2.3.GL1.15` and `2.4.GL4.8` convert differently; all 1,271 minimumdoel fragments identical; no markup or control characters in the DB. |
| Pinned numbered snapshot, version and hash stored | PASS | Migration applies cleanly; `opstapversies` holds `1.2 \| 8f470a12-…`; `latest` → 400. |
| Goal key stored; renumbering reported | PASS | All 5,835 carry a key. Renumbering cannot occur within one version, so it is covered by 4 unit tests only (e.g. `Een_hernummerd_doel_wordt_als_een_gebeurtenis_gemeld`). |
| Discipline selection honoured | PASS | API restarted with only discipline 2 selected: the other 12 came back skipped with a Dutch notice each. |
| Excel-loaded goals updated in place, not duplicated | PASS | Real `Wiskunde.xlsx` (319) then the API: 253 updated, 5,901 rows / 5,901 distinct codes; the 63 P/S/+ goals untouched and unflagged; only `2.1.GK3.6`, `2.4.GK2.4`, `2.4.GK3.7` flagged. |
| The six minimumdoelen without a G goal not shown as teacher gaps | PASS by absence | Nothing shows minimumdoel gaps yet; E5-04 must keep this rule. |
| Live contract test | PASS | Unit 4/4 and integration 1/1 with `JAARPLANNER_LIVE_OPSTAP=1`. |
| 400 / 401 / 409 / 502 | PASS | On the running app; 502 (unreachable host) gives the Dutch message and writes nothing. |
| Shared Excel import path not regressed | PASS | No existing assertion weakened; a real Excel import behaves as before; the one deliberate change is pinned by a test. |
| Gates | PASS | Full Release rebuild 0 warnings; format exit 0; unit 1,090 passed / 4 skipped / 0 failed; integration as above. |

## Findings outside the criteria
- **Major risk — the Excel route can now undo an API import.** After the API import, previewing a re-import of
  `Wiskunde.xlsx` shows 253 goals reverting to Excel text with their minimumdoel ref cleared, and 1,193 API goals flagged
  as no longer in Op.stap. The Excel screen (`Opstapimport.tsx`) is still reachable. (Same as the antagonist's MAJOR 1.)
- Worklog: "66 non-G goals in Wiskunde" — the real file has 63 (+ 17, P 38, S 8).
- Worklog: "the second apply leaves every diff empty" holds only on a database with no Excel history; with Excel rows
  present, every repeat apply keeps reporting the three flagged Wiskunde codes as gone (behaviour predating this story).

Cleanup: container `jp-e121-tr` stopped, port claims released; the owner's `jaarplanner-db` untouched.

---

# Round 2 (2026-09-13, on `01d5189`): PASS

*Pasted by the orchestrator; the test-runner's harness had no file-writing tool.* Mode: unit + integration, plus a hand
check against the running API (worktree Release build, own PostgreSQL on 55435, development sign-in, real KOV calls, the
real `assets/opstap-xlsx/Wiskunde.xlsx`). Judged against the re-scoped *Done when* (owner ruling R1, 2026-09-13).

| # | Criterion | Result | Evidence |
|---|---|---|---|
| 1a | After an API import, the Excel preview and apply answer 409 with the Dutch detail | PASS | After the minimumdoelen and leerplandoelen applies of 1.2 (all 200), `Wiskunde.xlsx` got **409** on both `/api/opstap-import/voorbeeld` and `/api/opstap-import`: type `urn:jaarplanner:opstap-import:excel-na-opstap-api`, title "Import niet doorgevoerd", detail "De leerplandoelen komen nu uit Op.stap, via Katholiek Onderwijs Vlaanderen, en niet meer uit een Excel-bestand. Daarom is dit bestand niet ingelezen. Er is niets gewijzigd." |
| 1b | …and nothing changes | PASS | Identical before/after: leerplandoelen 5,901 rows, whole-row md5 `60150762…a11`; minimumdoelen 998, md5 `634b8e53…cda`; 4,983 concorded to 992; `niet_meer_in_opstap` 3 / 0; 5,835 keys; 1 `opstapversies` row. |
| 1c | Excel route still works without an API import | PASS | Same DB before any API import: preview and apply 200, 319 added (+ 17, G 256, P 38, S 8), 0 problems. |
| 1d | Guard pinned by tests | PASS | `Na_een_api_import_weigert_de_excelroute_en_wijzigt_niets` (PostgreSQL); unit `Een_excelbestand_na_een_api_import_wordt_geweigerd`, `Na_een_api_import_blijft_de_api_zelf_importeren`; guard in the one writer (`OpstapImportService.cs:150`), keyed on `Herkomst.Bestand` only. |
| 2a | Table of images refused | PASS | `Een_tabel_van_afbeeldingen_is_niet_leeg_en_wordt_geweigerd` (a one-cell image table still becomes `[afbeelding: appel]`). |
| 2b | Link-only cell keeps its address | PASS | `Een_cel_met_alleen_een_link_zonder_tekst_houdt_het_adres`. |
| 2c | Nested `ol` refused | PASS | `Een_geneste_geordende_lijst_wordt_geweigerd` (`ul` › `ol` kept as `- x\n1. y`). |
| 2d | Snapshot 1.2 still 0 refusals | PASS | Live test passed; `problemen` 0 in all 13 disciplines; `[lege tabel` still on exactly `2.2.GL2.2`. |
| 3a | No redirects on either KOV client | PASS (no live 3xx) | `Geen_van_beide_bronnen_volgt_een_doorverwijzing` asserts `AllowAutoRedirect == false` on the real registration; `KovHttp.cs:25` turns any non-success, 3xx included, into `OpstapBronFout` → 502. |
| 3b | `GemeenschappelijkBuitenBereik` | PASS | Unit test, plus a live probe: stored P goal `2.1.PF2.1` relabelled G → preview lists it under `gemeenschappelijkBuitenBereik`, `vereistReview` true, the Dutch notice, row unchanged. |
| 4 | Every round-1 PASS still holds | PASS | Headline counts below. |
| R1 | Backlog texts carry the owner ruling | PASS | E1-21 *Done when* note; E5-04 (`E5-dekking-export.md:92`) owns the clause. Nit below. |

**Headline counts (live, 1.2):** 5,582 added + 253 updated = 5,835 G, all keyed; 0 refused; 13 disciplines; version 1.2,
hash `8f470a12-231f-5817-7a8b-6582195e2583`; 4,983 concorded to 992; skipped + 105, A 67, P 762, S 436, V 247, Z 28.

**Gates:** Release build 0 warnings; format exit 0; unit 1,103 passed / 4 skipped / 0 failed; full integration on
PostgreSQL 337 passed / 1 skipped / 0 failed (2 min 47 s); live 4/4 unit and 1/1 integration.

**Nits (non-blocking):**
- `OpstapImportFoutTests.cs:102-109`: the new test was inserted between an existing `<summary>` and its `[Fact]`, so one
  test carries two summaries and `Code_in_andere_discipline_uit_de_api_noemt_geen_bestand` lost its comment.
- `backlog/E1-curriculum-content.md:322`: the original "…returns real results. That last clause is also what closes E1-12,
  E1-03 and E1-04." stands unstruck before the re-scoping note.

Cleanup: API and container `jp-e121-tr2` stopped, port claims released, the owner's `jaarplanner-db` untouched.

---

# Round 3 (2026-09-13, on `66a26ac`): PASS

*Pasted by the orchestrator.* Unit + integration suites, live KOV tests, two mutations and a scratch probe (all reverted).

| # | Item | Result | Evidence |
|---|---|---|---|
| 1a | Release build | PASS | `--no-incremental`: 0 warnings, 0 errors. |
| 1b | Format | PASS | `--verify-no-changes` exit 0. |
| 1c | Unit | PASS | 1,105 passed, 4 skipped (live), 0 failed. |
| 1d | Full integration on PostgreSQL | PASS | Own container on 55437: 338 passed, 1 skipped (live), 0 failed, 3 min 22 s. |
| 2 | Live (`JAARPLANNER_LIVE_OPSTAP=1`) | PASS | Unit 4/4: snapshot 1.2 still 0 refusals after the `IsLeeg` change; 5,835 G, 4,983 concorded to 992, skipped + 105, A 67, P 762, S 436, V 247, Z 28, no `</` in stored text. Integration `OpstapApiLiveImportTests` 1/1 (21 s): 998 minimumdoelen, 5,835 goals, 4,983→992, all keyed, the same six without a G goal, repeat apply changes nothing. |
| 3a | 409 exact sentence | PASS | `Excel_na_een_api_import_zegt_alleen_wat_waar_is` pins it word for word; the PostgreSQL test checks the HTTP detail on preview and apply. Old sentence only in historical worklogs. |
| 3b | svg/iframe table refusal | PASS, mutation killed | Restoring the old `img|a` check makes both cases of `Een_tabel_met_een_ander_element_dan_opmaak_is_niet_leeg_en_wordt_geweigerd` fail. |
| 3c | Concordance both directions | PASS, mutation killed | `MinimumdoelRef == sleutel` → `Code == sleutel` makes `Na_de_import_beantwoordt_de_concordantie_beide_richtingen` fail (expected two codes, got none). Rows written through the real endpoint, read through DI's `IConcordantieQuery`. |
| 4 | Round-2 results still hold | PASS (from tests) | Relied on the PostgreSQL test (same HTTP pipeline) rather than the running app. |

Round-2 nits: both fixed.

**Behaviour note (not a defect):** the stricter `IsLeeg` also applies to the markup between rows and cells
(`OpstapHtml.cs:383`, `:392`), so a table with `<colgroup>`/`<col>` is now refused as a whole (probe:
`<table><colgroup><col><col></colgroup><tr><td>a</td><td>b</td></tr></table>` was `a | b`, now refused). It refuses rather
than alters, and 1.2 has none, but a later snapshot using `colgroup`/`col` would lose whole goals.

Cleanup: mutations and probe reverted (clean at `66a26ac`), container `jp-e121-tr3` removed, claim `port-55437` released.
