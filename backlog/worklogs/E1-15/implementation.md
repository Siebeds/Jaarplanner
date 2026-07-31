# E1-15 — Trigger the Op.stap import: an invocation surface for FR-2.1/2.5

## Build round 1 — an HTTP trigger for the Op.stap curriculum (re-)import

- **FR / Article:** FR-2.1, FR-2.5 · Art. III.1 (curriculum read-only), Art. III.4 (jaarplannen/links untouched
  + review report), Art. VI.1 + ADR-0011 §2 (authorisation seam), Art. VII.0/VII.1 (taxonomy + A–M mapping),
  Art. VIII (layering — **partially, with a filed exception: see the correction below and fix-round finding
  2**), Art. II.3 as amended 2026-07-30, Art. X (gates), Art. XIV (disciplines first, and "who may import?").

> **Correction, made in fix round 1: this round's "thin REST controller (Art. VIII)" claim was unqualified and
> should not have been.** The controller does only bind/delegate/return, but it constructor-injects
> `IOpstapParser` and `IOpstapImportService` and puts `OpstapRijProbleem` on the wire — three
> Application-shaped things that physically live in `Jaarplanner.Infrastructure`, so an `Api` controller
> consuming them takes a dependency the layering forbids. That is **E7-13**, which was already open for the
> school-content importer and which this story enlarged from one injected Infrastructure port to three. Fix
> round 1 records the blast radius there and states the exception in the controller's own doc comment. Citing
> Art. VIII as satisfied while adding to a filed Art. VIII defect is the kind of claim this worklog exists to
> prevent.

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
POST /api/opstap-import            (discipline 99, with a code NOT yet loaded)
 → 400 "'99' is geen Op.stap-discipline…"
   [CORRECTED in fix round 1: this line was only conditionally true. With the codes ALREADY loaded, the
    primary-key violation reached the database first and the answer was a 409 about "another discipline",
    i.e. advice about a discipline that does not exist. Found by the test-runner; the discipline is now
    checked before anything else, so the 400 wins either way.]
POST /api/opstap-import            (WIS-1 again, but as discipline 3)
 → 409 "Een of meer codes uit dit bestand bestaan al onder een andere discipline…"
GET  /openapi/v1.json → paths include /api/opstap-import and /api/opstap-import/voorbeeld
```

### Findings the story did not anticipate

1. **`IOpstapParser` was not DI-registered** (see above). Fixed here, because without it the trigger cannot exist.

2. **A wrong-discipline upload was a 500, and it is now a 409.** *(Fix round 1 moved this check up front and
   ratified the behaviour; see finding 2 in the fix round for what changed and the owner ruling.)* Found only
   by driving the endpoint by hand: the
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
   per-discipline import, `LeerdoelSelectie.Alles` means the matching prompt grows with the curriculum.
   Nothing changed here (deciding which goals are withheld from the model is pedagogical). **Ruled by the
   owner on 2026-07-31: the default stays uncapped.** Re-filed where the next author meets it, per the ruling,
   and this entry is now only a pointer: **E1-15's own backlog entry**, **E2-08 item 2** in
   `backlog/E2-ai-matching.md` (the levers and what not to do later), and **E7-11** in
   `backlog/E7-niet-functioneel.md` (authentication is the only remaining mitigation on a billable anonymous
   endpoint).

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
3. **A code moving between disciplines** (finding 2): refused today; no ratified policy. *(Ruled by the owner
   2026-07-31 — see fix round 1.)*
4. **E1-12 remains the gate on FR-2.1 being genuinely satisfied** (finding 3) — the trigger exists, and a real
   Op.stap file still cannot land until the decreed minimumdoelen do.

---

## Fix round 1 — 3 MAJOR, 4 MINOR, 1 test-runner defect, 2 owner rulings

Test-runner verdict on round 1 was **PASS**; the antagonist returned **VIOLATIONS FOUND** with none of the
findings disputing *what* was built. Everything below was addressed; nothing is disputed.

### The one thing a later reader must know first

**Round 1's headline property "the sanctioned importer is untouched" no longer holds, deliberately and on
instruction.** The test-runner verified it by showing `git diff main…HEAD -- …/OpstapImport …/Application` was
empty. Two findings (MAJOR 1, MINOR 5) required exactly that file to change, so here is precisely what did and
did not change in `OpstapImportService`:

| Changed | Not changed |
| --- | --- |
| Added a **preflight** that refuses three curriculum-integrity failures before any diffing. | Which rows an importable file imports, in any case that previously succeeded. |
| Wrapped its own `SaveChangesAsync` to translate a PostgreSQL SQLSTATE into a typed fault. | The diff computation, the flag-and-keep default, the empty-file guard, the discipline-selection seam, the review flag handling, the disappeared/linked classification. |
| Reworded **two** Dutch `opmerkingen` notices (em dashes, Art. II.5). | Every existing unit test's expectation about the diff. |

Both edits are refusals and diagnostics around the write, not changes to it. The coordinator's caveat was "if
you cannot do it without altering what the importer imports, stop and report" — that did not happen, and the
**21** pre-existing Op.stap unit tests still pass unmodified except for their fixtures (below). *That figure was "24"
until the fix-round-2 check; counted at `b44c869` the two files hold 11 (`OpstapImportServiceTests`) + 10
(`OpstapImportDisciplineSelectieTests`) = 21, and they now hold 25. Of the 21, **15** failed when the preflight
landed, which is the other number this worklog quotes.*

### MAJOR 1 — Npgsql SQLSTATE translation in the `Api` layer → moved to Infrastructure

**Accepted without reservation, including the part about the misleading comment.** The precedent I cited
(`KlasBeheerService`/`SchooljaarBeheerService`) is in *Infrastructure*, so quoting it to justify an *Api*
placement was an argument that did not support its conclusion. What changed:

- `Jaarplanner.Application/Curriculum/Import/OpstapImportFout.cs` (**new**) — a typed fault with an
  `OpstapImportFoutSoort` (`OnbekendeDiscipline` / `OntbrekendeMinimumdoelen` / `CodeInAndereDiscipline`) and
  a Dutch message for whoever runs the import.
- `OpstapImportService.VertaalIntegriteitsfout` — the single place that reads a SQLSTATE for this path, next
  to the `DbContext`. Anything it does not recognise keeps bubbling up as a 500, because a curriculum write
  that fails for an unknown reason must stay loud.
- `Jaarplanner.Api/Infrastructure/OpstapImportExceptionHandler.cs` (**new**, registered in `Program.cs`) —
  maps the fault to 400 (unknown discipline: a bad request) or 409 (the loaded curriculum refuses it).
- The controller's three `catch (DbUpdateException …)` blocks and its three SQLSTATE predicates are **gone**.
  `grep -rn "Npgsql" backend/src/Jaarplanner.Api --include=*.cs` now returns **nothing**, and the `using
  Microsoft.EntityFrameworkCore;` is removed too.

### MAJOR 2 — the controller injects Infrastructure ports → documented, not moved

Took the documenting option as instructed. (a) `backlog/E7-niet-functioneel.md`, E7-13 now carries a
**blast-radius paragraph**: this story took injected Infrastructure ports in `Api` controllers from **1 to 3**
(`IOpstapParser`, `IOpstapImportService`) and added a **second** Infrastructure DTO to the wire
(`OpstapRijProbleem`, next to `SchoolcontentRijProbleem`), so the move now spans five ports plus two DTOs; it
also records *why* E1-15 did not do it, and notes a cheaper adjacent win (the Api already depends on
`Application.Curriculum.Import` for the fault type, so moving `OpstapRijProbleem` there is a rename plus a
`using`). (b) The worklog's unqualified Art. VIII claim is corrected at the top of this file, and (c) the
controller's own doc comment now states the exception rather than opening with "Thin REST controller
(Art. VIII)". A reader who greps for the claim finds the caveat next to it.

### MAJOR 3 — E7-11's register updated for two anonymous mutating endpoints

Added both routes to E7-11's enumeration in the form E2-08 and E3-01 used, with the new dimension spelled
out: these are the **first anonymous writes to decreed reference data**, i.e. to the rows Art. V's coverage
proof is computed from, where every previous anonymous route touched school content or planning. The concrete
scenario is stated as the audit put it (a well-formed single-row file clears the "no valid rows" guard and
flags every other goal in that discipline; official `tekst`/`toelichting` can be rewritten), plus the 20 MB
anonymous ClosedXML parsing surface. It also records what *does* exist, so the entry is not read as "E1-15
shipped no authorisation at all": one named policy, no-op by design, one line for E6-02 to bind.

### MINOR 4 — em dashes in the two `opmerkingen` this story made reachable

Accepted, and the finding's framing is the useful part: my "no em dashes in any of the new strings" was true
and measured the wrong thing. Both notices in `OpstapImportService` were rewritten, not merely de-dashed:

- Out of scope: *"Discipline 2 valt buiten de ingestelde importselectie (…). Er is niets ingelezen of
  gewijzigd. Neem deze discipline op in de importselectie als ze toch mee moet."* The configuration key
  `Opstap:DisciplineSelectie` is **out** of the Dutch sentence (it mixed the two Art. II.3 audiences) and now
  lives in an English code comment for the operator.
- Empty/implausible file: *"Er zijn geen geldige leerplandoelen ingelezen voor discipline 2, dus is er niets
  toegepast. De 2 bestaande doelen blijven ongewijzigd. Mogelijk is het bestand leeg, onvolledig of hoort het
  bij een andere discipline."* Verified verbatim against a running host (below).

No test asserted these substrings (both only assert `NotEmpty`), so nothing was pinned to the old wording.

### MINOR 5 + the test-runner defect — the preview now refuses what the commit refuses

The real fix, not the doc-comment fallback. `ControleerVoorwaardenAsync` runs **before any diffing**, on both
paths, and checks in this order: (1) the discipline exists in the seeded taxonomy; (2) no incoming `code`
already belongs to another discipline; (3) every concordance key resolves to a loaded `Minimumdoel`. The
order is the test-runner's defect fixed at the root: a mistyped discipline number used to trip the
primary-key violation first, so the answer was *"these codes belong to another discipline. Check whether this
file belongs to discipline 99"* — advice about a discipline that does not exist.

The messages also got better because the checks now run in a place that knows the data: they name the
offending refs (`… : 4-12`) and codes with their current discipline (`WIS-1 (discipline 2)`), truncating after
five.

**A cost worth stating plainly:** while E1-12 is open, a preview of a real Op.stap file no longer shows what
the file *would* add — it returns 409. Round 1 showed a full diff, which was more informative and wrong. I
consider the trade correct (a review step that green-lights an impossible import is worse than none) and it
disappears when E1-12 lands, but it is a real loss of information and not a pure win.

Tests: 4 new unit tests (all three refusals asserted with `toepassen: false`, plus a positive test that a
**loaded** minimumdoel makes the concordance importable, so the refusal cannot degrade into "MD rows are never
importable") and 2 new integration tests
(`Voorbeeld_weigert_precies_wat_de_definitieve_import_weigert`, which asserts the preview and the commit
return the **same status and the same Dutch detail** for two of the cases, and
`Onbekend_disciplinenummer_geeft_400_ook_als_de_codes_al_geladen_zijn`, which is the test-runner's scenario
and which additionally asserts the answer does **not** mention "andere discipline").

**One consequence I did not foresee, and it is the interesting one.** The preflight broke **15 pre-existing
Op.stap unit tests** — because the EF **in-memory** fixtures seed no `Discipline` rows, so the new "does this
discipline exist?" check failed for all of them. On a real PostgreSQL those fixtures were never valid: the
required `Restrict` FK has always demanded a discipline row, and in-memory silently ignores it. Fixed by
seeding the disciplines those two fixtures import into, with a comment saying why. So the preflight made the
in-memory suite behave like the real database, which is the same class of defect
`ReferentiedataIntegriteitTests` was written for; it is worth knowing that a chunk of the Op.stap unit suite
had been asserting against a state PostgreSQL would refuse.

### MINOR 6 — the Art. II.3 log line

Extended in `backlog/README.md`: it now records the **2 pre-existing Dutch `opmerkingen` this story made
reachable for the first time** (with the running total updated to "7 authored and 2 exposed"), and states the
generalisable lesson — *"did I add a Dutch string?" is the wrong question; "did I make one visible?" is the
right one*, because a story that only adds a caller can fail Art. II.5 without touching a literal. On the
duplicated title I took the **share** option rather than the document option: `"Ongeldige aanvraag"` was
defined independently in **five** files and E1-15 nearly made it six, so the titles now come from
`Api/Infrastructure/Probleemtitels.cs` and the other four call sites were converted. `Detail` text stays
where the fault is raised, since only there is the row number, discipline or offending code known.

### MINOR 7 — recorded as an ADR

[`docs/adr/0022-curriculum-administration-authorisation-seam.md`](../../../docs/adr/0022-curriculum-administration-authorisation-seam.md),
**Accepted**, complementing ADR-0011 and superseding nothing (I checked how 0020 refines 0013 and followed the
"complement, do not rewrite" pattern; ADR-0011's §2 stands verbatim). It records the policy name, its
deliberate no-op body and why it is not `RequireAuthenticatedUser()`, the one-endpoint-per-import-source
decision with its reasoning, the typed-fault mapping, four rejected alternatives, and — as an explicit
negative consequence — that *a policy authorising everyone can be mistaken for protection*. It carries the
note for E1-12's author that `CurriculumbeheerAutorisatieTests` filters on the `api/opstap-import` prefix and
will **not** catch a new route that forgets the attribute. ADR index row, traceability-matrix row and the
"open decisions referenced by ADRs" paragraph updated (0022 is now the example of what a seam does *not* buy).

*Not changed:* `CLAUDE.md` still says "ADR-0001…0020", which was already stale before this story (0021
exists). Left alone deliberately: it is the project's instruction file, and a two-character edit to it is not
mine to make on an agent's say-so. Flagged for the orchestrator.

### Owner ruling 1 — a code moving between disciplines

Recorded as **RESOLVED (owner 2026-07-31)** in the open-decisions section of `backlog/README.md`, in the form
the other resolved entries use: the behaviour (refuse the whole file, name the offending codes and their
current discipline, change nothing), the reasoning (the code is the decreed identity, Art. III.5; the app is
not entitled to move it, Art. III.1; refusing is the non-destructive option, Art. III.4), and the note that
*the behaviour existed before the ruling, which is precisely why it needed one*. Referenced from the code at
the point of refusal (`ControleerVoorwaardenAsync`, and on `OpstapImportFoutSoort.CodeInAndereDiscipline`).
The message stayed accurate after the check moved up front — and got better, because it now names which
discipline each code currently belongs to.

### Owner ruling 2 — the uncapped FR-4.1 candidate set

No code change, per the ruling. Re-filed in the two places the next author will meet it: **E2-08 item 2** in
`backlog/E2-ai-matching.md` (the condition it was waiting for has arrived; treat `selectie` as the per-run
lever; do not add a cap later on cost grounds without asking again) and **E7-11** (the mitigation is not a cap,
it is authentication, which raises that gate's priority rather than the matching story's). E1-15's own backlog
entry now marks its "weigh a narrower default" clause **discharged**. The worklog entry is a pointer.

### Carried over, not mine to fix — `vereistReview` never clears

Filed on **E1-13 clause 6** in `backlog/E1-curriculum-content.md`, where it will bite: `vereistReview` is true
whenever `Verdwenen`/`VerdwenenMaarGekoppeld` is non-empty, and a flag-and-keep row is absent from every later
file, so every subsequent re-import of that discipline keeps reporting it. Rendered naively that is a
permanent, undismissable "te herzien" banner — the E3-09 mistake in another flow. The importer was **not**
touched for it. The same entry now also hands E1-13 the endpoint's contract, the English-`reden` warning, and
the "branch on the status, not on `isError`" lesson from E3-07.

### Gates (fix round 1)

| Command | Result |
| --- | --- |
| `dotnet build` | **Build succeeded. 0 Warning(s), 0 Error(s)** |
| `JAARPLANNER_TEST_POSTGRES=… dotnet test` | **472 unit passed, 112 integration passed, 0 failed, 0 skipped** (round 1: 468 + 110; +4 unit, +2 integration) |
| `dotnet format --verify-no-changes` | clean (`dotnet format` applied once, then verified) |

No frontend file was touched in this round either, so no `pnpm` gates.

### Re-verified by hand after the refactor (real host, Production environment, own port + own throwaway database)

Round 1's manual evidence was invalidated by these changes, so it was redone on `http://127.0.0.1:5188`
against `jaarplanner_e115b` (migrated, then dropped; `ASPNETCORE_ENVIRONMENT=Production`, which also proves
the seam and the handler are not Development-only):

```
POST /api/opstap-import            (2 rows, discipline 2)      → 200 toegevoegd:["WIS-1","WIS-2"] toegepast:true
POST /api/opstap-import/voorbeeld  (MD row, concordance 4-12)  → 409 "…minimumdoelen die nog niet ingeladen zijn: 4-12…"
POST /api/opstap-import            (same MD file)              → 409 identical detail   ← preview == commit
POST /api/opstap-import            (discipline 99, codes ALREADY loaded)
                                                              → 400 "'99' is geen Op.stap-discipline…"   ← the test-runner's defect, fixed
POST /api/opstap-import            (the discipline-2 file, as discipline 3)
                                                              → 409 "Deze codes staan al bij een andere discipline:
                                                                     WIS-1 (discipline 2), WIS-2 (discipline 2)…"
POST /api/opstap-import/voorbeeld  (same, as discipline 3)     → 409
POST /api/opstap-import            (header-only workbook)      → 200 overgeslagen:true, isVolledigVerwerkt:false,
                                                                 opmerkingen:["Er zijn geen geldige leerplandoelen
                                                                 ingelezen voor discipline 2, dus is er niets toegepast.
                                                                 De 2 bestaande doelen blijven ongewijzigd. …"]
```

The last line is the rewritten Art. II.5 notice, read back from the wire rather than from the source.

## Fix round 2 — 4 MINOR findings, finished by the orchestrator

**Round 2 was implemented in two halves.** The implementer wrote the two code fixes and their tests and then
stopped mid-round on an API spend limit, before running the gates or touching the records. The orchestrator
finished it: it verified the two code fixes, ran the gates, and made the four record corrections. Recorded
because "who wrote this" matters when a later reader weighs how independently a fix was checked, and because
one of the corrections below is about exactly that kind of provenance claim.

### MINOR 1 — one Dutch message source per `OpstapImportFoutSoort` (Art. II.3 clause 3)

Fix round 1 consolidated five copies of one *title* and, in the same commit, created three duplicated
*details* one layer down: each fault case was worded once in the new preflight and again in
`VertaalIntegriteitsfout`. The second copy of each pair is unreachable without a concurrent writer, so no
behavioural test could compare them: rewording the reachable copy would have left the race path answering
the old sentence, and nothing would have failed.

Now the wording lives in `OpstapImportFout`, one static factory per case
(`OnbekendeDiscipline` / `OntbrekendeMinimumdoelen` / `CodeInAndereDiscipline`). Both call sites use them; the
only difference the two paths may produce is whether the offending refs or codes are named, because the
preflight knows them and the SQLSTATE translator does not. `MaxGenoemdeVoorbeelden` moved onto the fault with
the formatting, so the preflight's `Take(Max + 1)` reads the same constant the message truncates on.

`OpstapImportFoutTests` (**new**, 5 facts) pins it at the only level where the divergence is observable: it
compares the two renderings of each factory directly and asserts they differ *only* by the inserted examples.
It deliberately duplicates no Dutch, so it cannot rot into a copy of the copy it exists to prevent.

### MINOR 2 — the operator diagnostic survives the throw (Art. II.3, operator half)

`OpstapImportFout` gained an `innerException` parameter and `VertaalIntegriteitsfout` passes the
`DbUpdateException`, so the SQLSTATE, the constraint name and the table reach the log. That path is only
reachable through a genuine concurrency anomaly, which is precisely the case where the original exception is
the only useful artefact. A test asserts the inner exception is kept on all three factories, **and** that the
preflight does not invent one.

### MINOR 3 — two wrong numbers in E7-13

`E7-niet-functioneel.md` said E1-15 took injected Infrastructure ports "from 1 to 3". Verified by grep rather
than recalled: `SchoolcontentImportController` already injects three (`ISchoolcontentParser`,
`ISchoolcontentImportService`, `ISchoolcontentTemplateGenerator`), so the figure is **3 to 5**. The paragraph
carried the wrong number beside the right five-port list, which is how a miscount survives a reading. The
correction matters beyond arithmetic: E7-13's own "check whether the other two school-content ports have the
same problem" line was implicitly answered *no* by counting them out, and the answer is **yes**.

`Probleemtitels.cs` and the Art. II.3 entry both said E1-15 "nearly made it six". Verified against git:
**4** files carried `"Ongeldige aanvraag"` at `b44c869`, **5** at `57a21b1`, and the fifth was this story's own
controller. E1-15 made it five; there was never a sixth. Both places now say so, and the class comment states
plainly that this story joined the drift rather than inheriting it.

### MINOR 4 — the Art. II.3 log line, restated with its history

The entry said "7 `ProblemDetails.Detail` strings in `OpstapImportController`". Counted at the end of the story
instead of the end of its first round: **4** details in the controller (the request validations), **3** refusal
messages in `OpstapImportFout`, and **1** new title in `Probleemtitels` — **8 authored across three files**,
plus the 2 pre-existing notices this story exposed and rewrote. The running total is corrected to match.

The entry now also records *where those 3 refusals moved and why*, because the churn is the transferable part:
controller → preflight (duplicated) → one factory per case. A count taken after round 1 would have said 7 in
one file; mid-round-1 it was 10 in two. Both were briefly true, which is why a figure in that entry needs the
commit it was counted at.

### Carried to E1-13 rather than fixed here

Two observations from the test-runner, added to E1-13 clause 6's note:

- **Two error envelopes on one endpoint.** The integrity refusals travel through `IProblemDetailsService` and
  so carry `type` and `traceId`; the controller's own 400s answer `{detail, status, title}`. Additive and
  RFC-valid, so not a defect, but a parser assuming one shape will trip on the other.
- **The 409 does not distinguish "your file is wrong" from "the application is not ready yet"**, and while
  E1-12 is open it is nearly always the second. Rendered raw, a directie member concludes the file they just
  downloaded from Op.stap is broken, and re-downloads it. That is presentation, so it belongs to E1-13, but it
  is a real trap and it is now written where that story's author will meet it.

### Gates (re-run by the orchestrator, actual output)

| Command | Result |
| --- | --- |
| `dotnet build` | Build succeeded, 0 warnings, 0 errors |
| `JAARPLANNER_TEST_POSTGRES=… dotnet test` | **477 unit + 112 integration passed, 0 failed, 0 skipped** (round 1: 472 + 112; +5 unit from `OpstapImportFoutTests`) |
| `dotnet format --verify-no-changes` | clean, exit 0 |

No frontend file was touched in any round, so the `pnpm` gates do not apply.

**The three refusal messages a caller receives are unchanged in wording** on the reachable path: the preflight's
sentences moved into the factories verbatim. The unreachable race-path copies did change, in the direction of
consistency: they now share the reachable path's second sentence instead of carrying an abbreviated variant.
`Voorbeeld_weigert_precies_wat_de_definitieve_import_weigert` and
`Onbekend_disciplinenummer_geeft_400_ook_als_de_codes_al_geladen_zijn`, including its
`DoesNotContain("andere discipline")` assertion, both still pass.
