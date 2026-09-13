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
| Api | `Infrastructure/Probleemtitels.cs` | `OpstapNietOpgehaald = "Op.stap niet opgehaald"` (first `BronNietBereikbaar`, renamed in fix round 1). |

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
2. **The frontend** (E1-22): a button, the report, and the minimumdoelen register's empty state
   (`doelen.geenMinimumdoelenTitel` / `doelen.geenMinimumdoelenActie`) and count, which become false the moment the
   import runs. Needs `nl.json`, also held by E6-01. *(This item first named `import.opstap.voorwaarde`, which
   `891195d` had already deleted; corrected after the antagonist's round 2.)*
3. **The ADR index row** (`docs/adr/README.md`) and the **progress row** (`backlog/README.md`), both held by E6-01.
4. **Question 1 in `docs/besluiten-gevraagd.md`** still asks directie for the decreed minimumdoelen file and says the
   tool is blocked on it. The owner's API ruling makes that false, and the document is marked for forwarding to
   directie. It must be rewritten to report the ruling (and whether directie is asked to confirm it). Held by E6-01;
   missed in the first version of this list and added after the antagonist's round 1 (MAJOR 5).
5. **Owner confirmation of two constitutional clauses** (antagonist round 1 Q10, round 2 Q7): Art. VII.2's "every
   decreed minimumdoel is imported" and its coverage-view duty are marked as the implementer's and have not been ruled.
   Asked in the session of 2026-09-13; whoever next holds `docs/besluiten-gevraagd.md` records the question there if it
   is still open.
6. **The stale lock** (round 2 Q8): E6-01 has held `DependencyInjection.cs` and the four documents above since
   2026-09-11 and has been silent since 18:05 that day. Breaking it is the technical lead's or the owner's call.

## Findings from the real data (2026-09-11), and what they changed

The first live contract run failed, which is what it is for. Every rule in `OpstapHtml` now rests on a count of the
998 real rows:

- **126 rows write examples between literal angle brackets**, escaped: `&lt; bv. tanden poetsen &gt;` (`K-9.1.4`), once
  without the space (`6-3.7.6`). That is decreed text and stays. Two versions of the live assertion ("no `<`", then "no
  `<letter`") were wrong about it; the assertion now checks for `</` only and spot-checks named rows.
- **49 MathML fractions** (`<math><mfrac><mn>1</mn><mn>10</mn></mfrac></math>`, one shape only; "98" in the first
  version of this worklog counted the substring `mfrac` twice per fraction). Stripping tags would
  have stored `110` for `1/10` in a decreed text. Now `1/10`.
- **6 links in 3 rows** (the Frans minimumdoelen `6-10.6.x` point at their word list) keep their address:
  `Word (https://…)`. ("12" in the first version counted opening and closing tags.)
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
| 2 MAJOR | A previously imported ref whose row the mapping refuses was reported as *verdwenen* | New bucket `MinimumdoelImportDiff.NietIngelezen`: refs the source still names (a refused row's `Sleutel` is its `uniqueCode`; since round 2 that is guaranteed, because a row without a well-formed one refuses the whole read) are kept apart, with `NietIngelezenMelding` ("staat nog in de Op.stap-bron maar werd niet ingelezen. De vorige tekst blijft staan.", reworded in round 2 from "kon niet ingelezen worden"). `Verdwenen` now means "named nowhere in the source". Test added. |
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

## Fix round 2 (2026-09-13, after the antagonist's round 2: 2 MAJOR, 4 MINOR, 3 QUESTION)

| # | Finding | Resolution |
| --- | --- | --- |
| 1 MAJOR | A refused row keyed by its href could still make a stored minimumdoel read as *verdwenen* | The source now refuses the whole read when a row lacks `$$expanded` or a well-formed `uniqueCode` (`OnderwijsdoelMapping.IsWelgevormdeRef`), so every problem is keyed by a ref and the `Verdwenen` / `NietIngelezen` split is exact. `IMinimumdoelBron` states that contract. Tests: a malformed and a missing `uniqueCode`, and a missing `$$expanded`, each refuse the read; an identified but unusable row is still reported and the rest imported. |
| 2 MAJOR | `sup`, `a` and `alt` could still change text unnoticed | `Superscript` converts only a plain number and any other `<sup>` is refused; an `<a>` that `Link()` does not consume (unclosed, or its address not double-quoted) is refused; `AltTekst` and `Link` no longer match inside another attribute name (`data-alt`). One test per probe the audit listed. The class doc now names what the rules were fitted to. |
| 3 MINOR | "kon niet ingelezen worden" was false for an expiry | "werd niet ingelezen", which holds for every cause; the `IsLeeg` doc narrowed. |
| 4 MINOR | Worklog and ADR still pointed at the deleted notice | Both retargeted at `doelen.geenMinimumdoelenTitel` / `doelen.geenMinimumdoelenActie` and the register's count. |
| 5 MINOR | The CLAUDE.md twin of Art. V.6 | CLAUDE.md's Testing section amended in step. |
| 6 MINOR | Double counts | 49 fractions and 6 links in 3 rows, corrected in ADR-0032, this worklog and the test. |
| 7 QUESTION | No place for the owner's confirmation | Outstanding item 5; asked in session. |
| 8 QUESTION | The stale lock | Outstanding item 6; the technical lead's or owner's call. |
| 9 QUESTION | FR-2.2 / Art. V.3 "only minimumdoelen" | Noted in FR-2.2 and ADR-0032 decision 5 as the implementer's reading: served by the minimumdoel-level view, since the API path never produces doelsoort MD. |

E1-21 also carries the audit's count: today's converter would refuse 43 G goals of snapshot 1.2.

### Verification after fix round 2 (2026-09-13)

- `dotnet build` succeeded; `dotnet format --verify-no-changes` on the touched paths: clean.
- Unit: **910 passed, 1 skipped** (the opt-in live test). Live contract test against KOV: **passed**.
- Integration without PostgreSQL: **68/68**. PostgreSQL, Op.stap and curriculum classes: **29 passed, 6 failed**, the six
  being the DI-blocked `OpstapMinimumdoelenImportEndpointsTests`, unchanged from fix round 1.
- The full PostgreSQL half is still not run (memory; see fix round 1).

## Fix round 3 (2026-09-13, after the antagonist's narrow round 3: 0 MAJOR, 4 MINOR)

Round 3 confirmed both round-2 MAJORs resolved against live data. Its four MINORs, all doc and copy accuracy:

1. English docs said "could not" where "was not imported" is what holds; fixed in `IMinimumdoelImportService`. `IsLeeg`
   was true for a skipped import, in which every stored minimumdoel went unread: it is now false when `Overgeslagen`, and
   the skip test asserts it.
2. The plural `NietIngelezenMelding` now inflects both sentences ("De vorige teksten blijven staan."); test updated.
3. The FR-2.2 note is dated 2026-09-13 and marked as the developer's reading, not confirmed by the owner; the
   CLAUDE.md marker is dated to when it was written.
4. `OpstapBronFout`, `IMinimumdoelBron` and `IMinimumdoelImportService` describe the refusal as "refused as a whole",
   covering a complete read refused for an unidentifiable row; ADR-0032 decision 3 lists the non-plain `sup` and the
   unclosed link.

These fixes had no independent audit round of their own. They are text, one tested line of code (`IsLeeg`) and one
tested string.
