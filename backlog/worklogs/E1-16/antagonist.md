# Antagonist audit — E1-16 (Doelen-UI: read API + register screen)

> **Correction to this transcription (2026-07-31, found by the round-2 audit).** The clean list below
> originally read *"all 69 new strings in `nl.json` via `t()`/`tAantal()`"*, which the findings in this very
> file contradict: three keys were rendered by nothing at all (findings 8 and 9) and one count string bypassed
> `tAantal` (the test-runner's FAIL). Two claims in one document could not both be true. Narrowed to what was
> actually checked. Recorded rather than silently edited, because a laundered audit record is worse than none,
> and this one was laundered by the orchestrator who transcribed it.

**Run:** 2026-07-31, against `git diff 8203dbb..HEAD` on `story/E1-16-doelen-ui` (the four pre-fix commits
`afb6e6c`, `ad847aa`, `165859b`, `38b71c6` — 23 files, ~4 200 insertions).
**Verdict: VIOLATIONS FOUND** — 3 MAJOR, 7 MINOR, 2 QUESTION. Every finding was addressed in fix round 1;
see the table in [`implementation.md`](implementation.md).

> **This audit saw the pre-fix tree only.** The fix round was self-verified by the orchestrator after the
> implementer was cut off by an org spend limit, so **this verdict has not been re-issued against the fixed
> code** and the story stays `[~]` until it is. Recorded here rather than in a commit message because the
> gap is the reason the checkbox has not moved.

## MAJOR

1. **The screen told a teacher no curriculum was imported while the facets were still loading, and
   permanently if they failed.** `Doelenlijst.tsx:39-51` derived `heeftCurriculum` from
   `(facetten.data?.totaalAantalDoelen ?? 0) > 0` and checked it *before* the loading branch;
   `useDoelen.ts:45-52` set no `placeholderData`. Deterministic on every cold visit to `/doelen`. A boolean
   collapsed three facet states (pending / error / resolved-with-count) into one, which is a fourth instance
   of the very defect class the story was written to avoid. Every test walked past it via `await findByText`.
   *Cited:* Art. X.5, and the story's own three-empty-states clause.

2. **Two code comments asserted a server-side `(domein, subdomein)` guard that does not exist.**
   `LeerplandoelFilter.cs:16-19` and `doelenfilter.ts:51-54` both claimed the server narrows a subdomein by
   its domein; `LeerplandoelenQuery.cs:237-240` applied `Subdomein` as an independent predicate, so
   `?subdomein=Bouwstenen` summed unrelated domeinen into one total. The frontend guard was real, tested, and
   the only one. Aggravating: the covering test was named `Subdomein_filtert_alleen_binnen_zijn_domein` while
   its first assertion proved the opposite. *Cited:* Art. VII.0, Art. XI.3. Third instance in this repo of
   "a comment asserting a guard that does not exist".

3. **The doel detail published class/age-scoped `Subdoel` and `Activiteit` links school-wide, with no
   scoping seam.** `LeerplandoelenQuery.cs:302-325` → `Doeldetail.tsx:274-293`. `HaalKoppelingenAsync` took
   only a code: no klas parameter, no filter, no seam at which a later visibility decision could apply. The
   story asked for the *thema* layer, which Art. IX.2 makes school-wide; the implementation went two levels
   wider, into the layer Art. IX.2 scopes per class, and so answered an open Art. XIV decision (FR-10.2
   teacher visibility) with the widest available answer. Not a live breach, because no authentication exists
   anywhere yet (E6-01/E7-11) — the violation is the missing seam. *Cited:* Art. IX.2, Art. XIV.

## MINOR

4. Discipline facets ordered with `StringComparer.Ordinal`, so a full import lists 1, 10, 11, 2, 3
   (`LeerplandoelenQuery.cs:198-200`); the comment defending it as "the only stable ordering" was false.
   *Art. VII.0.*
5. The row `aria-label` (`Doelregel.tsx:34`) overrode the name computed from the subtree, so a screen-reader
   user heard neither the doelsoort badge, nor jaar/fase, nor the goal text, nor the `nakijken` review flag.
   The Art. XII colour-plus-label redundancy existed visually and not in the accessibility tree.
   *Art. XII, WCAG 2.2 AA.*
6. `cluster` rendered as a fourth ordeningskader level (`Doeldetail.tsx:165-181`), directly under a docstring
   correctly stating it is not one. *Art. VII.0 ("do not conflate").*
7. "Gebruikt in thema's" and its count included `voorgesteld` and `geweigerd` links, nudging toward a
   coverage conclusion Art. V.1 does not support. Listing every status was right; the heading was not.
8. Three dead `nl.json` keys (`taxonomieLabel`, `sluiten`, `clusterLabel`), one of which made
   `Doeldetail.test.tsx:103` assert the absence of a string the app never rendered — reading as coverage of
   the nullable-cluster branch. *Art. X.6, Art. II.3.*
9. A comment claimed a goal with an unknown discipline number was possible (`LeerplandoelenQuery.cs:98-101`)
   while `LeerplandoelConfiguration.cs:39,60-63` makes it required behind a `Restrict` FK, so the null branch
   and the UI fallback are unreachable. The mirror image of the minimumdoel branch the implementer *did* flag
   correctly. *Art. XI.3.*
10. The axe check awaited only the detail, not the filters it claimed to cover
    (`DoelenPagina.test.tsx:529-537`), unlike its neighbour which awaits both for exactly that reason.

## QUESTION

11. **Unfiltered facets.** Judged, not accepted: the derived-from-data design is right and *is* the Art. XIV
    seam, but the option sets did not narrow either, so Discipline = Wiskunde still offered *Natuur (3)* and
    choosing it returned nothing. A control stating a positive number and delivering zero rows, not a matter
    of taste. Routed to directie; the orchestrator ruled on the interim behaviour.
12. **Clause 3's untested read branch.** The FK argument is **sound** — verified independently, not taken on
    trust: an FK is enforced on insert regardless of the delete rule, and `Minimumdoel` rejects blank fields,
    so the "concorded but omschrijving missing" state cannot be created. Refusing to fabricate it by dropping
    a constraint was the right call. Residual: what stands behind the branch is a schema constraint, not a
    test, and relaxing that FK is a plausible resolution of the E1-03/E1-12 blockage.

## Checks that came back clean

Domain language (Art. II.1/II.2); no hard-coded Dutch in any component, with the four English
`BadRequest` diagnostics correctly on the operator side of the amended Art. II.3, and `api.ts` never echoing a
server body to a teacher; **zero em dashes** in `nl.json` (Art. II.5); curriculum read-only with no write path,
`AsNoTracking` throughout, `NietMeerInOpstap` still writable only by the import, and POST/PUT/PATCH/DELETE
returning 405 live (Art. III.1/III.2/III.5); no new Excel or doelsoort mapping (Art. III.3/VII.1); the port in
`Application` and the adapter in `Infrastructure`, i.e. **no second instance of the E7-13 defect** (Art. VIII);
no new dependency; no fabricated minimumdoel content and no destination that renders nothing (Art. IX.1/V.2,
the E3-06 rule); no coverage computed or stored (Art. V.1); no pupil data, no secret beyond the ratified
local test-database credential, and the fabricated `-CHK-` dev rows confined to the local database with no
fixture, seeder, migration or config trace (Art. VI); the doelsoort edge using the six existing tokens with
**no new hue and no new token** (Art. XII); gates re-run by the auditor rather than read from the worklog
(Art. X); and the three open Art. XIV decisions behind the filters left to the data.
