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
