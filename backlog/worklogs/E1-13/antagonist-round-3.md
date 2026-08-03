# Antagonist Review — E1-13 (Import-UI), round 3, on fix round 2

`story/E1-13`, head `bdd5911`, range `origin/main...HEAD` (`origin/main` = `61457bc`, so E4-06 is excluded). Rounds 1 and 2 are in [`antagonist.md`](antagonist.md) and [`antagonist-round-2.md`](antagonist-round-2.md).

> Committed by the orchestrator: the antagonist is read-only by contract. Verbatim.

**Verdict:** VIOLATIONS FOUND — **1 MAJOR, 5 MINOR, 1 QUESTION.** All six round-2 findings are genuinely closed. The model-wide EF change is sound, verified metadata-only, and its test really fails without it. The MAJOR is new, and it is in the fix written for round-2 MINOR 2: the replacement sentence asserts something false in the most reachable case and steers a teacher toward a control that destroys teacher decisions for no benefit. **That one should block the merge**; the five MINORs and the QUESTION are defensible waivers.

**Scope audited:** new commits `4c1fcc3`, `46496f5`, merge `00dc903`, `bdd5911`. 129 files. Re-read in full: `AppDbContext.cs`, all 13 EF configurations, the model snapshot and every migration, `SchoolcontentImportService.cs`, `OpstapImportService.cs`, `KlasBeheerService.cs`, `SchoolcontentBeheerService.cs`, `AggregaatGroeiTests.cs`, `OpstapImportOpmerkingenTests.cs`, `SchoolcontentImportOpmerkingenTests.cs`, `Opstapimport.tsx`, `Schoolcontentimport.tsx`, `routes.ts`, `nl.json`, the E1-12/E1-13 backlog entries, `implementation.md`.

**I did not run a browser** (same as rounds 1 and 2). Everything below is from code, from the test suite, and from two experiments I ran myself.

## Findings

### [MAJOR] 1. The new reconcile-path cap notice states a falsehood in its most reachable case, and both remedies it offers are wrong there (one of them destructively)

- **Article/FR:** Art. II.3 (a message a teacher can act on must be true and actionable), Art. IV.2 (the opt-in it recommends deletes teacher decisions), Art. X.5. This is the fix for round-2 MINOR 2.
- **Where:** `backend/src/Jaarplanner.Infrastructure/SchoolcontentImport/SchoolcontentImportService.cs:544-550` (the sentence), `:493-504` (the comment defending it), `:452-454` (the `behouden` predicate), tests at `backend/tests/Jaarplanner.UnitTests/Schoolcontent/SchoolcontentImportOpmerkingenTests.cs:190-247` and `:249-274`.
- **Problem:** the sentence ends unconditionally with

  > `De bezette plaatsen kan dit bestand niet vrijmaken: haal eerst een themadoel weg bij het thema zelf, of duid bij het doorvoeren aan dat koppelingen die niet meer in het bestand staan mogen verdwijnen.`

  `behouden` (`:452`) counts a retained link when it is **in the incoming file** *or* when it is a human decision the opt-in is not discarding. Both new tests only cover the second case (`KoppelingStatus.Manueel`, codes **absent** from the file), where the sentence is true. The first case is the reachable one, because the import itself creates themadoelen as `Voorgesteld` (`:467`), so a second import of the same file meets links that *are* in the file.

  I reproduced it. Thema with two `Voorgesteld` themadoelen `NAT-K3-01/02`, file listing `01,02,03,04`, mode Bijwerken:

  ```
  Thema 'Herfst' houdt 2 themadoelen die er al staan, en dit bestand brengt 2 nieuwe codes aan.
  Samen is dat meer dan de 3 themadoelen die een thema kan hebben. 1 themadoel is daarom
  overgeslagen: NAT-K3-04. De bezette plaatsen kan dit bestand niet vrijmaken: ...
  ```

  Then I removed `NAT-K3-01` from the file and re-ran: **the slot was freed, no cap notice at all**, result `NAT-K3-02, 03, 04`. So "dit bestand kan de bezette plaatsen niet vrijmaken" is **false** exactly where it fires most often.

  Worse, in that case the two remedies are: (a) *haal een themadoel weg bij het thema zelf* — there is no screen for that. `DELETE /api/themas/{id}/themadoelen/{id}` exists (`Jaarplanner.Api/Controllers/ThemasController.cs:70`), but `frontend/src/features` contains only `doelen`, `import`, `jaarplan`, `matching`; no thema-beheer UI exists (E1-14 unbuilt). (b) *duid aan dat koppelingen die niet meer in het bestand staan mogen verdwijnen* — a **no-op for the cap** here (no retained link is absent from the file), while `MenselijkeBeslissingenVerwijderen` is a **global** option that deletes `aanvaard`/`manueel` links across every thema and subthema in the run. The notice therefore invites a teacher to arm the exact flag whose stale state destroyed two `Aanvaard` links in round 1, for zero benefit.
- **Required fix:** make the second sentence conditional on whether any retained link is actually absent from the file. When the occupied slots are the file's own codes, say so and say the real fix (remove one of those codes from the `Themadoelen` cell). Only mention the discard opt-in when it can change the outcome. Drop or defer "haal eerst een themadoel weg bij het thema zelf" until a screen offers it. And add the missing test case: retained `Voorgesteld` links that *are* in the file.

### [MINOR] 2. The comment carrying the model-wide rule says Subthema and Activiteit had no explicit-`Add` workaround; two such lines exist

- **Article/FR:** Art. X.5 (two of round 2's six findings were comments asserting what the code did not do).
- **Where:** `backend/src/Jaarplanner.Infrastructure/Persistence/AppDbContext.cs:98-102`; repeated in `implementation.md` and in the commit message of `4c1fcc3`.
- **Problem:** `SchoolcontentBeheerService.cs:268` is `_context.Subthemas.Add(subthema)` and `:353` is `_context.Activiteiten.Add(activiteit)`. Both collections *do* have the workaround; what they lacked was one on the **import** path (`SchoolcontentImportService` adds only `Themadoelen:468` and `Subdoelen:605`). As written, the rule's justification tells the next reader that `POST /themas/{id}/subthemas` was broken too, which it was not. A reader acting on that would look for the defect in the wrong place, or conclude the beheer endpoints were untested.
- **Required fix:** one word: "no such line **on the import path**". Correct the same sentence in `implementation.md`.

### [MINOR] 3. The blanket rule's precondition is asserted in a comment and guarded nowhere

- **Article/FR:** Art. X.1 (the relevant test), Art. X.5.
- **Where:** `AppDbContext.cs:85-87` ("Every Guid key in this model is assigned by the domain constructor … so none of them is store-generated") and the loop at `:110-117`.
- **Problem:** the statement is true today — I checked all eleven: nine `Guid Id` primary keys (`Thema`, `Themadoel`, `Subthema`, `Subdoel`, `Activiteit`, `Klas`, `Schooljaar`, `Jaarplan`, `Generatieparameters`) plus the owned `DoelKoppeling.Id` in two tables, every one with a `= Guid.NewGuid()` initialiser. But the rule inverts the failure mode: with `ValueGenerated.Never`, a future Guid-keyed entity whose constructor does *not* assign the key inserts `Guid.Empty` silently, and the second row of that type violates the PK. Nothing enforces the precondition; the guard is `AggregaatGroeiTests` only if somebody remembers to add a case for the new collection — which is the same "somebody remembers" the round rightly rejected for copy guards. Related and smaller: the loop is the last statement in `OnModelCreating`, so a configuration added *below* it would silently escape the "model-wide" rule.
- **Required fix:** a cheap reflection test over `modelBuilder.Model` asserting every `Guid` key property either has a non-empty value on a freshly constructed instance or is a dependent/FK key part; or, at minimum, state in the comment that the precondition is unguarded and that a new entity must assign its own key.

### [MINOR] 4. `implementation.md`'s counts do not match its own table, and its gate figures are pre-merge only

- **Article/FR:** Art. X.6 / X.5; this repo's own record on drifting counts.
- **Where:** `implementation.md`, fix-round-2 section: "a query over `information_schema.columns` for the **six** affected tables"; "`SchoolcontentBeheerService` (x3)"; the gate table headed "measured on `4c1fcc3`".
- **Problem:** the table immediately above names **five** broken collections, and the rule actually touches **eleven** Guid key properties, so "six" matches neither reading. `SchoolcontentBeheerService` has **four** `.Add` sites (`:232, :268, :321, :353`), not three. And the gate table records `166 integration / 256 pnpm`, measured before the `origin/main` merge (`00dc903`) that follows it; no line in the repo records the merged tree's numbers, so a reader of the worklog would take 166/256 as current. I measured HEAD myself: **513 unit / 167 integration / 272 frontend (15 files)**, `dotnet format`, `pnpm lint` and `pnpm build` clean. The figures are right; only the record is stale.
- **Required fix:** correct the two counts, and add a post-merge gate line for `bdd5911`.

### [MINOR] 5. A 7-failure integration run on this exact tree, unreproduced, hitting the story's own guard test

- **Article/FR:** Art. X.1.
- **Where:** `backend/tests/Jaarplanner.IntegrationTests` on `bdd5911`.
- **Problem:** my **first** full-solution run reported `Failed: 7, Passed: 160, Total: 167`, including `SchoolcontentImportEndpointsTests.Tweede_import_laat_een_bestaand_thema_groeien(modus: "Bijwerken")` failing with a **500** — the exact defect this round fixed. I then could not reproduce it in seven further runs: integration-only clean (167/167), full solution clean twice (513 + 167), the class alone 5×5 green, and two full suites deliberately run **concurrently** against the same PostgreSQL, both clean. The most likely explanation is Postgres connection/database-lifecycle contention (the suite's own `PostgresTestDatabase.DisposeAsync` documents intermittent `55006`), but I cannot prove it: I truncated my own log with `tail`, so the detail is lost. This is the **second** such observation on this story — round 2 logged a 6-failure run, also unreproduced. Two independent multi-failure runs, both unexplained, on the story that just changed key generation for every entity in the model, is a pattern that deserves a filed issue rather than a third "unreproduced observation".
- **Required fix:** file it (a story or a note in `backlog/README.md`) with the instruction to capture full logs on any future multi-failure run. Not a merge blocker: the fix itself is independently proven (see checks).

### [MINOR] 6. The same audience-leak the story fixed in the import service still sits in the beheer service, one file over

- **Article/FR:** Art. II.3 (article references belong in comments), Art. II.5 (no em dash in the product).
- **Where:** `backend/src/Jaarplanner.Infrastructure/SchoolcontentBeheer/SchoolcontentBeheerService.cs:479` — `"Een subthema is klas-gebonden; een klas is verplicht (Art. IX.2)."` — and `:468` — `$"Onbekende leerdoelcode '{code}' — koppeling geweigerd (Art. III.5)."` (em dash).
- **Problem:** **pre-existing** (introduced by E1-10, `aab4df0`), not authored by this story, and currently unrendered because no beheer UI exists. But `backlog/README.md` records this story as having fixed "one notice told a teacher '(een subthema is klas-gebonden, Art. IX.2)'", and the near-identical sentence in the sibling service was not swept — the same selective-fix pattern the story keeps naming. E1-14 will render both.
- **Required fix:** not this story's to fix, but log it against E1-14 so it is not rediscovered on that screen.

### [QUESTION] 7. MINOR 4's widened guard changes E1-05's response contract for an empty first import

- **Article/FR:** Art. III.4 / FR-2.5; Art. XI.3.
- **Where:** `backend/src/Jaarplanner.Infrastructure/OpstapImport/OpstapImportService.cs:166` (was `inkomend.Count == 0 && bestaand.Count > 0`).
- **Problem:** for a first import that reads nothing, `overgeslagen` flips `false→true` and `toegepast` flips `true→false`, plus a notice appears. **My judgement: this is within E1-13's scope.** No curriculum data behaviour changes (nothing was written either way), the destructive-over-reaction protection for `bestaand.Count > 0` is untouched, and the E3-06 rule genuinely required it — the screen otherwise offered "Doelen inlezen" and then claimed success for zero doelen. But it is a change to a response contract E1-05 owns, recorded only in a code comment and a commit message.
- **What I would need to settle it:** a line on the E1-05 (or E1-13) backlog entry recording that the empty-input guard now fires irrespective of existing rows, so the next reader of E1-05 does not treat the old condition as its specification.

## The six round-2 findings, verified closed

| # | How I verified it is closed, not moved |
| --- | --- |
| 1 (neutral 409 asserts "niets gewijzigd") | The clause is gone from `nl.json → import.opstap.geweigerdAlgemeenUitleg` (I read the key: *"Dit gaat niet over de rijen in het bestand: het bestand is als geheel geweigerd."*). The comment's "what a 409 always guarantees" is replaced with an explicit correction (`Opstapimport.tsx:145-157`). The new assertion reads the **rendered panel** — `expect(screen.getByRole("alert").textContent).not.toMatch(/niets gewijzigd/)` (`Opstapimport.test.tsx:321`) — so restoring the clause fails even after a key rename. I re-swept all 444 `nl.json` leaves: zero em dash / `Art.` / `(s)`. |
| 2 (cap advice create-path-only + false comment) | Closed as stated: two branches (`SchoolcontentImportService.cs:524-550`), the comment now names `reedsAanwezig` and retracts the old claim explicitly. **But the replacement introduced MAJOR 1 above**, so the finding is closed and the defect class is not. |
| 3 (guard's blind spot + unguarded Op.stap notices) | (a) `AssertLeesbaarVoorEenLeerkracht`'s doc comment now states the composed-inflection blind spot, names the escaping sentence and says a composed notice needs a case per grammatical form (`SchoolcontentImportOpmerkingenTests.cs:41-56`). (b) New `OpstapImportOpmerkingenTests.cs`: a `[Theory]` over all three forms with negative assertions on the wrong ones (`:55-81`), the out-of-scope notice, and a sweep over every opmerking with `Assert.Contains(runs, r => r.Diff.Opmerkingen.Count > 0)` at `:141` so it cannot pass vacuously — the exact failure round 2 caught twice. |
| 4 (one-sided E3-06 guard) | Widened on the **server** (`:166`), which is the right side: `nietsInTeLezen` keys on `overgeslagen`, so a third skip reason is covered without a frontend edit, and the comment says so. Pinned by `Eerste_import_zonder_bruikbare_rijen_is_ook_overgeslagen` on the wire value, not the copy. Third zero-form notice added and tested. See QUESTION 7 for the scope note. |
| 5 (`import.opstap.voorwaarde` expiry) | **Adequate.** The finding itself named this remedy first ("add the removal … to the E1-12 story's *Done when*"). `backlog/E1-curriculum-content.md` now carries an explicit clause under E1-12: *"remove `import.opstap.voorwaarde` and its notice block"*, with the alternative (a count endpoint) and the reason it is in the backlog rather than a comment. The string is untouched, deliberately, and E1-12 is `[!]`. A backlog item now owns the obligation; a comment did before. That is the fix. |
| 6 (lost FR-2.5 report — owner ruled acceptable) | Recorded **where the clearing happens**, not only in the backlog: `Opstapimport.tsx:84-92` and `Schoolcontentimport.tsx:99-104` each carry a paragraph saying the loss was weighed and chosen, naming the alternative that was rejected, and telling the next reader not to reinstate a recency rule. The ruling is also on the E1-13 story entry. It no longer reads as an oversight. |

## Job 2 — the model-wide key change, audited as new code

- **Is it metadata only? Yes, proven three ways.** `dotnet ef migrations has-pending-model-changes` on this tree: *"No changes have been made to the model since the last migration."* No migration file changed in the diff. And decisively: **no `uuid` column in any migration carries a default** — I grepped every migration for `defaultValue`/`defaultValueSql` on uuid and `gen_random_uuid` and found none, and the schema comes from the migrations, so the model change cannot alter it. The `Id` properties in `AppDbContextModelSnapshot.cs` still read `.ValueGeneratedOnAdd()` (11 places), which the relational differ ignores because no schema artefact follows from it; the next `migrations add` will rewrite the snapshot and emit an empty body. Harmless, worth knowing. **No Art. IX change, no ADR needed.**
- **Is the blanket scope right? Yes, with the caveat in MINOR 3.** I enumerated every Guid key: nine entity PKs and the owned `DoelKoppeling.Id` in `themas.Doelsuggesties` and `activiteiten.Doelkoppelingen`. All eleven are constructor-assigned. Non-Guid keys (`Discipline.Nummer`, `Leerplandoel.Code`, `Minimumdoel.Ref`, and the shadow int ordinals) are untouched. Nothing that should have stayed generated is silenced. The residual risk is the *inverse* one, unguarded — MINOR 3.
- **Does `AggregaatGroeiTests` actually fail without the fix? Yes — I proved it.** I cloned the repo to a scratch directory, checked out `bdd5911`, deleted the `foreach` loop from `OnModelCreating`, and ran the class against local PostgreSQL 17: **`Failed: 5, Passed: 4, Total: 9`**, and the five are exactly the named collections (`Bestaand_thema_krijgt_een_themadoel`, `..._subthema`, `Bestaand_subthema_krijgt_een_subdoel`, `..._activiteit`, `Bestaand_schooljaar_krijgt_een_klas`). Restoring the loop: **9/9 pass**. The claim reproduces precisely; this test cannot pass vacuously.
- **Are the three `.Add(child)` workarounds redundant, harmful or load-bearing?** Redundant and harmless — I verified there is no path where `.Add` is now required, and both comments that claimed to be load-bearing (`KlasBeheerService.cs:79-88`, `SchoolcontentBeheerService.cs:227-231`) now say plainly that they are belt-and-braces. The other five `.Add` sites never carried such a claim, so nothing false was left standing. See MINOR 2 for the one inaccuracy in the surrounding narrative.
- **E4-06 interaction:** none found. `Jaarplan._plaatsingen` was already `ValueGeneratedNever()` explicitly (`JaarplanConfiguration.cs:81`) and the blanket loop, which runs *after* `ApplyConfigurationsFromAssembly`, sets the same value; I checked no configuration anywhere sets `ValueGeneratedOnAdd` that the loop would override. E4-06's `JaarplanPersistentieTests` (154 lines) and `Jaarplankalender.test.tsx` (385 lines) both pass on the merged tree. The merge is clean: no conflict markers anywhere in `frontend/src`, `backend/src`, `backend/tests`, and both sides' `nl.json` keys and `catalogus.test.ts` additions survive.

## Checks run (proof of thoroughness)

- **Art. II.3 / II.5 — copy.** All **444** `nl.json` leaves swept for em dash / `Art.` / `(s)`: zero. Backend product literals across all 19 changed/adjacent `.cs` files (comments excluded, whole-file literal extraction): **101 candidates, 2 real hits, both pre-existing in `SchoolcontentBeheerService`** (MINOR 6) plus one test-fixture em dash in `SchoolcontentImportEndpointsTests.cs:217` (`"L6 — bestaat niet"`, a deliberately invalid klas name in a workbook — test data, not product copy, not a violation). Hard-coded Dutch in `features/import` production files: **none**; the one hit my scanner flagged (`Opstapimport.tsx:292`) is a code comment inside a JSX expression. `'bestand'` in `api.ts:77,119` is the multipart field name.
- **Art. VIII — stack and layering.** No `package.json`, `.csproj`, `global.json` or lockfile in the diff: no new dependency, no SDK move, ClosedXML unchanged. `Probleemsoorten.cs` sits in `Api/Infrastructure` and depends only on the `Application` enum. No EF Core or Npgsql type in `Jaarplanner.Api` outside `Program.cs`'s composition root.
- **Art. X.1 / X.2 — gates re-run by me on `bdd5911`.** `dotnet format --verify-no-changes` clean; `dotnet test` with `JAARPLANNER_TEST_POSTGRES` → **513 unit + 167 integration, 0 failed, 0 skipped** (twice, plus integration-only once, plus twice more under deliberate double-load); `corepack pnpm lint` clean; `corepack pnpm test` **272 passed / 15 files** (twice); `corepack pnpm build` clean. Every figure in the orchestrator's brief reproduces. The one contrary run is MINOR 5.
- **Art. III.** No mutation of official `Leerplandoel`/`Minimumdoel` content; the empty-input guard returns before any write; the Excel→model mapping is still in one place and untouched by this round.
- **Art. IV.** No AI surface touched. `DoelKoppeling.Status` is still persisted and the import creates new links as `Voorgesteld`. The one AI-adjacent thing this round touched is the **preservation** of `aanvaard`/`manueel` on reconcile, which is intact — and MAJOR 1 is precisely about a notice that invites a teacher to override it.
- **Art. V.** `Dekking` still computed, nowhere stored. No coverage logic changed.
- **Art. VI.** No pupil data. No new credential: the only `Password=` occurrences in the diff are worklog lines quoting the throw-away local test database, covered by the ratified Art. VI.4 exception. No AI key path; the frontend never sees one. §3.2 handling is now the owner's ruling rather than an interpretation, recorded in both `routes.ts` and `Opstapimport.tsx`.
- **Art. VII / IX.** Taxonomy untouched; `cluster` still nullable; `(domein, subdomein)` grouping unchanged; level scoping unchanged (`Themadoel` school-wide, `Subthema`/`Subdoel`/`Activiteit` per class and age — `AggregaatGroeiTests` seeds exactly that shape); no month assumption anywhere.
- **Falsification experiments (run in a scratch clone, never against the worktree):** (1) the model-fix reproduction described above; (2) a probe test reproducing MAJOR 1 and then showing that editing the file *does* free the slot the notice claims it cannot. Both were deleted from the clone; the worktree was never modified.

## Open questions surfaced (Art. XIV)

- **Durable acknowledgement of a disappeared leerplandoel** — unchanged, and now the recorded home of round-2's QUESTION 6 rather than an open gap in this story.
- **E1-12** — unchanged, still `[!]`, still owns the removal of `import.opstap.voorwaarde`, and now also owns the two identity hazards (`jaarFase` orderings, `minimumdoelRef` padding) added in `bdd5911`. This story still does not close FR-2.1.
- **The minimum of 2 themadoelen** (Art. IX.2 says "2–3", only the maximum is enforced) — still unowned, still correctly flagged in `SchoolcontentImportService.cs:483-485`.
- **E1-05's empty-input contract** — QUESTION 7 above.
- **Disciplines first** — the free-text discipline number remains the right seam.

**Per Art. X.7 this change is not done until these are fixed or explicitly waived.** Stated plainly for the merge decision: **MAJOR 1 should block it.** It is a user-facing false statement whose recommended remedy is a globally destructive opt-in that cannot help in the case that produced the message, in a story whose round-1 audit already found that same opt-in deleting `Aanvaard` links. It is a one-branch fix plus one test case. MINORs 2, 3 and 4 I would fix in the same pass (three comments and two numbers). MINOR 5 should be filed, MINOR 6 handed to E1-14, and QUESTION 7 answered with one backlog line — none of those three need to hold the merge.
