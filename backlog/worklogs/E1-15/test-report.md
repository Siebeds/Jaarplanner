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

---

# E1-15 — Test report (round 2, after fix round 1)

**Verdict:** PASS
**Mode:** unit/integration (xUnit over HTTP against real PostgreSQL 17) + a manual API run against a real `dotnet run` host
**Commit:** `cd426cf`, on top of the `57a21b1` that passed round 1
**Method:** reviewed the `57a21b1..cd426cf` delta rather than starting over, then re-ran all three gates and re-executed the round-1 manual evidence that the delta could have invalidated.

## Gates (re-run, actual counts)

| Command | Result | vs claimed |
| --- | --- | --- |
| `dotnet build` | **Build succeeded. 0 Warning(s), 0 Error(s)** | matches |
| `dotnet test --no-build` with the Postgres env var | **472 unit passed, 112 integration passed, 0 failed, 0 skipped** | matches exactly (round 1: 468 + 110) |
| `dotnet format --verify-no-changes` | clean, exit 0 | matches |

## The five high-risk claims

### 1. The sanctioned importer is no longer untouched: honest, and the table is accurate

Round 1's Art. III.1/III.4 evidence rested on the importer's `git diff` being empty. That is no longer true, and the worklog says so plainly and first, which is the right way to report it. I checked the changed/not-changed table line by line against the diff:

- **Changed, as stated:** a preflight (`ControleerVoorwaardenAsync`) before any diffing; a `try/catch` around its own `SaveChangesAsync` translating a SQLSTATE into a typed fault; two Dutch `opmerkingen` notices reworded.
- **Not changed, as stated, and confirmed in the diff:** the diff computation (`toegevoegd`/`gewijzigd`/`ongewijzigd`/`verdwenen`/`verdwenenMaarGekoppeld`), the flag-and-keep default, the review-flag handling, the out-of-scope guard, the empty-file guard and the discipline-selection seam. The preflight is invoked **after** both guards and returns immediately when `inkomend.Count == 0`, so neither guard lost precedence.
- Every edit is a refusal or a diagnostic *around* the write, not a change to the write. **The table is honest.**

**Art. III.4 re-verified, not assumed.** `Verdwenen_maar_gekoppeld_doel_wordt_gemarkeerd_en_de_koppeling_blijft` still asserts the koppeling status (`Assert.Equal("Manueel", ...)`, line 175) and still passes; the integration test file is **additions-only**, with no deleted or modified line anywhere in it. Reproduced by hand at `cd426cf`: koppeling id `2f599080...` survived a re-import that dropped `WIS-1`, still `Manueel`, with `verdwenenMaarGekoppeld:[{"code":"WIS-1","aantalKoppelingen":1}]` and `verdwenen:["WIS-2"]`. Identical to round 1.

**A previously-succeeding file still imports exactly the same rows.** The same `v1.xlsx` I used at `57a21b1` returned a **byte-identical** body: `"toegevoegd":["WIS-1","WIS-2"] ... "vereistReview":false,"toegepast":true`.

### 2. The new preflight: verified on a loaded table, and my defect is fixed at the root

- **My round-1 defect is gone.** A commit with `disciplineNummer=99` against a table that **already holds those codes** now returns `400 "'99' is geen Op.stap-discipline. Gebruik het officiele disciplinenummer..."`: the useful message, and no longer the misleading "andere discipline" 409. Fixed at the root (the discipline is checked first) rather than patched at the catch site. The wording is byte-identical to what I tested at `57a21b1`.
- **A test now covers the loaded-table case.** `Onbekend_disciplinenummer_geeft_400_ook_als_de_codes_al_geladen_zijn` uploads `WIS-1` first, then re-uploads under `99`, and asserts both `400` **and** `Assert.DoesNotContain("andere discipline", detail)`. That negative assertion is what stops the regression, and the old empty-table test is retained alongside it.
- **Preview/commit parity verified live.** For the missing-minimumdoel case and the wrong-discipline case, the preview and the commit returned the **same status and character-identical `detail`**. Pinned by `Voorbeeld_weigert_precies_wat_de_definitieve_import_weigert`, which asserts detail equality and that nothing was written.
- Verified independently that no refusal wrote anything: after all six refusal calls, re-importing `v1.xlsx` reported `ongewijzigd:["WIS-1","WIS-2"]` and `isLeeg:true`, and the empty-file notice counted exactly *"De 2 bestaande doelen"*.

### 3. The "15 modified unit tests": not one assertion was changed

This was the item most likely to hide a weakened test, so I checked it mechanically rather than by reading prose. **The delta for both unit-test files contains no deleted or modified line at all: it is additions-only.**

- `OpstapImportServiceTests`: `[Fact]` count 11 -> 15 (+4 new preflight tests). The only change to existing material is the **fixture constructor**, which now seeds one `Discipline` row.
- `OpstapImportDisciplineSelectieTests`: `[Fact]` count 10 -> 10 (**unchanged**). Only the constructor changed, seeding two `Discipline` rows.

So no assertion was relaxed, removed, or edited to match new behaviour, and no expectation was re-baselined. The change makes the EF in-memory fixture *more* faithful to real PostgreSQL, which has always required a discipline row via the `Restrict` FK and which the in-memory provider silently ignores: the same fidelity gap `PostgresTestDatabase` exists for. It strengthens rather than weakens.
The obvious failure mode of such a preflight is also guarded: `A_loaded_minimumdoel_makes_the_concordance_importable` asserts a *positive* outcome, so "MD rows are refused" cannot silently degrade into "MD rows are never importable".

### 4. The `Probleemtitels` consolidation: safe, a pure literal-to-constant substitution

All four converted call sites (`SchoolcontentImportController`, `AiMatchingExceptionHandler`, `PlanningExceptionHandler`, `SchoolcontentExceptionHandler`) change only `Title = "Ongeldige aanvraag"` to `Title = Probleemtitels.OngeldigeAanvraag` (and `"Niet gevonden"` to `Probleemtitels.NietGevonden`). The constant values are character-identical to the literals they replace, so **no other controller's response changed shape or wording**. The suites covering those call sites pass inside the green 472 + 112 run.

### 5. `Npgsql` absent from the Api layer: substantively true, the claim is literally imprecise

The grep does **not** return nothing: it returns **5 lines, every one of them a comment** (four prose mentions plus one comment containing `UseNpgsql`). Filtering comments out leaves **zero** matches; there is no `using Npgsql` and no `using Microsoft.EntityFrameworkCore` anywhere in the Api; and the controller's three `DbUpdateException` catches and three SQLSTATE predicates are gone. The substance holds (the Api names no EF Core or Npgsql type) while the wording of the claim does not. Worth correcting only so a future reader who runs the grep is not alarmed.

**Statuses and titles a caller sees are unchanged; two `Detail` messages were deliberately reworded.** Compared against what I captured at `57a21b1`:

| Case | Status | Title | Detail |
| --- | --- | --- | --- |
| Unknown discipline | 400, unchanged | `Ongeldige aanvraag`, unchanged | **identical wording** |
| Missing minimumdoelen (E1-12) | 409, unchanged | `Import niet doorgevoerd`, unchanged | **reworded**: now names the refs (`...: 4-12`) |
| Code in another discipline | 409, unchanged | `Import niet doorgevoerd`, unchanged | **reworded**: names each code with its current discipline (`WIS-1 (discipline 2)`) and adds the ratified-policy sentence |

Both rewordings are improvements (more actionable, offenders named, truncated after five) and both are **disclosed in the worklog**, which says the messages "got better" rather than claiming they were unchanged. No test was pinned to the old wording. I record it because the brief asked for wording to be verified unchanged: it is not, by design and with disclosure.

**One genuine, minor shape change the worklog does not mention.** The two refusal responses now come from `IProblemDetailsService` via the exception handler instead of `Conflict(new ProblemDetails ...)` in the controller, so they gained `type` and `traceId` fields. Controller-raised validation 400s still return only `{detail, status, title}`. Both envelopes are RFC 7807-valid and the addition is purely additive, but the import endpoints now answer two slightly different error envelopes depending on which layer refused. Harmless for a client that reads `detail`; worth E1-13 knowing.

## The judgment call on FR-2.5: which state serves the review step better?

I tested both states, so this is a view rather than a pass/fail.

**The new behaviour is better, and I would not trade back.** FR-2.5's preview exists so a reviewer can decide whether to commit. At `57a21b1` a preview of a real Op.stap file returned `200` with a populated `diff.toegevoegd` and `vereistReview:false`: an answer that reads as "this is ready, go ahead" for a file the very next call rejected outright. That is not merely less information, it is **information pointing the wrong way**, and E1-13 clause 6 would have rendered it as a green light. The parity property (the preview refuses exactly what the commit refuses) is what makes a two-step flow trustworthy at all; without it the first step is decorative.

**Is the 409 still actionable for a directie member? Yes.** It names the blocking refs (`4-12`), states the cause in plain Dutch, gives the next action (*"Laad eerst de decretale minimumdoelen in."*) and reassures that nothing changed. A non-technical reader learns what is wrong, what to do, and that they have broken nothing. That is more actionable than a list of codes that would have been added.

**The cost is real and correctly stated.** While E1-12 is open, a preview cannot tell a directie member *how much* a real file would add, so it cannot be used to size an import or sanity-check a downloaded file. The implementer states this plainly instead of presenting a pure win, which is the right disclosure. Two things limit it: the loss is confined to files carrying MD concordance (non-concorded files still preview fully, as I verified), and it disappears when E1-12 lands.

**My one reservation.** The 409 does not distinguish "your file is bad" from "the system is not ready yet", and it is the latter. Rendered raw by E1-13, a directie member could reasonably conclude the file they just downloaded from Katholiek Onderwijs Vlaanderen is broken. That is an E1-13 presentation concern, not a reason to hold E1-15, but it should be carried forward.

## What no longer holds from my round-1 report

Stated explicitly, since round 1 leaned on some of it as evidence:

1. **"The sanctioned importer is genuinely unchanged, not merely claimed to be"** is no longer true. `OpstapImportService` gained the preflight, a SQLSTATE translation and two reworded notices. My Art. III.1/III.4 conclusions still hold, but they now rest on reading the delta and re-running the behaviour rather than on an empty diff.
2. **Defect 1 (the masked unknown-discipline 400)** is **fixed and regression-tested**. Closed.
3. **The `[info]` em dash in the empty-file notice** is **fixed**. Both notices were rewritten rather than merely de-dashed; I confirmed live that the empty-file notice now contains no em dash.
4. **The `[info]` `vereistReview` never clears** is still true, deliberately not fixed here, and filed on E1-13 clause 6. Re-observed at `cd426cf`.
5. **"Thin controller / Art. VIII-clean"**: round 1 repeated the implementer's framing. The fix round corrects it. The controller injects Infrastructure-resident ports, which the layering forbids; this is now stated in the controller's own doc comment and filed as **E7-13** with its blast radius. The honest position is that the Api names no EF/Npgsql type but is not fully Art. VIII-clean.

## Residual observations (none blocking)

- The worklog says "the **24** pre-existing Op.stap unit tests still pass unmodified except for their fixtures" while the same section says the preflight broke **15**; the two files hold 21 pre-existing facts between them. The numbers are loose. The substance (no assertion edited) is what I verified, and it holds.
- The dual error-envelope shape noted under claim 5.
- `CLAUDE.md` still says "ADR-0001...0020" while 0021 and now 0022 exist. The implementer flagged it and deliberately did not edit the project's instruction file. Agreed: that is the owner's call, and the staleness pre-dates this story.

## Verdict

**PASS.** All five acceptance criteria still hold, verified against the new code rather than inherited from round 1. My round-1 defect is fixed at the root and pinned by a test carrying a negative assertion. No test was weakened: both unit-test files are additions-only. The consolidation touched four files outside the story without changing any response. The gates reproduce exactly (472 + 112, 0 failed, 0 skipped). The FR-2.5 trade-off is a net improvement, and it is disclosed rather than sold.

The **E1-12 judgment from round 1 stands unchanged**: the trigger works, but a real Op.stap file still cannot land, so **FR-2.1 is not satisfied, E1 is not complete and M1 is not reached.** The fix round makes that limitation *more* visible, because the preview now reports it too.

Cleanup: verification host on port 5241 terminated and the throwaway database `jp_e115_r2` dropped. No parallel agent's port, database or dev server was touched.

---

# E1-15 — Test report (round 3, final verification on the merged branch)

**Verdict:** PASS
**Mode:** unit/integration + a manual API run against a real `dotnet run` host, plus frontend gates for the merged state
**Tree:** `C:\source\Jaarplanner`, branch `feature/e1-curriculum-content` at **`a6941fc`** ("Merge E1-15: the Op.stap import trigger"), which contains E1-15 fix round 2 (`43a38eb`) and E1-16 (`f0330ed`).
**Scope:** narrow, per the brief: gates on the merged tree, round 2's two code fixes, the runtime-only projection question, and the E1-15/E1-16 merge interaction.

## Gates on the merged tree (exit codes captured directly, not through a pipe)

| Command | Exit | Result |
| --- | --- | --- |
| `dotnet build` | **0** | **Build succeeded. 0 Warning(s), 0 Error(s)** |
| `dotnet test --no-build` with `JAARPLANNER_TEST_POSTGRES` | **0** | **484 unit + 133 integration passed, 0 failed, 0 skipped** |
| `dotnet format --verify-no-changes` | **0** | clean |
| `corepack pnpm lint` (frontend) | **0** | `eslint . --max-warnings 0 && tsc --noEmit`, clean |
| `corepack pnpm test` (frontend) | **0** | **12 test files, 174 tests passed** |
| E1-15's own suite, filtered | **0** | **33 unit + 18 integration passed, 0 skipped** |

These are my numbers, measured independently. They agree with the coordinator's reported build result. The `0 skipped` on the integration assembly is the important part: it confirms the Postgres-backed tests actually ran rather than skipping.

## The file-lock incident, and the transferable lesson

My first `dotnet build` in the main tree failed with **6 errors**, all `MSB3027`/`MSB3021` **file-copy** failures: a leftover `Jaarplanner.Api.exe` (PID 64584, listening on **5184**) from the parallel E1-16 session held `Jaarplanner.Application.dll`, `Jaarplanner.Domain.dll` and `Jaarplanner.Infrastructure.dll` in the main tree's `bin`. I identified the process, confirmed it was not mine (my ports were 5231/5232/5241/5251) and **did not kill it**, since a parallel agent is active in this repo.

To make progress without touching another agent's process, I first proved the main tree was exactly `a6941fc` with **no uncommitted tracked changes and no relevant untracked files**, then verified that same commit in my own throwaway `git worktree`, which has its own `bin`/`obj` and no contention. It built with **0 warnings, 0 errors** and gave **484 + 133, 0 skipped**. After the coordinator stopped the stale host I re-ran everything **in the main tree itself** and got byte-identical counts, so the worktree detour changed nothing about the result; both runs are reported above as one.

Two things worth recording because they generalise:

1. **A leftover dev host silently degrades a full-suite run to unit tests only, while still printing "Passed!".** The copy into `Api/bin` fails, so the integration test project never builds, and `dotnet test` then reports only the unit assembly, in green. The defence is to assert on the *shape* of the run, not just its colour: I checked that **both** assemblies appear in the output and that `Skipped` is 0. Had I only read "Passed!", a unit-only run would have looked like a full one.
2. **`dotnet build 2>&1 | tail` hides the failure.** A shell pipeline reports the exit status of the *last* command in the pipe, so `... | tail` and `... | grep` return 0 even when the gate failed. My earlier rounds used exactly that idiom. For this round I redirected each gate to a file and captured `$?` **before** filtering, which is why the 6 errors were visible as errors rather than as a truncated tail. Any gate whose result is quoted as evidence should be measured this way.

## Round 2's two code fixes (which I had not previously seen)

### One Dutch message source per `OpstapImportFoutSoort` — verified, and the reachable Dutch is unchanged

The three refusals now come from static factories (`OpstapImportFout.OnbekendeDiscipline` / `.OntbrekendeMinimumdoelen` / `.CodeInAndereDiscipline`); `MaxGenoemdeVoorbeelden` and the truncation helper moved onto the fault, and both call sites (the preflight, which knows the offenders, and `VertaalIntegriteitsfout`, which knows only the constraint) now call the same factory, the latter with an empty detail list.

I verified the claim by composing the factory output by hand from the source and then **against live responses**. All three reachable messages are **character-identical** to what I captured at `cd426cf`:

- `400` / `Ongeldige aanvraag` / *"'99' is geen Op.stap-discipline. Gebruik het officiële disciplinenummer, bijvoorbeeld 1 voor Nederlands en communicatie of 9.2 voor Leren leren."*
- `409` / `Import niet doorgevoerd` / *"Deze codes staan al bij een andere discipline: WIS-1 (discipline 2), WIS-2 (discipline 2). Controleer of dit bestand bij discipline 3 hoort. Er is niets gewijzigd. Verhuist een doel echt naar een andere discipline, dan moet iemand dat eerst bevestigen."*
- `409` / `Import niet doorgevoerd` / *"Deze leerplandoelen verwijzen naar minimumdoelen die nog niet ingeladen zijn: 4-12. Laad eerst de decretale minimumdoelen in. Er is niets gewijzigd aan de doelen die al in de toepassing staan."*

Statuses and titles are unchanged too. **One deliberate change on the unreachable path**, which I note for completeness because it is a wording change even if no user can reach it: the `SaveChanges` race path for `CodeInAndereDiscipline` now *gains* the trailing sentence *"Verhuist een doel echt naar een andere discipline, dan moet iemand dat eerst bevestigen."*, because it shares the factory. That is the point of the fix (one source per case), and it makes the two paths consistent rather than divergent.

The five pins the brief named all pass, run individually:

- `OpstapImportFoutTests.Onbekende_discipline_leest_identiek_uit_beide_paden` — passed
- `OpstapImportFoutTests.Ontbrekende_minimumdoelen_verschilt_alleen_in_de_genoemde_verwijzingen` — passed
- `OpstapImportFoutTests.Code_in_andere_discipline_deelt_de_staart_tussen_beide_paden` — passed
- `OpstapImportFoutTests.Een_lange_lijst_wordt_afgekapt` — passed
- `OpstapImportFoutTests.De_oorspronkelijke_databasefout_blijft_bewaard` — passed

And my own four substring pins plus the parity pin, which are what actually guard the wording:

- `Doel_met_concordantie_naar_een_onbekend_minimumdoel_geeft_409_en_wijzigt_niets` (`Contains("minimumdoelen")`) — passed
- `Zelfde_code_onder_een_andere_discipline_geeft_409_en_wijzigt_niets` (`Contains("andere discipline")`) — passed
- `Onbekend_disciplinenummer_geeft_400` (`Contains("99")`) — passed
- `Onbekend_disciplinenummer_geeft_400_ook_als_de_codes_al_geladen_zijn` (`Contains("is geen Op.stap-discipline")` **and** `DoesNotContain("andere discipline")`) — passed
- `Voorbeeld_weigert_precies_wat_de_definitieve_import_weigert` (preview/commit `detail` equality) — passed

**Preview/commit parity re-confirmed live**, not only by test: for both 409 cases the preview and the commit returned the same status and a character-identical `detail`.

### The `DbUpdateException` kept as inner exception — verified

`OpstapImportFout` gained an optional `innerException` passed to `base(melding, innerException)`, and all three `VertaalIntegriteitsfout` branches now pass `ex`. So the SQLSTATE, constraint name and table survive into the log on the one path that is only reachable through a concurrency anomaly. Pinned by `De_oorspronkelijke_databasefout_blijft_bewaard`, which passes.

## The line that could only fail against a real server — it translates

`ControleerVoorwaardenAsync` now projects `new DoelInAndereDiscipline(l.Code, l.DisciplineNummer)` **after** `OrderBy` and `Take`, i.e. a constructor projection into a `readonly record struct` over a subquery. Whether Npgsql translates that is a runtime question that compilation cannot answer, and the EF in-memory provider would not answer honestly either.

**It translates.** Two independent pieces of evidence:

1. Both `[PostgresFact]` tests that cover it pass against real PostgreSQL: `Zelfde_code_onder_een_andere_discipline_geeft_409_en_wijzigt_niets` and `Voorbeeld_weigert_precies_wat_de_definitieve_import_weigert`. A translation failure would surface as an `InvalidOperationException` and therefore a 500, failing both.
2. **Live against a real host**, the refusal returned the projected values correctly and in order: *"Deze codes staan al bij een andere discipline: **WIS-1 (discipline 2), WIS-2 (discipline 2)**."* Those pairs can only come from the projection materialising, so the query ran server-side and hydrated the struct.

## The merge interaction with E1-16 — clean

**No literal title was reintroduced.** `grep` for `"Ongeldige aanvraag"`, `"Niet gevonden"` and `"Import niet doorgevoerd"` across `backend/src/Jaarplanner.Api` matches only the three `const` definitions in `Probleemtitels.cs` plus one doc-comment mention. All five call sites read the constants.

**E1-16's endpoints answer exactly what they did before, because they never used those titles.** `LeerplandoelenController` sets no `Title` at all: its validation failure is `BadRequest(fout)` returning a bare string, and its not-found is a bare `NotFound()`. Verified live on the merged build:

- `GET /api/leerplandoelen?aantal=5` -> `200`, body keyed `{aantal, overslaan, regels, totaal}`
- `GET /api/leerplandoelen?aantal=99999` -> `400`, body is the plain string `'aantal' must be between 1 and 200 (was 99999).`
- `GET /api/leerplandoelen/GEEN-BESTAANDE-CODE` -> `404` with ASP.NET's default `"title":"Not Found"`
- `GET /api/leerplandoelen/facetten` -> `200`

None of those shapes is one E1-15 defines or changed, so **nothing in E1-16 depends on a shape E1-15 altered**. The new `OpstapImportExceptionHandler` cannot intercept E1-16's responses either: it returns `false` for anything that is not an `OpstapImportFout`, and E1-16 raises none.

**A genuine end-to-end check across the two stories, which the merge makes possible for the first time.** I imported two leerplandoelen through E1-15's trigger and then read them back through E1-16's register: `totaal: 2`, and the rows returned E1-15's imported content intact (`WIS-1 | Gemeenschappelijk | Getallen | "De leerling telt tot 20."`, `WIS-2 | ... | "De leerling splitst tot 10."`). E1-15 writes and E1-16 reads the same rows correctly in the merged state.

**One observation that belongs to E1-16, not to E1-15.** Its 400 returns an **English** bare string (`'aantal' must be between 1 and 200 (was 99999).`) and its 404 returns the framework's English `"Not Found"` title, both reaching a user-facing surface. That is an Art. II.3 question for E1-16, which is already held at `[~]`; I record it only so the merged state is described accurately. It is not an E1-15 defect, it is not caused by the `Probleemtitels` consolidation, and I did not change it.

## Verdict

**PASS.** All five acceptance criteria continue to hold on the merged branch, verified against the merged code rather than inherited from either earlier round. Round 2's two fixes do what they claim: the Dutch has one source per fault and the reachable wording is character-for-character unchanged (confirmed live against three real responses), and the `DbUpdateException` survives as inner exception. The constructor projection that only a real server could reject **translates**, proven both by the two `[PostgresFact]` tests and by the projected values appearing in a live refusal. The merge interaction is clean: no literal reintroduced, E1-16's responses unchanged, and E1-15's writes readable through E1-16's register. All six gates pass with exit code 0, with both test assemblies present and **0 skipped**.

The **E1-12 judgment stands unchanged from rounds 1 and 2**: the trigger works and is now reachable, but a real Op.stap file still cannot commit while no `Minimumdoel` row can exist, so **FR-2.1 is not satisfied, E1 is not complete and M1 is not reached.** Nothing in fix round 2 or the merge changes that, and the preview now reports the blocker rather than hiding it.

Cleanup: my host on port 5251 terminated, throwaway database `jp_e115_final` dropped, and my temporary verification worktree removed (`git worktree list` confirms only the pre-existing worktrees remain). The parallel session's host on 5184 was identified but deliberately left alone; the coordinator stopped it.
