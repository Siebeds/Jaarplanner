# E1-21 — Leerplandoelen from KOV's API, G goals only — implementation worklog

- **Date:** 2026-09-13
- **Branch:** `story/E1-21`, fast-forwarded to `feature/e1-opstap-api` (`8e62672` = `main` `309cc29` plus the `[~]` claim), in
  worktree `.claude/worktrees/agent-a944187cb3ec7aaa6`. Not pushed, not merged.
- **Rulings this rests on:** the owner's two of 2026-09-11 (KOV's Op.stap API is the import source; only goal set **G** is
  imported for now), recorded in [ADR-0032](../../../docs/adr/0032-opstap-api-als-importbron.md) and `CONSTITUTION.md` Art. VII.2.
- **FR / Article:** FR-2.1–2.5; Art. III.1, III.3, III.4, III.5; Art. V.2, V.6; Art. VII.2; Art. VIII; ADR-0032 decisions 5–7;
  ADR-0022 (one endpoint per import source, `Curriculumbeheer`).
- **Status:** built, gated once (round 1: test-runner FAIL on the coverage clause only, antagonist 2 MAJOR / 4 MINOR /
  3 QUESTION), fix round 1 done (below). The coverage clause moved to E5-04 by owner ruling R1. Checkbox left to the
  orchestrator.

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
   (63 in Wiskunde alone: + 17, P 38, S 8; this read 66 until the test-runner's round-1 count) while KOV lists them. Stored codes the source names under a skipped set are `BuitenBereik`
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
  - two applies of 1.2 are recorded, and the second leaves every discipline's diff empty. *That holds on this test's
    database, which has no Excel history (qualified after the test-runner's round 1): where the Excel route loaded
    goals KOV no longer has, such as Wiskunde's three, every repeat apply keeps reporting those as gone, behaviour that
    predates this story;*
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

## Owner rulings, 2026-09-13 (after the round-1 gates)

- **R1.** E1-21, E1-12, E1-03 and E1-04 close on the **input**: G goals concorded to the loaded minimumdoelen, proven on
  PostgreSQL. The clause "minimumdoel-level coverage returns real results" moves to **E5-04**, which owns the
  computation. The orchestrator flips the checkboxes at land time; the texts were rewritten in fix round 1.
- **R2.** App-authored bracketed markers inside reference text (`[afbeelding: …]`, `[lege tabel …]`) are acceptable. This
  decides E1-22's point (c).

## Fix round 1 (2026-09-13, after round 1: test-runner FAIL on the coverage clause only; antagonist 2 MAJOR, 4 MINOR, 3 QUESTION)

| # | Finding | Resolution | Test |
| --- | --- | --- | --- |
| MAJOR 1 | An Excel re-import after an API import flags ≈4,700 goals and clears ≈858 concordances | Option (b): `OpstapImportService` refuses a `Herkomst.Bestand` import once an `Opstapversie` exists, before anything else, on preview and apply, with `OpstapImportFout.ExcelNaOpstapApi` → 409, new type `urn:jaarplanner:opstap-import:excel-na-opstap-api`. The Dutch detail says only what that branch guarantees (the doelen come from Op.stap now, the file was not read, nothing changed); it deliberately does not say the file would overwrite goals, which a discipline selection can make false. ADR-0032 decision 8 amended with a dated note. The Excel screen renders the detail, so no UI change; recorded in E1-22. | `Na_een_api_import_weigert_de_excelroute_en_wijzigt_niets` (PostgreSQL: API import, then the Excel preview and apply both 409, rows and concordance unchanged); `Een_excelbestand_na_een_api_import_wordt_geweigerd` (×2), `Na_een_api_import_blijft_de_api_zelf_importeren`, `Excel_na_een_api_import_zegt_alleen_wat_waar_is`, and `Elke_weigeringssoort_heeft_een_eigen_type_uri` covers the new kind |
| MAJOR 2 | A table of images becomes `[lege tabel …]`; an empty-text link is lost; a nested `ol` flattens | `IsLeeg` counts an `img` or `a` as content: a multi-cell table of images is now refused (block content), a link cell keeps its address, a one-cell table still unwraps. An `ol` inside an `ol` is refused. Both doc comments (`OpstapHtml` bullets, `OpstapBeschrijving` "what the split drops") now claim only this. Re-run over snapshot 1.2: still 0 refused. | `Een_tabel_van_afbeeldingen_is_niet_leeg_en_wordt_geweigerd`, `Een_cel_met_alleen_een_link_zonder_tekst_houdt_het_adres`, `Een_geneste_geordende_lijst_wordt_geweigerd` |
| MINOR 1 | Cyclic closure chain; status lines over-claim after merge | Applied R1: E1-03, E1-04, E1-12, E1-21 texts re-scoped, E1-12's owed live request marked done, E5-04 and its three "blocked on E1-12" lines unblocked with the carry-forward (the six, the MD filter). `CLAUDE.md` and `backlog/README.md` are held by another session and left to the orchestrator. | text |
| MINOR 2 | Redirects followed; body uncapped | Both typed clients get a `SocketsHttpHandler { AllowAutoRedirect = false }` through `ConfigurePrimaryHttpMessageHandler`, so a 3xx is a non-success status and refuses the read. No size cap: the body is streamed from the one configured host, and the controller doc now says so. | `Geen_van_beide_bronnen_volgt_een_doorverwijzing` (×2, on the handler the real registration builds) |
| MINOR 3 | A null `wijzigingslog` has two meanings; the refusal is not logged | `CurriculumApiBron` takes an `ILogger` and logs an English warning naming the version and the markup; the contract states that a null renders without a reason. | `Een_wijzigingslog_dat_niet_trouw_om_te_zetten_is_valt_weg_en_wordt_gelogd`, `Zonder_wijzigingslog_is_er_niets_te_melden` |
| MINOR 4 | `BuitenBereik` silences a stored G goal KOV moved into a skipped set | New bucket `GemeenschappelijkBuitenBereik` (review item, not in `IsLeeg`), with a Dutch notice limited to what the branch knows: stored as gemeenschappelijk, listed by the source under a doelsoort that is not read, left as it was. | `Een_opgeslagen_G_doel_in_een_overgeslagen_doelset_vraagt_nazicht`, `De_melding_over_G_doelen_buiten_het_bereik_is_verbogen` |
| QUESTION 1 | "Mogelijke aanpak…" / "Verdere referenties": toelichting or voorbeelden? | The toelichting reading stays the default and is question 12 in `docs/besluiten-gevraagd.md` (36 goals; in 6 KOV's own Excel had it under voorbeelden). The same edit corrected two sentences there the API import made stale (question 1's "moet nog gebouwd worden", question 3's "één bestand per vak"). | text |
| QUESTION 2 | App-authored Dutch in reference text | Decided by R2: acceptable. | — |
| QUESTION 3 | Will E1-22 show the English `problemen`? | Contract and E1-22 entry: a count plus the Dutch `nietIngelezen` consequence only. | text |
| Test-runner | Wiskunde non-G count 66 → 63 (+ 17, P 38, S 8); "the second apply leaves every diff empty" | Both corrected in this worklog (the second qualified: only without Excel history). | text |

### Verification after fix round 1

*(PostgreSQL 17.5 in a throwaway container on port 55434.)*

- `dotnet format Jaarplanner.sln --verify-no-changes`: **exit 0**, after one `dotnet format` pass that re-wrapped lines in
  `OpstapHtml.cs`, `OpstapImportService.cs` and the endpoint test.
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors**.
- `dotnet test Jaarplanner.sln --no-build -c Release` with `JAARPLANNER_TEST_POSTGRES`, live switch off, as CI runs it, on
  the formatted tree: **unit 1,103 passed, 4 skipped** (the live contract tests); **integration 337 passed, 1 skipped**
  (the live KOV → PostgreSQL test); **0 failed**. An identical run before the whitespace-only format pass gave the same
  counts.
- Live, `JAARPLANNER_LIVE_OPSTAP=1`, run once before the whitespace-only format pass: unit **4/4**, integration **1/1**
  (23 s). `Snapshot_1_2_komt_via_de_echte_registratie_zonder_problemen_binnen` asserts no problem over all 5,835 G goals,
  so the stricter MAJOR 2 guard still refuses nothing in snapshot 1.2.
- Byte check: no U+0001, U+0002 or U+00A0 in any `.cs` file of the tree.
- Not re-run: the antagonist and the test-runner. Both are the orchestrator's.

## Fix round 2 (2026-09-13, after round 2 on `01d5189`: test-runner PASS with 2 nits; antagonist 0 MAJOR, 6 MINOR, 1 QUESTION)

| # | Finding | Resolution | Test |
| --- | --- | --- | --- |
| MINOR 1 | The 409 sentence claims where every leerplandoel comes from; the ADR note records the benefit, not the cost; the enum doc is unqualified | New detail: "Er is al een versie van Op.stap ingelezen via Katholiek Onderwijs Vlaanderen. Daarna wordt geen Excel-bestand van Op.stap meer ingelezen. Er is niets gewijzigd." It asserts only what the trigger (an `opstapversies` row) proves. The factory doc, the enum doc and the writer's comment are qualified alike, and the ADR-0032 note now states the cost: Excel-loaded P/S/+/A goals can no longer be refreshed; a removal by KOV is still flagged through the API path, a wording change is not. | `Excel_na_een_api_import_zegt_alleen_wat_waar_is`; `Na_een_api_import_weigert_de_excelroute_en_wijzigt_niets` reads the factory |
| MINOR 2 | `CONSTITUTION.md`, the functional analysis and `CLAUDE.md` still say the Excel route stays available | **Ratified by the owner on 2026-09-13** ("Bekrachtigen"). In its own commit (Art. XI.1): Art. VII.2 and the Art. XIV "Resolved" line amended, a ratification-log entry following the 2026-09-11 precedent (the cost stated, directie's confirmation outstanding), and FR's *Koppeling leerplandoelen* in the functional analysis in step. ADR-0032 cites the ratification. **`CLAUDE.md:137` ("which stays available") and `:21` (the E1 status sentence) are held by session ticket-backlog and left to the orchestrator at land time.** | text |
| MINOR 3 | `IsLeeg` counted only `img`/`a` as content: tables of `svg`, `iframe`, `input`, `object`, `video` still became `[lege tabel …]` | A cell is empty only when it holds no text and no element beyond `TekstlozeOpmaak` (p, div, span, br, hr, strong, b, em, i, u and the table structure tags). Anything else makes it content, so the table reaches the guard. | `Een_tabel_met_een_ander_element_dan_opmaak_is_niet_leeg_en_wordt_geweigerd` (`svg`, `iframe`); the live contract test still finds 0 problems in snapshot 1.2 |
| MINOR 4 | `besluiten-gevraagd.md`: questions 1, 3 and 12 say more than is true | Q1: 4,983 of the 5,835 G goals name a minimumdoel, and the others name none in Op.stap itself. Q3: the reason is fewer goals to review. Q12, **recounted on the real conversion** with a temporary harness (deleted): **27** G goals have such a heading after their examples (the case the question is about), and 41 have such a line at all. **8** of the 27 are also in the repo's Op.stap Excel files, and in **all 8** that text is in column K (voorbeelden). The round-1 figures (36; 6) are superseded. "Drie stukken uitleg" now reads "voor zover het doel die heeft". | recount |
| MINOR 5 | E1-04's note claimed `IConcordantieQuery` on PostgreSQL; no PostgreSQL test called it | New PostgreSQL test over rows the API path wrote: minimumdoel → goals, goal → minimumdoel, a goal with none, a minimumdoel with none. E1-04's note now names the two tests it rests on. | `Na_de_import_beantwoordt_de_concordantie_beide_richtingen` |
| MINOR 6 | `VereistReview` doc omitted `GemeenschappelijkBuitenBereik`; `E4-bewerking-hergeneratie.md:25` still said "blocked on E1-12" | Both corrected. | text |
| QUESTION | Option (b) freezes non-G data; until E1-22 the upload control can only refuse (E3-06 shape) | The freeze is now ratified (MINOR 2). The orchestrator lands E1-21 and E1-22 together in one PR, so the interim screen never reaches `main`; E1-22's entry already carries the decision. | — |
| Test-runner nit 1 | A stray `<summary>` in `OpstapImportFoutTests.cs` | Each test carries its own summary again. | — |
| Test-runner nit 2 | E1-21's original clause not struck | Struck (`~~…~~`) before the re-scoping note, and E1-12's twin clause likewise. | — |

### Verification after fix round 2

*(PostgreSQL 17.5 in a throwaway container on port 55436.)*

- `dotnet format Jaarplanner.sln --verify-no-changes`: **exit 0** (a `dotnet format` pass ran first).
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors**.
- `dotnet test Jaarplanner.sln --no-build -c Release` with `JAARPLANNER_TEST_POSTGRES`, live switch off, as CI runs it:
  **unit 1,105 passed, 4 skipped** (the live contract tests); **integration 338 passed, 1 skipped** (the live KOV →
  PostgreSQL test); **0 failed**.
- Live, `JAARPLANNER_LIVE_OPSTAP=1`, same build: unit **4/4**, integration **1/1** (24 s). The snapshot-1.2 contract
  still asserts no problem over all 5,835 G goals, so the wider `IsLeeg` rule (MINOR 3) refuses nothing in the real data.
- Byte check: no U+0001, U+0002 or U+00A0 in any `.cs` file of the tree.
- The constitution amendment is its own commit (Art. XI.1), ahead of the fix commit.
- Not re-run: the antagonist and the test-runner. Both are the orchestrator's.

## Fix round 3 (2026-09-13, after round 3 on `66a26ac`: test-runner PASS with one note; antagonist 0 MAJOR, 2 MINOR, 1 QUESTION)

*Owner answer to the round-3 question, 2026-09-13 ("Na de leerplandoelen"):* "until the first API import" means the first
applied import of the **leerplandoelen** (an `opstapversies` row), which is what the code already checks. Between the
minimumdoelen import and that point the Excel route still works, harmlessly.

| # | Finding | Resolution | Test |
| --- | --- | --- | --- |
| MINOR 1 | "The first API import" was broader than the code, which also counts the minimumdoelen import; VII.2's "overwrite … flag every API goal" was unqualified | Narrowed to "the first API import of the leerplandoelen (a snapshot applied)" in `CONSTITUTION.md` VII.2, the 2026-09-13 log entry (corrected in place, since it has not reached `main`, with the owner's clarification recorded) and XIV; in the functional analysis; in E1-03's note and E1-21's fix-round-2 note; and in this worklog's contract. VII.2 now says "in a discipline that import covered", as the code comment does. Constitution and functional analysis in their own commit (Art. XI.1). | text |
| MINOR 2 | Functional analysis: "blijven zoals ze zijn en kunnen niet meer bijgewerkt worden" is false for a removal | Now: "Van doelen die via Excel buiten de gemeenschappelijke doelen (G) werden ingelezen, kan de tekst niet meer bijgewerkt worden; verdwijnt zo'n doel uit Op.stap, dan wordt het nog wel gemarkeerd." | text |
| Test-runner note | Round 2's stricter emptiness rule also applies between rows and cells, so `<colgroup>`/`<col>` refused a whole table | `colgroup` and `col` joined the text-free set (`thead`/`tbody`/`tfoot` were already in it). A `<caption>` carries text, so a table with one is still refused, never flattened without it. Snapshot 1.2 still converts with 0 refusals (live contract test). | `Kolomdefinities_houden_een_tabel_niet_tegen_een_bijschrift_wel` |
| Cosmetic | Broken comment reflow in `OpstapImportService.cs` | Rewritten, and narrowed to the leerplandoelen snapshot. | — |

### Verification after fix round 3

*(PostgreSQL 17.5 in a throwaway container on port 55437.)*

- `dotnet format Jaarplanner.sln --verify-no-changes`: **exit 0** (a `dotnet format` pass ran first).
- `dotnet build Jaarplanner.sln -c Release`: **0 warnings, 0 errors**.
- `dotnet test Jaarplanner.sln --no-build -c Release` with `JAARPLANNER_TEST_POSTGRES`, live switch off, as CI runs it:
  **unit 1,106 passed, 4 skipped** (the live contract tests); **integration 338 passed, 1 skipped** (the live KOV →
  PostgreSQL test); **0 failed**.
- Live unit contract tests, `JAARPLANNER_LIVE_OPSTAP=1`, once: **4/4**. The snapshot-1.2 contract still asserts no
  problem over all 5,835 G goals, so adding `colgroup`/`col` to the text-free set changed nothing in the real data.
- Byte check: no U+0001, U+0002 or U+00A0 in any `.cs` file of the tree.
- The constitution and functional-analysis correction is its own commit (Art. XI.1), ahead of the code and docs commit.
- Not re-run: the antagonist and the test-runner, which are the orchestrator's; the live integration test (asked for the
  live unit tests only this round).

## Not done, and why

1. **Minimumdoel-level coverage is not computed**; by owner ruling R1 that clause now belongs to **E5-04** ("a minimumdoel
   shows covered iff ≥1 concorded leerplandoel is covered"). What E1-21 makes true, and proves on PostgreSQL: a G goal a
   class covers carries a ref to a loaded minimumdoel (`GET /api/klassen/{id}/dekking` → `minimumdoelRef`), and the
   minimumdoelen register, which lists only minimumdoelen with a concorded goal, lists it.
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
  `[afbeelding: …]` (E1-22 decide-and-record (c)); one goal carries it. *Decided by owner ruling R2 (2026-09-13):
  acceptable.*
- **Implementer's reading, not ruled:** that `Mogelijke aanpak/indeling/onderzoekscontexten` and `Verdere referenties`
  belong in toelichting rather than voorbeelden. *Kept as the default and put to directie as question 12 in
  `docs/besluiten-gevraagd.md` (fix round 1).*
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
        "gemeenschappelijkBuitenBereik": [ … ],   // stored here as G, in a skipped goal set at KOV: untouched (review; fix round 1)
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
- **Source problems** (`problemen[].reden`) are English and **operator-only**, per discipline and summed. The screen shows
  their **count**, and the Dutch consequence is the `nietIngelezen` notice in `opmerkingen` (only when such a code is
  stored); it never renders the English reason to directie (antagonist round 1, QUESTION 3).
- **A null `wijzigingslog` renders without a reason.** It has two causes the payload does not tell apart: KOV published no
  changelog for the version, or the changelog carries markup the conversion cannot keep. The second is logged as an
  English operator warning (fix round 1, MINOR 3), so the screen needs no wording for it.
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
| 502 | KOV could not be read or its answer is untrustworthy (network, timeout, status, a redirect, shape, version mismatch, whole-read refusal) | title `Op.stap niet opgehaald`, detail `OpstapBronFout.Melding` ("De Op.stap-gegevens van Katholiek Onderwijs Vlaanderen konden niet opgehaald worden. Er is niets gewijzigd."); the English cause is logged only |

### The Excel route after an API import (fix round 1)

Once an API import has been applied (an `opstapversies` row exists), `POST /api/opstap-import` and `…/voorbeeld` answer
**409** before reading anything into the database: title `Import niet doorgevoerd`, `type`
`urn:jaarplanner:opstap-import:excel-na-opstap-api` (`Probleemsoorten.OpstapExcelNaOpstapApi`), detail "Er is al een versie
van Op.stap ingelezen via Katholiek Onderwijs Vlaanderen. Daarna wordt geen Excel-bestand van Op.stap meer ingelezen. Er
is niets gewijzigd." (fix round 2; the round-1 sentence claimed where every leerplandoel comes from). Ratified by the
owner on 2026-09-13 (Art. VII.2): the route stays available until the first API import of the leerplandoelen (a snapshot applied) and refuses every file after it,
and goals the Excel route loaded outside goal set G can no longer be refreshed by any route. Today's Excel screen shows
the detail under "Niet gelukt". E1-22 reworks the screen
and decides whether the upload is offered at all after an API import (noted in its backlog entry).
