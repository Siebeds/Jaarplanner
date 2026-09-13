# E1-22 — Test report (round 1)

**Verdict:** PASS
**Mode:** both (unit/integration gates + a real browser pass: headless Chrome 152 over CDP, driven from Bash, against KOV's live API)
**Tree verified:** `story/E1-22` @ `6fe98a6` (base `eb000ad`), worktree `.claude/worktrees/agent-afddb294927345066`. Read and run only; nothing committed.

## Criteria checked

- "directie can run the import from the screen" -> **PASS**. Signed in as `directie@jaarplanner.local` through the development sign-in, on an empty migrated database. Inladen > Op.stap: *Op.stap ophalen* -> minimumdoelen preview (998 nieuw) -> *Doorvoeren* -> the leerplandoelen preview arrived by itself (version 1.2, 5.835 nieuw, 13 disciplines) -> second *Doorvoeren* -> stand "Versie 1.2, doorgevoerd op 13 september 2026". DB after: `minimumdoelen 998`, `leerplandoelen 5835`, `opstapversies 1` (1.2). The fetch log of the second run showed exactly `POST .../minimumdoelen/voorbeeld`, `POST .../leerplandoelen/voorbeeld {}`, `POST .../leerplandoelen {"versie":"1.2"}`, `GET .../stand`. The minimumdoelen were not re-applied, because their preview wrote nothing.
- "reads the report before anything is written" -> **PASS**. After the first *Op.stap ophalen*, the DB read `0/0/0`. After the minimumdoelen *Doorvoeren*, it read `998/0/0`: the leerplandoelen preview was on screen and not applied, and only the second press wrote the 5,835. The status line read "Nog niet doorgevoerd" on every unapplied preview and "Doorgevoerd" on the apply's own report.
- "no sentence on the screen claims the minimumdoelen are missing while they are loaded" -> **PASS**. With 998 stored, the stand read "998 ingeladen" and the register "998 minimumdoelen", one group "Zonder ingeladen leerplandoel (998)" under "Geen enkel ingeladen leerplandoel verwijst naar deze minimumdoelen.". After the leerplandoelen: "998 minimumdoelen" (1,090 rows) and a last group of exactly six (`4-2.2.23, 6-2.2.3, 6-6.2.5, 6-6.3.9, 6-7.1.6, K-1.2.6`). "Nog geen minimumdoelen" appeared only on the truly empty DB. The only gap-like words on the register ("gedekte klinkers", "het ontbrekende verhoudingsgetal") are inside decreed `omschrijving` text, not app copy. "decretale bestand" and "Importeer eerst de Op.stap-bestanden" are gone from `nl.json` (they survive only in two code comments that describe the old text).
- "Browser-checked at desktop and at 390px" -> **PASS**. Every state at 1440 and 390. `scrollWidth` was 390 at 390 in every state (preview, full leerplandoelen report, changelog open, register, the failure). The discipline table is 324 px at 390 with no overflowing element. Dark and light both.
- Art. II.3 (the language follows the audience) -> **PASS**. The app's own sentences come from `nl.json`, and the server's Dutch (`detail`) is rendered as given. `problemen[].reden` is never rendered by the API flow: KOV's 1.2 had zero problems live, so this rests on Vitest `Opstapimport.test.tsx:186` (minimumdoelen) and `:329` (leerplandoelen), which assert the English text is absent while the Dutch count shows. The `{probleem.reden}` in `Opstapbestand.tsx:218` is the old Excel route's row diagnostic, moved unchanged, under its "Technische details" heading, and offered only before an API version.
- The E3-06 rule (no control that does nothing) -> **PASS**. After version 1.2 was applied, the Excel disclosure was not rendered, and one line said why ("Excel-bestanden van Op.stap worden niet meer ingelezen, want Op.stap is doorgevoerd vanuit Katholiek Onderwijs Vlaanderen."). The condition is `laatsteVersie != null`, and only `LeerplandoelImportService` writes `opstapversies`, the same table the Excel refusal reads (`OpstapImportService.cs:151`), so the sentence is true whenever it shows. A repeat *Op.stap ophalen* gave "Er verandert niets" for both, with no status and no *Doorvoeren*. The DB stayed `998/5835/1`.
- E5-03 rule (conditional sentences) -> **PASS** for every state I rendered. "Eerst de minimumdoelen..." only showed with 0 stored, including on the failure. "Nog niet doorgevoerd" never showed beside "Er verandert niets".
- Also in scope: `Omschrijving` keeps its line breaks -> **PASS**. In the register, `white-space: pre-line` held on 65 of the first 200 rows with a newline. In the doeldetail, `4-1.3.14` rendered on 9 lines with its `- ` items on their own lines (screenshot 14). The register pages with "Nog 200 tonen" (200 -> 400 rows, heading and count stay at 998, no button left at 1,090). The placeholder assets are deleted (no file, no `git ls-files` hit, no reference in `src`). No em dash in the added `nl.json` lines (0), and the catalogue guard is green.
- Failure path (KOV unreachable) -> **PASS**. API restarted with `Opstap__Api__BasisUrl=http://127.0.0.1:9/` (connection refused) on a fresh empty DB. *Op.stap ophalen* showed, under Minimumdoelen: "Niet gelukt / De Op.stap-gegevens van Katholiek Onderwijs Vlaanderen konden niet opgehaald worden. Er is niets gewijzigd.", with no *Doorvoeren* and no English on screen. DB `0/0/0`. The English operator warning went to the API log only.
- Keyboard -> **PASS**. Real Tab presses over CDP: `Op.stap` -> *Op.stap ophalen* -> *Doorvoeren* -> the Excel disclosure (`aria-expanded=false`), each with a 2 px solid focus outline. The changelog toggle has `aria-expanded` and `aria-controls`, and its region is `tabIndex=0`, `role=region`, 384 px high and scrollable (222,188 characters).

## Commands run

- `pnpm install --frozen-lockfile && pnpm lint && pnpm test && pnpm build` (frontend) -> lint clean (oxlint + `tsc --noEmit`), **33 files / 227 tests passed**, build OK (existing chunk-size notice only).
- `dotnet build backend/Jaarplanner.sln -c Release` -> 0 warnings, 0 errors; re-run with `--no-incremental` -> **0 warnings, 0 errors**.
- `dotnet format backend/Jaarplanner.sln --verify-no-changes` -> exit 0.
- `dotnet test backend/tests/Jaarplanner.UnitTests -c Release --no-build` -> **1110 passed, 4 skipped** (live KOV contract tests), 0 failed.
- `JAARPLANNER_TEST_POSTGRES=(Port=55446) dotnet test backend/tests/Jaarplanner.IntegrationTests -c Release --no-build` (PostgreSQL 17.5, throwaway container `jp-e122-tr`) -> **340 passed, 1 skipped** (the live KOV -> PostgreSQL test), 0 failed.
- `dotnet ef database update` against `jp_e122tr` and `jp_e122tr2` -> all migrations applied, through `20260913114751_OpstapApiLeerplandoelen`.
- API `bin/Debug` on 5246 (Development, development sign-in), Vite on 5247 (`VITE_API_PROXY_TARGET=http://localhost:5246`), headless Chrome CDP on 9346.

## Evidence

Screenshots in `C:\Users\siebe\AppData\Local\Temp\claude\C--Source-Jaarplanner\862efea7-537c-42c4-98ee-d05011f28abd\scratchpad\tr-e122\shots\`:

| # | File | State |
| --- | --- | --- |
| 01, 02 | `01-doelen-leerplandoelen-leeg-1440`, `02-doelen-minimumdoelen-leeg-1440` | Empty DB: "Nog geen leerplandoelen" / "Nog geen minimumdoelen" + *Laad ze in bij Inladen* (-> `/inladen`) |
| 03 | `03-inladen-opstap-begin-1440` | Before anything: "Nog niet ingeladen", "Nog geen versie doorgevoerd", Excel disclosure |
| 04, 05 | `04-ophalen-md-voorbeeld-1440`, `05-...-390` | First preview: 998 nieuw, "Nog niet doorgevoerd", "Eerst de minimumdoelen...", accent on *Doorvoeren* |
| 06, 07 | `06-md-doorgevoerd-lp-voorbeeld-1440`, `07-...-390` | Minimumdoelen "Doorgevoerd"; leerplandoelen preview 5.835, table, skipped goal sets |
| 08 | `08-wijzigingslog-open-390` | KOV changelog open, scrollable, line breaks kept |
| 09, 10 | `09-register-998-zonder-leerplandoel-1440`, `10-...-390` | 998 stored, no leerplandoel: one neutral group of 998 |
| 11, 12 | `11-tweede-ophalen-1440`, `12-lp-doorgevoerd-1440` | Second run: minimumdoelen "Er verandert niets", leerplandoelen applied, Excel line instead of upload |
| 13 | `13-register-zes-zonder-leerplandoel-1440` | After import: the last group holds exactly six |
| 14 | `14-doeldetail-minimumdoel-preline-1440` | Doeldetail: decreed list on its own lines |
| 15, 16, 17 | `15-opnieuw-ophalen-niets-1440`, `16-...-390`, `17-...-licht-1440` | Repeat fetch: nothing to change, no status, no button |
| 18, 19 | `18-kov-onbereikbaar-1440`, `19-...-390` | KOV unreachable: the server's Dutch 502 sentence, nothing written |
| 20, 21 | `20-eerste-ophalen-licht-1440`, `21-...-licht-390` | First-run preview in light mode |

(The full-page captures 06, 07 and 12 paint the fixed sidebar and bottom bar mid-page, and the focus ring on "Dekking" is left over from my Tab walk. Both are capture artefacts, not layout.)

**Contrast, measured in the browser with every alpha layer composited** (light / dark): stand label `dt` 6.51 / 7.58; stand values 17.78 / 13.12; "Nog niet doorgevoerd" 6.51 / 7.58; "Eerst de minimumdoelen..." 6.51 / 7.58; "Versie 1.2, gepubliceerd..." 6.51 / 7.58; "Er verandert niets..." 6.51 / 7.58; *Doorvoeren* (accent: white on rgb(18,108,120) / ink on rgb(57,181,198)) 6.10 / 7.06; *Op.stap ophalen* (rustig) 17.78 / 13.12; Excel disclosure 6.08 / 8.44; Excel line 6.08 / 8.44; micro `h3` headings and goal-set marks (inkt-zwak, 11-13 px) 4.97 / 5.78; goal-set names 6.51 / 7.58; changelog toggle 17.78 / 13.12; Foutvlak 9.39 / 8.00. All >= 4.5:1.

## Observations (not defects against this story's criteria)

- Register discipline groups sort as 1, 10 (Frans), 2, ..., a string sort on `DisciplineNummer` that predates this story. The implementer already recorded it as follow-up 1.
- Group headings count rows per discipline (their sum is 1,090), while the header counts distinct minimumdoelen (998). Both are internally consistent (a heading counts the rows listed under it), but a directie reader may see a minimumdoel counted twice across disciplines. Worth one sentence of owner attention; not a false claim.
- Not browser-exercised (covered by Vitest only): a refused leerplandoelen apply after a successful minimumdoelen apply (409), and a 502 on the leerplandoelen preview, because neither can be provoked with a live KOV mid-flow. Also a snapshot with source problems, since live 1.2 has none.

## Defects

None.

## Cleanup

API, Vite and Chrome stopped; container `jp-e122-tr` removed; ports 55446/5246/5247/9346 released (`mine E1-22-test-runner` prints nothing).

---

# E1-22 — Test report (round 2, after fix round 1)

**Verdict:** PASS
**Mode:** both (full gates on PostgreSQL 17.5 + live KOV once + mutation check + a real browser pass: headless Chrome 152 over CDP, driven from Bash, against KOV's live API)
**Tree verified:** `story/E1-22` @ `617e44e` (on top of `6fe98a6`), worktree `.claude/worktrees/agent-afddb294927345066`. Read and run only; nothing committed. The only other uncommitted change in the worktree is `backlog/worklogs/E1-22/antagonist.md`, which another session wrote during this run; I did not touch it.

## Criteria checked

- **1. "No button that does nothing on a repeat fetch"** -> **PASS**.
  - *Browser, Excel-history database (the case the MAJOR named):*
    - Starting point: empty migrated DB. `assets/opstap-xlsx/Wiskunde.xlsx` loaded through the Excel route (discipline 2): 319 leerplandoelen, 256 G, `opstapversies` 0.
    - *Op.stap ophalen*: the minimumdoelen preview wrote nothing (DB `0/0`). *Doorvoeren* stored `998` minimumdoelen.
    - The leerplandoelen preview then arrived by itself: 5.582 nieuw, 253 wijzigt, 0 blijft, 3 weg, plus "Bij 6 minimumdoelen verandert de uitleg in het register.". The DB was still `998/319/0`.
    - The second *Doorvoeren* gave `md=998 lp=5901 versies=1 gevlagd=3 redenen=6`, and the stand read "Versie 1.2, doorgevoerd op 13 september 2026".
  - *The repeat:* *Op.stap ophalen* again showed "Er verandert niets aan de minimumdoelen." and "Er verandert niets aan de leerplandoelen.". No status line and no *Doorvoeren*; the only buttons in `main` were *Op.stap ophalen* (rustig) and the changelog toggle. **The DB was identical before and after the repeat: `md=998 lp=5901 versies=1 gevlagd=3 redenen=6`**, with one `opstapversies` row, `1.2 / 8f470a12-...`.
  - *The PostgreSQL tests exist and bite:*
    - `Een_herhaalde_ophaling_na_een_verdwenen_doel_heeft_niets_te_schrijven` (API-only), `Na_een_exceldoel_dat_kov_niet_heeft_heeft_een_herhaalde_ophaling_niets_te_schrijven` (Excel history) and `Een_herhaalde_ophaling_na_een_verdwenen_minimumdoel_heeft_niets_te_schrijven` all assert that `eerderVerdwenen` holds the code, `verdwenen` is empty and `schrijftIets` is false.
    - `De_toepassing_laadt_geconcordeerde_G_doelen_en_legt_de_versie_vast` asserts a single version row.
  - *Mutation (reverted):* three mutations, applied together:
    - the `eerderVerdwenen` branch in `OpstapImportService` made unreachable (`if (false && oud.NietMeerInOpstap ...)`);
    - the minimumdoel split made to count flagged refs as `verdwenen` (`Where(m => true)`);
    - the version row made unconditional (`if (true)`).
  - Result with the mutations:
    - **4 unit tests failed:** `Een_al_gemarkeerd_minimumdoel_...`, `Een_al_gemarkeerd_doel_...` (both the linked and the unlinked case) and `Een_herhaalde_toepassing_van_dezelfde_versie_...`.
    - **4 PostgreSQL tests failed:** the three repeat tests above plus `De_toepassing_laadt_...`.
  - After `git checkout` of the three files and a rebuild, everything was green again: unit 1124 passed / 4 skipped, and the two PostgreSQL import classes 22/22.
- **2. Owner ruling "Reden tonen"** -> **PASS**.
  - *DB after the live import:* exactly six rows carry a reason, and exactly six minimumdoelen have no leerplandoel:
    - `4-2.2.23`, `6-2.2.3`, `6-6.2.5`, `6-6.3.9` and `K-1.2.6`: `GeenDoelInOpstap`;
    - `6-7.1.6`: `AlleenOvergeslagenDoelsets` / `Z`.
    - No other minimumdoel has a reason.
  - *Register:* the last group is "Zonder ingeladen leerplandoel (6)". `6-7.1.6` reads "Alleen zwemdoelen verwijzen ernaar, en die worden niet ingelezen.", and the other five read "In de doorgevoerde versie van Op.stap verwijst geen enkel doel ernaar.".
  - *The sentences are true:*
    - The stored reasons match ADR-0032 decision 5 and the live test `OpstapApiLiveImportTests`, which asserts the same six against KOV (it passed live, see below).
    - The third sentence ("Een gemeenschappelijk doel verwijst ernaar, maar dat doel kon niet ingelezen worden.") has no live instance, because 1.2 has zero refused G goals. It rests on `Het_register_toont_de_reden_...` (PostgreSQL) and on Vitest.
  - *No gap words:* none of the `doelen.reden*`, `doelen.doelset*` or `doelen.herhaald` values contains `gedekt|dekking|ontbreekt|ontbreken|mist|missen|gat|vergeten|koppel...`. The guard in `catalogus.test.ts:91-99` enforces exactly this over exactly these keys, and it also pins three reasons. No added string contains an em dash.
  - *Migration:*
    - Fresh DB (`jp_tr2_vers`): every migration applied, through `20260913164907_MinimumdoelZonderLeerplandoelReden`.
    - DB first migrated to the previous head (`jp_tr2_prev` at `20260913114751_OpstapApiLeerplandoelen`) with a minimumdoel row seeded: the upgrade applied only `20260913164907...`. It added `zonder_leerplandoel_reden` and `zonder_leerplandoel_doelsets` as `character varying(32)`, nullable. The existing row reads `NULL/NULL` with `niet_meer_in_opstap=f`.
- **3a. Changed-field labels in Dutch** -> **PASS**. The leerplandoelen preview lists "2.1.GJK.1 voorbeelden, toelichting, minimumdoel", "2.1.GK2.4 toelichting, minimumdoel", and so on. No model identifier (`MinimumdoelRef`, `Toelichting`) appears on screen.
- **3b. Disciplines ordered numerically, no-leerplandoel group last** -> **PASS**.
  - Register group headings, in order: Nederlands en communicatie (1), Wiskunde (2), ... ICT (8), Veilige en gezonde levensstijl (9.1), Leren leren (9.2), Sociaal en emotioneel leren (9.3), Frans (10), Zonder ingeladen leerplandoel (6).
  - Discipline 11 has no group because no minimumdoel is concorded to godsdienst.
  - The import report's discipline table runs 1 ... 9.3, 10, 11.
- **3c. Never two accent buttons** -> **PASS**. The accent button in each state:

  | State | Accent button | Not accent |
  | --- | --- | --- |
  | Excel section opened before any fetch | *Op.stap ophalen* (rgb 18,108,120) | *Voorbeeld bekijken* (white) |
  | Excel preview | *Op.stap ophalen* | Excel *Voorbeeld bekijken* and *Inladen* |
  | Leerplandoelen preview | *Doorvoeren* | everything else |
  | After a repeat fetch | none | all |
- **3d. The neutral repeat note shows only when true** -> **PASS**.
  - The condition `totaal > aantalTreffers` compares distinct (ref, bucket) with distinct ref under the same `Gefilterd(...)` filter (`MinimumdoelenQuery.cs:46` and `:171-172`).
  - Unfiltered (API: 1,090 rows, 998 minimumdoelen): the note shows.
  - With domein "Kennis van geschiedenis" (API: 23 rows = 23 minimumdoelen): the header reads "23 minimumdoelen" and the note is absent.
  - Vitest `zegt dat een minimumdoel meer dan eens kan voorkomen, maar alleen als dat zo is` covers both branches.
- **4. Round 1 still holds** -> **PASS**.
  - The flow ran in order: stand, preview, *Doorvoeren*, leerplandoelen preview, *Doorvoeren*.
  - No preview wrote anything (DB checked after each step).
  - "Nog niet doorgevoerd" shows only on an unapplied preview.
  - Once version 1.2 is applied, the Excel upload is replaced by the single "Excel-bestanden van Op.stap worden niet meer ingelezen, ..." line.
  - `scrollWidth` is 390 at 390 on the leerplandoelen preview, on the repeat fetch and on the register tail.
  - The API log has 0 `fail:` lines and 0 exceptions. Its 4 warnings are unrelated to this story (EF query splitting, https port, DataProtection encryptor).

## Commands run

- `pnpm install --frozen-lockfile && pnpm lint` -> clean (oxlint + `tsc --noEmit`).
- `pnpm test` -> **33 files / 232 tests passed**.
- `pnpm build` -> OK (the existing chunk-size notice only).
- `dotnet build backend/Jaarplanner.sln -c Release --no-incremental` -> **0 warnings, 0 errors**.
- `dotnet format backend/Jaarplanner.sln --verify-no-changes` -> exit 0.
- `dotnet test backend/tests/Jaarplanner.UnitTests -c Release --no-build` -> **1124 passed, 4 skipped** (live), 0 failed.
- `JAARPLANNER_TEST_POSTGRES=(Port=55447) dotnet test backend/tests/Jaarplanner.IntegrationTests -c Release --no-build` -> **344 passed, 1 skipped** (live), 0 failed. This was the **full project**, on PostgreSQL 17.5 in the throwaway container `jp-e122-tr2`.
- Live, once (`JAARPLANNER_LIVE_OPSTAP=1`) -> unit `~LiveContract` **4/4**, integration `~Live` **2/2**. These include the six-reason and single-version-row assertions against KOV.
- The mutation run described above: 4 unit and 4 PostgreSQL failures with the mutations, green again after the revert.
- `dotnet dotnet-ef database update` (local tool 10.0.9) on `jp_tr2_vers` and `jp_tr2_browser` (to head), and on `jp_tr2_prev` (to `20260913114751`, then a seeded row, then to head).
- Browser setup:
  - API `bin/Debug` on 5248 (Development, development sign-in as `directie@jaarplanner.local`);
  - Vite on 5249 (`VITE_API_PROXY_TARGET=http://localhost:5248`);
  - headless Chrome, CDP on 9347.

## Evidence

The screenshots are in `C:\Users\siebe\AppData\Local\Temp\claude\C--Source-Jaarplanner\862efea7-537c-42c4-98ee-d05011f28abd\scratchpad\tr2\shots\`:

| File | State |
| --- | --- |
| `r2-01-excel-open-voor-ophalen-licht-1440` | Excel section open before any fetch: one accent (*Op.stap ophalen*) |
| `r2-02-excel-voorbeeld-licht-1440` | Excel preview of Wiskunde.xlsx: the Excel buttons are rustig |
| `r2-03-lp-voorbeeld-na-excel-licht-1440`, `r2-04-...-390` | Leerplandoelen preview after Excel history: 5.582 / 253 / 0 / 3, Dutch field labels, "Bij 6 minimumdoelen verandert de uitleg ..." |
| `r2-05-lp-doorgevoerd-licht-1440` | Leerplandoelen applied; stand "Versie 1.2, doorgevoerd op 13 september 2026" |
| `r2-06-herhaling-niets-licht-1440`, `r2-07-...-390`, `r2-08-...-donker-1440` | Repeat fetch: "Er verandert niets" twice, no status, no *Doorvoeren*, the Excel line |
| `r2-09-register-boven-licht-1440` | Top of the register: "998 minimumdoelen" and the repeat note |
| `r2-10-register-zes-met-reden-licht-1440`, `r2-13-...-390`, `r2-14-...-donker-1440` | "Zonder ingeladen leerplandoel (6)" with a reason under each |
| `r2-11-register-domein-zonder-herhaling-licht-1440` | Domein filter, 23 = 23: no repeat note |

Ignore `r2-12-...`: it records a failed step in my own harness, not a product state.

**Contrast of the new text**, measured in the browser with every alpha layer composited:

| Text | Light | Dark |
| --- | --- | --- |
| Reason lines | 6.51 | 7.58 |
| Repeat note | 6.08 | 8.44 |

The accent *Doorvoeren* and the rustig buttons are the same as in round 1.

## Observations (not defects against this story's criteria)

- **Environment interruption.** Docker Desktop stopped by itself mid-run: the `docker-desktop` WSL distro went to Stopped between the live run and the migration step, and nobody had announced stopping it. I started it once and posted INFO on the board; `jaarplanner-db` (5433) came back healthy. The frontend gates, the unit run, the full integration run and the live run all finished before the stop; every other result was taken after the restart.
- **An edge in the version rule.** In `LeerplandoelImportService`, `andereVersie` requires `vorige is not null`. So on a *first* leerplandoelen apply in which no discipline writes and no reason changes, no version row would be recorded, and the Excel refusal would not switch on. Real data can't reach this: a first API apply over Excel rows always rewrites `MinimumdoelRef`, and on an empty DB everything is new. I note it only because the rule, "record the version when it differs from the last applied one", reads as if "no previous version" counted as different.
- **No accent in the idle state.** After a repeat fetch no button carries the accent; *Op.stap ophalen* is rustig. That satisfies "never two". Whether the idle state should give the accent back to *Op.stap ophalen* is a design call, not a criterion.
- **Harness note.** The Doelen filter is kept in sessionStorage by design, and the filter button's accessible name becomes "Filters, 1 actief" while a filter is on. Both behaviours are correct; I record them only because they made my own harness miss the button twice.

## Defects

None.

## Cleanup

- Stopped: API (5248), Vite (5249) and Chrome (9347).
- Removed: container `jp-e122-tr2`.
- Released: ports 55447, 5248, 5249 and 9347. No claim is left for `E1-22-test-runner`.
- Restored: the three mutated files, with `git checkout`, before the Release rebuild. `git status` shows no change under `backend/`.
