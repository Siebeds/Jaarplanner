# E1-12 — Decreed minimumdoelen from KOV's Op.stap API — implementation worklog

- **Date:** 2026-09-11
- **Branch:** `story/E1-12-opstap-api-minimumdoelen`, off `origin/main` `fbe317a`, worktree `.claude/worktrees/e1-12-opstap-api`
- **Rulings this rests on (project owner, 2026-09-11):** KOV's Op.stap API is the curriculum import source, and the owner
  declined to ask KOV about its usage notes first; only **G** goals are imported for now, with Z (zwemdoelen) and V
  (Vlaamse gebarentaal) named as skipped. Recorded in [ADR-0032](../../../docs/adr/0032-opstap-api-als-importbron.md),
  `CONSTITUTION.md` Art. VII.2 and the ratification log.
- **Status:** `[~]`. Built and tested; **not reachable** until one DI line lands (below); substantive minimumdoel-level
  coverage waits on E1-21.

## What was built

| Layer | File | What |
| --- | --- | --- |
| Application | `Curriculum/Import/IMinimumdoelBron.cs` | The source port, its result and `MinimumdoelBronProbleem` (English operator reason). |
| Application | `Curriculum/Import/IMinimumdoelImportService.cs` | The import port, `MinimumdoelImportResultaat`, `MinimumdoelImportDiff`, `MinimumdoelWijziging`. |
| Application | `Curriculum/Import/OpstapBronFout.cs` | "The source could not be read": Dutch `Message` for directie, English `TechnischeOorzaak` for the log. |
| Infrastructure | `OpstapImport/OpstapApiOptions.cs` | `Opstap:Api` — base URL (default KOV production), timeout, page size. No secret. |
| Infrastructure | `OpstapImport/OnderwijsdoelenApiBron.cs` | Typed `HttpClient` over `GET /agodi/onderwijsdoelen/opstap`; follows `$$meta.next`; refuses a read that ends short of `$$meta.count`; every read failure becomes one `OpstapBronFout`; caller cancellation stays a cancellation. |
| Infrastructure | `OpstapImport/OnderwijsdoelMapping.cs` | **The** mapping (Art. III.3): `Ref` = `uniqueCode`, `Leeftijd` = prefix, `Nr` = `code` (must match), `Omschrijving` = doelzin + uitbreiding as text; expired rows and rows with unknown markup are refused with a reason. |
| Infrastructure | `OpstapImport/OpstapHtml.cs` | HTML to plain text without changing what the decree says (see findings). |
| Infrastructure | `OpstapImport/MinimumdoelImportService.cs` | Upsert on `Ref`; preview writes nothing; a ref the source drops is kept and reported, never deleted; an empty source is a skip; count-inflected Dutch notice. |
| Infrastructure | `OpstapImport/OpstapApiRegistratie.cs` | `AddOpstapApi(configuration)`: options, typed client, import service. |
| Api | `Controllers/OpstapMinimumdoelenImportController.cs` | `POST /api/opstap-import/minimumdoelen` and `…/voorbeeld`, behind `Curriculumbeheer`; `OpstapBronFout` → **502** with the Dutch sentence, the English cause logged. No request body: the host cannot be chosen by the caller. |
| Api | `Infrastructure/Probleemtitels.cs` | `BronNietBereikbaar = "Bron niet bereikbaar"`. |

Stale comments corrected where this story made them false: `OpstapImportService` (preflight 3), `OpstapImportFout`
(`OntbrekendeMinimumdoelen`) and the characterisation test in `OpstapImportEndpointsTests`, which E1-12 narrowed rather
than falsified (a ref nobody imported still answers 409).

## Outstanding, and why it is not done here

1. **`services.AddOpstapApi(configuration);` in `Infrastructure/DependencyInjection.cs`.** That file was claimed by
   session E6-01 all afternoon; an `ASK` went up at 18:25 and had no answer when this worklog was written. A claim is a
   lock, so the line is not added. Until it lands the endpoint answers 500 and all six tests in
   `OpstapMinimumdoelenImportEndpointsTests` fail; `De_echte_bron_is_geregistreerd` is the one that names the cause, so
   the gap cannot pass silently (the E1-15 / E2-08 defect class). *(Corrected after the antagonist's round 1: this said
   only that one test failed.)*
2. **The frontend** (E1-22): a button, the report, and removal of E1-13's notice `import.opstap.voorwaarde`, which
   becomes false the moment the import runs. Needs `nl.json`, also held by E6-01.
3. **The ADR index row** (`docs/adr/README.md`) and the **progress row** (`backlog/README.md`), both held by E6-01.
4. **Question 1 in `docs/besluiten-gevraagd.md`** still asks directie for the decreed minimumdoelen file and says the
   tool is blocked on it. The owner's API ruling makes that false, and the document is marked for forwarding to
   directie. It must be rewritten to report the ruling (and whether directie is asked to confirm it). Held by E6-01;
   missed in the first version of this list and added after the antagonist's round 1 (MAJOR 5).

## Findings from the real data (2026-09-11), and what they changed

The first live contract run failed, which is what it is for. Every rule in `OpstapHtml` now rests on a count of the
998 real rows:

- **126 rows write examples between literal angle brackets**, escaped: `&lt; bv. tanden poetsen &gt;` (`K-9.1.4`), once
  without the space (`6-3.7.6`). That is decreed text and stays. Two versions of the live assertion ("no `<`", then "no
  `<letter`") were wrong about it; the assertion now checks for `</` only and spot-checks named rows.
- **98 MathML fractions** (`<math><mfrac><mn>1</mn><mn>10</mn></mfrac></math>`, one shape only). Stripping tags would
  have stored `110` for `1/10` in a decreed text. Now `1/10`.
- **12 links** (the Frans minimumdoelen `6-10.6.x` point at their word list) keep their address: `Word (https://…)`.
- **3 images** (`6-3.5.1`, circuit symbols) become their alt text: `[afbeelding: De energiebron]`.
- **Unknown markup is refused, not stripped**: a row with a tag outside the known set lands in `Problemen` and is not
  imported. A missing minimumdoel is loud (its leerplandoelen then refuse with 409); a rewritten one would not be.
- **Concordance cardinality:** no goal references more than one minimumdoel (ADR-0018 holds); all 5,654 references in
  `krcItems` snapshot 1.2 resolve.
- **G-only cost:** 992 of 998 minimumdoelen are reachable through a G goal; `6-7.1.6` only through a Z goal, and
  `K-1.2.6`, `4-2.2.23`, `6-2.2.3`, `6-6.2.5`, `6-6.3.9` through no goal at all.
- **The repo's Op.stap Excel files are partial and carry no concordance**: Wiskunde has 319 of 1,564 goals and columns
  B–D are empty on every row. 316 of its 319 codes exist in the API; three do not (renumbered or removed).

## Verification (all run in this worktree, 2026-09-11)

- `dotnet build` — succeeded, no warnings in the touched projects.
- `dotnet test tests/Jaarplanner.UnitTests` — **890 passed, 1 skipped** (the live contract test, skipped by design).
- `JAARPLANNER_LIVE_OPSTAP=1 dotnet test --filter OnderwijsdoelenLiveContractTests` — against KOV's live API: 998
  minimumdoelen, no problems, named rows exact (see the final run in the gate record).
- `JAARPLANNER_TEST_POSTGRES=… dotnet test tests/Jaarplanner.IntegrationTests --filter "OpstapMinimumdoelenImportEndpointsTests|OpstapImportEndpointsTests"`
  on the local PostgreSQL 17 — **22 passed, 1 failed: `De_echte_bron_is_geregistreerd`, as intended until the DI line
  lands.** To exercise the five endpoint tests before that line exists, a temporary `services.AddOpstapApi(...)` call
  was placed in the test's own `ConfigureTestServices` for the run and **removed before commit**; with the line in
  `DependencyInjection.cs` they run unchanged. Stated because a green run obtained that way proves the pipeline, not
  the wiring — the wiring is exactly what the failing test is there to show.
- `dotnet format --verify-no-changes` on the touched files.

Gates (antagonist, and a test-runner once the DI line lands) are recorded in `antagonist.md` beside this file.

## Fix round 1 (2026-09-11 to 2026-09-13, after the antagonist's round 1: 5 MAJOR, 4 MINOR, 2 QUESTION)

| # | Finding | Resolution |
| --- | --- | --- |
| 1 MAJOR | `CurriculumbeheerAutorisatieTests` counted 2 `api/opstap-import*` routes; there are 4 | The test now names the four routes, so the next one is added on purpose. |
| 2 MAJOR | A previously imported ref whose row the mapping refuses was reported as *verdwenen* | New bucket `MinimumdoelImportDiff.NietIngelezen`: refs the source still names (a refused row's `Sleutel` is its `uniqueCode`) are kept apart, with `NietIngelezenMelding` ("staat nog in de Op.stap-bron maar kon niet ingelezen worden. De vorige tekst blijft staan."). `Verdwenen` now means "named nowhere in the source". Test added. |
| 3 MAJOR | The converter's guard admitted text-changing markup | A `<` that starts no tag is escaped before stripping (`=, ≠, <, >`, `(< 1 week)`); `<sup>x</sup>` becomes `^x`; `ol` and `sub` left the known set; an image without alt text and a link without a double-quoted `href` are refused. `OnbekendeTags` became `OnvertaalbareOpmaak`. Tests use the shapes of `2.1.GL3.10` and `2.1.GL1.2`. E1-21 carries a warning to census its corpus. |
| 4 MAJOR | Dependent text not amended | Functional analysis (FR-2 intro, FR-2.1, the koppeling paragraph, the data flow, the assumptions, the open question marked as decided, the plan step), `CLAUDE.md` (Status and goals data flow), `CONSTITUTION.md` Art. V.6. |
| 5 MAJOR | `besluiten-gevraagd.md` question 1 still asks directie for the file; the log row was silent on directie | The ratification-log row now says directie has not confirmed the ruling and that question 1 must be rewritten; item 4 under Outstanding. The file itself is held by E6-01. |
| 6 MINOR | Status clauses said one test fails | Backlog, this worklog and the test-class doc now say all six fail until the DI line lands. |
| 7 MINOR | E1-22 pointed at a deleted notice | Retargeted at `doelen.geenMinimumdoelenTitel` / `doelen.geenMinimumdoelenActie` and the register's count; the inner join in `MinimumdoelenQuery` is stated as a certainty. |
| 8 MINOR | The 502 promised that a retry helps | `OpstapBronFout.Melding` now says only that nothing was fetched and nothing changed; the title is `Probleemtitels.OpstapNietOpgehaald` ("Op.stap niet opgehaald"). |
| 9 MINOR | An absolute `$$meta.next` could leave KOV's host | Refused as an `OpstapBronFout`; test added. |
| 10 QUESTION | VII.2 bound clauses beyond the rulings | "Every minimumdoel is imported" and the coverage-view duty are marked as the implementer's in VII.2 and ADR-0032; the duty is generalised to any minimumdoel with no loaded concorded leerplandoel, and the "six" is tied to all disciplines being imported. Put to the owner. |
| 11 QUESTION | E1-22 design points | Recorded in E1-22 as "decide and record". |

### Verification after fix round 1 (2026-09-13)

- `dotnet build` succeeded; `dotnet format --verify-no-changes` on the touched paths: clean.
- `dotnet test tests/Jaarplanner.UnitTests`: **901 passed, 1 skipped** (the opt-in live test).
- Live contract test against KOV (`JAARPLANNER_LIVE_OPSTAP=1`): **passed** (998 minimumdoelen, no problems, named rows exact).
- Integration tests **without** PostgreSQL (`--filter "FullyQualifiedName!~Jaarplanner.IntegrationTests.Postgres"`): **68/68**, including the fixed route inventory.
- PostgreSQL, the Op.stap and curriculum classes (`OpstapMinimumdoelenImportEndpointsTests`, `OpstapImportEndpointsTests`, `Referentiedata*`, `Minimumdoel*`, `Doelen*`): **29 passed, 6 failed**, the six being exactly `OpstapMinimumdoelenImportEndpointsTests`, which cannot activate the controller until the DI line lands.
- **The full PostgreSQL half did not complete, and is reported as not run.** A full run started on 2026-09-11 stalled for hours with 3.6 GB of 31.4 GB free (other sessions' processes) and was killed by the system. Before the kill it had printed the expected Op.stap failures plus six unrelated failures in the same second (`WeekplanningEndpointsTests`, `JaarplanPersistentieTests`, `DekkingEndpointsTests`, `OpstapImportEndpointsTests.Herimport_rapporteert…`, `SchoolcontentImportEndpointsTests`, `AggregaatGroeiTests`). One of those, `Herimport_rapporteert…`, passed in the targeted run above; the other five were not re-run. Their simultaneous timestamp points at the stall, but that is an inference, not a result.
