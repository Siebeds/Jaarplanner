# E1-15 — Test report (round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit over HTTP against real PostgreSQL 17) + a manual API run against a real `dotnet run` host
**Branch/commit:** `story/E1-15-opstap-import-trigger` @ `57a21b1`
**Playwright:** deliberately not used. This story is server-side by design; the `/import` screen is E1-13. Verified instead that `frontend/` is untouched (`git diff main...HEAD -- frontend/` is empty), so the absence of UI is scope, not a defect.

## Criteria checked

Acceptance criteria verbatim: *an initial Op.stap import and a re-import can both be triggered in a deployed app; the re-import returns its review report; the curriculum stays read-only (Art. III.1) and existing jaarplannen are untouched (Art. III.4).*

- **"an initial Op.stap import ... can be triggered in a deployed app"** -> **PASS** (as scoped; see the E1-12 judgment below)
  `Eerste_import_laadt_de_leerplandoelen_in` passes against real Postgres and asserts on rows read back through a *separate* `DbContext` (`Tekst`, `Domein`, `DisciplineNummer`, `NietMeerInOpstap == false`): rows only the real controller -> parser -> import service -> Npgsql pipeline could have written.
  Independently reproduced by hand against a real host (my own port 5231, my own throwaway database `jp_e115_verify`, since dropped): `POST /api/opstap-import` with a 2-row Art. VII.1 A-M workbook returned `200 ... "toegevoegd":["WIS-1","WIS-2"] ... "toegepast":true`. The host ran in the **Production** environment, which is stronger evidence for "deployed app" than a Development run.

- **"a re-import can be triggered"** -> **PASS**
  `Herimport_van_hetzelfde_bestand_wijzigt_niets` and `Herimport_rapporteert_de_gewijzigde_velden_en_werkt_de_inhoud_bij` pass. Reproduced by hand: committing a reworded file returned `gewijzigd:[{code:WIS-1, velden:[{veld:Tekst, oudeWaarde:"De leerling telt tot 20.", nieuweWaarde:"De leerling telt tot 100."}]}]`, and re-running the same file returned `ongewijzigd:["WIS-1"]` (idempotent on `code`).

- **"the re-import returns its review report"** -> **PASS**
  The `OpstapHerimportDiff` is returned in the response body as `diff`, carrying `toegevoegd`, `gewijzigd` (field-level `veld`/`oudeWaarde`/`nieuweWaarde`), `ongewijzigd`, `verdwenen`, `verdwenenMaarGekoppeld` (with `aantalKoppelingen`), `overgeslagen`, `opmerkingen`, `isLeeg` and `vereistReview`. Confirmed in raw JSON from the live host, not only in test assertions.

- **"the curriculum stays read-only (Art. III.1)"** -> **PASS**
  `git diff main...HEAD -- backend/src/Jaarplanner.Infrastructure/OpstapImport backend/src/Jaarplanner.Application` is **empty**: the sanctioned importer is genuinely unchanged, not merely claimed to be. No write path was added to the Api project (a search for `SaveChanges` and `context.Add|Remove|Update` under `Jaarplanner.Api` matches only *comments*). The controller's constructor takes `IOpstapParser` + `IOpstapImportService` and no `DbContext`, so it structurally cannot write.

- **"existing jaarplannen are untouched (Art. III.4)"** -> **PASS**
  `Verdwenen_maar_gekoppeld_doel_wordt_gemarkeerd_en_de_koppeling_blijft` does what it claims, and crucially asserts the koppeling's **status**, not merely the row's survival: `Assert.Equal("Manueel", koppeling.GetProperty("status").GetString())`. Both the import and the themadoel creation go over HTTP, so the `Restrict` FK in play is the production one.
  Reproduced by hand end-to-end: created thema `Meten en wegen`, anchored a themadoel on `WIS-1` (koppeling id `3ec409dc...`, status `Manueel`), then re-imported a file without `WIS-1`. Result: `verdwenenMaarGekoppeld:[{"code":"WIS-1","aantalKoppelingen":1}]`, `vereistReview:true`, and `GET /api/themas/{id}` still returned the **same koppeling id** with status still `Manueel`. Flagged, not deleted; status intact.
  Corroborated independently: a later empty-file call reported *"De 3 bestaande doelen blijven ongewijzigd"* (WIS-1, WIS-2 and WIS-3 all still present), i.e. no goal was deleted at any point in the session.

### Reachability, the story's central concern

This is the criterion the story exists to enforce, so it was checked specifically rather than taken on trust. **It holds.**

- `PostgresApiFactory` overrides **only** the connection string (it removes the `DbContextOptions` descriptors and re-adds Npgsql pointing at the test database). It stubs no service: the real `Program`, the real DI container, the real migrations, FKs, unique indexes and seed data are all in force. There is no fake parser and no fake import service anywhere in the new tests.
- Every one of the 13 `OpstapImportEndpointsTests` starts at an `HttpClient.PostAsync` against `/api/opstap-import` or `/api/opstap-import/voorbeeld`, and ends either at a row read back through a fresh `DbContext` or at a real Postgres constraint. None shortcut the HTTP boundary. Fixtures address cells through the `OpstapKolom` enum, so the workbook cannot drift from the A-M map.
- The suite would have caught the original defect: with `IOpstapParser` unregistered the host cannot construct the controller, so every test would fail at DI resolution.

## Commands run

| Command | Result |
| --- | --- |
| `dotnet build` | **Build succeeded. 0 Warning(s), 0 Error(s)** |
| `dotnet test --no-build` (no env var) | unit **468 passed / 0 skipped**; integration **59 passed / 51 skipped**, matching the claim exactly |
| `JAARPLANNER_TEST_POSTGRES=... dotnet test --no-build` | unit **468 passed**, integration **110 passed**, **0 failed, 0 skipped**, matching the claim exactly |
| `dotnet test` filtered to the two new classes | **16 passed, 0 failed, 0 skipped** (13 Postgres-backed + 3 seam) |
| `dotnet format --verify-no-changes` | clean, exit 0 |
| `dotnet ef database update` then `database drop --force` | throwaway database `jp_e115_verify` created and dropped |

Connection string: `Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable`.

## Implementer claims, checked one by one

| # | Claim | Verdict |
| --- | --- | --- |
| 1 | Two endpoints, multipart `bestand` + `disciplineNummer`, returning problems plus the diff | **Holds.** Both exercised live; both listed in `/openapi/v1.json` as `post`. |
| 2 | 468 + 110, 0 failed / 0 skipped with the env var; 468 + 59/51 without | **Holds exactly**; both runs reproduced. |
| 3 | The preview writes nothing | **Holds, and verified more strongly than the implementer's own test.** Their test previews into an *empty* table. I previewed the reworded file against a **loaded** database twice: both responses still reported `oudeWaarde:"De leerling telt tot 20."` and `verdwenen:["WIS-2"]`. Had the first preview written, the second would have reported `ongewijzigd`. It did not. |
| 4 | Art. III.4 pinned including the koppeling **status** | **Holds.** The status assertion is explicit (`"Manueel"`), not just row survival. Reproduced by hand. |
| 5 | Art. III.1: importer unchanged, no new write path | **Holds.** Empty diff for the importer and Application; no write path in Api; the controller has no `DbContext`. |
| 6 | `IOpstapParser` was never DI-registered and now is | **Holds.** `git show main:.../DependencyInjection.cs` contains no `IOpstapParser` line; it is registered on the branch. |
| 7 | The E1-12 gap is a 409 with a Dutch explanation, pinned by test | **Holds.** Live: `HTTP 409`, *"Deze leerplandoelen verwijzen naar minimumdoelen die nog niet ingeladen zijn..."*, and `WIS-1` was untouched. Pinned by `Doel_met_concordantie_naar_een_onbekend_minimumdoel_geeft_409_en_wijzigt_niets`. |
| 8 | A wrong `disciplineNummer` was a 500 (23505) and is now a 409 | **Holds for the 23505 case** (live `HTTP 409`, *"bestaan al onder een andere discipline"*, nothing changed). **The adjacent worklog line claiming `discipline 99 -> 400` is only conditionally true**: see Defect 1. |
| 9 | One policy, genuinely applied, authorising everyone on purpose | **Holds.** Exactly **one** `AddPolicy` and exactly **one** `[Authorize]` in the whole backend `src/`; `UseAuthorization()` is present in `Program.cs`. The seam is asserted on **endpoint metadata**, so a third unattributed import route fails the test. That it authorises everyone today is proven by all fourteen of my unauthenticated curl calls succeeding. |

## Judging criterion 1 honestly against the E1-12 caveat

Does *"an initial Op.stap import can be triggered in a deployed app"* hold when a real Op.stap file cannot commit?

**Yes for this story, and no for FR-2.1 as a whole.** The reasoning:

- The criterion tests the **trigger**, which is what this story is scoped to deliver ("FR-2.1/2.5 fail on the trigger, not the logic"). The trigger demonstrably works: real rows committed to real Postgres through a real host, and a re-import that returns its review report.
- The remaining failure is a **missing-data dependency, not a trigger defect**. `Leerplandoel.MinimumdoelRef` is a `Restrict` FK and nothing can insert a `Minimumdoel` yet. That is **E1-12**, already tracked `[!]` and blocked on a source file from directie. The story text explicitly says E1-15 does not unblock E1-03/E1-04. Failing E1-15 for E1-12's missing input would mean failing it for work it was told not to do.
- The failure mode is handled well: a 409 with an actionable Dutch explanation and a guaranteed no-op (the import is a single `SaveChanges`), pinned by a characterisation test, rather than a 500. Fabricating minimumdoel rows from the goal file would have breached Art. III.1, so refusing was the right call.

**This PASS must not be read as FR-2.1 being satisfied.** A real per-discipline Op.stap file mixes MD and G rows in one sheet, so the whole file still fails until E1-12 lands. **E1 remains incomplete and M1 remains unreached.** E1-12 is the gate, exactly as the implementer states.

## Defects (non-blocking: none breaches an acceptance criterion)

- **[low] The unknown-discipline 400 is masked by a misleading 409 once a curriculum is loaded.**
  Repro: import `WIS-1` under discipline `2`, then upload that same file under discipline **`99`**, a discipline that does not exist.
  - *Expected:* `400 "'99' is geen Op.stap-discipline..."`
  - *Actual:* `409 "Een of meer codes uit dit bestand bestaan al onder een andere discipline. Controleer of dit bestand bij discipline 99 hoort."`

  Cause: the primary-key violation (SQLSTATE 23505 on `leerplandoelen`) fires before the discipline FK violation (23503), so `CodeBestaatAlElders` wins the `catch` race. Confirmed to be exactly this: uploading a **fresh** code (`NIEUW-1`) under `99` does return the correct `400`.
  Why it slipped through: `Onbekend_disciplinenummer_geeft_400` runs against an **empty** table, so it only ever exercises the FK path. The realistic operator case is a mistyped discipline number on an already-loaded system, and that case is given advice that cannot help ("check whether this file belongs to discipline 99" when 99 is not a discipline at all).
  Not a criterion failure: nothing is written and it is still a 4xx rather than a 500. Worth a follow-up: validate the discipline number up front, or order the `catch` clauses so the unknown-discipline case wins.

- **[info] A pre-existing em dash in a Dutch string that the trigger now surfaces.** The empty-file notice reads *"Geen geldige leerplandoelen ingelezen voor discipline 2 [em dash] niets toegepast..."*. That em dash is in `OpstapImportService` and is **present on `main`** (E1-05), so the implementer's "no em dashes in any of the new strings" is accurate: they did not author it. But E1-15 makes it reachable by a caller for the first time, so E1-13 must not render it verbatim to a directie. Flagged for the owner's em-dash rule, not as an E1-15 defect.

- **[info] `vereistReview` never clears for a discipline that once lost a goal.** After `WIS-2` disappeared, every later re-import kept reporting `verdwenen:["WIS-2"]` and `vereistReview:true`, including a fully idempotent re-run of the same file. This is pre-existing `OpstapImportService` behaviour surfaced by the trigger, and it means E1-13's review notice would be permanently lit. Not a criterion breach.

## Dutch copy review (requested by the implementer)

All seven `Detail` strings read as natural, non-technical Dutch appropriate for a directie, each naming a concrete next action ("Laad eerst de decretale minimumdoelen in", "Controleer of dit bestand bij discipline 2 hoort"), and each write refusal reassures the reader that nothing changed. **No em dash occurs in any string the controller authors**; the em dashes in that file are all in English XML-doc and code comments, which is what the working agreements prescribe. One nit: the 409 described in Defect 1 gives advice that is wrong for that situation.

## Evidence

- Test output: `16 passed / 0 failed / 0 skipped` for the story's own suite; `468 + 110, 0 failed, 0 skipped` for the full suite with Postgres configured.
- Live-host raw JSON captured for: preview, commit, double-preview-writes-nothing, re-import diff, idempotent re-run, the MD 409, unknown-discipline 400 and 409, wrong-discipline 409, empty-file skip, non-xlsx 400, missing-disciplinenummer 400, thema/themadoel survival, and `/openapi/v1.json`.
- Workbooks were generated to the Art. VII.1 A-M layout (A=Doelsoort, B=LfMD, C=nrMD, E=Code, F=Jaar/fase, G=Domein, H=Subdomein, J=Leerplandoel).
- Cleanup: both verification hosts (ports 5231 and 5232) terminated, and `jp_e115_verify` dropped. No parallel agent's database, port or dev server was touched.
