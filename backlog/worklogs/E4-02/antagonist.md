# E4-02 — antagonist verdicts

Four rounds, all **VIOLATIONS FOUND**, all addressed. Recorded here because the worklog carried the counts
and not the findings, and because round 2's own MINOR was that this file did not exist while
`E4-06/antagonist.md` does (Art. X.7).

| Round | Audited | Verdict | Findings |
| --- | --- | --- | --- |
| 1 | `3795c16` + the `57b79c0` merge resolutions | VIOLATIONS FOUND | 3 MAJOR, 7 MINOR, 2 QUESTION |
| 2 | `cd6e3e0` (fix 1) | VIOLATIONS FOUND | 3 MAJOR, 8 MINOR |
| 3 | `447fe0a` (fix 2) | VIOLATIONS FOUND | 2 MAJOR, 6 MINOR, 1 QUESTION |
| 4 | `c6b0dde` (fix 3) | VIOLATIONS FOUND | 2 MAJOR, 3 MINOR, 2 QUESTION |

> *Condensed at the owner's instruction, 2026-08-03, together with the worklog. Full text at `e47e7e8`.*
>
> **The shape of the sequence is worth more than any single finding.** Round 1 found a real design defect.
> Round 2 found one more, plus a false promise this story had made reachable. **Rounds 3 and 4 found no
> defect in what the screen does at all** — every MAJOR was in prose the previous fix round had written,
> twice in text written *into another story's file*. Length was the risk, not fragility.

---

## Round 1 — the design

1. **MAJOR — the stale-card exclusion was right about accepting and wrong about rejecting.** One flag, so
   the accept argument silently annexed the reject case, which `DekkingService`'s
   `IsVervallen && !IsGeweigerd` falsifies: a weigering is what *resolves* a stale proposal. *Fixed:*
   `magAanvaarden` / `magWeigeren`.
2. **MAJOR — `beslisUitleg` was false about the card rendered above it** (*"aanvaard of weiger **elk**
   voorstel"*, while a stale card offered neither). *Fixed:* quantifier removed, plus `beslisVervallen`.
3. **MAJOR — three comments asserted the opposite of the code**, all about the one string this story
   reworded.

Seven MINORs: `beslisUitleg` unpinned; two of three live-region branches unasserted, including the
un-reject announcement the worklog *claimed* as delivered; the interlock claimed closed when only one
direction is; `statusFoutmelding` mis-attributing the lock's 404 split to the move path (which splits on
400, differently); a test comment claiming `herzienUitleg` points at a picker; SC 2.5.3 while busy;
discharged backlog obligations left standing.

## Round 2 — the fix round as new code

1. **MAJOR — five documentation statements falsified by the commit that wrote them.** The one that mattered
   was inverted: *"a teacher still cannot directly create a stale rejected card"* — they now can, in one
   press, and that is the combination **E3-07 is reopened over**.
2. **MAJOR — `weigeringUitleg` promised a themaperiode a stale card does not have**, and contradicted
   `weigeringEerstTerugdraaien` on the same card. *Fixed:* split into `weigeringUitlegVervallen`. An
   existing test — E4-06's (`81b4ed9`), in E3-07's `describe` block — had been **pinning the defect**.
3. **MAJOR — `herzienUitleg` calls the dekking unreliable in the state the new button resolves.** Filed to
   E5-02; see the owner's ruling below.

Eight MINORs, of which the two that mattered were the auditor's own surviving mutations:
`vergrendelDekking`'s `!isVervallen` guard and the face error's gate were both unpinned. Also: the
stale-rejection test asserted the request and never rendered the result; a comment named a deleted flag;
"routed to E7-10" was routed nowhere; this file did not exist.

## Round 3 — evidence, not behaviour

1. **MAJOR — the correction to round 2's MAJOR-1 was self-contradicting**: the headline was rewritten and
   the old reason clause left attached. A claim and its own negation, inside the fix for that class.
2. **MAJOR — the `weigeringUitlegVervallen` split was pinned only by tautologies** (`t(key)` versus
   `t(key)`) and by properties inherited from E4-06, so restoring the false promise left 314 tests green.

Six MINORs: `kalender.weigering*` was outside the catalogue family guard; the epic entry's status and
verification lines were stale; three of four hand-offs named a destination instead of writing in it — the
rule this story had just enforced on itself for E7-10.

## Round 4 — my own filing was false

1. **MAJOR — the `kalender.indelingUitleg` filing was false at `HEAD`.** The key does not exist:
   `grep -c indelingUitleg nl.json` → 0. It existed at `3795c16` and was gone at `57b79c0`, **this story's
   own merge**, because E3-08 deleted it — and `README.md`'s Art. II.3 citation had been corrected the same
   day to say exactly that. Asserted twice post-merge without re-deriving, once into **E3-06's entry**,
   creating a work item nobody could do. Retracted with the `grep` beside it.
2. **MAJOR — widening the catalogue family filter disabled the family's rename canary**, which I had called
   "free of charge". With one combined list, `length > 0` is satisfied by whichever family survives.
   *Fixed:* non-vacuity per family, verified against the auditor's own mutation and its mirror.

Three MINORs: `git log -S` shows the pinning test is E4-06's, not E3-07's; the guard still called itself
"the lock copy"; the worklog header listed two commits after three fix rounds.

## The QUESTIONs, and who answered them

**Round 1, Q1 — is building *reject* as well as *accept* in scope?** Not raised as a violation, and I agree:
Art. IV.2 words the capability as one thing, and accept alone would have left `Geweigerd` unreachable.
*Residues, stated rather than closed:* the *Done when* names only `manueel` for **DoelKoppelingen**, and
this story closes that half by **reading** `DoelsuggestieLijst.tsx` rather than by adding evidence; and the
scope now overlaps E4-01's remaining "prove it end to end", written down once, on E4-01.

**Round 1, Q2 — is the dekking rule said twice?** Partially and deliberately: above the board, and inside
an open lock section where it contrasts with *vastzetten*.

**Rounds 3+4 — does a rejected stale placement leave the figure trustworthy? → RESOLVED (owner,
2026-08-03): yes.** `DekkingService`'s narrowing stands, on the grounds E5-01's audit gave: dekking is
recomputed on read, so un-rejecting makes the next read withhold the figure again and the state is
self-healing. **So E5-01's assignment of the copy to E5-02 was right and E4-02's counter-instruction was
wrong** — `kalender.herzienUitleg` is what changes, and it is E5-02's. Recorded there.

**Round 4 — no independent verification artefact.** Answered by running the **test-runner**:
[`test-report.md`](test-report.md), **PASS on all nine claims**, every figure exact, with three
qualifications now carried in the worklog.

## What is still open

- **`backlog/README.md` L31** still says *"E4-01/E4-02 must build the accept affordance"* as a standing
  obligation. Discharged. The lead holds that file's claim, so it is escalated in the groepschat as a false
  statement rather than a stale count.
- **E3-07** owes more after this story, not less — written into its own entry.
- **SC 2.5.8 / SC 2.5.3** are filed under E7-10; both are app-wide patterns.
- The **accept-versus-panel-edit race** is deliberately open, documented at `Themakaart.tsx`, and
  unverified in either direction.
