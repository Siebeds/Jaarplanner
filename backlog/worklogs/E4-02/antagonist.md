# E4-02 — antagonist verdicts

Two rounds, both **VIOLATIONS FOUND**, both against the constitution rather than against taste.
Recorded here because the worklog carried the counts and not the findings, and because round 2's
own MINOR was that this file did not exist while `E4-06/antagonist.md` does (Art. X.7).

| Round | Commit audited | Verdict | Findings |
| --- | --- | --- | --- |
| 1 | `3795c16` + the `57b79c0` merge resolutions | VIOLATIONS FOUND | 3 MAJOR, 7 MINOR, 2 QUESTION |
| 2 | `cd6e3e0` (fix round 1) | VIOLATIONS FOUND | 3 MAJOR, 8 MINOR, 0 QUESTION |

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
   that had been **pinning the defect** for the stale case is parameterised over the split.
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

## What is still open

- **`backlog/README.md` L31** says *"E4-01/E4-02 must build the accept affordance"* as a standing
  obligation. It is discharged. The **lead holds that file's claim**, so it is escalated in the
  groepschat as a false statement rather than a stale count, and it needs one line from whoever holds it.
- **SC 2.5.8 and SC 2.5.3** are now filed under **E7-10** (they were not, when the story claimed they
  were). Both are app-wide patterns; E4-02's own two buttons measure 106×36 and 91×36.
- **E3-07** owes more after this story, not less. See the E4-02 entry.
