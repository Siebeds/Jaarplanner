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
  existing uppercase micro style, because the brief is to extend the screen, not restyle it.

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

1. **Discipline groups sort as 1, 10, 2, …** in the register (Frans between Nederlands and Wiskunde): `MinimumdoelenQuery`
   has ordered `DisciplineNummer` as a string since E1-16; the facets use `DisciplinenummerVergelijker`. Visible now that the
   data is real. Not changed here (pre-existing, outside the story); worth a one-line follow-up.
2. **A repeat apply on a database with Excel history offers *Doorvoeren* again**: `verdwenen` keeps listing goals the Excel
   route loaded and KOV lacks (E1-21 recorded this), so the report "writes something" (it re-flags and records another
   version row). Honest, but repetitive; a durable "already flagged" notion is E1-21/E1-23 territory.
3. **Changed fields are shown by their model names** (`Tekst`, `MinimumdoelRef`), as the Excel report already did.
4. **No per-code list of additions** by design; a directie who wants the codes has the register.
5. `CLAUDE.md` lines 21 and 137 and `docs/adr/README.md` are held by other sessions; nothing in them was touched.

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
