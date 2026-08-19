# E5-05 — antagonist audit trail

> **Why this file exists at all, and why it is thin.** The technical-lead sweep of 2026-08-19 found that the
> per-story gate files (`test-report.md`, `antagonist.md`) quietly stopped being written after E2-07: nine stories
> since then have one or neither, so **an `[x]` no longer tells a reader which gates ran** — which is the property
> the checkbox exists for. That convention question is **open and the owner's**. This file takes the cheap half of
> the answer: it records the verdict, the finding list and the verification, and points at the story entry in
> [`../../E5-dekking-export.md`](../../E5-dekking-export.md) for the full text, rather than duplicating it in two
> places that can then disagree. Duplicated records drifting apart is the defect this story's own MINOR-5 was.

## Ronde 1 — 2026-08-19 — **VIOLATIONS FOUND**

Audited `git diff main...story/E5-05-gap-analyse` at `e7a29de` (28 files, 4 commits) against `CONSTITUTION.md`.
Ran independently, twelve days after the code was written, because the session that wrote it left without one.

**3 MAJOR + 5 MINOR + 2 QUESTION.** Every gate figure in the story's record was re-derived by the audit and held;
the contrast claims reproduced to 8-bit rounding. **Two of the three MAJOR were found by running mutations that the
entire 876-test backend suite survived** — not by reading.

| # | Severity | Article | What | Disposition |
| --- | --- | --- | --- | --- |
| 1 | **MAJOR** | Art. II.3, E5-03 rule, E3-06 rule | `NietIngepland`'s copy said a thema sat in no period while a rejected card for it was drawn in one, and its route led to a picker that disables that thema in that very period | **Fixed** — `PlaatsingGeweigerd` split out as its own cause |
| 2 | **MAJOR** | Art. V.6, Art. IX.2 | The candidate read's layer-4 class scoping was untested; the test claiming to guard it filled layer 3 only | **Fixed** — activiteit added to the foreign class, mutation now fails |
| 3 | **MAJOR** | Art. V.6 | The Postgres pin between the two reads held 4 of 16 (layer, status) pairs, and it is the whole stated reason the eightfold duplication was accepted rather than routed to E1-17 | **Fixed** — every layer now carries both decided statuses |
| 4 | MINOR | Art. X.5, E5-03 rule | `DekkingController` claimed FR-9 was unsatisfied "for one reason only"; FR-9.4 (E6-06) is unbuilt too | **Fixed** |
| 5 | MINOR | Art. X.5 | `Lacuneroutes` and `telLacuneoorzaken` asserted opposite things about the same four counts | **Fixed, then re-fixed** — round 1 stated it on `Lacuneroutes` and called that component the gate's owner, which it is not; see ronde 2 finding 3 |
| 6 | MINOR | FR-9, Art. V.3 | `GeenThema`'s line is true of every gap, so it distinguishes nothing; round 1 recorded the useful wording as *forbidden* by the rejected-link case | **Owner question**, and ronde 2 corrected the framing: only the SHORT wording is impossible, so the trade is brevity against informativeness |
| 7 | MINOR | Art. X.5 | `KAND-GEWEIGERD` in the pin fixture was `Voorgesteld`, so the assertion read as a claim about rejected links that would be a bug if true | **Fixed** — renamed `KAND-ONBESLIST` |
| 8 | MINOR | Art. VI.1/VI.5 | The unauthenticated dekking read now also returns names of thema's in no plan | **Routed to E7-11** — widening of recorded debt, no pupil data. *Round 1 only claimed the routing; ronde 2 found nothing had been written on E7-11, and it is written there now* |
| Q1 | QUESTION | FR-9 | Does "Wat er nog moet gebeuren" read as a complete remediation list? | Judged sufficiently covered by `dekking.alleenLeerplandoelen`, which states the minimumdoel absence unconditionally at page level |
| Q2 | QUESTION | SC 2.4.4 | Adjacent route links reading the same and going to the same place | **Made worse by fix round 1** (two became three) and deliberately not redesigned; owner question in the story entry |

**Cleared by the audit, with the check named rather than asserted:** the withheld-figure gate is real and
mutation-checked (`Lacuneroutes` renders nothing while `cijfer.soort !== "cijfer"`, and it carries no `title`,
`value`, `content` or numeric `aria-*`), so **E5-02's leak is not repeated**; nothing auto-applies or mutates
official content (Art. III/IV); no new dependency, hue, entity or migration; the export deliberately carries no
cause column and a test asserts the candidate thema name appears nowhere in the workbook; every route leads
somewhere that can actually close its cause and carries `klas`/`schooljaar` (ADR-0021). The `Dekkingsamenvatting`
"Naar Inladen" defect named in the audit brief **does not exist** on this branch or on `main` — the premise was
stale, and all four `to={` in the feature carry `search`.

### Fix round 1 — `6b4111c`

Gates and the four mutation checks that prove the fixes bite are recorded on the story entry, together with two
process failures worth carrying (a `sed` that silently mutated nothing while the suite went green, and a failed
build whose `--no-build` test run served the previous mutation's binary).

## Ronde 2 — 2026-08-19 — **VIOLATIONS FOUND**

Audited `git diff e7a29de..9c15019` (fix round 1 and its record) plus the whole branch for ripple, and treated
ronde 1's findings as claims to falsify rather than as given. **1 MAJOR + 7 MINOR + 2 QUESTION.**

It **re-ran all four of ronde 1's mutations itself** and confirmed each bites, then added two of its own that also
bite (swapping the branch order fails `Een_open_voorstel_gaat_voor_op_een_weigering_elders`; deleting
`!p.IsVervallen` from the shared `Themaplaatsingen` helper fails three theory rows including the rejected-and-stale
one). It re-derived every gate figure and reproduced the 26 leaked `jp_test_*` databases, confirming they stayed 26
across six suite runs of its own — so "not mine" is measured.

| # | Severity | Article | What | Disposition |
| --- | --- | --- | --- | --- |
| 1 | **MAJOR** | Art. V.6, Art. IV.1 | MAJOR-3's fix closed the **decided** axis of the predicate grid and its comment called sixteen cells the whole thirty-two; the **non-counting** axis was at three of eight, proven by two surviving mutations | **Fixed** — both status tests carry both non-counting statuses at every layer; both mutations now fail; the arithmetic corrected |
| 2 | MINOR | E5-03 rule, Art. X.5 | `NietIngepland`'s rewritten doc says two states where an **unparseable placement status** makes three, and that third would carry MAJOR-1's false sentence again | **Documented at the enum** — unreachable today; fixing speculatively would build a screen no teacher can reach |
| 3 | MINOR | Art. X.5 | MINOR-5's fix repeated MINOR-5: it named `Lacuneroutes` as the gate's owner and "the one place the rule is stated" while the gate is on `DekkingPagina`, which stated it a third time and more strongly; and it added an unbounded claim ("rounding error") | **Fixed** — stated once, at the gate |
| 4 | MINOR | E5-03 rule | `types.ts` kept "a cause added on the server errors here" — there is no such guard; a server-added cause renders **nothing** | **Fixed** — says the array is hand-kept in step, enum is the source |
| 5 | MINOR | Art. II.3, Art. V.6 | The new catalogue guard bit on three literal phrasings, not the category it claimed: the same lie reworded passed all 28 tests | **Fixed** — pattern broadened; mirror loop's rationale corrected to what it checks |
| 6 | MINOR | Art. X.5, Art. V.6 | The cause count went stale in **nine** places, one written by fix round 1, including `leesOorzaak`'s own named guard which had **no assertion for the new cause** | **Fixed** — that guard now iterates `LACUNEOORZAKEN` |
| 7 | MINOR | Art. X.5, CLAUDE.md | `backlog/README.md` — designated source of truth for live progress — was never touched, so it stated four causes, pre-fix gate figures, and "no antagonist round has run" at a commit where one had | **Fixed** |
| 8 | MINOR | Art. X.5, Art. VI.1/VI.5 | MINOR-8's routing to E7-11 was **asserted and never written**, the exact defect E7-03's note and the E4-08 precedent already record; plus a second unrecorded widening of E7-03's performance item | **Fixed** — both written on E7's own entries |
| Q1 | QUESTION | FR-9, Art. V.3 | `GeenThema`'s line is **true**, so nothing false is deferred; but this entry's word "forbidden" overstated the constraint — a longer truthful sentence exists | **Reframed** as brevity vs informativeness; owner's call |
| Q2 | QUESTION | SC 2.4.4 | Three identical route links; **E4-08's tested opposite convention** was not on the table | **Precedent cited**; owner's call |

**What ronde 2 cleared, having checked rather than assumed:** MAJOR-1's premise independently confirmed in
`kalenderFormat.ts` and `Themakiezer.tsx`; the new row sentence true clause by clause, including that a placement
reaches `Geweigerd` only through the kalender's own path; the route genuinely closes the cause (undoing makes the
placement `Manueel`, which counts); the withheld-figure gate intact with a fifth counted cause; MINOR-4's "two
counts" enumeration complete against the FA; the export boundary holding; the enum renumbering safe because
`JsonStringEnumConverter` is global and the endpoint tests assert names; no migration, dependency, hue or entity
added anywhere on the branch.

**Bounded honestly by the audit itself:** it could not re-measure contrast in a browser, so it verified instead that
the new copy introduces **no token** and renders through the identical spans — and said plainly that the "five
overflowing elements at 390px are all pre-existing nav" count is unverified by it.

### Fix round 2 — `a154604` onwards

**Changed no executable product code**: the diff is comments, tests and records, which is checkable and was checked.
Two self-inflicted slips were caught by diffing my own work rather than by an audit: six files gained a BOM from a
script that round-tripped them, and a paragraph cited a commit hash before that commit existed (E4-08's recorded
defect, in a new form). Both fixed; see the story entry.

## Ronde 3 — owed

Fix round 2 has been audited by nobody but its author. **What that leaves open is narrower than last time and worth
stating precisely:** ronde 2's MAJOR was about the test net rather than product behaviour, and ronde 2 itself
recorded that the code as written is correct and that no teacher can reach the unpinned states today. So the risk in
fix round 2 is concentrated in the **record and the tests** — which is exactly where rondes 2 and 3 of the last three
stories found their remaining findings, so it is not a reason to skip the round.
