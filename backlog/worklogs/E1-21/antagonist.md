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
