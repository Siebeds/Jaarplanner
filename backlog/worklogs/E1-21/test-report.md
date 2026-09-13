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
