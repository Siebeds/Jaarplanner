# Antagonist Review: TB-005, round 4 (fix commit `2967e26`)

*Saved by session `kindrapport` on 2026-09-14. The owner answered QUESTION 1 as R31: only the K3 leerkrachten edit the
K3 set and the scale, and directie views them. The fixes follow in the final TB-005 commit, which no further round
audited.*

**Verdict:** VIOLATIONS FOUND. 0 CRITICAL, 0 MAJOR, 4 MINOR, 2 QUESTION.

**Round 3:**
- **Resolved:** MINORs 2, 3, 4, 6 and 7, and QUESTION 1.
- **Partly resolved:** MINORs 1 and 5.
- **Carried forward:** QUESTION 2.

## Findings

1. **[MINOR] Directie on the K3 set.**
   - ADR-0035 §3.3 still gives directie a ✓ and grounds it in VI.1 and R26. R26 is about reports after the schooljaar.
   - VI.7 says that R6 "takes precedence" but keeps directie in. That argues against itself.
   - VI.1 and ADR-0030's rule that "every Directie ✓ rests on R3" has no pointer to the exception.
2. **[MINOR]** The ADR index still says the rewrite "never sees" the names of the klas's children. R25 says a mistyped
   name is not caught.
3. **[MINOR] R30 is recorded as confirming more than it was asked.**
   - The question spoke of one rule, while eight lines changed.
   - "In his own answer" reads as free text, but he chose an offered option.
   - The substance is sound: the rest is dependent text of R23, R24 and IX.4.
4. **[MINOR]** ADR-0035 claims the conditional AVG position is stated, while §3.8 states the DPIA as required and cites
   art. 13 without 13(1) or 14.

- **[QUESTION 1]** R6 against R3: may directie edit the K3 set? Only the owner can resolve that.
- **[QUESTION 2]** A menggroep recorded as K3: its K2 children could get a K3 report. Question 14 tells directie only
  the K2 side.

## Checks run

- **Em dashes:** none added to directie-facing lines.
- **Markdown:** the R30 row, the new blockquote and footnote ⁶ render correctly.
- **The VI.7 logs rule:** agrees with ADR-0035 §3.8 and CLAUDE.md.
- **Cosmetic:** IV.4 is listed before IV.3 in ADR-0035 §4.
- **TB-005:47** omits FA §2.3 and §7 (subordinate ticket text).
- **The ratification log** must say four rounds, not three.
