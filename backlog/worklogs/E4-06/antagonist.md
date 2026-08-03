# E4-06 — Antagonist verdicts

Three audit rounds, by independent `antagonist` spawns, each on a different commit. Written into the
worklog by the orchestrator from the returned reports; the verdicts, findings and severities are the
auditors' own. Where an auditor corrected itself, that is kept — it is the more useful half.

| Round | Commit audited | Verdict | Findings |
| --- | --- | --- | --- |
| 1 | `01327ce..889471d` (the build) | **VIOLATIONS FOUND** | 3 MAJOR, 5 MINOR |
| 2 | `c8fabe6..81b4ed9` (fix round 1) | **VIOLATIONS FOUND** | 1 MAJOR, 4 MINOR — 8 of the previous 9 verified closed |
| 3 | `81b4ed9..01b1613` (fix rounds 2–3 + the `origin/main` merge) | **COMPLIANT** | 1 MINOR, explicitly not grounds to hold the story |

Closing gate on the landing commit: **COMPLIANT** (audit) + **PASS** (test-runner). The one MINOR from
round 3 was fixed rather than waived, in `75f326c`.

---

## Round 1 — `889471d`: VIOLATIONS FOUND (3 MAJOR, 5 MINOR)

The audit's own framing: the design decision it was asked to scrutinise hardest was *half* right. The
`Geweigerd` exception it was pointed at was safe; the branch nobody had named was broken.

1. **[MAJOR] `vergrendelUitlegVast` was false on every locked placement that is not `Voorgesteld`.** The
   section decided *whether* to render on two axes (`status`, `vergrendeld`) but *which sentence* on one.
   So a locked `Aanvaard`/`Manueel`/`Geweigerd` card read *"Dit thema staat vast, dus een hergeneratie
   laat het staan. Maak het los als de AI het opnieuw mag voorstellen."* Both halves misinform: the `dus`
   asserts the lock is the reason it survives (it is not — `IsVervangbaar => Voorgesteld && !Vergrendeld`),
   and after unlocking a decided placement the AI can never re-propose it. Reachable in two clicks: lock a
   proposal, then move it, because `VerplaatsNaar` sets `Manueel` and deliberately keeps the lock.
2. **[MAJOR] The panel sold "Vastzetten" as the way to keep a thema, on a screen with no accept control.**
   `useWijzigPlaatsingStatus` had one call site and never sent `Aanvaard`, so locking became the only
   keep-action — while a locked `Voorgesteld` placement counts for **nothing** in dekking under E5's
   binding reading. → owner ruling 1.
3. **[MAJOR] The copy claimed something unqualified about "een hergeneratie"** while only one regeneration
   path exists and E4-07's preserve/overwrite rule is an open directie question.
4. **[MINOR]** The `Geweigerd` exception was defensible but its recorded justification was inaccurate.
5. **[MINOR]** The lock section rendered unchanged on a **stale** placement, offering a remedy that
   competes with re-placement and would let the *"dekking onbetrouwbaar"* state survive every run — where
   before this story a stale proposal healed itself at the next generation.
6. **[MINOR]** `vergrendelMislukt` claimed *"Er is niets gewijzigd aan je jaarplan"*, which the call site
   does not guarantee: the mutation commits before the grid is derived and the plan projected.
7. **[MINOR]** Success was invisible to assistive technology while failure was announced (SC 4.1.3).
8. **[MINOR]** Two visually identical `outline` buttons, one reversible and one unrecoverable, stacked on
   the most common card. → owner ruling 2.
9. **[MINOR]** Records that did not survive counting: six keys claimed, seven present; and *"changes
   nothing observable"* asserted in three places, when locking a decided placement does change the badge
   and the sentence.

*Confirmed rather than faulted in round 1:* the contrast figures were honestly composited, and the new
integration test genuinely isolates the lock — it would fail if `Vergrendeld` were dropped from
`IsVervangbaar`.

---

## Round 2 — `81b4ed9`: VIOLATIONS FOUND (1 MAJOR, 4 MINOR)

1. **[MAJOR] The fix routed `Geweigerd` into the `!isVoorstel` branch**, so a rejected + locked card read
   *"Je hebt dit thema zelf beslist, dus een hergeneratie laat het staan."* What the teacher decided there
   was **no**. The second half is factually true, which is what makes it a true-looking sentence in the
   wrong state. **The fix round's own comment forbade exactly this**, and `toonSlotOverbodig` excluded
   `isGeweigerd` for that reason; the sibling branch then did the excluded thing. A new `it.each` had
   pinned the wrong copy for `Geweigerd`. Not reachable from the UI as built (nothing in the frontend sets
   `Geweigerd`), but reachable the moment E4-01/E4-02 ship a reject control. → owner ruling 4 closed this
   at its root.
2. **[MINOR]** `vergrendelUitlegVervallen` told the teacher to *"kies eerst een periode"* on a card whose
   period picker is suppressed — a second instance of a pre-existing E3-07 defect.
3. **[MINOR] The new variant's contrast was stated three times with three different numbers**, none of
   them right, while the correct figure sat 24 lines above in the same file. Contrast is symmetric, so the
   label figure and the neighbouring `destructive` figure describe the identical pair and cannot both be
   right. Every wrong figure understated, so nothing passed on a failing number.
4. **[MINOR]** Four regeneration claims were qualified and **the fifth was left** — `vergrendeldUitleg`,
   the badge tooltip — with the new test pinning exactly the four that were fixed. The audit named the
   pattern in the repo's own words: *each previous fix was applied to the one instance that had been
   noticed.*
5. **[MINOR / QUESTION]** `vergrendelDekking` named `aanvaard` only, while E5 counts `Aanvaard` **and**
   `Manueel`, and `Manueel` is what "Verplaatsen" produces on that very card. → owner ruling 3.

---

## Round 3 — `01b1613`: COMPLIANT

Asked to judge fix round 3 knowing it was **orchestrator-authored** (four agents had died on the stream
watchdog and the previous audit had said no build round was needed), the verdict was that orchestrator
copy was *not* worse: both `nl.json` edits were defensible line by line, and the two inaccuracies found
were in **code comments**, not product copy.

1. **[MINOR] Two claims in `catalogus.test.ts` asserted a guard and a history that did not exist.** The
   comment said the *"hier"* scoping of `vergrendelUitlegGeweigerdVast` was *"pinned by the rendered-copy
   assertion in `Jaarplankalender.test.tsx`, which checks it says hier"* — **no such assertion existed**,
   so deleting "hier" left the whole suite green. And the rename catch was misattributed: it was caught by
   the pre-existing `gevonden.length` line, not by the `SLOTTEKSTEN.length` line round 3 added, which is
   redundant in the first guard and load-bearing only in the second.
   **Fixed, not waived** (`75f326c`): the `toContain("hier")` assertion now exists and bites (removing
   "hier" fails two tests, verified then restored), and the attribution is corrected on the line itself.
   The auditor also **withdrew half of its own round-2 finding**: only one of the two guards was vacuous,
   because `gevonden ⊆ SLOTTEKSTEN`.

*Verified rather than trusted in round 3:* every contrast figure recomputed from token values (3.41 /
3.22 / 3.17 / 6.04 against the recorded 3,40 / 3,21 / 3,16 / 6,08 — all correct), the git history of the
token fix looked up rather than believed, and the merged tree's guard interactions checked — the family
guard neither goes vacuous nor false-fires on E1-16's catalogue, which entered the tree for the first
time with the merge.

*On the vocabulary question the orchestrator could not answer itself:* naming "Aanvaard" and "Manueel"
in the dekking sentence is the right trade and *"not really that trade"* — `Themakaart` renders the
status chip on the same card, so those are the card's **own on-screen words**, whereas the replaced
wording pointed at a button on a different screen. The "Manueel is jargon" item is a pre-existing,
app-wide, filed copy decision owned by nobody; this story adds a third occurrence rather than creating it.
If it ever lands as "Zelf gekozen", three strings change together: `suggestieStatus.manueel`,
`doelen.koppelingenAantal(Enkelvoud)` and `kalender.vergrendelDekking`.

---

## The obligations these audits leave behind

Filed on the stories that must act on them, not only here:

- **E4-01 / E4-02** — build the accept affordance. Until then locking is the only keep-action on the
  anchor screen and every locked proposal is a figure E5 cannot honour.
- **E4-05 / E4-07** — six strings become false when a second discard path exists. Listed on both stories,
  with a note on which of the two guards can see each one (`weigeringUitleg` is outside the
  `kalender.vergrendel*` prefix and is pinned by a literal assertion instead).
- **E3-07** — reopened `[~]` by owner ruling on the stale-rejected-card contradiction.
- **App-wide copy decision, owned by nobody** — whether "Manueel" is the right word to show a
  non-technical teacher.
