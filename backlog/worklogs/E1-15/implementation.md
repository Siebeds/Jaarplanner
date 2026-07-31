# E1-15 — Trigger the Op.stap import: an invocation surface for FR-2.1/2.5

## Build round 1 — an HTTP trigger for the Op.stap curriculum (re-)import

- **FR / Article:** FR-2.1, FR-2.5 · Art. III.1 (curriculum read-only), Art. III.4 (jaarplannen/links untouched
  + review report), Art. VI.1 + ADR-0011 §2 (authorisation seam), Art. VII.0/VII.1 (taxonomy + A–M mapping),
  Art. VIII (thin Api), Art. II.3 as amended 2026-07-30, Art. X (gates), Art. XIV (disciplines first, and
  "who may import?").

### What was built

| Path | Why |
| --- | --- |
| `backend/src/Jaarplanner.Api/Controllers/OpstapImportController.cs` | **New.** The trigger: `POST /api/opstap-import/voorbeeld` (preview, writes nothing) and `POST /api/opstap-import` (commit, initial import *and* re-import). Multipart form: `bestand` (.xlsx) + `disciplineNummer`. Returns the parse problems plus the `OpstapHerimportDiff` review report. |
| `backend/src/Jaarplanner.Api/Infrastructure/CurriculumbeheerAutorisatie.cs` | **New.** The one authorisation seam: the named policy `Curriculumbeheer`, with a documented always-allow body until E6-01/E6-02 exist. |
| `backend/src/Jaarplanner.Api/Program.cs` | Registers the policy and calls `UseAuthorization()`, so the `[Authorize]` metadata is actually enforced (an endpoint carrying it with no authorisation middleware throws at request time). |
| `backend/src/Jaarplanner.Infrastructure/DependencyInjection.cs` | Registers `IOpstapParser` → `ClosedXmlOpstapParser` (it was **not registered at all**, see below) and documents that `IOpstapImportService` now has a caller. |
| `backend/tests/Jaarplanner.IntegrationTests/Postgres/OpstapImportEndpointsTests.cs` | **New.** 13 tests, HTTP in → real service → real PostgreSQL, asserting on rows only the real pipeline could have written. |
| `backend/tests/Jaarplanner.IntegrationTests/CurriculumbeheerAutorisatieTests.cs` | **New.** 3 tests pinning the seam: the policy exists, both import routes name *it*, and it lets an unauthenticated caller through today. |
| `backlog/README.md` | Logs this story's new backend Dutch strings in the Art. II.3 entry, as that entry instructs each story to do. |

Nothing else was touched. **No frontend file was changed** (see "What was deliberately not built").

### One thing the story did not anticipate: the parser had no DI registration either

`IOpstapParser` was never registered in `DependencyInjection.cs` — only `IOpstapImportService` was. So the
unreachability was one layer deeper than the story text describes: even a controller written against the
import service could not have been constructed, because the thing that produces its input was not resolvable.
Registered as a singleton, matching its stateless school-content sibling.

### Key decisions

1. **HTTP endpoint, not a CLI/admin script.** The story allowed either. HTTP was chosen because E1-13 clause 6
   has to render the review notice, and a CLI would need a second surface built later; because the school-content
   importer already establishes the exact idiom (`POST …/voorbeeld` then `POST`), so consistency was free; and
   because "can be triggered in a deployed app" is provable end-to-end by test only through the host.

2. **The authorisation seam is a single ASP.NET Core policy.** `CurriculumbeheerAutorisatie.Beleid` =
   `"Curriculumbeheer"`, applied with one `[Authorize(Policy = …)]` on the controller. **It currently
   authorises everyone, and it cannot do otherwise:** the API registers no authentication scheme (E6-01,
   Entra ID) and there is no role matrix (E6-02), so there is no authenticated principal to test a role
   against, and E7-11 already tracks "the API is unauthenticated" as a `[!]` deployment gate. The policy body
   is therefore `RequireAssertion(_ => true)` — deliberately *not* `RequireAuthenticatedUser()`, which with no
   scheme registered would fail every request and leave the import unreachable, i.e. reintroduce the exact
   defect this story removes. What E6-02 changes: the assertion becomes the matrix-driven requirement
   (expected `Beheerder`/directie, Art. VI.1) in that one file, and every endpoint naming the policy inherits
   it. No client-side gating was added anywhere: ADR-0011 rejects it and it would be security theatre.
   Three tests pin the seam so it cannot silently evaporate, including one that asserts the "allow everyone"
   behaviour explicitly — when it flips to 401/403 that test must be updated on purpose.

3. **E1-12 does *not* share this surface. It gets a sibling route.** Decision and justification:
   - The artefacts differ in kind. This endpoint takes **one per-discipline Op.stap goal Excel** whose layout is
     the Art. VII.1 A–M map, and it *requires* a `disciplineNummer` because the file has no discipline column.
     The decreed eindtermen are a **single, discipline-less source** with different columns
     (`ref`/`leeftijd`/`nr`/`omschrijving`), a different identity (`ref`, not `code`), and no concept of
     "disappeared but still linked by a themadoel".
   - Sharing would mean a `soort` discriminator that forks the parser, the diff type *and* the response
     contract: two endpoints wearing one URL, which is harder to review than two URLs.
   - It would also teach the wrong mental model. The two imports have a **required order** (minimumdoelen
     first, otherwise MD-concorded leerplandoelen cannot commit — see finding below), and one upload box
     labelled "curriculum" hides that.
   - What E1-12 **should** reuse, and what is documented for it here: the `Curriculumbeheer` policy (the class
     comment names E1-12 as its expected second consumer), the multipart + `voorbeeld`/commit two-step, the
     `isBestandGeldig` / `isVolledigVerwerkt` split, and the ProblemDetails conventions. So the *seam* is
     shared; the *endpoint* is not.

4. **The re-import logic was not touched.** No behaviour change to `OpstapImportService`, the diff, the
   flag-and-keep default, the empty-file guard or the discipline seam. The controller parses, delegates and
   maps faults to answers.

5. **Discipline scope stays configuration.** The controller passes the caller's discipline number to the
   parser and lets `IDisciplineSelectie` (`Opstap:DisciplineSelectie`, E1-06/ADR-0019) decide whether it is in
   scope. No discipline list is compiled into the trigger, and a test drives an out-of-scope discipline
   *through HTTP* with the config set to a starter selection.

6. **`isBestandGeldig` vs `isVolledigVerwerkt`, kept separate** — the split E1-07's audit forced on the other
   importer. An Op.stap file can parse with zero problems and still change nothing (out-of-scope discipline, or
   no valid rows), reported as `diff.overgeslagen` + `opmerkingen`. One collapsed "OK" flag would tell a
   reviewer that a skipped import succeeded.

### Language classification (Art. II.3, amended 2026-07-30)

Logged in full in the Art. II.3 entry of `backlog/README.md`. Summary: **7 Dutch `ProblemDetails.Detail`
strings** (4 request validations + 3 write refusals) and **1 new Dutch `Title`** — all of them actionable by
the person running the import, who for reference-data administration is directie. **Deliberately English:**
`OpstapRijProbleem.Reden`, the per-row parse diagnostics carried in the response. A malformed row in the
*official* Op.stap file cannot be fixed by anyone using this app, so it is an operator diagnostic. That makes
this the first place where two row-level diagnostics are classified differently based on **who authored the
file** (teacher-authored school-content rows → Dutch; Op.stap rows → English). E1-13 must render them without
"fixing" that. No em dashes in any of the new strings.

### Tests added

Postgres-backed, over HTTP (`OpstapImportEndpointsTests`, 13):

| Test | What it pins |
| --- | --- |
| `Eerste_import_laadt_de_leerplandoelen_in` | FR-2.1: rows land, with official content, discipline FK and `NietMeerInOpstap = false`, asserted in the database. |
| `Voorbeeld_schrijft_niets` | FR-2.5 preview: reports the adds, table stays empty. |
| `Herimport_van_hetzelfde_bestand_wijzigt_niets` | Idempotent on `code`; `isLeeg` true, `vereistReview` false. |
| `Herimport_rapporteert_de_gewijzigde_velden_en_werkt_de_inhoud_bij` | The review report reaches the caller with field-level old/new detail, and the stored text is refreshed. |
| `Verdwenen_maar_gekoppeld_doel_wordt_gemarkeerd_en_de_koppeling_blijft` | **The headline (Art. III.4).** Goal imported via the endpoint, themadoel created via the beheer endpoint, goal dropped from the next file: reported in `verdwenenMaarGekoppeld` with its link count, row kept and flagged, and the teacher's `manueel` koppeling still there. |
| `Ongeldige_rij_wordt_gerapporteerd_en_geldige_rij_gaat_door` | Report, never silently drop; row number + code; the good row still lands. |
| `Leeg_bestand_slaat_de_import_over_en_laat_de_geladen_doelen_staan` | Art. III.4: an empty/wrong file is not a mass disappearance; nothing flagged or deleted; `isVolledigVerwerkt` false while `isBestandGeldig` is true. |
| `Discipline_buiten_de_geconfigureerde_selectie_wordt_overgeslagen` | The E1-06 seam honoured through the trigger, driven from configuration. |
| `Doel_met_concordantie_naar_een_onbekend_minimumdoel_geeft_409_en_wijzigt_niets` | The E1-12 blocker, characterised at the trigger. |
| `Zelfde_code_onder_een_andere_discipline_geeft_409_en_wijzigt_niets` | The wrong-discipline upload (found by hand, see findings). |
| `Onbekend_disciplinenummer_geeft_400` | Unknown discipline, answered by the seeded taxonomy, not a compiled-in list. |
| `Zonder_disciplinenummer_geeft_400` / `Niet_xlsx_bestand_geeft_400` | Request validation. |

Seam tests (`CurriculumbeheerAutorisatieTests`, 3): the policy is registered; **both** `api/opstap-import`
route endpoints carry `IAuthorizeData` naming that policy (asserted on endpoint metadata, so adding a third
import route without it fails); an unauthenticated request is answered on its content (400), not rejected
(401/403).

No new unit tests: the logic under the trigger already has them, and the whole point of this story is that
unit tests could not see the defect. Every new assertion crosses the HTTP boundary.

### Gates

Run in `backend/` on this branch.

| Command | Result |
| --- | --- |
| `dotnet build` | **Build succeeded. 0 Warning(s), 0 Error(s)** |
| `JAARPLANNER_TEST_POSTGRES=… dotnet test` | **468 unit passed, 110 integration passed, 0 failed, 0 skipped** |
| `dotnet test` (no env var, for the record) | 468 unit passed; integration 59 passed / **51 skipped** (the `[PostgresFact]` suite, by design) |
| `dotnet format --verify-no-changes` | clean (it flagged two whitespace lines in `CurriculumbeheerAutorisatie.cs` on the first run; `dotnet format` applied, re-verified clean) |

Connection string used locally: `Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable`
(throw-away local test database — the narrow Art. VI.4 exception ratified 2026-07-30; `Host=127.0.0.1` and
`SSL Mode=Disable` are required or Npgsql hangs on this machine).

Frontend gates were **not** run: no frontend file was touched.

### Verified by hand against a running app

Not a browser test (that is the test-runner's), but the trigger was exercised against a real
`dotnet run` host on `http://127.0.0.1:5187` with its **own** throwaway database (`jaarplanner_e115`, migrated
with `dotnet ef database update`, dropped afterwards) so a parallel agent's dev database was never touched.

```
POST /api/opstap-import/voorbeeld  (2 rows, discipline 2)
 → 200 {"isBestandGeldig":true,"isVolledigVerwerkt":true,"problemen":[],
        "diff":{"toegevoegd":["WIS-1","WIS-2"],…,"vereistReview":false},"toegepast":false}
POST /api/opstap-import            (same file)
 → 200 …"toegepast":true
POST /api/opstap-import            (WIS-1 reworded, WIS-2 removed)
 → 200 "gewijzigd":[{"code":"WIS-1","velden":[{"veld":"Tekst",
        "oudeWaarde":"De leerling telt tot 20.","nieuweWaarde":"De leerling telt tot 100."}]}],
        "verdwenen":["WIS-2"],"vereistReview":true,"toegepast":true
POST /api/opstap-import            (an MD row with concordance 4-12)
 → 409 "Deze leerplandoelen verwijzen naar minimumdoelen die nog niet ingeladen zijn…"
POST /api/opstap-import            (discipline 99)
 → 400 "'99' is geen Op.stap-discipline…"
POST /api/opstap-import            (WIS-1 again, but as discipline 3)
 → 409 "Een of meer codes uit dit bestand bestaan al onder een andere discipline…"
GET  /openapi/v1.json → paths include /api/opstap-import and /api/opstap-import/voorbeeld
```

### Findings the story did not anticipate

1. **`IOpstapParser` was not DI-registered** (see above). Fixed here, because without it the trigger cannot exist.

2. **A wrong-discipline upload was a 500, and it is now a 409.** Found only by driving the endpoint by hand: the
   import diffs *within* one discipline, so a `code` that already exists under a **different** discipline is not
   "ongewijzigd" to it, it is an insert on an existing primary key (SQLSTATE 23505 on `PK_leerplandoelen`).
   Uploading Wiskunde's file under discipline 3 is an ordinary operator slip, so it is answered with a Dutch
   409 rather than an unhandled exception. Nothing commits (the import is one `SaveChanges`). Note the
   underlying question this exposes and does **not** answer: what *should* happen when Op.stap moves a code
   between disciplines? Today the answer is "refuse and tell the uploader", which is safe and non-destructive
   but is a policy nobody has ratified. Worth a directie question if it ever occurs in a real release.

3. **The E1-12 blocker is now reachable and visible, and it bites the first real file.**
   `Leerplandoel.MinimumdoelRef` is a `Restrict` FK on `minimumdoelen.Ref` and nothing in the codebase can
   insert a `Minimumdoel` (the goal Excel has no decreed `omschrijving`, Art. VII.1). So **every MD-concorded
   row of a real Op.stap file fails to commit**, and since a real per-discipline file is mostly MD and G rows
   mixed in one sheet, that means the *whole* file fails, not just those rows: the import is a single
   `SaveChanges`. It is mapped to a 409 with a Dutch explanation instead of a 500, and characterised by test.
   **This trigger is therefore fully usable for non-concorded rows and blocked for real Op.stap files until
   E1-12 lands** — consistent with the story's own note that E1-15 does not unblock E1-03/E1-04. Not "fixed"
   here: fabricating minimumdoel rows from the goal file would invent decreed content (Art. III.1).

4. **The FR-4.1 candidate-set warning recorded in the story now applies for real.** With a runnable
   per-discipline import, `LeerdoelSelectie.Alles` means the matching prompt grows with the curriculum. Nothing
   was changed here (deciding which goals are withheld from the model is pedagogical), but the condition the
   note was waiting for has arrived: the levers are the generation endpoint's optional `selectie` and the
   panel's filters. Flagged for the orchestrator/owner, not silently absorbed.

### What was deliberately not built

- **No UI.** `/import` stays a placeholder and `isGebouwd` was not flipped; the screen is E1-13, including
  clause 6's rendering of this review notice. **Not even a typed API-client function** was added: `frontend/`
  is untouched, so E1-13 owns the whole client surface and there is no half-built helper to reconcile.
- **No E1-12 importer.** Blocked on the decreed source file; only the seam and the decision are documented.
- **No role system.** One policy, documented as authorising everyone; E6-02 binds it.
- **No change to the import/diff logic**, and no new read endpoint for "which disciplines are in scope"
  (E1-13/E1-16 may want one; not needed to trigger an import).
- **No backlog checkbox change.** The story stays as the orchestrator left it; only the Art. II.3 log line was added.

### Self-check vs acceptance criteria

| Criterion | Met? | Evidence |
| --- | --- | --- |
| An initial Op.stap import can be triggered in a deployed app | **Yes**, for files without minimumdoel concordance; **blocked by E1-12** for real Op.stap files (finding 3) | `Eerste_import_laadt_de_leerplandoelen_in` + the manual run above |
| A re-import can be triggered | Yes | `Herimport_*` tests; manual re-import shows the field-level diff |
| The re-import returns its review report | Yes | `OpstapHerimportDiff` is the response's `diff`, incl. `vereistReview`, `verdwenenMaarGekoppeld`, `opmerkingen` |
| The curriculum stays read-only (Art. III.1) | Yes | The controller only parses and delegates; the sanctioned importer remains the only writer, untouched |
| Existing jaarplannen / teacher links untouched (Art. III.4) | Yes | `Verdwenen_maar_gekoppeld_…`: goal flagged not deleted, `manueel` koppeling intact; `Leeg_bestand_…`: no mass disappearance |
| Authorisation behind one seam (Art. XIV question, not hard-assumed) | Yes | `CurriculumbeheerAutorisatie` + 3 tests; documented as no-op today |
| E1-12 share-or-not decided | Yes | Decision 3 above: sibling route, shared policy |

### For the test-runner

- **Unit/integration:** `cd backend && JAARPLANNER_TEST_POSTGRES="Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable" dotnet test`.
  Without the variable, 51 integration tests skip — including 13 of the 16 added here, so a run without it
  proves almost nothing about this story.
- **No Playwright.** There is no UI in this story by design; a browser cannot reach these endpoints from any
  screen. If you want a manual API check:
  1. `dotnet ef database update --project src/Jaarplanner.Infrastructure --startup-project src/Jaarplanner.Api`
     against a scratch database, then run the API on a port no other agent owns
     (`ASPNETCORE_URLS=http://127.0.0.1:5187 ConnectionStrings__Postgres=… dotnet run --project src/Jaarplanner.Api --no-launch-profile`).
  2. Build a small Op.stap workbook: header row with `Doelsoort` in column A, then data rows with
     A=`G`, E=`WIS-1`, F=`L1`, G=`Getallen`, H=`Getalbegrip`, J=some Dutch goal text (Art. VII.1 A–M).
  3. `curl -X POST http://127.0.0.1:5187/api/opstap-import/voorbeeld -F "bestand=@file.xlsx" -F "disciplineNummer=2"`
     → expect `toegepast:false` and `diff.toegevoegd`.
  4. Same without `/voorbeeld` → `toegepast:true`; re-run → `ongewijzigd`, `isLeeg:true`.
  5. Add column B=`4-` and C=`12` to a row and commit → expect **409**, not 500, and no rows written.
  Please also confirm the two Dutch 409/400 messages read like Dutch a directie would accept, and that they
  contain no em dash.

### Open questions / Art. XIV touched

1. **Who may run an import, and from where?** Still open. Isolated behind one policy that authorises everyone
   today. This is a **permissions gap in a deployed app**, not merely an unbuilt feature: until E6-01/E6-02
   land, anyone who can reach the API can refresh curriculum reference data. Same exposure as every other
   write endpoint in the app (E7-11), and now on reference data too.
2. **Disciplines first** (Art. XIV): untouched; the trigger consults the config seam.
3. **A code moving between disciplines** (finding 2): refused today; no ratified policy.
4. **E1-12 remains the gate on FR-2.1 being genuinely satisfied** (finding 3) — the trigger exists, and a real
   Op.stap file still cannot land until the decreed minimumdoelen do.
