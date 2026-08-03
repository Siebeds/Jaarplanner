# E4-02 — antagonist verdicts

Four rounds, all **VIOLATIONS FOUND**, all against the constitution rather than against taste.
Recorded here because the worklog carried the counts and not the findings, and because round 2's
own MINOR was that this file did not exist while `E4-06/antagonist.md` does (Art. X.7).

| Round | Commit audited | Verdict | Findings |
| --- | --- | --- | --- |
| 1 | `3795c16` + the `57b79c0` merge resolutions | VIOLATIONS FOUND | 3 MAJOR, 7 MINOR, 2 QUESTION |
| 2 | `cd6e3e0` (fix round 1) | VIOLATIONS FOUND | 3 MAJOR, 8 MINOR |
| 3 | `447fe0a` (fix round 2) | VIOLATIONS FOUND | 2 MAJOR, 6 MINOR, 1 QUESTION |
| 4 | `c6b0dde` (fix round 3) | VIOLATIONS FOUND | 2 MAJOR, 3 MINOR, 2 QUESTION |

> **This header is on its second correction, and the reason belongs at the top of the file.** It said
> "Two rounds" while round 3 was already written below it — the same partial-substitution mistake round 3
> graded MAJOR, in the file that records that finding. **A count in a heading is a claim, and a heading is
> the last thing anyone re-reads.** If a fourth round runs, this table and this sentence are what to change
> first, before writing the round up.

---

## Round 1 — the three MAJORs

1. **The stale-card exclusion was right about accepting and wrong about rejecting.** `magBeslissen` was
   one flag, so the accept argument silently annexed the reject case. `DekkingService` counts
   `IsVervallen && !IsGeweigerd` as unresolved, so a weigering is precisely what **resolves** a stale
   proposal and hands back the withheld figure. Without it, refusing a stale proposal had two routes and
   both were wrong: re-placing sets `Manueel`, which makes the thema **count**, and removal is
   unrecoverable. *Fixed:* one flag became two.
2. **`kalender.beslisUitleg` was false about the card rendered above it** — *"aanvaard of weiger **elk**
   voorstel"* while a stale card offered neither. *Fixed:* quantifier removed, plus a per-card
   `beslisVervallen`.
3. **Three comments asserted the opposite of the code**, all concerning the one string this story
   reworded. *Fixed.*

Seven MINORs, all fixed: `beslisUitleg` unpinned; two of three live-region branches unasserted
(including the un-reject announcement the worklog **claimed** as delivered); the interlock claimed
closed when only one direction is; `statusFoutmelding` mis-attributing the lock's 404 split to the move
path (which splits on 400 with different meanings); a test comment claiming `herzienUitleg` points at a
picker; SC 2.5.3 while busy; and discharged backlog obligations left standing.

## Round 1 — the two QUESTIONs, answered here because round 2 found them in no artefact

**Q1. Is building *reject* as well as *accept* within E4-02's scope?**
The auditor did not raise it as a violation and neither do I: Art. IV.2 words the capability as one
thing, E4-06's ruling assigns "the accept affordance" to E4-01/E4-02, and shipping accept alone would
have left `Geweigerd` unreachable, i.e. the whole rejected-card branch remaining a state no teacher can
produce. **Two residues that are genuinely the owner's, not closed by this file:**
- E4-02's *Done when* names only `manueel`, and only for **DoelKoppelingen**. This story closes that half
  **by reading `DoelsuggestieLijst.tsx`** (it does send `Manueel`), not by adding evidence. The claim is
  true and it is asserted rather than newly proven. If the owner wants it proven, it is a test, not a
  build.
- The scope now overlaps **E4-01**'s remaining "prove it end to end". Written down once, on E4-01, rather
  than argued twice.

**Q2. Is the dekking rule now said twice?**
Partially, and deliberately. `beslisUitleg` says it above the board; `vergrendelDekking` says it inside
an open lock section, where it earns its place by contrasting with *vastzetten* rather than by repeating
the rule. Not a violation. What *was* wrong is that a comment claimed the fact is stated "once" — fixed
in round 1's fix, and round 2 then found the same comment naming a flag that no longer exists.

---

## Round 2 — the three MAJORs, and why they are the more interesting round

Round 2's value is that it audited the **fix round as new code**, which is this project's own recorded
lesson (E1-13's round-2 fix created the MAJOR that then blocked it). It found that the fix round had
introduced two defects and left one hand-off stale.

1. **Five documentation statements that the same commit falsifies.** `cd6e3e0` made a stale proposal
   rejectable *and* committed an epic entry and worklog saying "a stale card gets no decision". One
   instance had been struck; five had not. **The one that mattered was inverted:** *"a teacher still
   cannot directly create a stale rejected card"* — they now can, in one press, and that combination is
   exactly what **E3-07 is reopened over**. Telling the next reader the state is unreachable would have
   understated what E3-07 owes. *Fixed:* all five corrected, the E3-07 line rewritten to say it **raises**
   rather than lowers that story's remaining work.
2. **`kalender.weigeringUitleg` promised a themaperiode the new button's result does not have.** It closes
   with *"het thema komt dan als jouw eigen keuze in deze themaperiode"* — true inside a real period,
   false on a stale card, where un-rejecting yields `Manueel` with `isVervallen` still true. It also
   contradicted `weigeringEerstTerugdraaien` printed a few lines above on the same card: one card, two
   sentences, opposite claims, which is the shape E3-07 is reopened over. **The string is E4-06's, the
   defect is E4-02's**: before this story that state took a rejection *plus* a vakantie edit, and now
   "Weigeren" sits on the stale card with `beslisVervallen` recommending it, so the false promise became
   the advertised destination. *Fixed:* split into `weigeringUitlegVervallen`, and the existing E3-07 test
   that had been **pinning the defect** for the stale case is parameterised over the split. *(Round 4: that
   test is **E4-06's** (`81b4ed9`), living in E3-07's `describe` block — `git log -S`. Rounds 2 and 3 both
   credited it to E3-07.)*
3. **The board still tells the teacher the dekking is unreliable in the state the new button resolves.**
   `herzienUitleg` ends *"Zolang dit openstaat is de dekking van dit jaarplan onbetrouwbaar"*, and
   `vervallenPlaatsingen` filters on staleness with no status filter, so after the weigering the card stays
   in that notice while the API reports `isBetrouwbaar: true, onopgeloste: 0`. **Already filed against
   E5-02 by E5-01**; what changed is that it went from corner case to advertised remedy. *Fixed:* the
   hand-off to E5-02 is corrected and sharpened; the string itself is legitimately E5-02's, and no teacher
   can see the contradiction today because no dekkingsoverzicht exists.

## Round 2 — eight MINORs

Fixed: the stale-rejection test asserted the request and never rendered the result (the mechanism behind
MAJOR-2); a comment named `magBeslissen`, deleted by the same commit; **`vergrendelDekking`'s
`!isVervallen` guard was unpinned** (the auditor's M9 survived, 308 green) and the reword made losing it
worse, because the new imperative names a button a stale card does not have; **the face error message had
no test on the state the split created** (M10 survived, so a failed weigering on a stale card would have
failed silently); "routed to E7-10" was routed nowhere; this file did not exist and the two QUESTIONs were
unaccounted for; and `beslisUitleg` still rendered on a board with nothing left to decide.

**Two mutations were the auditor's own, not from my table**, and both landed on the axis the fix round
widened. That is the argument for an independent pass in one line.

## Round 3 — two MAJORs, both small edits, both about evidence rather than behaviour

Round 3 found **no defect in what the screen does.** Its two MAJORs are that two fixes were not
*provable*, and one of them was not even *coherent*. That is the more uncomfortable kind of finding.

1. **The correction to round 2's MAJOR-1 was self-contradicting.** I rewrote the headline of finding 4
   and left the old sentence's reason clause attached, so it read *"a teacher CAN now directly create a
   stale rejected card … because the stale card offers no decision"* — a claim and its own negation, in
   one sentence, **inside the fix for exactly that class**, in the item that fix had singled out as "the
   one that mattered". Fourth consecutive round of this project's dominant defect class.
   **The mechanism, which is the transferable part:** I edited the clause I had noticed and left the
   grammar around it. A partial in-place substitution reads as fixed to whoever wrote it and as nonsense
   to whoever reads it next. *Rewrite the whole sentence, or do not touch it.* Now rewritten whole.
2. **The MAJOR-2 fix was pinned structurally, not semantically.** Every assertion added for
   `weigeringUitlegVervallen` was either a `t(key)`-versus-`t(key)` tautology (which variant renders on
   which card) or a property **inherited from E4-06** (`"hier"`, `"hele jaarplan"`). The property the
   split existed to create — *does not promise the card a period* — was asserted **nowhere**, and the
   auditor put the false promise back with all 314 tests green. **Third round running that a fix's
   defining property turned out to be unfalsifiable.** Now pinned negatively *and* positively, plus a
   pin on the placed variant still making the promise, so the pair cannot be satisfied by flattening the
   two strings into one cautious sentence.

**Six MINORs**, and five of them are one rule applied inconsistently inside one commit:

- **`kalender.weigering*` was never in the catalogue family guard**, which polices exactly the
  hergeneratie claim both its members make. This story added the second member. The prefix now covers it,
  free of charge (both values already satisfy the assertion), and a third variant can no longer escape.
- **The epic entry's own status line still said "Awaiting the antagonist audit"** after two audits and two
  fix rounds, and its `*Verification:*` line still carried the misleading mutation sentence and a
  superseded test count — corrected in the worklog, left in the backlog. *"Fixed where noticed, left where
  not"* is the pattern round 2 graded MAJOR, recurring one file over.
- **Three of four hand-offs named a destination instead of writing in it** — the very rule this story had
  just enforced on itself for E7-10. Now written **into** their destinations: the E3-07 entry says this
  story enlarged what it owes and why; **E5-02** carries the divergence, the ruling it needs and the
  instruction not to fix it by rewording the true half; and `kalender.indelingUitleg` being dead is filed
  against **E3-06**, whose story introduced it, together with the fact that it falsifies a sentence the
  open Art. II.3 entry cites as evidence.
- **Two state gaps are now recorded as choices** rather than left implicit: the split branches on the
  server's `isVervallen` while the "Te herzien" notice uses a wider client-side predicate (deliberate:
  the copy stays aligned with the figure rather than with the notice), and `beslisUitleg` can render above
  a board whose only outstanding decision sits in the notice (deliberate: suppressing it would leave a
  decision unexplained, which is the defect the gate exists to prevent).

**One QUESTION, and it is the owner's.** Round 3 rejected my framing of MAJOR-3 as "copy E5-02 owns". The
directie ruling of 2026-07-28 says the figure is onbetrouwbaar *while any placement is unresolved*;
`DekkingService` narrows that to exclude rejected placements and **its own comment calls this "a judgement
call, not an owner ruling"**. So `herzienUitleg` is faithful to the ruling and the *service* is the
divergence — meaning the sentence that looks wrong is the true one. Filing that as a copy task is how a
rule conflict gets resolved by rewording the correct half. It belongs in the **Art. XIV** list, which
lives in `backlog/README.md`, which this session cannot edit; escalated in the groepschat and written into
E5-02 instead.

### Gates after fix round 3

**314 frontend tests** (15 files), lint clean, build clean. **Four mutations, four caught**, including the
auditor's own survivor (MU13, the false promise restored), the half-fix that merely deletes the phrase
without saying anything, flattening both variants into one, and an unscoped hergeneratie promise — which
now fails **twice**, once at the hand-written assertion and once at the widened family guard.

**No browser re-run.** Fix round 3 changed one string's *assertions*, one test-file prefix, five
documentation files and two comments. The only user-visible text touched is unchanged in content; nothing
about layout, colour or control state moved.

---

## What is still open

- **`backlog/README.md` L31** says *"E4-01/E4-02 must build the accept affordance"* as a standing
  obligation. It is discharged. The **lead holds that file's claim**, so it is escalated in the
  groepschat as a false statement rather than a stale count, and it needs one line from whoever holds it.
- ~~**`backlog/README.md` L125**~~ — **retracted (round 4).** The claim that it is falsified by a dead
  `kalender.indelingUitleg` was itself false: the key does not exist (E3-08 deleted it in this story's own
  merge) and that README line had already been corrected the same day. See `implementation.md` finding 1.
- **The Art. XIV ruling round 3 surfaced:** does a **rejected stale** placement leave the dekking figure
  trustworthy? `DekkingService` says yes and calls its own narrowing "a judgement call, not an owner
  ruling"; the directie ruling of 2026-07-28 says no. E4-02 made that state routine, so the conflict is now
  reachable. Written into **E5-02** with the instruction not to resolve it by rewording the true half;
  it belongs in the Art. XIV list, which lives in the file this session cannot edit.
- **SC 2.5.8 and SC 2.5.3** are filed under **E7-10** (they were not, when the story first claimed they
  were). Both are app-wide patterns; E4-02's own two buttons measure 106×36 and 91×36.
- **E3-07** owes more after this story, not less, and that is now written in **E3-07's own entry**.

---

## Round 4 — my own filing was false, and the rule that earns is the auditor's

Round 4 found **no defect in what the screen does, for the second round running.** Both MAJORs were in
prose *round 3 wrote*, and one of them had been written into another story's file.

1. **The `kalender.indelingUitleg` filing was false at `HEAD`.** Re-derived myself rather than taken on
   trust: `grep -c indelingUitleg frontend/src/i18n/nl.json` → **0**. The key existed when this story
   branched (`git show 3795c16:…/nl.json | grep -c` → 1) and was gone after **this story's own merge**
   (`57b79c0` → 0), because **E3-08 deleted it** as a dead key — and `backlog/README.md`'s Art. II.3
   citation had been corrected the same day to say precisely that. So the observation was true when I made
   it, pre-merge, and I re-asserted it **twice afterwards without re-deriving it**, once into **E3-06's own
   entry**, creating a work item nobody could do and telling the next reader that a governing
   open-decision record was false when it was not. Retracted in all four places, with the `grep` beside
   the retraction.
2. **Widening the catalogue family filter disabled the family's rename canary, and I called it "free".**
   The per-string assertion was indeed unaffected — but with one combined list, `length > 0` is satisfied
   by *whichever* family survives, so renaming every `vergrendel*` key away **and** restoring the exact
   unscoped promise E4-06's round-1 fix had missed left the guard green. That canary has caught that rename
   before; its own comment records the incident. Fixed by asserting non-vacuity **per family**
   (`SLOTTEKSTEN` + `WEIGERINGTEKSTEN`, unioned only for the per-string loop), and verified by running the
   auditor's own mutation plus its mirror: both now fail. The correct sentence is *the per-string assertion
   is free; the canary has to be per-family.*

**Three MINORs**, all the same shape: `git log -S` shows the test that "was pinning the defect" is
**E4-06's** (`81b4ed9`), not E3-07's — so the hand-off written to fix a mis-routing mis-routed the credit,
inside the entry of the story it was informing; the guard still called itself "the lock copy" in its
constant, `describe` and both `it` names while covering two families; and this worklog's own header still
listed two commits after three fix rounds, in the commit that had corrected exactly that in the epic entry
next to it. The second guard's rationale is also extended to the weigering family, because E3-08 removed
the re-placement line from rejected cards at both tiers and this story made a stale rejected card routine,
so the same E3-06 rule applies one family across.

### The rule this story earns, and it is the auditor's, not mine

> **Re-derive every claim about the repo against `HEAD` at the moment you commit it, and write the command
> beside it.**

One `grep -c`, one `git log -S`, one mutation run. Each of round 4's three verifiable findings would have
cost a single command. This story spent four rounds writing prose about verifying claims and did not apply
it to its own prose; the fix is not a fifth round, it is that line.

*A second observation, recorded because it is uncomfortable and true:* every round after the second found
defects **only in text this story had added**. More explanation is not free — each paragraph is a new claim
that can rot, and three of the four documentation defects came from **partial in-place substitution**,
editing the clause I had noticed and leaving the sentence around it.

### Gates after fix round 4

**314 frontend tests** (15 files), lint clean, build clean. **Two mutations, two caught:** the auditor's
surviving MU-E (family renamed away plus the unscoped promise restored) and its mirror on the weigering
family. No browser re-run: this round changed one test file's structure, two comments and five
documentation files, and no user-facing string.
