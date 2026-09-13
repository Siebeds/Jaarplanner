# E1-22 — The import screen for the API source — implementation worklog

- **Date:** 2026-09-13
- **Branch:** `story/E1-22`, fast-forwarded to `feature/e1-opstap-api` (`eb000ad` = `main` + E1-21 landed + the `[~]` claim), in
  worktree `.claude/worktrees/agent-afddb294927345066`. Not pushed, not merged; the checkbox stays `[~]` for the orchestrator.
- **FR / Article:** FR-2.1, FR-2.4, FR-2.5; Art. II.3 (as ratified 2026-07-30), Art. III.1, Art. VII.2 (as amended 2026-09-13),
  Art. VIII, Art. XII; the E3-06 rule and the E5-03 rule (CLAUDE.md); ADR-0024, ADR-0032.
- **Design:** read and followed `frontend-design/SKILL.md` together with CLAUDE.md's UI rules and ADR-0024. This is one more flow
  on an existing screen, so it reuses the import screen's `Vak`, `Telling`, `Beperkt`, `Foutvlak` and the token set; no new hue,
  no new token. The accent follows the next step (on *Op.stap ophalen* until there is a report, then on *Doorvoeren*), so a
  screen never shows two primary actions. One deliberate deviation from the skill: the count and column labels stay in the
  existing uppercase micro style, because the brief is to extend the screen, not restyle it. *(Fix round 1: the
  two-primary claim was false while the Excel disclosure was open, whose buttons were `hoofd`; they are `rustig` now.)*

## What was built

| Layer | File | What |
| --- | --- | --- |
| Application | `Curriculum/Import/IOpstapImportStandQuery.cs` (new) | Port + `OpstapImportStand(AantalMinimumdoelen, LaatsteVersie)`. Why it exists is in its summary and under trap 1/2 below. |
| Infrastructure | `OpstapImport/OpstapImportStandQuery.cs` (new) | Two reads of our tables; "last version" ordered exactly as `LeerplandoelImportService` orders `vorigeVersie`. |
| Infrastructure | `OpstapImport/OpstapApiRegistratie.cs` | Registers the query with the imports it describes (`DependencyInjection.cs` untouched). |
| Api | `Controllers/OpstapImportStandController.cs` (new) | `GET /api/opstap-import/stand`, behind `CurriculumbeheerAutorisatie.Beleid`. Never calls KOV. |
| Application | `Curriculum/MinimumdoelWeergaven.cs`, `IMinimumdoelenQuery.cs` | Bucket fields nullable; facets gain `AantalTreffers` and `AantalZonderLeerplandoel`. |
| Infrastructure | `Persistence/MinimumdoelenQuery.cs` | Left join, so a minimumdoel no loaded leerplandoel concords is listed once, last, without a bucket; facets read only concorded rows (no empty option); explicit NULL-last ordering (PostgreSQL and LINQ-to-Objects disagree); discipline names by lookup. |
| Frontend | `features/import/Opstapimport.tsx` (rewritten) | The Op.stap tab: stand panel, *Op.stap ophalen*, both reports, *Doorvoeren*, the Excel disclosure or the line replacing it. |
| Frontend | `features/import/Opstaprapport.tsx` (new) | The two report bodies: counts, per-discipline table, changed/renumbered/still-linked lists (capped), server notices grouped per discipline, skipped goal sets, problem count, collapsible changelog. |
| Frontend | `features/import/stappen.ts`, `opmaak.ts` (new) | Step state, the call runner, "does this report write anything", nl-BE number format. |
| Frontend | `features/import/Opstapbestand.tsx` (new) | The Excel upload, moved out of `Opstapimport.tsx` unchanged. |
| Frontend | `features/import/api.ts`, `types.ts`, `Meldingen.tsx`, `ImportScherm.tsx` | Calls and wire types for the three API routes; `Telling` formats counts (`5.835`); note updated. |
| Frontend | `features/doelen/Minimumdoelenlijst.tsx`, `DoelenScherm.tsx`, `Doeldetail.tsx` | Three empty states, the group without a leerplandoel, paging, the true count, `whitespace-pre-line` on decreed text. |
| Frontend | `lib/queries.ts`, `lib/types.ts`, `lib/datum.ts` | `useMinimumdoelenPaginas` (infinite, replaces the one-page hook), register types, `datumVanTijdstip`. |
| Frontend | `i18n/nl.json` | `importeren.kov.*`, two `importeren.opstap.*` keys, register keys; removed `doelen.leegActie` and `doelen.geenMinimumdoelenActie`. |
| Assets | `assets/minimumdoelen-PLAATSHOUDER-*` | Deleted (LEESMIJ, csv, xlsx). |
| Backlog | `backlog/E1-curriculum-content.md` | E1-22 status note; E1-12's placeholder paragraph marked as describing deleted files (its link would otherwise be dead). |

## Decisions

### Trap 1: order (minimumdoelen before leerplandoelen)
**Checked:** the leerplandoelen *preview* already answers 409 while a concorded minimumdoel is not stored (`OpstapImportFout`
is raised on the preview path by design, "a preview refuses exactly what a commit would refuse"). So a first-time flow cannot
preview both.
**Decision:** one flow in two steps, ordered by `GET /api/opstap-import/stand`. With no minimumdoel stored, *Op.stap ophalen*
previews only the minimumdoelen and the leerplandoelen section says "Eerst de minimumdoelen: de leerplandoelen van Op.stap
verwijzen ernaar." *Doorvoeren* applies them; the screen then fetches the leerplandoelen preview **by itself** and shows it
with a new *Doorvoeren*, which **only a second press** applies, so nothing is written that was not read first. The same
follow-up runs when the leerplandoelen preview was refused (e.g. a new snapshot naming a minimumdoel the minimumdoelen apply
is about to bring). With minimumdoelen stored, both previews are fetched in parallel and one *Doorvoeren* applies the
minimumdoelen and then the leerplandoelen (the version the preview named); a refused minimumdoelen apply stops before the
leerplandoelen. That is safe because a successful leerplandoelen preview already resolved every concordance against stored
minimumdoelen, and the minimumdoelen apply never deletes.
**Why a backend change** (minimal, tested): the alternatives were worse. The leerplandoelen preview's `vorigeVersie` costs a
13 MB read of KOV and answers 409 in exactly the first-time case to detect; `/api/minimumdoelen/facetten` has the count but
not the version, is not behind `Curriculumbeheer`, and runs eight queries. Two counts from our database answer both traps.

### Trap 2: the Excel Op.stap upload after an API import
**Decision:** the upload is offered (collapsed, below the API flow, "Een Op.stap-bestand in Excel inladen") only while
`laatsteVersie` is null, the exact condition under which the server still accepts a file (an `opstapversies` row). After a
snapshot is applied it is not rendered, and one line says why: "Excel-bestanden van Op.stap worden niet meer ingelezen, want
Op.stap is doorgevoerd vanuit Katholiek Onderwijs Vlaanderen." Kept rather than dropped before an API import because it is
the one route that loads the non-G goal sets (ratified Art. VII.2 keeps it available until then). While the stand is loading
or failed, neither is shown.

### Trap 3: server Dutch and the E5-03 rule
`opmerkingen` and the 409/502 `detail` are rendered as given (grouped per discipline, since some notices do not name it);
every sentence of my own is in `nl.json`. `problemen[].reden` is never rendered (a test asserts the English text is absent).
Each conditional sentence was checked against what its branch proves:

| Sentence | Shown when | Proves |
| --- | --- | --- |
| "{n} ingeladen" / "Nog niet ingeladen" | stored minimumdoelen > 0 / = 0 | the count |
| "Versie {v}, doorgevoerd op {d}" / "Nog geen versie doorgevoerd" | an `opstapversies` row / none | which apply, when |
| "Eerst de minimumdoelen: …" | no minimumdoel stored | order; the reason is a fact of the model |
| "Doorgevoerd" / "Nog niet doorgevoerd" | `toegepast` / not, and the report writes something | whether this report was written |
| "Er verandert niets aan de minimumdoelen/leerplandoelen." | `isLeeg` (all disciplines) | nothing would be written |
| "{n} … staan niet meer in Op.stap en blijven bewaard, want er hangt schoolinhoud aan" | `verdwenenMaarGekoppeld` | that bucket's definition |
| "{oud} heet nu {nieuw}" | `hernummerd` | that bucket's definition |
| "{n} … uit Op.stap konden niet ingelezen worden." | `problemen` non-empty | refused by the mapping |
| "Excel-bestanden … niet meer ingelezen, want Op.stap is doorgevoerd …" | `laatsteVersie` non-null | the refusal's trigger |
| "Geen enkel ingeladen leerplandoel verwijst naar deze minimumdoelen." | rows without a bucket | the left join's null |

New guards in `catalogus.test.ts`: no `doelen.*` / `importeren.kov.*` value speaks of a *bestand*; no
`doelen.zonderLeerplandoel*` value uses a gap word (gedekt, dekking, ontbreekt, mist, gat, vergeten, koppel…); every
`…Meer` key of this story has its `…Een`. No em dash anywhere (existing guard).

### (a) Refused source rows get a Dutch notice beyond `NietIngelezen`
**Yes:** a count, "{n} minimumdoelen/leerplandoelen uit Op.stap konden niet ingelezen worden." plus "Meld dit aan wie de
toepassing beheert.", singular forms included. It is actionable for directie (tell the operator) even when no stored goal
is affected, which is the case `NietIngelezen` cannot cover. The reasons stay English and with the operator.

### (b) The screen shows the apply's own report
Implemented for both: when an apply returns, its answer replaces the preview (a test pins 998 in the preview, 997 in the
apply, and only 997 on screen). While an apply runs the preview stays visible, because it is what is being written. A
refused apply keeps the preview, marked "Nog niet doorgevoerd", with the server's sentence under it and *Doorvoeren* still
there to retry.

### (c) App-authored bracketed markers
Decided by the owner (2026-09-13, R2): acceptable. Nothing to build.

### The minimumdoelen no loaded goal concords
**Listed**, once, after every discipline, in a group of their own headed "Zonder ingeladen leerplandoel" with the one sentence
above, and never under a discipline: a minimumdoel has none of its own (Art. VII.0), and borrowing one would be invented.
Right after the minimumdoelen import that group holds all 998; after snapshot 1.2 it holds exactly the six of ADR-0032
decision 5 (`4-2.2.23`, `6-2.2.3`, `6-6.2.5`, `6-6.3.9`, `6-7.1.6`, `K-1.2.6`). A taxonomy or jaar/fase filter drops them (those
dimensions exist only through a goal); a search finds them.

### The register's copy and count
- The empty state was shown whenever the inner join found no concorded goal, so it said "Nog geen minimumdoelen" with 998
  stored, and its action said they came "uit het decretale bestand". Now: nothing stored → "Nog geen minimumdoelen" +
  *Laad ze in bij Inladen* (a link to `/inladen`); nothing matching → "Geen minimumdoelen voor deze filters" + *Wis de
  filters*; a failed read keeps its own state. The leerplandoelen empty state's "Importeer eerst de Op.stap-bestanden"
  (false since E1-21) gets the same link.
- The header count summed the domein facets, i.e. rows: it over-counted a minimumdoel taught in two subdomeinen and missed
  one without a goal. It now reads the server's distinct count (`aantalTreffers`): 998 after the import, where rows are
  1,090.
- **Paging (beyond the letter of the story, needed for its count):** the list fetched one page of 200 and stopped, which
  would have shown 200 of 1,090 rows under a count of 998. It now loads 200 at a time behind *Nog {n} tonen*; the group
  headings count from the facets, so they do not grow as pages arrive.

### Found in the browser, not by a test
1. **The discipline table spread over the full card at 1440**: the last column sat about 1,100 px from its name. Capped at
   `max-w-2xl`.
2. **"Nog niet doorgevoerd" beside "Er verandert niets aan de minimumdoelen."** True, and pointing at an action that is not
   offered. The status now shows only when the report was written or would write something (test added).

## Tests added

- **Vitest** `features/import/Opstapimport.test.tsx` (8): the first-time order (only the minimumdoelen preview; the apply's own
  report; the leerplandoelen preview by itself with body `{}`; the second press sends `{"versie":"1.2"}`); both previews with
  stored minimumdoelen and no *Doorvoeren* or status when nothing changes; the Excel upload offered without a version and
  replaced by its line after; a 502 detail under the leerplandoelen with the minimumdoelen report kept; a 409 on the
  leerplandoelen apply after a successful minimumdoelen apply; 5,835 codes summarised as `5.835` with no code rendered and an
  overgeslagen discipline; skipped goal sets named, the problem count shown and the English reasons absent, a renumbering;
  the changelog only after a click, and no toggle for a null changelog.
- **Vitest** `features/doelen/Minimumdoelenlijst.test.tsx` (6): the empty state and its link; the group without a leerplandoel
  and no gap words; all minimumdoelen listed before any leerplandoel exists; `whitespace-pre-line` with the `\n- ` kept; the
  filter empty state and its button; paging past 200 with `overslaan=200`.
- **Vitest** `i18n/catalogus.test.ts`: the three guards above.
- **xUnit (in-memory)** `MinimumdoelenQueryTests` (+4): listed last without a bucket; all listed with no leerplandoel; a taxonomy
  filter drops them; the facets count minimumdoelen, not rows, with no empty option.
- **xUnit (PostgreSQL)** `OpstapLeerplandoelenImportEndpointsTests` (+2): the stand before and after an apply (and the fake
  source never asked); the register over real PostgreSQL (ordering, NULLs, search, filter, facets) before and after an
  import. `CurriculumbeheerAutorisatieTests` names the new route; `ElkeRouteVraagtEenSessieTests` covers it by enumeration.

## Gates

*(PostgreSQL 17.5 in a throwaway container `jp-e122` on port 55440.)*

- `pnpm lint` (oxlint + `tsc --noEmit`): **clean**, no warnings (three fast-refresh warnings from a first draft were fixed by
  moving non-components into `stappen.ts` / `opmaak.ts`).
- `pnpm test`: **33 files, 227 tests passed**.
- `pnpm build`: **passes**; the chunk-size notice is the existing bundle.
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors** (also after the format pass).
- `dotnet format Jaarplanner.sln --verify-no-changes`: **clean after one `dotnet format` pass**, which re-wrapped the comment
  I had put inside the fluent chain in `MinimumdoelenQuery.cs` (whitespace only).
- `dotnet test -c Release --no-build` with `JAARPLANNER_TEST_POSTGRES`, live switch off, as CI runs it (before the
  whitespace-only format pass): **unit 1,110 passed, 4 skipped** (live contract tests); **integration 340 passed, 1 skipped**
  (the live KOV → PostgreSQL test); **0 failed**. Unit re-run after the format pass: same result.
- Not run: the live tests (`JAARPLANNER_LIVE_OPSTAP=1`), the antagonist and the test-runner (the orchestrator's).

## Browser pass

The real app from this worktree: API `bin-run` on 5241 in Development against the migrated throwaway database `jp_e122`,
Vite on 5242, headless Chrome over CDP on 9341 (own profile), signed in through the development sign-in as
`directie@jaarplanner.local`. **KOV's live API was read end to end**; nothing faked. Screenshots in the scratchpad
`C:\Users\siebe\AppData\Local\Temp\claude\C--Source-Jaarplanner\862efea7-537c-42c4-98ee-d05011f28abd\scratchpad\shots\`:

| # | File | What it shows |
| --- | --- | --- |
| 01 | `01-doelen-minimumdoelen-leeg-1440.png` | Empty database, dark: "0 minimumdoelen", "Nog geen minimumdoelen", *Laad ze in bij Inladen* |
| 02 | `02-inladen-begin-1440.png` | Op.stap tab before anything: "Nog niet ingeladen", "Nog geen versie doorgevoerd", the Excel disclosure |
| 03 | `03-ophalen-minimumdoelen-{1440,licht-1440,licht-390}.png` | First *Op.stap ophalen*: 998 nieuw, "Eerst de minimumdoelen…", accent on *Doorvoeren* |
| 04 | `04-md-doorgevoerd-lp-voorbeeld-licht-1440.png` | After the first *Doorvoeren*: minimumdoelen "Doorgevoerd", "998 ingeladen", the leerplandoelen preview (5.835 nieuw, 13 disciplines, skipped goal sets) |
| 05 | `05-lp-voorbeeld-wijzigingslog-licht-1440.png` | The changelog opened (222,188 characters, scrollable, focusable) |
| 06 | `06-lp-voorbeeld-licht-390.png` | The same at 390: the table is 324 px wide, names wrap, no overflow |
| 07, 08 | `07-register-998-zonder-leerplandoel-licht-1440.png`, `08-…-390.png` | Minimumdoelen stored, no leerplandoel yet: "998 minimumdoelen", one group "Zonder ingeladen leerplandoel (998)", decreed lists on their own lines |
| 09 | `09-lp-doorgevoerd-licht-1440.png` | After the second *Doorvoeren*: "Versie 1.2, doorgevoerd op 13 september 2026", capped table, the Excel line instead of the upload |
| 10 | `10-register-na-import-boven-licht-1440.png` | Register after the import: "998 minimumdoelen", disciplines with their codes |
| 11, 12 | `11-register-zes-zonder-leerplandoel-licht-1440.png`, `12-…-390.png` | The last group: exactly the six, under the neutral sentence |
| 13, 14, 15 | `13-na-import-opnieuw-opgehaald-licht-1440.png`, `14-…-licht-390.png`, `15-…-donker-1440.png` | A fresh fetch after the import: "Er verandert niets" for both, no status, no *Doorvoeren* |

The full-page captures 05–08 paint the fixed sidebar/header mid-page; that is how CDP captures a scrolled page with fixed
elements, not the layout (the viewport captures 10–15 of the same screens are clean).

**Measured in the browser, every alpha layer composited onto the page background:**

| Element (new in this story) | Light | Dark |
| --- | --- | --- |
| Stand values (`dd`) | 17.78 | 13.12 |
| Stand labels (`dt`, inkt-zacht) | 6.51 | — |
| "Nog niet doorgevoerd" / "Doorgevoerd" | 6.51 / 17.78 | 7.58 / 13.12 |
| "Eerst de minimumdoelen…", "Versie 1.2, gepubliceerd…" | 6.51 | 7.58 |
| Excel disclosure button | 6.08 | — |
| *Doorvoeren* (accent) | 6.10 | 7.06 |
| Table header, discipline number, zero cells (inkt-zwak) | 4.97 | 5.78 |
| Count labels on the diep well (existing `Telling`) | 4.52 | 6.45 |
| Changelog region | 16.86 | 14.19 |
| Goal-set mark / name | 4.97 / 6.51 | 5.78 / — |
| "Geen enkel ingeladen leerplandoel…" | 6.51 | — |

No horizontal overflow at 390 on either screen (`scrollWidth` 390). Every server and the container this session started was
stopped (see the report).

## Not done, and why

1. ~~**Discipline groups sort as 1, 10, 2, …**~~ *Fixed in fix round 1 (antagonist MINOR): numeric order on the server.*
2. ~~**A repeat apply on a database with Excel history offers *Doorvoeren* again** … "Honest, but repetitive".~~ *Corrected
   in fix round 1: that was not honest, it was the antagonist's MAJOR. It also happened on an API-only database the first
   time a snapshot dropped a goal, and every press recorded a duplicate version row. Both imports now report an already
   flagged row as `eerderVerdwenen`, which writes nothing, and the server decides `schrijftIets`.*
3. ~~**Changed fields are shown by their model names**~~ *Fixed in fix round 1: Dutch labels, with the identifier as fallback.*
4. **No per-code list of additions** by design; a directie who wants the codes has the register.
5. `CLAUDE.md` lines 21 and 137 and `docs/adr/README.md` are held by other sessions; nothing in them was touched.

## Owner ruling 2026-09-13 (in session): "Reden tonen"

Asked "Moet de lijst die reden per minimumdoel tonen?", the owner answered "Reden tonen". The register therefore shows, per
minimumdoel in "Zonder ingeladen leerplandoel", why no loaded leerplandoel concords it, but only what is known (the E5-03
rule). Built in fix round 1, below.

**No constitution amendment, argued.** Art. IX.1 lists a `Minimumdoel`'s *functional* fields (ref, leeftijd, nr,
omschrijving: the decreed content). The two new columns are import metadata of the same kind as `NietMeerInOpstap`
(E1-21, on both curriculum entities) and `Leerplandoel.OpstapSleutel`, which were added without an amendment: derived from
KOV's snapshot, written only by the import through EF metadata (the entity has no mutator), never shown or used as decreed
text, and recomputed by every applied leerplandoelen import. Art. III.1 (decreed content never mutated) is untouched,
because none of the four decreed fields changes. Had the reason been something a teacher could edit, or something coverage
counted, the answer would differ; it is neither.

## Fix round 1 (2026-09-13, after round 1 on `6fe98a6`: test-runner PASS; antagonist 1 MAJOR, 4 MINOR, 1 QUESTION)

Both verdicts are committed with this round: [`antagonist.md`](antagonist.md), [`test-report.md`](test-report.md).

| # | Finding | Resolution | Tests |
| --- | --- | --- | --- |
| MAJOR | A repeat fetch offered "Nog niet doorgevoerd" + *Doorvoeren* for an apply that changed nothing; the apply added a duplicate `Opstapversie` | **At the source, in both services and so for the Excel route too.** `verdwenen` / `verdwenenMaarGekoppeld` now hold only rows not flagged yet (a real write); a row an earlier import flagged is `eerderVerdwenen` (no write, not a review item, no notice); a flagged row delivered again unchanged is `teruggekeerd` (the flag clears, a write, with a Dutch notice; it used to hide in `ongewijzigd`). Each diff carries a server-computed `schrijftIets`; the leerplandoelen answer carries one over the whole report (a discipline writes, a reason per minimumdoel changes, or the version differs from the last applied one). A version row is added only when a discipline writes or the version is new. **Not** "version and hash equal ⇒ nothing": a widened selection makes the same snapshot add goals (tested). Under the opt-in purge an already flagged, unlinked row is still `verdwenen`, because the purge removes it. `stappen.ts` now reads `schrijftIets` instead of reconstructing it. A version-only report gets its own sentence ("Doorvoeren legt versie {versie} vast als de doorgevoerde versie."). Storing an Op.stap key on an Excel row stays bookkeeping and does not count as a write (it rides along with the next apply). | Unit: `Een_al_gemarkeerd_minimumdoel_wordt_niet_opnieuw_als_verdwenen_gemeld_en_er_valt_niets_te_schrijven`, `Een_al_gemarkeerd_doel_wordt_niet_opnieuw_als_verdwenen_gemeld` (linked and unlinked), `Onder_de_opt_in_opruiming_…`, the return tests, `Een_herhaalde_toepassing_van_dezelfde_versie_schrijft_niets_en_legt_geen_tweede_versie_vast`, `Een_andere_versie_zonder_gewijzigde_doelen_wordt_toch_vastgelegd`, `Een_verbrede_selectie_bij_dezelfde_versie_heeft_wel_iets_te_schrijven`. PostgreSQL: `Een_herhaalde_ophaling_na_een_verdwenen_doel_heeft_niets_te_schrijven` (API-only), `Na_een_exceldoel_dat_kov_niet_heeft_heeft_een_herhaalde_ophaling_niets_te_schrijven` (Excel history), `Een_herhaalde_ophaling_na_een_verdwenen_minimumdoel_heeft_niets_te_schrijven`; `De_toepassing_laadt_…` now expects one version row (it asserted two). Vitest: `biedt bij een herhaalde ophaling na een verdwenen doel geen doorvoeren aan`, `zegt waarom doorvoeren wordt aangeboden als alleen de versie of de uitleg …`. Live: `OpstapApiLiveImportTests` expects one version row after the repeat apply and `schrijftIets` false. |
| Owner ruling | "Reden tonen" | `ZonderLeerplandoelReden` (enum) + `ZonderLeerplandoelDoelsets` on `Minimumdoel`, migration `20260913164907_MinimumdoelZonderLeerplandoelReden` (two nullable columns, nothing else). The source now reports every snapshot goal that points at a minimumdoel without being imported (`MinimumdoelVerwijzing`: skipped-set goals, and refused G goals); `ZonderLeerplandoelBepaling` (pure, Application) decides per ref: an importable goal → no reason; a refused G goal → `DoelNietIngelezen`; only skipped sets → `AlleenOvergeslagenDoelsets` + the sets; nothing → `GeenDoelInOpstap`. An importable goal whose discipline was not imported (a selection, an unknown discipline) gives no reason: that is not a fact about the minimumdoel. Recomputed for every stored minimumdoel on every leerplandoelen apply; a preview counts what would change (`aantalRedenenGewijzigd`, shown as "Bij {n} minimumdoelen verandert de uitleg in het register."), and a change is a write, so a database migrated before this round gets its reasons at the next apply. The register returns the reason on the row without a bucket only; the frontend renders "Alleen zwemdoelen verwijzen ernaar, en die worden niet ingelezen.", "In de doorgevoerde versie van Op.stap verwijst geen enkel doel ernaar." or "Een gemeenschappelijk doel verwijst ernaar, maar dat doel kon niet ingelezen worden."; no reason, no sentence. Set names in Dutch (zwemdoelen, doelen voor Vlaamse Gebarentaal, …), joined with `Intl.ListFormat`. **Live, snapshot 1.2:** `6-7.1.6` AlleenOvergeslagenDoelsets `Z`; `4-2.2.23`, `6-2.2.3`, `6-6.2.5`, `6-6.3.9`, `K-1.2.6` GeenDoelInOpstap; no other minimumdoel has a reason: as the coordinator predicted. | `ZonderLeerplandoelBepalingTests` (2), `De_reden_per_minimumdoel_wordt_uit_de_snapshot_afgeleid_en_met_de_toepassing_opgeslagen`, `De_reden_zonder_leerplandoel_staat_alleen_op_de_rij_zonder_bucket`; PostgreSQL `Het_register_toont_de_reden_per_minimumdoel_zonder_leerplandoel_en_ordent_disciplines_als_getal`; live `OpstapApiLiveImportTests` asserts the six reasons against KOV; Vitest `zegt per minimumdoel zonder leerplandoel waarom, maar alleen wat de import weet`; catalogue guard extended to `doelen.reden*`, `doelen.doelset*`, `doelen.herhaald` (and counts the three reasons). |
| MINOR | Changed fields shown as identifiers | `veldLabel` in `opmaak.ts`: 14 identifiers mapped to `importeren.veld.*`, unknown ones shown as sent; used in both reports (`Opstaprapport.tsx` and the Excel report in `Opstapbestand.tsx`). | Vitest `noemt gewijzigde velden in het Nederlands, niet met hun code` (incl. the fallback) |
| MINOR | Register sorted disciplines as text | `MinimumdoelenQuery` orders by (no bucket last, length of the whole-number part, that part, the full number), computed in SQL, which matches `DisciplinenummerVergelijker` for every real number. | `Disciplines_staan_in_hun_numerieke_volgorde_en_zonder_bucket_blijft_laatst` (in-memory); the PostgreSQL register test puts 2 before 10; browser: … 9.3, 10 Frans, then the group without a bucket |
| MINOR | Two accent buttons when the Excel disclosure was open | Both Excel buttons are `rustig`; the worklog's design claim ("a screen never shows two primary actions") is now true. Measured: "Voorbeeld bekijken" ink on white 17.78:1, no accent. | Vitest asserts the Excel button has no `bg-accent` while *Op.stap ophalen* has it |
| MINOR | `Minimumdoelenlijst.tsx` comment gave reasons its branch cannot prove | Now: "no loaded leerplandoel refers to it. The reason, when known, comes from the import … when it is not known, nothing more is said." | — |
| QUESTION | "Laad ze in bij Inladen" shown to every role | Carry-forward note on **E6-02** (`backlog/E6-beheer-rollen-samenwerking.md`): gate that link (and the Doelen header's Inladen button) on the same role once `Curriculumbeheer` narrows. | — |
| Test-runner note | Group headings count rows (sum 1,090) while the header counts 998 minimumdoelen | A neutral line above the list, shown only when rows outnumber minimumdoelen (so only when a minimumdoel really is listed twice): "Een minimumdoel kan meer dan eens voorkomen: onder elke discipline en elk subdomein waarin een ingeladen leerplandoel ernaar verwijst." | Vitest `zegt dat een minimumdoel meer dan eens kan voorkomen, maar alleen als dat zo is` |

### Verification after fix round 1

*(PostgreSQL 17.5 in a throwaway container `jp-e122-f1` on port 55441.)*

- `pnpm lint`: **clean**. `pnpm test`: **33 files, 232 tests passed**. `pnpm build`: **passes** (existing chunk-size notice).
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors** (a first attempt surfaced one CS8631 in a new test and a
  missing `using` in the live test; both fixed before the counts below).
- `dotnet format Jaarplanner.sln --verify-no-changes`: **clean after one `dotnet format` pass** (line endings of the comment
  block added to `MinimumdoelenQuery.cs`).
- `dotnet test -c Release --no-build`, `JAARPLANNER_TEST_POSTGRES` set, live switch off, as CI runs it: **unit 1,124 passed,
  4 skipped** (live); **integration 344 passed, 1 skipped** (live); **0 failed**. The full integration project ran.
- Live, `JAARPLANNER_LIVE_OPSTAP=1`, once: **unit 4/4, integration 2/2** (the KOV → PostgreSQL test now also asserts one
  version row after the repeat apply and the six reasons above).
- Byte check (`node` over every `.cs` under `backend/src` and `backend/tests`): **438 files, 0** control characters other
  than tab/LF/CR, **0** U+00A0.
- **Browser re-check** (API `bin-run` on 5243 against a migrated `jp_e122_browser`, Vite on 5244, headless Chrome CDP on
  9342, KOV live). To get a realistic "gone" row, `assets/opstap-xlsx/Wiskunde.xlsx` was loaded through the Excel route
  first (319 goals, three of them G goals KOV lacks). Then *Op.stap ophalen* → *Doorvoeren* (998 minimumdoelen) → the
  leerplandoelen preview: 5.582 nieuw, 253 wijzigt, 3 weg; changed fields read "voorbeelden, toelichting, minimumdoel";
  "Bij 6 minimumdoelen verandert de uitleg in het register." → *Doorvoeren* → "Versie 1.2, doorgevoerd op 13 september
  2026". **Then a repeat *Op.stap ophalen*: "Er verandert niets aan de minimumdoelen.", "Er verandert niets aan de
  leerplandoelen.", no status, no *Doorvoeren*** (the case the MAJOR was about, on an Excel-history database). Database
  after: 1 `opstapversies` row, 3 flagged leerplandoelen, exactly six stored reasons (above). Register: "998 minimumdoelen",
  the repeat note, groups 1 … 9.3, 10 Frans, then "Zonder ingeladen leerplandoel (6)" with a reason under each. No
  horizontal overflow at 390. Screenshots in
  `C:\Users\siebe\AppData\Local\Temp\claude\C--Source-Jaarplanner\862efea7-537c-42c4-98ee-d05011f28abd\scratchpad\shots-f1\`:
  `f1-01-excel-voorbeeld-rustig-licht-1440` (Excel buttons `rustig`, accent on *Op.stap ophalen*),
  `f1-02-lp-voorbeeld-na-excel-licht-1440`, `f1-03-lp-doorgevoerd-licht-1440`, `f1-04-herhaling-niets-te-doen-licht-1440`,
  `f1-05-…-390`, `f1-06-register-boven-notitie-licht-1440`, `f1-07-register-zes-met-reden-licht-1440`, `f1-08-…-390`,
  `f1-09-…-donker-1440`.
- **Contrast of what is new**, measured in the browser with alpha composited (light / dark): reason lines 6.51 / 7.58; the
  repeat note 6.08 / 8.44; "Bij 6 minimumdoelen verandert …" is the same `text-meta text-inkt-zacht` on white as the reason
  lines (6.51); Excel buttons 17.78 (rustig).
- All servers and the container of this round stopped; ports 55441, 5243, 5244 and 9342 released.
- Not run: the antagonist and the test-runner (the orchestrator's).

## Fix round 2 (2026-09-13, after round 2 on `617e44e`: test-runner PASS; antagonist 0 MAJOR, 4 MINOR, 1 QUESTION)

Both round-2 verdicts are committed with this round ([`antagonist.md`](antagonist.md), [`test-report.md`](test-report.md)).

| # | Finding | Resolution | Tests |
| --- | --- | --- | --- |
| MINOR 1 | The reason could claim more than the snapshot proves: (a) a goal KOV dropped stays stored, flagged and concorded, so its minimumdoel keeps its register place, yet got `GeenDoelInOpstap` and was counted; (b) a minimumdoel KOV withdrew got "geen enkel doel verwijst ernaar", unproven | `LeerplandoelImportService` now computes what points at each minimumdoel **after** this import, identically for preview and apply: the stored concordance, with every goal of a discipline the shared writer took over replaced by its snapshot version (a dropped goal keeps its ref). No reason for a minimumdoel in that set, and none for a minimumdoel flagged `NietMeerInOpstap`. `ZonderLeerplandoelBepaling` takes that set as `zonderReden`; `Minimumdoel.cs`'s definition lists all four no-reason cases. Snapshot 1.2 still gives exactly the six (live test and browser). | `Een_minimumdoel_waar_een_opgeslagen_verdwenen_doel_naar_verwijst_krijgt_geen_reden` (unit, preview count 0), `Een_minimumdoel_dat_niet_meer_in_opstap_staat_krijgt_geen_reden` (unit, preview count 0), `Een_ref_die_de_aanroeper_uitsluit_krijgt_geen_reden`; PostgreSQL `Een_minimumdoel_waar_een_opgeslagen_verdwenen_doel_naar_verwijst_houdt_zijn_plaats_zonder_reden` (register row under discipline 2, reason null, preview count 0) |
| MINOR 2 | A first apply with no version recorded counted as "the same version" | `andereVersie = vorige is null \|\| …` in the flag and the version-row condition; `alleenVersie` in `Opstaprapport.tsx` matches. A first apply therefore always records the version, is offered, and closes the Excel route (Art. VII.2). Not reachable with live data (the test-runner's note: a first API apply over Excel rows always rewrites `MinimumdoelRef`), so proven in tests, not in the browser. | Unit `Een_eerste_toepassing_legt_de_versie_vast_ook_als_er_geen_doel_verandert`; PostgreSQL `Een_eerste_toepassing_zonder_gewijzigd_doel_legt_de_versie_vast_en_sluit_de_excelroute` (only an unknown discipline, reasons unchanged, `schrijftIets` true, one version row, Excel preview 409); Vitest `biedt een eerste doorvoering zonder gewijzigd doel aan met de zin over de versie` |
| MINOR 3 | Comments over-claimed; the minimumdoelen return notice named a "vervallen" mark no screen shows on a minimumdoel | The key-only exception is stated in the `OpstapImportService` class note, `ILeerplandoelImportService`, the controller and `types.ts` (twice). *(This row first said "wherever `SchrijftIets` is described", which was false: `stappen.ts` still said "a version not applied yet" without the exception. Fixed in round 3, antagonist round 3 MINOR 3.)* The minimumdoelen notice is now "1 minimumdoel staat weer in de Op.stap-bron." / "{n} minimumdoelen staan weer in de Op.stap-bron.", its doc says what holds. (The leerplandoelen notice keeps "vervallen": the register does show "Vervallen in Op.stap" on a flagged leerplandoel.) | `De_melding_over_teruggekeerde_minimumdoelen_is_verbogen` |
| MINOR 4 | No test that a preview never clears the flag; Excel load button keyed on `!isLeeg` | Preview tests in both services; the Excel *Inladen* button now shows on `diff.schrijftIets`. | `Het_voorbeeld_van_een_teruggekeerd_minimumdoel_laat_de_markering_staan`, `Het_voorbeeld_van_een_teruggekeerd_doel_laat_de_markering_staan` |
| QUESTION | Where is the ruling recorded? | Dated amendment note on ADR-0032 decision 5 ("Amended 2026-09-13 by owner ruling"), original text kept, the two columns and the migration named, no constitution change. | — |
| Test-runner observation | After a repeat fetch no button carried the accent | *Op.stap ophalen* is `hoofd` whenever there is nothing to write (before any report and after one that writes nothing), `rustig` while *Doorvoeren* is offered: one primary action, never two (ADR-0024). Measured on the idle screen: 6.10:1 light, 7.06:1 dark. | Vitest: the repeat-fetch test asserts the accent on *Op.stap ophalen*; the first-apply test asserts it is not there beside *Doorvoeren* |

### Verification after fix round 2

*(PostgreSQL 17.5 in a throwaway container `jp-e122-f2` on port 55442. Docker Desktop was running throughout this round; it did
not stop, so no restart was needed.)*

- `pnpm lint`: **clean**. `pnpm test`: **33 files, 233 tests passed**. `pnpm build`: **passes**.
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors**. `dotnet format --verify-no-changes`: **clean**.
- `dotnet test -c Release --no-build`, `JAARPLANNER_TEST_POSTGRES` set, live switch off: **unit 1,130 passed, 4 skipped**;
  **integration 346 passed, 1 skipped**; **0 failed**. The full integration project ran.
- Live, `JAARPLANNER_LIVE_OPSTAP=1`, once: **unit 4/4, integration 2/2**; the KOV → PostgreSQL test still asserts exactly the
  six reasons on snapshot 1.2.
- Byte check: **438 `.cs` files, 0** control characters beyond tab/LF/CR, **0** U+00A0.
- **Browser** (API `bin-run` on 5245 against a migrated `jp_e122_browser`, Vite on 5246, headless Chrome CDP on 9343, KOV
  live, empty database): *Op.stap ophalen* → *Doorvoeren* (998) → the leerplandoelen preview with the accent on *Doorvoeren*
  only and "Bij 6 minimumdoelen verandert de uitleg in het register." → *Doorvoeren* → a repeat *Op.stap ophalen*: "Er
  verandert niets" for both, no *Doorvoeren*, no status, **the accent on *Op.stap ophalen*** (6.10 / 7.06). Database after:
  one `opstapversies` row, exactly the six reasons. Register: "998 minimumdoelen", Frans (10) last of the disciplines, the
  six with their reason; no horizontal overflow at 390. Screenshots in
  `C:\Users\siebe\AppData\Local\Temp\claude\C--Source-Jaarplanner\862efea7-537c-42c4-98ee-d05011f28abd\scratchpad\shots-f2\`:
  `f2-01-ophalen-idle-accent-licht-1440`, `f2-02-…-390`, `f2-03-register-zes-met-reden-licht-1440`, `f2-04-…-390`. The MINOR 1
  and MINOR 2 edge cases are not reachable with KOV's live data and rest on the tests above.
- All servers and the container of this round stopped; ports 55442, 5245, 5246 and 9343 released.
- Not run: the antagonist and the test-runner (the orchestrator's).

## Fix round 3 (final, not re-audited by owner decision)

After round 3 on `9c2aed8`: test-runner PASS; antagonist 0 MAJOR, 4 MINOR. The project owner then decided, 2026-09-13:
*"stop hierna maar met de antagonist rondes en rondt deze us af"*. So this round is **not independently audited**; it rests
on the gates below only. Both round-3 verdicts are committed with it ([`antagonist.md`](antagonist.md),
[`test-report.md`](test-report.md)).

| # | Finding | Resolution | Tests |
| --- | --- | --- | --- |
| MINOR 1 | "No longer in Op.stap" was read only from the flag the other import sets, so a minimumdoel KOV withdrew could keep a reason (flagged by the minimumdoelen apply while the leerplandoelen preview, unaware, changed nothing), or get `GeenDoelInOpstap` on a direct apply although a snapshot goal refers to its old address | `LeerplandoelBronResultaat.GepubliceerdeMinimumdoelen` carries the refs of the minimumdoelen index the source read from KOV; every stored minimumdoel not in it joins `zonderReden` beside the flag rule. The minimumdoelen apply that flags a row also clears its reason and sets in the same write. `Minimumdoel.cs` now says what "no longer in Op.stap" means and that only the imports write the reason. Snapshot 1.2 still gives exactly the six (live test). | `Een_minimumdoel_dat_kov_niet_meer_publiceert_krijgt_geen_reden_ook_zonder_markering` (withdrawn, not flagged: preview count 0, no reason), `Het_markeren_van_een_verdwenen_minimumdoel_wist_zijn_reden` (preview clears nothing; the apply flags and clears) |
| MINOR 2 | ADR-0032 decision 5's note attributed the realisation to the ruling and listed the stored-pointer case wrongly | The note now states the ruling as asked and answered ("Moet de lijst die reden per minimumdoel tonen?" → "Reden tonen", 2026-09-13) and marks the case list, the two columns, the migration and the no-amendment argument as *Implementer's realisation, not part of the ruling*. A minimumdoel a stored leerplandoel still points at is described as listed under that goal's discipline. | — |
| MINOR 3 | `stappen.ts` worded the leerplandoelen `schrijftIets` as "a version not applied yet", without the key-only exception | Worded like `types.ts`: a version other than the last one applied (a first apply included), and the key-only exception. The round-2 table row that said "wherever" is corrected in place. | — |
| MINOR 4 | The first-apply Vitest served a stand the server cannot produce beside `vorigeVersie: null` | The stand is now `{ aantalMinimumdoelen: 998, laatsteVersie: null }`, the state in which the Excel upload is offered; the test opens it and asserts that exactly one button on the screen, *Doorvoeren*, carries the accent. | Vitest `biedt een eerste doorvoering zonder gewijzigd doel aan met de zin over de versie` |

### Verification after fix round 3

*(PostgreSQL 17.5 in a throwaway container `jp-e122-f3` on port 55443; Docker Desktop stayed up.)*

- `pnpm lint`: **clean**. `pnpm test`: **33 files, 233 tests passed**. `pnpm build`: **passes**.
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors**. `dotnet format --verify-no-changes`: **clean**.
- `dotnet test -c Release --no-build`, `JAARPLANNER_TEST_POSTGRES` set, live switch off: **unit 1,132 passed, 4 skipped**;
  **integration 346 passed, 1 skipped**; **0 failed**. The full integration project ran.
- Live, `JAARPLANNER_LIVE_OPSTAP=1`, once: **unit 4/4, integration 2/2**; the KOV → PostgreSQL test still asserts exactly the
  six reasons on snapshot 1.2.
- Byte check: **438 `.cs` files, 0** control characters beyond tab/LF/CR, **0** U+00A0.
- No browser pass: no visible string changed in this round (`nl.json` untouched; the server's notices unchanged).
- The container of this round was removed and port 55443 released.
- Not run, by owner decision: an antagonist round 4. Not run: a test-runner pass on this round (the orchestrator's).

## Open questions / Art. XIV touched

- No Art. XIV decision assumed. The discipline selection (`IDisciplineSelectie`) is untouched; a narrower selection would
  simply put more minimumdoelen in the group without a leerplandoel, which its sentence still describes truthfully.
- **For the owner:** the group title "Zonder ingeladen leerplandoel" and its sentence are the implementer's wording for the
  six minimumdoelen no G goal reaches; directie may prefer to know *why* (Z/V goal sets, or no goal at all). That reason is
  not in the render condition, so it is deliberately not said (E5-03 corollary).

## For the test-runner

- Unit: `pnpm test` in `frontend/`; `dotnet test backend/tests/Jaarplanner.UnitTests`.
- PostgreSQL: set `JAARPLANNER_TEST_POSTGRES`, run the integration project (the two new tests are in
  `OpstapLeerplandoelenImportEndpointsTests`).
- Browser (needs KOV reachable): run the API against a fresh migrated database and Vite, sign in at
  `/api/aanmelden/ontwikkeling`, open `/doelen` → *Minimumdoelen* (expect "Nog geen minimumdoelen"), then `/inladen` → *Op.stap*
  → *Op.stap ophalen* → *Doorvoeren* (minimumdoelen) → wait for the leerplandoelen preview → back to `/doelen` (998 in
  "Zonder ingeladen leerplandoel") → `/inladen` → *Op.stap ophalen* → *Doorvoeren* → `/doelen` (998; the last group holds the
  six). Check 1440 and 390.
