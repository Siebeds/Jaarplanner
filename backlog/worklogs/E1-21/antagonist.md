# E1-21 — antagonist audits

## Round 1 (2026-09-13, on `5397e98`): VIOLATIONS FOUND — 2 MAJOR, 4 MINOR, 3 QUESTION

*Verdict pasted by the orchestrator.* The auditor re-downloaded snapshot 1.2 (hash `8f470a12-…`) and ran the committed
Release DLLs over all 5,835 G goals from a scratchpad harness. The API path itself was found careful and the converter
lossless on today's data; the violations are in the shared writer this story widened and in one hole in the converter's
guard.

### [MAJOR 1] An Excel re-import after an API import flags ≈4,700 goals "Vervallen in Op.stap" and erases ≈858 concordances
Art. III.4, Art. V.2, FR-2.5 — same class as E1-12 round 1 MAJOR 2 / round 2 MAJOR 1. `OpstapImportService.cs` (the
"Absent" walk ≈303–360, `SetValues` ≈291, `VeldVerschillen` `MinimumdoelRef` compare ≈647); `ClosedXmlOpstapParser.cs:121-134`
returns null for an empty column D; the route is reachable from `ImportScherm.tsx:42` → `Opstapimport` → `api.ts:65,73`;
badge `nl.json:58` "Vervallen in Op.stap" at `Doeldetail.tsx:64`, `Doelenboom.tsx:331`. "Absent is not gone" protects
Excel rows from an API import, not API rows from an Excel import: the Excel path supplies neither `BuitenBereikCodes` nor
`NietIngelezenCodes`, so a stored API goal missing from the file lands in `Verdwenen` and is flagged on apply, and an
overlapping code gets `MinimumdoelRef = null` (column D empty on 0 of 2,192 rows scanned). Measured on 1.2 against the
repo's files: Wiskunde flags 1,247 and nulls 198; all twelve files 4,728 and 858. The preview shows it under a false label.
No test covers API-then-Excel. **Required:** (a) the shared writer must not flag, nor null the ref of, a stored row the API
wrote (`OpstapSleutel` set) during a `Herkomst.Bestand` import, reporting such rows in their own bucket with a sentence
that says only that the file does not hold them; or (b) refuse the Excel route once an `Opstapversie` row exists (needs an
ADR-0032 decision-8 line). PostgreSQL test for API-then-Excel; record the choice.

### [MAJOR 2] A table of images becomes `[lege tabel …]` without refusal, losing the alt text
Art. III.1, Art. V.6 — same class as E1-12 round 2 MAJOR 2. `OpstapHtml.cs` `IsLeeg` (:420-421) strips every tag before
testing emptiness; empty-table branch :403-409; images become alt text only later in `NaarTekst` (:89-95); the class doc
(:26-27) and `OpstapBeschrijving.cs:30-34` overstate. Probe: a table whose cells hold only `<img alt="appel">` /
`<img alt="peer">` → `[lege tabel van 1 rij en 2 kolommen]`, no refusal. Same for a cell holding only an empty-text
`<a href>`. Nested `<ol>` flattens its numbering without refusal. None fires on 1.2. **Required:** a cell is empty only
with no text and no `img` or `a`, otherwise refuse or convert images first; refuse nested `ol` or keep its level; one test
per shape; correct both doc comments.

### [MINOR 1] The closure chain is cyclic and several status lines will over-claim after merge
Art. X.5, the E5-03 rule. E1-21 and E1-12 (`E1-curriculum-content.md:192`) both require minimumdoel-level coverage; E5-04
is "blocked on E1-12" (`backlog/E5-dekking.md` 17, 44, 74); `CLAUDE.md:21`, `backlog/README.md:274`, E1-03 (:29) and E1-04
(:35) say coverage "returns nothing … until E1-21" / "close with E1-21". After merge that is false (E5-04 unbuilt).
**Required:** say E1-21 unblocks E5-04 and E5-04 makes minimumdoel-level coverage real; the owner decides whether E1-12,
E1-03, E1-04 re-scope. *Owner ruling 2026-09-13 (after this audit): they close on the input; the clause moves to E5-04.*

### [MINOR 2] Host pin holds for the URL only: redirects followed, body size uncapped
Art. VI; E1-12 round 1 finding 9. `OpstapApiRegistratie.cs` `StelIn` configures no primary handler;
`OpstapLeerplandoelenImportController.cs:18` claims the host stays fixed. **Required:** `AllowAutoRedirect = false` (or a
same-host check) via `ConfigurePrimaryHttpMessageHandler` for both typed clients, or narrow the claim; optionally cap size.

### [MINOR 3] A null `wijzigingslog` has two meanings, and the refusal is not logged
FR-2.5, the E5-03 rule. `CurriculumApiBron.cs:263-266`. **Required:** log the conversion refusal as an English operator
warning; expose which case it was, or record in the E1-22 contract that a null must render without a reason.

### [MINOR 4] `BuitenBereik` silences a stored G goal that KOV moved into a skipped set
Art. III.4. `OpstapImportService.cs` `buitenBereik` checks only whether the source names the code, never the stored
doelsoort. **Required:** report a stored `Gemeenschappelijk` row found in a skipped set as a review item (sentence limited
to what that branch knows) + test.

### [QUESTION 1] "Mogelijke aanpak…" / "Verdere referenties": toelichting or voorbeelden?
`OpstapBeschrijving.cs:21-24, 153`. 36 G goals have both voorbeelden and these headings; in the 6 where the repo's KOV
Excel carries one (`3.5.GK2.1`–`3.5.GK3.3`) KOV put it in column K, so the first API import moves that text between
fields. KOV's Excel is not a clean arbiter (M empty on every overlapping row; woordenschat in K for 21, in L for 40). The
split also merges several toelichting sections and loses their order across fields. Unruled reading; owner/directie to
rule, add to `docs/besluiten-gevraagd.md`.

### [QUESTION 2] App-authored Dutch inside curriculum text, now in two places
`[lege tabel van 4 rijen en 5 kolommen]` in `2.2.GL2.2` beside `[afbeelding: …]` (12 goals). *Owner ruling 2026-09-13
(after this audit): acceptable, keep the bracketed markers.* This decides E1-22 point (c).

### [QUESTION 3] Will E1-22 show the English `problemen` to directie?
`problemen[].reden` is operator-only; E1-22 says the screen "shows the source problems". Resolve in E1-22: a count and the
Dutch `nietIngelezen` consequence only.

### Checks the auditor ran (summary)
Art. II new server Dutch strings addressed to directie, count-inflected, no em dashes. Art. III.1 word audit over all
5,835 G goals vs an independent `html.parser` extraction: 0 refused, no word lost; additions only image markers, list
numbers, link addresses, the one empty-table marker. Art. III.3 mapping in `CurriculumdoelMapping`. Art. VI policy,
CSRF, no secrets, version digits-and-dots only, `latest` only for the 63-byte hash, 100 s timeout. Art. VIII layering
clean. Art. IX migration additive only. Art. X curriculum unit tests 385 passed / 4 live skipped; format exit 0; the
PostgreSQL suite was **not** run by the auditor; byte scan of changed `.cs` files clean. Art. XIV discipline selection
honoured.

## Round 2 (2026-09-13, on `01d5189`): VIOLATIONS FOUND — 0 CRITICAL, 0 MAJOR, 6 MINOR, 1 QUESTION

*Verdict pasted by the orchestrator.* Every round-1 finding closed as required (MAJOR 1: check before the selection seam
and any write, 409 via the registered type, the ADR amendment dated and appended; MAJOR 2: verified on a fresh harness
build; MINOR 2–4 and QUESTION 3 closed). New findings are sentences the fix round wrote, plus one gap beside MAJOR 2.

- **MINOR 1** — the 409 sentence "De leerplandoelen komen nu uit Op.stap … en niet meer uit een Excel-bestand" claims more
  than the trigger proves (an applied API import of **G** goals): Excel-loaded P/S/+/A goals stay as the file wrote them,
  and once the route refuses nothing can refresh their text. The ADR-0032 decision-8 amendment records the benefit, not
  this cost; the enum doc (`OpstapImportFout.cs` ≈:33–38) is unqualified where the factory doc is. The other two clauses
  hold, and the Excel screen renders the detail under "Niet gelukt".
- **MINOR 2** — `CONSTITUTION.md:160` (VII.2), `:317` (XIV), `docs/Functionele_Analyse_Jaarplanner.md:277` and
  `CLAUDE.md:137` still say the Excel route stays available. Owner-ratified amendment needed, dependent text in step.
- **MINOR 3** — `OpstapHtml.IsLeeg` (:427-429) counts only `img`/`a` as content: tables of `svg`, `iframe`, `input`,
  `object`, `video`/`audio` still become `[lege tabel …]` unrefused, while the same tags outside a table are refused.
  Latent on 1.2.
- **MINOR 4** — `docs/besluiten-gevraagd.md`: question 1 (lines 13, 17) says every leerplandoel names its minimumdoel
  (852 of 5,835 G goals carry none); question 12's "36" does not reproduce (27 have voorbeelden followed by such a heading;
  28 mention one; 41 have such a line), and the Excel evidence was consistent (all 6 overlapping goals under voorbeelden),
  not "niet overal gelijk"; "drie stukken uitleg" shows only the pieces present; question 3's "per discipline … sneller
  starten" is stale.
- **MINOR 5** — E1-04's note says `IConcordantieQuery` answers in both directions on PostgreSQL; the PostgreSQL proof never
  calls it (the only `ConcordantieQuery` test is in-memory).
- **MINOR 6** — `OpstapHerimportDiff.cs:139-141` `VereistReview` doc omits `GemeenschappelijkBuitenBereik`;
  `backlog/E4-bewerking-hergeneratie.md:25` still says "(E5-04, blocked on E1-12)".
- **QUESTION** — option (b) freezes non-G reference data, and until E1-22 the Op.stap upload control can only refuse while
  the API import has no screen (E3-06 shape). *Orchestrator: E1-21 and E1-22 land together on `feature/e1-opstap-api` in
  one PR, so the interim state never reaches `main`; the freeze went to the owner (see MINOR 2).*

## Round 3 (2026-09-13, on `01d5189..66a26ac`): VIOLATIONS FOUND — 0 CRITICAL, 0 MAJOR, 2 MINOR, 1 QUESTION

*Verdict pasted by the orchestrator.* Every round-2 finding closed (the 409 sentence true against its trigger and pinned
by value; the ADR cost clause holds against the code; `5c7880c` is its own commit and its log entry follows the
2026-09-11 precedent; `IsLeeg` now allows only `TekstlozeOpmaak`, every other element traced to a refusal or a kept
address; question 12's 27 and 8-of-8 confirmed; the `IConcordantieQuery` PostgreSQL test real; both nits fixed).

- **MINOR 1** — "the first API import" (`CONSTITUTION.md:160`, `:251` log entry, `:318`; functional analysis `:277`;
  `backlog/E1-curriculum-content.md:30`) covers more than the guard: only the leerplandoelen apply writes an
  `opstapversies` row (`LeerplandoelImportService.cs:103`), so after a minimumdoelen-only API import the Excel route still
  reads files. Harmless (no API leerplandoelen exist yet), but the binding text over-claims; VII.2's "overwrite … every API
  goal the file lacks" is also unqualified where the code comment says "in a discipline that import covered". Narrow to
  "the first API import of the leerplandoelen" (owner's nod needed), or extend the guard.
- **MINOR 2** — functional analysis `:277` says non-G Excel goals "blijven zoals ze zijn", while VII.2 says a removal by
  KOV is still flagged through the API path (true: `OpstapImportService.cs:310-314`).
- **QUESTION (owner)** — did "until the first API import" mean the first leerplandoelen import (what the code does)?
- Cosmetic, not a finding: the comment reflow at `OpstapImportService.cs:146-151` is broken.

Not run by the auditor: the PostgreSQL suite and the live tests (123 targeted unit tests passed).

## Round 4 (2026-09-13, on `66a26ac..d3a6cf1`): COMPLIANT

*Verdict pasted by the orchestrator.* No finding at MINOR or above; every round-3 finding closed. The narrowed wording
("the first API import of the leerplandoelen (a snapshot applied)") appears in all five places and matches the code (only
the leerplandoelen apply writes an `opstapversies` row; the guard checks for it); the log entry records the owner's
clarification and was corrected in place before reaching `main`; `961439c` touches only the constitution and the
functional analysis (Art. XI.1). The functional-analysis sentence on non-G Excel goals is true in both halves. The
`colgroup`/`col` entries are what `IsLeeg` reads; a `<caption>` table is still refused, never flattened without its
caption. `OpstapHtmlTests` 62/62 at `d3a6cf1`; format clean on the changed files; full suites and PostgreSQL not re-run by
the auditor.

Observations, recorded so they are not rediscovered (none is a finding):
- `OpstapImportService.cs:147` "before anything else is looked at" is true inside the service; the controller parses the
  workbook first, so a corrupt `.xlsx` after an API import gets the 400, not the 409 (still refused, nothing written).
- The E1-21 status line said the live KOV → PostgreSQL import "last ran green in fix round 2"; the test-runner also ran it
  green in the round-3 gate. *Corrected by the orchestrator at land time.*
- The functional analysis freezes only "de tekst" where VII.2 freezes the whole row: narrower, not contradictory.
- ADR-0032 decision 8 (`:96`) says "once an API import has been applied", pinned by its own parenthetical to the
  `opstapversies` row, i.e. the narrowed trigger.
