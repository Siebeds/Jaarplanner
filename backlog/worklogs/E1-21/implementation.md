# E1-21 — Leerplandoelen from KOV's API, G goals only — implementation worklog

- **Date:** 2026-09-13
- **Branch:** `story/E1-21`, fast-forwarded to `feature/e1-opstap-api` (`8e62672` = `main` `309cc29` plus the `[~]` claim), in
  worktree `.claude/worktrees/agent-a944187cb3ec7aaa6`. Not pushed, not merged.
- **Rulings this rests on:** the owner's two of 2026-09-11 (KOV's Op.stap API is the import source; only goal set **G** is
  imported for now), recorded in [ADR-0032](../../../docs/adr/0032-opstap-api-als-importbron.md) and `CONSTITUTION.md` Art. VII.2.
- **FR / Article:** FR-2.1–2.5; Art. III.1, III.3, III.4, III.5; Art. V.2, V.6; Art. VII.2; Art. VIII; ADR-0032 decisions 5–7;
  ADR-0022 (one endpoint per import source, `Curriculumbeheer`).
- **Status:** built; unit, PostgreSQL and live gates run (below). **The done-when's last clause is not met and cannot be by
  this story** (see "Not done"). Checkbox left to the orchestrator.

## What was built

| Layer | File | What |
| --- | --- | --- |
| Domain | `Curriculum/Leerplandoel.cs` | `OpstapSleutel` (Guid?, the goal's UUID `key`), optional constructor parameter. |
| Domain | `Curriculum/Minimumdoel.cs` | `NietMeerInOpstap`, the flag ADR-0032's consequences asked for. |
| Domain | `Curriculum/Opstapversie.cs` (new) | One row per applied import: `Versie`, `Hash`, `ToegepastOp`; `IsGeldigeVersie` (digits and dots, never `latest`). |
| Domain | `Curriculum/Jaarfasen.cs` | `Normaliseer`: `1K/2K/3K` → `JK/K2/K3`, `nL` → `Ln`, everything else untouched (the clause E1-12 handed over). |
| Application | `Curriculum/Import/ILeerplandoelBron.cs` (new) | The source port and its result per discipline (goals, problems, out-of-scope codes, skipped-set counts). |
| Application | `Curriculum/Import/ILeerplandoelImportService.cs` (new) | The import port and `LeerplandoelImportResultaat` / `LeerplandoelDisciplineResultaat` / `OpstapversieWeergave`. |
| Application | `Curriculum/Import/OpstapHerkomst.cs` (new) | `Bestand` / `OpstapApi`: only the wording of notices differs per source. |
| Application | `Curriculum/Import/OpstapHerimportDiff.cs` | Three new buckets: `NietIngelezen`, `BuitenBereik`, `Hernummerd` (+ `HernummerdDoel`); `IsLeeg` / `VereistReview` extended. |
| Application | `Curriculum/Import/OpstapImportFout.cs` | `CodeInAndereDiscipline` words per herkomst ("dit bestand" is false about an API read). |
| Infrastructure | `OpstapImport/CurriculumApiBron.cs` (new) | Typed `HttpClient`: pinned snapshot, hash, `krcItems`, tree walk, G only, whole-read refusals, the href → `uniqueCode` index from the minimumdoelen endpoint. |
| Infrastructure | `OpstapImport/CurriculumdoelMapping.cs` (new) | **The** leerplandoelen mapping (Art. III.3) and the `krcItems` DTOs. |
| Infrastructure | `OpstapImport/OpstapBeschrijving.cs` (new) | Splits `description` into voorbeelden / woordenschat / toelichting on its headings. |
| Infrastructure | `OpstapImport/OpstapHtml.cs` | The shapes of the curriculum: MathML walk, KaTeX, `ol`, `hr`, tables, `li` + `br`; bold markers for the splitter. |
| Infrastructure | `OpstapImport/KovHttp.cs` (new) | The one JSON read with its failure translation, shared by both sources (moved out of `OnderwijsdoelenApiBron`). |
| Infrastructure | `OpstapImport/OnderwijsdoelenApiBron.cs` | Paging read extracted as `LeesRijenAsync` so the curriculum source uses the same rules; behaviour unchanged. |
| Infrastructure | `OpstapImport/LeerplandoelImportService.cs` (new) | Per discipline through the existing `IOpstapImportService`, **one transaction** per apply with the `Opstapversie` row; an unknown discipline is skipped with a Dutch notice. |
| Infrastructure | `OpstapImport/OpstapImportService.cs` | The three buckets, the key bookkeeping, herkomst-aware notices; shared by the Excel route. |
| Infrastructure | `OpstapImport/OpstapParseResult.cs` | `Herkomst`, `NietIngelezenCodes`, `BuitenBereikCodes`. |
| Infrastructure | `OpstapImport/MinimumdoelImportService.cs` | Writes `Minimumdoel.NietMeerInOpstap` (set when gone, cleared when back). |
| Infrastructure | `OpstapImport/ClosedXmlOpstapParser.cs` | `jaarFase` through `Jaarfasen.Normaliseer`. |
| Infrastructure | `OpstapImport/OpstapApiOptions.cs`, `OpstapApiRegistratie.cs` | `CurriculumDocument` key; the second typed client and the import service (DependencyInjection.cs untouched). |
| Infrastructure | `Persistence/…` | `OpstapversieConfiguration` (new), `opstap_sleutel` + index, `niet_meer_in_opstap`, `DbSet<Opstapversie>`. |
| Infrastructure | `Persistence/Migrations/20260913114751_OpstapApiLeerplandoelen` | Adds the two columns, the index and the `opstapversies` table. Nothing else. |
| Api | `Controllers/OpstapLeerplandoelenImportController.cs` (new) | `POST /api/opstap-import/leerplandoelen` and `…/voorbeeld`; contract below. |

Tests: `OpstapHtmlTests` (rewritten, +18), `OpstapBeschrijvingTests`, `CurriculumdoelMappingTests`, `CurriculumApiBronTests`,
`LeerplandoelImportServiceTests`, `OpstapversieTests` (new); additions to `OpstapImportServiceTests` (+12),
`MinimumdoelImportServiceTests` (+3), `JaarfasenTests`, `ClosedXmlOpstapParserTests`, `OpstapImportFoutTests`;
`CurriculumApiLiveContractTests` (live, 3); integration `OpstapLeerplandoelenImportEndpointsTests` (PostgreSQL, 8),
`OpstapApiLiveImportTests` (live + PostgreSQL, 1); `CurriculumbeheerAutorisatieTests` names the six routes.

## The census of snapshot 1.2, and what it decided (2026-09-13)

Read from `…/snapshots/1.2/krcItems` (12,818,949 bytes, 15,282 items; version `1.2`, hash
`8f470a12-231f-5817-7a8b-6582195e2583`, published 2026-08-27T10:03:07Z; `latest` answers the same version and hash today).

**The tree.** Every goal's parent is a `KRC_AGE_RANGE_ITEM`; above it a `KRC_GOAL_SET_ITEM`, then a cluster (4,971 goals) or
directly the subdomain (2,509), then domain and discipline. No goal lacks an identifier; no G code occurs twice. 13
disciplines, identifiers `1`–`11` with `9-1`/`9-2`/`9-3`. Domain, subdomain and cluster titles carry no markup (longest 89,
110, 114 characters). The goal carries its own `domain`/`subdomain`/`discipline` titles too; they agree with the ancestors on
all 5,835 G goals (the mapping uses the ancestors, as the story asked).

**Goal sets** (all 7,480 goals): G 5,835 · P 762 · S 436 · V 247 · + 105 · A 67 · Z 28. G age ranges are only JK…L6.

**The concordance.** A goal's `minimumGoals` are **hrefs** (`/agodi/onderwijsdoelen/opstap/93408`), not `uniqueCode`s, so the
source also reads the minimumdoelen endpoint (998 rows) to translate them. G goals: 4,983 with one ref, 852 with none, 0 with
two; **0 unresolved**; 992 distinct minimumdoelen reached. The six not reached are exactly ADR-0032's: `4-2.2.23`,
`6-2.2.3`, `6-6.2.5`, `6-6.3.9`, `6-7.1.6`, `K-1.2.6`.

**The Excel codes meet the API codes.** The repo's Excel files write the 9.x codes the same way (`9-2.1.PF1.1`), so rows
update in place. Of 2,519 Excel codes, 15 are not in the API: Wiskunde `2.1.GK3.6`, `2.4.GK2.4`, `2.4.GK3.7`; LO
`7.3.GK2.2`, `7.3.GK3.2`, `7.4.SF4.1`–`7.4.SF4.5`; NL `1.3.GK3.5`, `1.3.GK3.8`, `1.6.GK2.7`, `1.6.GK3.6`; SEL `9-3.3.GK2.2`.
They carry no key (the Excel route has none), so they are reported as *verdwenen* and flagged, not as renumbered.

### Markup: the census, and the decision per shape

Tags in G titles: `span` 76, `math`/`mfrac` 60, `mrow` 156, `mn` 120, `br` 24. In G descriptions: `strong` 9,810, `li`
11,930, `ul` 3,626, `br` 2,899, `span` 1,132, `em` 374, `math` 204, `mrow` 602, `mfrac` 208, `mn` 416, `td` 146, `tr` 62,
`th` 26, `table`/`tbody` 16, `ol` 8, `mo` 6, `sup` 6, `semantics`/`annotation` 4, `mtext` 2, `hr` 2, `thead` 2, `img` 12.
(Counts are opening plus closing tags.) Attributes: `span@class` 163, `math@xmlns` 128, `td@style` 73, `table@style` 8,
`table@border` 1, `img@src`/`alt` 12. Bare `<`: exactly the three the story named. Entities: `&quot;` 1,142, `&gt;` 21,
`&amp;` 5, `&lt;` 3.

| Shape (G goals, 1.2) | Count | Decision | Why it keeps the text |
| --- | --- | --- | --- |
| MathML fraction in `mrow` with `xmlns`, in a `math-node` span | 124 formulas | Parse the `<math>` element as XML and walk it; `mfrac` → `a/b` | Stripping writes `12` for ½; the E1-12 regex only knew `<math><mfrac>` with nothing around it. |
| Plain fraction (E1-12's shape), with or without `xmlns`/whitespace | 5 | Same walk; output byte-identical to E1-12 | Regression below: no minimumdoel text changed. |
| `mfrac` `mo` `mfrac` (`2.2.GL4.6`) | 1 | `mo` keeps its sign between spaces: `7/10 - 3/10` | The operator is content. |
| `semantics` + LaTeX `annotation` (`2.5.GL6.6`) | 2 | Keep the presentation, drop the annotation | The annotation is the same formula again. |
| KaTeX (`katex-display` › `katex-mathml` + `katex-html`) | 2 | Drop the `katex-html` copy (balanced span match); a `katex-display` block gets its own line | Otherwise the formula is written three times; before the block fix "Berekening" and "2/10 = 1/5" ran together. |
| Any other MathML element, text loose in a container, XML that does not parse | 0 | Refused (`<math>`) | Not guessed at. |
| `ol` (`2.4.GL1.2`, `2.1.GL6.31`, `2.5.GL6.6`, `2.5.GL6.11`) | 4 lists | Numbered lines `1. `…, `start` honoured, nested `ul` keeps dashes; any other `ol` attribute or unbalanced tags → refused | The numbering is part of what the list says. |
| `<li><br>` | (2 goals affected) | The empty first line of an item is dropped | It separated the item from its dash or number; the only change to text the E1-12 converter already accepted (below). |
| Data table (`2.4.GL4.9`, `2.5.GL2.3` ×2, `2.5.GL6.11` ×2) | 5 | One line per row, cells between ` \| `, `th` as cells | Rows and columns survive; `colspan`/`rowspan`, nested tables, content outside cells or block content in a multi-cell row → refused (none occur). |
| One-cell layout table (`8.1.GL1.1` ×2) | 2 | The cell's content stands in its place | It holds the goal's section headings; flattening it as a table would hide them. |
| Empty table (`2.2.GL2.2`, a 4 × 5 grid: "4 rijen met telkens 5 stoelen") | 1 | `[lege tabel van 4 rijen en 5 kolommen]` | Text cannot draw it; stripping loses that there is a picture. Same kind of marker as E1-12's `[afbeelding: …]`. |
| `hr` (`2.4.GL4.9`, `6.5.GL6.8`) | 2 | A line break | It separates two examples. |
| `sup` | 3 | E1-12's rule (`10^2`); all three are plain powers of ten | — |
| `img` with alt (`3.5.GL4.15`, …) | 12 | E1-12's rule | — |
| KaTeX render **already flattened by KOV** (`2.1.GL6.29`: `20200=0,10=10%\frac{20}{200} = 0,10 = 10\%20020​=0,10=10%`) | 1 goal | Kept verbatim | The classes are gone in KOV's own data, so its site shows the same string; repairing it would be us writing curriculum text. |

**Result:** the E1-12 converter refused **43 G goals**; this one refuses **none**. A comparison of both converters over all
13,666 fragments (title and description of the 998 minimumdoelen and the 5,835 G goals): 13,621 accepted by both convert
**identically** except 2 (`2.3.GL1.15`, `2.4.GL4.8`, the `<li><br>` dash), and **no minimumdoel text changes**, so the next
minimumdoelen re-import reports nothing new. Stored text never contains `</` or the bold markers.

### The description split: the census, and the decision

Of 3,066 non-empty G descriptions, 2,338 mention "oorbeeld" and 295 "oordenschat"; bold section headings at the start of a
line: `Voorbeeld(en):` 1,685, `Richtinggevende woordenschat:` 278 (+6 without colon), `Voorbeelden:` 202, `Toelichting`
105, `Toelichting:` 102, `Voorbeeld:` 40, `Voorbeeld` 23, `Voorbeeld(en)` 19, `Verdere referenties` 19, `Voorbeelden` 15,
KOV's typo `Voorbeel(den):` 2, a split `V` + `oorbeeld(en):` 2, and 41 labels in a plain `<span>` on their own line; plus
titled examples (`Voorbeeld 1: Toename`, `Voorbeeld: Fruit uitdelen`, …). After a voorbeelden section KOV writes
`Mogelijke aanpak in de klaspraktijk` 9, `Mogelijke aanpak met onderzoekende houding` 8, `Mogelijke indeling voor de
klaspraktijk` 6, `Verdere referenties` 5, `Mogelijke onderzoekscontexten` 1; every other bold line after it is example
content (`6 × 19`, emoji, food chains, `Spelsituatie`).

Decision (class doc of `OpstapBeschrijving`): bare labels open their section and are dropped; a heading that says more
opens its section and stays as its first line; the `Mogelijke …` and `Verdere referenties` headings open toelichting; any
other bold line is content. **Result on 1.2:** voorbeelden 2,272 goals, woordenschat 284, toelichting 1,905. A word audit
over every G description found nothing missing from the three fields but the labels themselves; the 42 "toelichting only"
descriptions that differ from the whole text differ exactly by the dropped `Toelichting` label. Known misplacements, text
kept: a non-bold "Voorbeeld" glued to a sentence (`2.1.GK2.4`) stays in toelichting; a bold label inside a list item stays
where it is (2 goals).

## Key decisions

1. **Absent is not gone** (`OpstapImportService`). The story did not name it, and it would have been a MAJOR: the Excel
   files hold every goal set, so a G-only import would have flagged every stored P, S, + and A goal *niet meer in Op.stap*
   (66 in Wiskunde alone) while KOV lists them. Stored codes the source names under a skipped set are `BuitenBereik`
   (untouched, not a review item); stored codes whose G goal the mapping refused are `NietIngelezen` (untouched, review
   item, Dutch notice), as E1-12 does for minimumdoelen. The Excel route benefits too: a malformed row whose code is
   stored is no longer flagged.
2. **Renumbering** reports a pair (`Hernummerd`) when a vanished code and a new code share the Op.stap key, *instead of* an
   addition plus a disappearance; what is written is unchanged (new code inserted, old one kept and flagged, links stay on
   the old code). The key index is **not unique**, because both rows carry the key. Storing a key on a row that had none is
   bookkeeping and not reported; a key that changes under one code is reported; a re-import without keys keeps the stored one.
3. **The version is pinned by the caller of the apply.** The preview may omit it and reads the newest *number* (via the
   63-byte `latest/…/hash`, never `latest/krcItems` itself); the apply must send that number back, so it writes what was
   reviewed even if KOV publishes a new version between the two. The source checks the snapshot it gets is the version it
   asked for. This resolves E1-22's decide-and-record (b) for the leerplandoelen; the minimumdoelen endpoint still has no
   version.
4. **One transaction per apply**, around every discipline and the version row, so a refusal in any discipline leaves the
   database as it was ("Er is niets gewijzigd" becomes true of the whole import). Proven on PostgreSQL.
5. **A discipline this application does not know is skipped with a notice** rather than refused with the Excel path's 400,
   whose advice is for someone uploading a file.
6. **Whole-read refusals** mirror E1-12: a goal without identifier or UUID key, a duplicate code, a goal off the expected
   tree, an unknown discipline-identifier shape, a snapshot with no G goal, or a minimumdoel row without a usable
   `uniqueCode` refuses the read (502), because each could make a stored goal read as *verdwenen*. A G goal naming two
   minimumdoelen is refused alone rather than concorded to the first (ADR-0018; none does in 1.2).
7. **`Minimumdoel.NietMeerInOpstap`** came cheap with the same migration: set on apply when the source no longer names the
   ref at all, cleared when it does again; a refused row is not marked.
8. **`jaarFase` normalisation** lives in `Jaarfasen.Normaliseer` and runs on both paths; it normalises and never guesses
   (`K1` is left for the G mapping to refuse).
9. **Plain text, not HTML, for KOV's changelog** (`wijzigingslog`, 222,188 characters for 1.2), like every other KOV text.

## Verification

*(Commands run in this worktree; PostgreSQL 17.5 in a throwaway container on port 55432.)*

- `dotnet format Jaarplanner.sln --verify-no-changes`: **exit 0**, after one `dotnet format` pass that re-wrapped lines in
  four of this story's files.
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors**.
- `dotnet test Jaarplanner.sln --no-build -c Release` with `JAARPLANNER_TEST_POSTGRES` set and the live switch off, as CI
  runs it: **unit 1,090 passed, 4 skipped** (the live contract tests, E1-12's and this story's three); **integration 336
  passed, 1 skipped** (the live KOV → PostgreSQL test); **0 failed**. Every PostgreSQL test in the project ran, not only
  this story's classes.
- Live, `JAARPLANNER_LIVE_OPSTAP=1`, same build: `CurriculumApiLiveContractTests` **3/3** and E1-12's
  `OnderwijsdoelenLiveContractTests` **1/1** (unit); `OpstapApiLiveImportTests` **1/1** (integration, 19 s). That last test
  runs through the application with nothing faked:
  - 998 minimumdoelen and 5,835 G goals land, 4,983 of the goals concorded to 992 minimumdoelen, and no goal lacks its key;
  - two applies of 1.2 are recorded, and the second leaves every discipline's diff empty;
  - exactly the six minimumdoelen of ADR-0032 decision 5 have no G goal.

  This also records the request through the registered source that E1-12's status note named as owed before its `[x]`.
- The census and the converter regression above ran as a temporary harness test over the downloaded snapshot and the 998
  minimumdoelen. The harness and its copy of the E1-12 converter were deleted before commit.
- **A defect in the file-writing channel, found by a byte check and fixed.** It decoded `\uXXXX` escapes, so `OpstapHtml.cs`
  and `OpstapBeschrijving.cs` briefly held literal U+0001, U+0002 and U+00A0 characters, E1-12's `' '` included. The
  tests could not see it, because they compared the same characters. The code now uses `(char)1`, `(char)2`, `(char)0xA0`
  and the regex escapes `\x01`/`\x02`. A grep finds no control character and no non-breaking space in any `.cs` file of
  the tree, and all the counts above were taken after that fix.
- Not run: the antagonist audit and an independent test-runner pass. Both belong to the orchestrator.

## Not done, and why

1. **Minimumdoel-level coverage is not computed**, so the done-when's last clause ("minimumdoel-level coverage returns
   real results") is not met. That computation is **E5-04** ("a minimumdoel shows covered iff ≥1 concorded leerplandoel is
   covered"), unbuilt, and out of this story's scope. What E1-21 makes true, and proves on PostgreSQL: a G goal a class
   covers carries a ref to a loaded minimumdoel (`GET /api/klassen/{id}/dekking` → `minimumdoelRef`), and the minimumdoelen
   register, which lists only minimumdoelen with a concorded goal, lists it. **Decision for the orchestrator/owner:**
   whether E1-12, E1-03 and E1-04 close on that, or wait for E5-04.
2. **The frontend** (E1-22): nothing reads the new endpoint yet; `frontend/src/features/import/types.ts` does not know the
   three new diff buckets (they are additive, so the Excel screen keeps working; it shows the new Dutch notices through
   `opmerkingen`).
3. **Renumbering is detectable only between two API imports.** Excel rows have no key, so the 15 Excel codes KOV no longer
   has (above) will read as *verdwenen*, not as renumbered, on the first API import.
4. **A key that moves between disciplines** under a new code reads as a disappearance in one and an addition in the other:
   the shared writer works per discipline.
5. **The version row is per apply, not per discipline**: with a discipline selection, a left-out discipline keeps whatever
   an earlier import wrote (stated on `Opstapversie`).
6. **Changelogs between versions** are not collected; only the pinned version's own changelog is returned (E1-23 territory).

## Open questions / Art. XIV touched

- No Art. XIV decision was assumed. "Disciplines first" still goes through `IDisciplineSelectie` untouched.
- **App-authored Dutch in reference text, second instance:** `[lege tabel van 4 rijen en 5 kolommen]` joins E1-12's
  `[afbeelding: …]` (E1-22 decide-and-record (c)); one goal carries it.
- **Implementer's reading, not ruled:** that `Mogelijke aanpak/indeling/onderzoekscontexten` and `Verdere referenties`
  belong in toelichting rather than voorbeelden.
- The skipped goal sets are counted, not named per goal, in the report (1,645 codes); the codes travel only as
  `buitenBereik` for stored rows.

## For the test-runner

Backend only, no UI. Unit: `dotnet test backend/tests/Jaarplanner.UnitTests`. PostgreSQL: set `JAARPLANNER_TEST_POSTGRES`
and run `OpstapLeerplandoelenImportEndpointsTests` (and the full integration project). Live: `JAARPLANNER_LIVE_OPSTAP=1`
runs `CurriculumApiLiveContractTests` (unit) and, with PostgreSQL, `OpstapApiLiveImportTests` (the real KOV → database path,
about 20 s). By hand on a running API with a signed-in session: `POST /api/opstap-import/minimumdoelen`, then
`POST /api/opstap-import/leerplandoelen/voorbeeld` with `{}`, then `POST /api/opstap-import/leerplandoelen` with
`{"versie":"1.2"}`.

## Contract for E1-22

All routes are behind `CurriculumbeheerAutorisatie.Beleid` (a signed-in session today; directie once E6-02 lands) and take
and return JSON (camelCase).

**Order.** The minimumdoelen import (`POST /api/opstap-import/minimumdoelen`, E1-12) must have run first: a leerplandoel
concorded to a minimumdoel that is not loaded refuses the whole import with 409. The screen can run it first in the same
flow.

### `POST /api/opstap-import/leerplandoelen/voorbeeld`

Body optional: `{}` / no body (the newest numbered version) or `{ "versie": "1.2" }`. Writes nothing.

### `POST /api/opstap-import/leerplandoelen`

Body **required**: `{ "versie": "<the versie the preview returned>" }`. Writes, in one transaction, and records the version.

### `200` — both routes

```jsonc
{
  "isVolledigVerwerkt": true,        // no problem and no discipline skipped (skipped goal SETS do not count)
  "versie": "1.2",                   // the numbered snapshot read; the apply must send this back
  "hash": "8f470a12-231f-5817-7a8b-6582195e2583",
  "snapshotTijdstip": "2026-08-27T10:03:07.098307+00:00",
  "vorigeVersie": { "versie": "1.1", "hash": "…", "toegepastOp": "…" },   // or null: never applied
  "wijzigingslog": "TOEGEVOEGD\n- 1.2.GL2.39 - …",   // KOV's own changelog for this version, plain text (~220 kB for 1.2), or null
  "overgeslagenDoelsets": [ { "doelset": "+", "aantal": 105 }, { "doelset": "A", "aantal": 67 }, … ],  // whole snapshot
  "problemen": [ { "code": "2.1.GL3.10", "reden": "contains markup …" } ],  // G goals not imported; English, operator-only
  "disciplines": [
    {
      "disciplineNummer": "9.1",     // this repo's form, never "9-1"
      "disciplineNaam": "Veilige en gezonde levensstijl",   // KOV's title
      "overgeslagenDoelsets": [ { "doelset": "P", "aantal": 41 }, { "doelset": "S", "aantal": 26 } ],
      "problemen": [],               // this discipline's share of "problemen"
      "diff": {                      // OpstapHerimportDiff, the same shape the Excel import returns, plus three buckets
        "disciplineNummer": "9.1",
        "toegevoegd": ["9-1.1.GL1.1", …],
        "gewijzigd": [ { "code": "…", "velden": [ { "veld": "Tekst", "oudeWaarde": "…", "nieuweWaarde": "…" } ] } ],
        "ongewijzigd": [ … ],
        "verdwenen": [ … ],                       // no longer in Op.stap, no teacher link: kept and flagged
        "verdwenenMaarGekoppeld": [ { "code": "…", "aantalKoppelingen": 2 } ],
        "nietIngelezen": [ … ],                   // stored, still in Op.stap, refused this time: untouched (review)
        "buitenBereik": [ … ],                    // stored, in a skipped goal set (P/S/+/A…): untouched (no review)
        "hernummerd": [ { "oudeCode": "…", "nieuweCode": "…", "aantalKoppelingen": 0 } ],
        "overgeslagen": false,                    // true: outside the selection, unknown discipline, or nothing usable
        "opmerkingen": [ "…" ],                   // Dutch, for directie; render as given
        "isLeeg": false,
        "vereistReview": true
      }
    }
  ],
  "toegepast": false                  // true only for a committed apply
}
```

Notes for the screen:
- **Skipped goal sets** appear twice: per discipline and summed over the snapshot, as `{ doelset, aantal }`. Only G is
  imported (owner ruling); `buitenBereik` lists the stored codes this touches, and they are not a review item.
- **Source problems** are English operator diagnostics, per discipline and summed; they are not directie copy. The Dutch
  consequence is the `nietIngelezen` notice in `opmerkingen` (only when such a code is stored).
- **Every code of a discipline sits in exactly one bucket**; `hernummerd` replaces an addition plus a disappearance.
- **The changelog is available** (`wijzigingslog`, KOV's own words, Dutch, plain text with `\n- ` list lines, like
  `Minimumdoel.Omschrijving`); it is long, so collapse it.
- **Size:** a first import lists all 5,835 codes in `toegevoegd`; with the changelog the answer is a few hundred kB.
- A preview and an apply are two reads of KOV; the apply's answer is its own report, but because the version is pinned
  it describes the snapshot the preview showed.

### Errors

| Status | When | Body |
| --- | --- | --- |
| 400 | Apply without `versie` | ProblemDetails, title `Ongeldige aanvraag`, detail "Geef de Op.stap-versie mee die in het voorbeeld getoond werd, bijvoorbeeld 1.2. Zo wordt precies doorgevoerd wat nagekeken is." |
| 400 | `versie` that is not a number such as `1.2` (both routes) | detail "'…' is geen Op.stap-versie. Een versie is een nummer zoals 1.2." |
| 401 | No session | framework default, as for the other import routes |
| 409 | A discipline cannot land: a concordance to a minimumdoel that is not loaded (`type` = `Probleemsoorten.OpstapOntbrekendeMinimumdoelen`), or a code stored under another discipline (`…OpstapCodeInAndereDiscipline`, API wording) | `OpstapImportExceptionHandler`, title `Import niet doorgevoerd`, Dutch detail; on an apply **nothing** was written |
| 502 | KOV could not be read or its answer is untrustworthy (network, timeout, status, shape, version mismatch, whole-read refusal) | title `Op.stap niet opgehaald`, detail `OpstapBronFout.Melding` ("De Op.stap-gegevens van Katholiek Onderwijs Vlaanderen konden niet opgehaald worden. Er is niets gewijzigd."); the English cause is logged only |
