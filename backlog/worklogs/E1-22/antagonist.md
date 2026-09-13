# E1-22 — antagonist audits

## Round 1 (2026-09-13, on `eb000ad..6fe98a6`): VIOLATIONS FOUND — 1 MAJOR, 4 MINOR, 1 QUESTION

*Verdict pasted by the orchestrator.* Scope: 34 files, checked against the story entry, the worklog, E1-21's "Contract for
E1-22", and the backend services the screen depends on.

### [MAJOR] A later fetch offers "Nog niet doorgevoerd" and *Doorvoeren* on a report whose apply changes nothing
The E3-06 rule, the E5-03 rule, FR-2.5 / Art. III.4. `frontend/src/features/import/stappen.ts:43-61` counts any
`verdwenen` / `verdwenenMaarGekoppeld` entry as "writes something" (its own comment, 39-42, names E3-06).
`MinimumdoelImportService.cs:112-121`: `verdwenen` is every stored ref missing from the source, flagged or not, and the
apply only re-sets `NietMeerInOpstap = true`, so a repeat apply writes nothing. `OpstapImportService.cs:309-371`:
already-flagged rows are candidates (hence `.OrderBy(l => l.NietMeerInOpstap)`), re-reported as `verdwenen` /
`verdwenenMaarGekoppeld`; the apply re-sets a true flag. `LeerplandoelImportService.cs:101-106`: every apply adds an
`Opstapversie` row, so pressing only records a duplicate version for the same snapshot and moves "doorgevoerd op" to
today. Wider than the Excel-history quirk the worklog names: on an API-only database the first snapshot that drops or
renumbers a goal leaves the old code stored and flagged, and from then on every *Op.stap ophalen* of an unchanged snapshot
shows "weg N", "Nog niet doorgevoerd" and the accent *Doorvoeren* under a stand line naming that same version. No test
covers the repeat case. **Required:** status and button must depend on something true — the backend must separate "newly
gone" from "already flagged" (e.g. `verdwenen` only for rows not yet flagged, or a separate bucket) for the minimumdoelen;
for the leerplandoelen either treat `versie`+`hash` equal to `vorigeVersie` as nothing to write, or the same backend split.
Pin the repeat case in a test; correct worklog "Not done" item 2.

### [MINOR] Changed fields shown to directie as code identifiers
Art. II.2 / II.3. `Opstaprapport.tsx:277` renders `veld.veld` = `nameof(...)` (`MinimumdoelRef`, `JaarFase`, `Leeftijd`,
`Nr`, `Omschrijving`). **Required:** map each identifier to an `nl.json` label with a fallback, in both reports.

### [MINOR] The register sorts discipline groups as text (1, 10, 11, 2, …), unlike its own filter
Art. VII.0. `MinimumdoelenQuery.cs:72-73` `.ThenBy(r => r.DisciplineNummer)`; the facets use `DisciplinenummerVergelijker`
(:170). This story rewrote that clause and is the first to show real data; paging is server-side. **Required:** order by a
numeric discipline key on the server, or file a follow-up story.

### [MINOR] Two accent-coloured primary buttons on one screen; the worklog says that cannot happen
ADR-0024, Art. X. `Opstapimport.tsx:147` (*Op.stap ophalen*, `rang="hoofd"`) and `Opstapbestand.tsx:99`, `:176` (Excel
buttons, `rang="hoofd"`) are both visible when the Excel disclosure is opened before any fetch; worklog lines 10-11 claim
otherwise. **Required:** make the Excel buttons `rustig` under the API flow, or correct the claim.

### [MINOR] A code comment gives reasons its branch cannot prove
The E5-03 rule (binds comments). `Minimumdoelenlijst.tsx:25-26` "Op.stap's G goals do not reach it, or its discipline is
not loaded yet" — false for an Excel-loaded discipline (no concordance) and for a minimumdoel whose only G goal was refused.
**Required:** say less ("no loaded leerplandoel refers to it; why is not known here").

### [QUESTION] "Laad ze in bij Inladen" is shown to every role
Art. VI.1, E3-06. `Minimumdoelenlijst.tsx:147-153`, both empty states. Works for everyone today (`Curriculumbeheer` =
any session); once E6-02 narrows the policy, a teacher sees a link to something they cannot do. **Required:** none now;
record it on E6-02.

### Checks the auditor ran (summary)
FR-2.5: after the minimumdoelen apply only `voorbeeldLeerplandoelen` is called (test asserts no leerplandoelen apply; the
second press sends the pinned `versie`); each apply's report replaces the preview. Art. II.3: `reden` never rendered;
the 502 detail is the fixed Dutch `OpstapBronFout.Melding`; server notices Dutch, count-inflected, no em dash. All copy via
`t()`, no em dashes, singular/plural pairs; the three catalogue guards sound. E3-06 Excel upload: same condition as the
server's refusal. E5-03 table: every row holds except "Nog niet doorgevoerd" (MAJOR). Art. III: both queries
`AsNoTracking`, nothing writes reference data. Art. VI: new GET behind `Curriculumbeheer`, in the route inventory; CSRF
header on every request; no secrets. Art. VIII clean. Art. V / ADR-0032 decision 5: no coverage view touched; the group's
wording neutral and guarded. Art. XII: every state carries text; contrast not measured by the auditor. Art. X: vitest on
import/doelen/i18n 23 passed, `pnpm lint` clean, `MinimumdoelenQueryTests` 7 passed; PostgreSQL and browser not run by
the auditor.

## Round 2 (2026-09-13, on `6fe98a6..617e44e`): VIOLATIONS FOUND — 0 CRITICAL, 0 MAJOR, 4 MINOR, 1 QUESTION

*Verdict pasted by the orchestrator.* The round-1 MAJOR and all four round-1 MINORs are resolved (both services split
already-flagged from newly gone; `stappen.ts` reads the server's `schrijftIets`; a version row only when something is
written or the version differs; `teruggekeerd` clears the flag only on an apply, notice true and inflected; E1-21's buckets
intact; `veldLabel` 14 labels with fallback; numeric order in SQL, tested on PostgreSQL; Excel buttons `rustig`; comment
says less; E6-02 note accurate; the "meer dan eens" line holds). New findings:

- **MINOR 1 — the reason logic can claim more than the snapshot proves.** (a) A dropped goal stays stored and flagged and
  still points at M, so M keeps a place under that goal's discipline, yet `GeenDoelInOpstap` is stored for M and counted
  ("Bij 1 minimumdoel verandert de uitleg in het register." while the register changes nothing); it also breaks
  `Minimumdoel.cs`'s own definition. (b) A goal pointing at a minimumdoel KOV withdrew is dropped from the references, so M
  gets "In de doorgevoerde versie van Op.stap verwijst geen enkel doel ernaar." — unproven. `ZonderLeerplandoelBepaling.cs:33-54`,
  `LeerplandoelImportService.cs:103-109`, `Opstaprapport.tsx:137-143`, `MinimumdoelenQuery.cs:211-229`, `Minimumdoel.cs:59-64`,
  `CurriculumApiBron.cs:256`, `CurriculumdoelMapping.cs:113-116`. **Required:** no reason for a minimumdoel any stored
  leerplandoel (flagged or not) points at; no reason for a minimumdoel flagged `NietMeerInOpstap`; test for (a).
- **MINOR 2 — a first API apply with no version recorded counts as "the same version".** `LeerplandoelImportService.cs:114-116`
  (`andereVersie = vorige is not null && …`), `:132`; `Opstaprapport.tsx:91-95`. A first apply that changes no discipline
  writes reasons but no version row: the Excel route stays open (against VII.2), the stand says "Nog geen versie
  doorgevoerd" while the reason speaks of "de doorgevoerde versie", and if the reasons do not change either, *Doorvoeren*
  is never offered. **Required:** `vorige is null || …` in the flag and the version-row condition, `alleenVersie` to match,
  test for the no-earlier-version case.
- **MINOR 3 — comments over-claim.** "`SchrijftIets` is therefore true exactly when an apply writes a row"
  (`OpstapImportService.cs` class note), "writes anything" (`ILeerplandoelImportService.cs`, `types.ts`): an apply also
  sets `OpstapSleutel` on an Excel-loaded row without counting it. `MinimumdoelImportService.cs` `TeruggekeerdMelding` doc:
  no screen shows a "vervallen" mark on a minimumdoel. **Required:** admit the key-only exception; correct the minimumdoel
  comment; consider "…staat weer in de Op.stap-bron." for the minimumdoelen notice.
- **MINOR 4 — no test that a preview never clears the flag** (both `teruggekeerd` tests use `toepassen: true`); and the
  Excel *Doelen inlezen* button still shows on `!diff.isLeeg` (`Opstapbestand.tsx:176`) where `diff.schrijftIets` now
  exists. **Required:** a preview test asserting the flag stays set; switch the Excel button to `schrijftIets` or waive it.
- **QUESTION — where is the "Reden tonen" ruling and its two stored columns recorded?** The auditor accepts that no
  amendment is needed (import bookkeeping like `NietMeerInOpstap`/`OpstapSleutel`, never named in the constitution; the
  four decreed fields untouched; only the import writes the reason; no coverage code reads it), but ADR-0032 decision 5
  does not know the ruling. *Orchestrator: record it as a dated amendment note on ADR-0032 decision 5; no constitution
  change.*

Checks by the auditor: Vitest import/doelen/i18n 28 passed; unit tests filtered to Curriculum 419 passed / 4 live skipped;
PostgreSQL, live tests and browser not run by the auditor.

## Round 3 (2026-09-13, on `617e44e..9c2aed8`): VIOLATIONS FOUND — 0 CRITICAL, 0 MAJOR, 4 MINOR

*Verdict pasted by the orchestrator.* Each round-2 finding is closed where it was named (the stored-pointer rule exact
under the registered policy; preview and apply share one computation and the count sentence is true for the database the
preview read; `vorige is null || …` in the flag, the version row and `alleenVersie`, with a PostgreSQL test for one version
row and the Excel 409 afterwards; the `TeruggekeerdMelding` doc and notice true; preview tests keep the flag; the Excel
button reads `diff.schrijftIets`; exactly one primary action whenever the stand has loaded). The QUESTION is resolved in
form; its content is MINOR 2.

- **MINOR 1 — "no longer in Op.stap" is read from a flag only the other import sets.** (a) Reachable through the screen:
  KOV withdraws M, which has a stored reason; the minimumdoelen preview writes (M `verdwenen`), the leerplandoelen preview
  still sees M unflagged and changes nothing, so *Doorvoeren* flags M and skips the leerplandoelen apply
  (`Opstapimport.tsx:78-103`, `:90`) — M ends flagged **with** a reason, contradicting `Minimumdoel.cs:61-62`, and the next
  fetch offers *Doorvoeren* for a write the first press should have made. (b) A direct `POST /api/opstap-import/leerplandoelen`
  resolves concordance against KOV's live minimumdoelen index (`CurriculumApiBron.cs:87`); a minimumdoel KOV withdrew after
  our last minimumdoelen apply (G goal refused, `CurriculumdoelMapping.cs:113-116`; other refs dropped,
  `CurriculumApiBron.cs:241-243`) can be stored with `GeenDoelInOpstap` although a snapshot goal refers to its address.
  **Required:** decide "no longer in Op.stap" from this import's own read of KOV (expose the live index refs in
  `LeerplandoelBronResultaat`, add every stored ref not in it to `zonderReden`), and either clear the reason when the
  minimumdoelen import flags a row or narrow the wording in `Minimumdoel.cs:61-62`, the service comment `:135-136` and the
  backlog's fix-round-2 line. Unit test for a withdrawn, not-yet-flagged ref.
- **MINOR 2 — ADR-0032 decision 5's new note** lists "a stored leerplandoel that still points at it" among the cases the
  register tells only "no loaded leerplandoel refers to it" — false, the register lists such a minimumdoel under that
  goal's discipline (`MinimumdoelenQuery.cs:211-229`; this round's own PostgreSQL test asserts it). And it puts the case
  list, the two columns, the migration and the no-amendment argument under "by owner ruling", where the owner ruled only
  "Reden tonen" in answer to "Moet de lijst die reden per minimumdoel tonen?". **Required:** state the ruling as that
  question and answer; mark the rest as the implementer's realisation; drop or correct the stored-pointer case.
- **MINOR 3 — `stappen.ts:39-53`** still calls the leerplandoelen `schrijftIets` "writes anything" (no key-only exception)
  and says "or a version not applied yet" where the server compares against the **last** applied version
  (`LeerplandoelImportService.cs:153-155`); so the worklog's "stated wherever `SchrijftIets` is described" is false.
  **Required:** word it like `types.ts:319-325`, or narrow the worklog sentence.
- **MINOR 4 — the first-apply Vitest** ("biedt een eerste doorvoering zonder gewijzigd doel aan …") serves a stand with
  `laatsteVersie` 1.1 beside a leerplandoelen answer with `vorigeVersie: null` — a combination the server cannot return
  (both read `opstapversies`). **Required:** `{ aantalMinimumdoelen: 998, laatsteVersie: null }`, so the accent assertion
  also covers the screen with the Excel toggle.

For the record (not a violation): a first apply in which every discipline is skipped still closes the Excel route while
importing nothing, as ratified Art. VII.2 ("a snapshot applied") says; a PostgreSQL test proves it.

Auditor's runs: Vitest import/doelen/i18n 29 passed; unit filtered to Curriculum 425 passed / 4 live skipped; PostgreSQL,
`pnpm lint`, `dotnet format` and browser not run by the auditor.

## Owner decision after round 3 (2026-09-13)

The project owner, in session: *"stop hierna maar met de antagonist rondes en rondt deze us af"*. No round 4 is run. The
four round-3 MINORs are fixed in a final fix round **without an independent re-audit**; that fix round is verified by the
test-runner's gates and the orchestrator's own build and test run only. Recorded so E1-22's `[x]` is read for what it is:
three audit rounds (1 MAJOR, then 4 MINOR + 1 QUESTION, then 4 MINOR), the last fix round un-re-audited by owner decision.
