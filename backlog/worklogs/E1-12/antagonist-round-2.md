# E1-12 — antagonist audit, round 2 (2026-09-13)

Audited: `git diff 024e3ef..578e039` (the fix round: `7720dac` amendment, `578e039` code). Verdict: **VIOLATIONS FOUND**
— 2 MAJOR, 4 MINOR, 3 QUESTION. Findings in full below; the checks section is abridged. The response is under "Fix round
2" in `implementation.md`.

**What the audit found solid.** It compiled the committed `OpstapHtml` and its round-1 version verbatim and ran both over
the live endpoint (998 minimumdoelen, 1,271 fragments, 2026-09-13) and over `krcItems` 1.2: every minimumdoel fragment
converts byte-identically in both versions and no row is refused; an independent comparison against Python's
`html.parser` (letters, digits, comparison signs, word sequence) found no difference on any accepted fragment; the two
goals round 1 named now convert correctly (`2.1.GL1.2` keeps `=, ≠, <, >`; `2.1.GL3.10` reads `10^2`).

**Round-1 status:** 1 resolved; 2 partly (a row without `$$expanded` still landed in *verdwenen*); 3 partly (`sup`, `a`
and `alt` could still change text unnoticed); 4 resolved for every named line, the CLAUDE.md twin of V.6 missed; 5
resolved in the record; 6 resolved (6/6 fail as disclosed); 7 partly (worklog and ADR not retargeted); 8 resolved; 9
resolved; 10 still open; 11 resolved.

1. **[MAJOR] A refused row keyed by its href is still reported to directie as "niet meer in de Op.stap-bron"** (Art.
   III.4, FR-2.5, conditional-copy rule, Art. II.3). A row without `$$expanded` (`OnderwijsdoelenApiBron.cs:88-93`) or
   without `uniqueCode` (`OnderwijsdoelMapping.cs:32`) is keyed by its href, which never equals a ref, so an already
   imported minimumdoel lands in `Verdwenen` while the source still lists it. The `Verdwenen` doc and the worklog's
   "a refused row's `Sleutel` is its `uniqueCode`" claim more than the code guarantees. No test covers it. Fix: say less
   when a problem row cannot be identified, or bucket it; add a test; correct the doc and worklog.
2. **[MAJOR] The `sup` guard the class doc describes does not exist; `102` is still reachable, and two other silent
   losses** (Art. III.1, V.6). Probes on the committed class, none refused: `10<sup class="x">2</sup>` → `102`;
   `10<sup><em>2</em></sup>` → `102`; `<a href="u">w` (unclosed) → `w`; `<img data-alt="q" src="x">` →
   `[afbeelding: q]`; `x<sup>n+1</sup>` → `x^n+1`; `2<sup>de</sup>` → `2^de`. None occurs in today's data, but it is
   the round-1 MAJOR class, the doc asserts a check that is not there, and E1-21's corpus emits `class=` 185 times. Fix:
   refuse any `<sup` `Superscript` did not consume and any non-plain exponent; refuse an `<a …href…>` `Link()` did not
   consume; anchor `AltTekst`; one test per shape; correct the doc.
3. **[MINOR] An expired eindterm is reported as "kon niet ingelezen worden"** — the import chose not to; use "werd niet
   ingelezen" or a separate sentence. The `IsLeeg` doc ("leaves nothing unread") is false for refused rows not yet
   stored.
4. **[MINOR] Two records still point E1-22 at the deleted `import.opstap.voorwaarde`:** `implementation.md:40-41` and
   `docs/adr/0032-opstap-api-als-importbron.md:123`.
5. **[MINOR] The Art. V.6 amendment's twin in CLAUDE.md was not amended in step:** `CLAUDE.md:182` and `:184`.
6. **[MINOR] Record figures are double counts:** the live endpoint holds **49** fractions (98 counted `mfrac` twice) and
   **6** links in 3 rows (12 counted both tags) — ADR-0032:60, `implementation.md:56,58`, `OpstapHtmlTests.cs:75`.
   `OpstapHtml.cs:10` reads as if it listed what the curriculum contains; the G goals also carry `ol`, tables, `hr`,
   `span` and MathML beyond fractions.
7. **[QUESTION] The unconfirmed constitutional clauses have no recorded place where the owner will answer them.**
8. **[QUESTION] E1-12 cannot meet Art. X.1 behind a lock silent for about two days** — the lead or owner decides on
   E6-01's claim.
9. **[QUESTION] FR-2.2 / Art. V.3's "only minimumdoelen" filter under the G-only ruling:** the API path never produces
   doelsoort MD, so an MD filter at leerplandoel level is always empty; confirm the minimumdoel-level view serves it and
   note it.

Checks (abridged): Art. II (new Dutch allowed, count-inflected, tested); Art. III.1 (13,248 fragments across both
converter versions; minimumdoelen 0 refusals, 0 changes; **43 G goals would be refused** by today's converter, mostly
`mrow` MathML, the rest tables/`ol`/`hr`); III.3; III.4 (finding 1); V.6 (targeted unit tests 68/68); VI (host check
reviewed); VII.2 figures unchanged; VIII/IX unchanged; X (build OK, `CurriculumbeheerAutorisatieTests` 3/3,
`OpstapMinimumdoelenImportEndpointsTests` 6/6 fail as disclosed, format clean, full Postgres half not run as
instructed); XI (dedicated amendment commit; coordination checked); XIV; scope.
