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
