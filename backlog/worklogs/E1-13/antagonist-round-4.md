# Antagonist Review — E1-13 (Import-UI), round 4, on fix round 3

`story/E1-13`, head `7fba804`, range `bdd5911..HEAD`. Rounds 1–3: [`antagonist.md`](antagonist.md), [`antagonist-round-2.md`](antagonist-round-2.md), [`antagonist-round-3.md`](antagonist-round-3.md).

> Recorded by the orchestrator (the antagonist is read-only by contract). **Condensed** from the agent's report: every finding, file/line, verdict, mutation result and measured figure is preserved verbatim or near-verbatim; the longest prose passages of the reasoning are shortened. Where a sentence is quoted it is the agent's own.

**Verdict:** VIOLATIONS FOUND — **0 CRITICAL, 0 MAJOR, 5 MINOR, 1 QUESTION.**

> **"Nothing here should block the merge.** The round-3 MAJOR is genuinely closed, and closed *better* than my own proposed fix would have been: the implementer's reasoning about the discriminator is correct and mine was wrong one level down."

Every gate figure reproduced exactly. The six items are drift, record-keeping and one untested inflection; four are one-line fixes and none is a falsehood a teacher can be harmed by.

**Scope:** `06437b5`, `a0aff9c`, `f4161c2`, `b30301a`, `b92201d`, `7fba804`. Five falsification experiments in a scratch clone, all reverted; the worktree was never modified (verified clean at `7fba804` afterwards).

## Job 1 — the MAJOR is closed, and the discriminator is right

**The auditor withdraws its own round-3 suggestion.** It proposed branching on *"is the retained link in the file"*; the implementer branched on *can this file dislodge the link* (`IsMenselijkeBeslissing(status) && !MenselijkeBeslissingenVerwijderen`, `SchoolcontentImportService.cs:468-470`).

> "A link satisfying **both** clauses (a human decision whose code *is* in the file) is counted as `bezetDoorBeslissing` … removing its code from the cell moves it from the `continue` at `:420-423` into the preserve-and-warn branch at `:434-439`, where it still occupies a slot. So the file cannot dislodge it … **My discriminator would have shipped a smaller version of the same falsehood.**"

Using literally the removal loop's own expression is judged the right call: the two cannot disagree about which links survive.

**All four reachable `(bezetDoorBestand, bezetDoorBeslissing)` states enumerated, each notice true in its own case:**

| State | Branch | Truth |
| --- | --- | --- |
| (0,0) | `:561` "vooraan in de kolom" | **True**, including on the reconcile path: if `behoudenKoppelingen` is empty, `nieuweCodes` is the whole cell in cell order, so `Take(ruimte)` really is the first *n*. |
| (b>0, 0) | `:571` "alles komt uit dit bestand" | **True**. `DoelCodeControle.FilterGeldig` (`:734-745`) deduplicates via `gezien.Add`, so a thema spread over several activity rows cannot inflate the count. Also true in the `MenselijkeBeslissingenVerwijderen=true` sub-case. |
| (0, m>0) | `:592`, no `viaBestand` | **True.** The two-step remedy is complete for both an absent and an in-file decision, which round 2's single-step version was not. |
| (b>0, m>0) | `:592` + `viaBestand` | **True.** See MINOR 1 and 2 for two things that are not truth problems. |

**No fourth case falls into the wrong branch.** `IsMenselijkeBeslissing` covers `Geweigerd` too (`:673-674`), and the copy says *"waar iemand zelf al over beslist heeft"* rather than "aanvaard" — correct, since a `geweigerd` link occupies a slot identically. `reedsAanwezig > MaxThemadoelen` is unreachable (`Thema.VoegThemadoelToe:144`).

## Findings

### [MINOR] 1. In the mixed branch the notice puts the globally destructive lever first and the safe, sufficient one last
- **Art. II.3; Art. IV.2 in spirit.** `SchoolcontentImportService.cs:598-611` — `viaBestand` is appended *after* the blast-radius sentence.
- In the reachable mixed state (`07`/`08` Manueel, `05` Voorgesteld; file `05;06;07`), removing `05` from the cell frees the slot and `06` lands: **the safe lever alone resolves the cap completely, with no data loss.** The destructive one deletes `08` and every other `aanvaard`/`manueel` link absent from the file across the whole run. A non-technical reader gets the destructive option in sentence 4 and the safe one in sentence 6. The code comment at `:598-599` justifies the placement with "because it is the cheap lever", which is an argument for putting it **first**.
- **Fix:** emit `viaBestand` before the opt-in clause, or gate the opt-in sentence on `bezetDoorBestand == 0`. **Blocks merge?** No. Belongs to **E1-14**.

### [MINOR] 2. The notice counts occupied slots it never names, so "die codes" has no resolvable referent
- **Art. II.3 as amended 2026-07-30** (a server-composed diagnostic is licensed *because* it can name the row, column, thema). `:592-611`; DTO `SchoolcontentImportDiff.cs:96`; panel `Schoolcontentimport.tsx:291-293`.
- On the demo "Water" case the screen carries the skipped code in the notice and one threatened code in another panel, and **nothing anywhere identifies the second occupied code**. `ThemaWijziging` carries no codes at all, so the instruction *"zorg dat die codes niet in de kolom Themadoelen staan"* cannot be carried out for it. The service has them (`behoudenKoppelingen`, `:453`).
- **Fix:** name them parenthetically, as the skipped codes already are. **Blocks merge?** No. **E1-14**.

### [MINOR] 3. `implementation.md` §4 states the mixed case cannot be reached through the product. It can, and the auditor reached it
- **Art. X.5.** Third instance on this story of a record asserting what the code does not do. `implementation.md:904-906`.
- `DemoDataSeeder.cs:246-247` gives **every** demo thema two `Manueel` themadoelen, so importing this round's own B-file **twice** in Bijwerken, through the import screen alone, reaches `(1, 2)`. Proven with a probe test in a scratch clone. *"So the branch the implementer itself calls 'the one the composed sentence is easiest to get wrong in' was one extra click away from a browser pass that had already loaded the exact file and thema."*
- **Fix:** correct the sentence (doc-only). Behaviour is covered in xUnit. **Blocks merge?** No.

### [MINOR] 4. The copy guard's doctrine has drifted again, and one reachable inflection is untested
- **Art. X.1 / II.3.** `SchoolcontentImportOpmerkingenTests.cs:22-29, 41-52, 265-267, 446-470`.
- (1) **`inkomend`'s singular is never asserted.** `"1 nieuwe code"` requires `reedsAanwezig == 3`, which MINOR 3 shows is reachable. The class's own rule is *"a case per grammatical form"*; three of four is not that. (2) The singular test's doc says "both counts"; the sentence now interpolates three. (3) The class doc still says "four reachable notices"; as a count of *strings* it is now six. (4) The sweep imports in `Toevoegen`, so of the cap's three branches it exercises one.
- **Fix:** one assertion plus three doc sentences. **Blocks merge?** No. **E1-14**.

### [MINOR] 5. Round-3 MINOR 6 was neither fixed nor filed. It is simply gone
- **Art. X.7** (findings addressed **or explicitly waived**). `SchoolcontentBeheerService.cs:468` (em dash *and* article reference) and `:479`, both still verbatim.
- The orchestrator filed MINOR 5 (E7-14) and QUESTION 7 (E1-13) and **not** MINOR 6. No backlog entry mentions `SchoolcontentBeheerService`; E1-14's *Done when* says nothing about copy. Meanwhile `backlog/README.md:128` credits this story with fixing the near-identical sentence one file over. *"That is precisely the rediscovery my round-3 report asked to prevent."*
- **Fix:** one clause under E1-14. **Blocks merge?** No, but *"it should be written down **before** the merge, because the merge is what closes the window in which anyone remembers."*

### [QUESTION] 6. The 13 deleted screenshots: the claim cannot be verified, by anyone, any more
- **Art. X.5 / X.7.** `7fba804`, `backlog/worklogs/E1-13/fix-3/`.
- **Established:** `7fba804` touches one file, one line; `git log --diff-filter=D` over the range is empty; the 13 `R*` names appear nowhere in history under `fix-3/`; no document references them except `implementation.md:901-903` saying they were deliberately not committed. So nothing tracked was removed and no dangling reference was created.
- **Cannot be established:** byte-identity. The files were never in git, so there is no blob to hash. In its favour: `fix-1/` holds exactly 13 committed screenshots named `R1-…R13-`, and the 21 committed images in `round-3/` and `fix-3/impl-r3/` have 21 distinct md5s.
- *"What would have settled it: the 13 md5 pairs pasted into the commit message. That is the same remedy round-3 MINOR 5 demanded for the truncated test logs, and this is the same defect: an assertion whose evidence was discarded in the act of making it."*
- *Found while checking, and not this round's:* `test-report.md` still references three screenshots deleted in `bc4c880` (round 1's "wrong moment, photographed three times"). Deleting images without sweeping references is the failure mode — which `7fba804` avoided.

## The round-3 findings, verified closed

| # | Verdict | How, rather than by accepting the claim |
| --- | --- | --- |
| **MAJOR 1** | **Closed, correctly** | Full case analysis (above). **Mutation:** `if (bezetDoorBeslissing == 0)` → `< 0` in a scratch clone: the new cap test fails on *Not found: "zou 4 themadoelen krijgen"*, exactly as the worklog claims. The falsehood, the non-existent screen and the useless opt-in are gone from the branch that produced them, and the new test **carries the advice out** instead of only asserting copy. |
| **MINOR 2** | **Closed** | `AppDbContext.cs:98-106` carries the "ON THE IMPORT PATH" qualifier, names which two collections the import service does add, and states that `SchoolcontentBeheerService` covers `Subthemas`/`Activiteiten` so `POST /themas/{id}/subthemas` was never broken. `implementation.md:549-553` retracted rather than deleted. |
| **MINOR 3** | **Closed, and the guard genuinely fails** | Three mutations, each reverted: (a) delete the loop → guard fails naming **exactly 11** keys; (b) **add `ValueGeneratedOnAdd()` below the loop** → fails with *"Check whether a configuration was added below the ValueGenerated.Never loop … Thema.Id = OnAdd"*, so **the ordering hazard is guarded, not documented**; (c) drop `Themadoel.Id`'s initialiser → precondition test fails naming it. Neither test can pass vacuously (`Assert.NotEmpty(GuidSleutelEigenschappen())`), and all four FK exemptions are genuinely owner-relationship keys. |
| **MINOR 4** | **Closed, all four counts exact** | Re-measured off the finalised model: **19** Guid key properties over **15** tables; the worklog's "17 uuid primary-key columns" is right because two owned *references* table-split onto the parent's column (19 − 2 = 17). Split verified: 11 loop-changed + 4 explicit `ValueGeneratedNever()` + 4 FK key parts = 19. `.Add` sites verified at `:58, :232, :268, :321, :353` and `:485, :668`. Every line number in the corrected worklog is exact. |
| **MINOR 5** | Filed, better than asked | E7-14, saying explicitly that the two runs do **not** match its signature, why a teardown fault cannot produce 6–7 failures or a 500 in a test body, and "capture the full log". |
| **MINOR 6** | **Not closed** | See MINOR 5 above. |
| **QUESTION 7** | Answered | E1-13 entry records that the empty-input guard now fires irrespective of existing rows and that E1-05's old condition is not its specification. Checkboxes and `README.md` untouched, as claimed. |

## Checks run

- **Art. X.1/X.2 — gates re-run on `7fba804`:** `dotnet format` clean, exit 0. `dotnet test` against local PostgreSQL 17: **517 unit / 0 / 0** and **167 integration / 0 / 0** (3 m 24 s). `corepack pnpm lint` clean. `corepack pnpm test` **272 / 15 files**. `corepack pnpm build` clean. **Every implementer figure reproduces exactly**, and no repeat of round 3's unexplained red run.
- **Art. II.3 / II.5:** no frontend file or `nl.json` key changed in the range, so round 3's 444-leaf sweep stands. Every added `+` line in the changed `.cs` files swept for `—` outside comments: **zero**. All three notices verified in both grammatical forms except `inkomend`'s singular (MINOR 4).
- **Art. III / IV / V:** no curriculum mutation; mapping untouched and still single-source; no AI surface; preservation of `aanvaard`/`manueel`/`geweigerd` intact and now the *reason* for the split; new links still `Voorgesteld` (`:484`); `Dekking` still computed.
- **Art. VI:** no pupil data, no credential — the only `Password=` in the range is `"…Database=model_only;Username=x;Password=x"` in `GuidSleutelConventieTests.cs:250`, which opens no connection and names no existing database.
- **Art. VII / VIII / IX:** taxonomy untouched, `cluster` still nullable, level scoping unchanged. **No data-model change:** the range matches no `Migrations/`, `.csproj`, `package.json`, lockfile or `global.json`. The `ValueGenerated` change stays metadata-only. No new dependency, no layering breach.
- **Art. X.6:** ~110 lines of code in one file plus ~290 test lines; the rest of the 1,005-line diff is worklog, evidence and backlog. Reviewable.

## Open questions (Art. XIV)

- **Durable acknowledgement of a disappeared leerplandoel** — unchanged.
- **E1-12** — unchanged, still `[!]`, owns the removal of `import.opstap.voorwaarde` and the two identity hazards.
- **The minimum of 2 themadoelen** — still unowned, still flagged at `SchoolcontentImportService.cs:500-503`.
- **Notice length** — four to six sentences is more prose than this project's UI principles like. MINOR 2's fix (naming the codes) is the one addition that shortens the reader's *work* rather than the text. A design decision for E1-14.

**Recommendation: waive.** No CRITICAL, no MAJOR, no falsehood on any screen, no destructive advice presented as the only option, no data-model or curriculum risk, every gate reproduced independently. **MINOR 5 written down before the merge** (done, `eae0e7b`); MINOR 3 doc-only (done, `eae0e7b`); MINORs 1, 2 and 4 to **E1-14** (done, `eae0e7b`); QUESTION 6 is for the owner — *"it is not a defect, it is a habit worth adopting, and it is now the second finding on this story caused by discarding the evidence for a claim in the act of making it."*
