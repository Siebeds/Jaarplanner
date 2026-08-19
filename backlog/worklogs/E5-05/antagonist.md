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
| 5 | MINOR | Art. X.5 | `Lacuneroutes` and `telLacuneoorzaken` asserted opposite things about the same four counts | **Fixed** — stated once, on the component that owns the gate |
| 6 | MINOR | FR-9, Art. V.3 | `GeenThema`'s line is true of every gap, so it distinguishes nothing; the useful wording is forbidden by the rejected-link case | **Owner question** — see the story entry |
| 7 | MINOR | Art. X.5 | `KAND-GEWEIGERD` in the pin fixture was `Voorgesteld`, so the assertion read as a claim about rejected links that would be a bug if true | **Fixed** — renamed `KAND-ONBESLIST` |
| 8 | MINOR | Art. VI.1/VI.5 | The unauthenticated dekking read now also returns names of thema's in no plan | **Routed to E7-11** — widening of recorded debt, no pupil data |
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

## Ronde 2 — owed

Fix round 1 has been audited by nobody but its author. That is the gap three consecutive rounds of E4-08 found in
the previous round's fix, and it is why the checkbox is still `[~]`.
