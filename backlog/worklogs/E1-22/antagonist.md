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
