# Antagonist Review: TB-005, round 3 (fix commit `2c38da3`)

*Saved by session `kindrapport` on 2026-09-14. How each finding was handled is in the TB-005 werklog and in the commit
that follows this file.*

**Verdict:** VIOLATIONS FOUND. 0 CRITICAL, 0 MAJOR, 7 MINOR, 2 QUESTION.

The round-2 MAJOR (Art. IV.4 sending the title and the label) is resolved, and a grep finds no text left that sends
them to the AI. Rounds 2's MINORs 3, 5, 6, 7, 8 and 9 and QUESTIONs 2 and 4 are resolved. MINORs 1, 2 and 4 are partly
resolved: the fixes did not reach the ratification log or ADR-0035 §4.

## Findings

1. **[MINOR] Directie on the K3 set is called both ratified and a default.** VI.7 calls it a default, because R6 named
   only the K3 leerkrachten. ADR-0030 footnote ⁶ and VI.1's column rule rest every directie ✓ on R3. Except the
   rapportdoelen row in footnote ⁶, and say that R6 overrides R3 there.
2. **[MINOR] The ratification log and ADR-0035 §4 were not updated with the round-2 fixes.**
   - They still cite R23 for "the proposal is not stored".
   - They still say "D1 to D16".
   - They leave out IV.4, the XIV annotations, ADR-0010, FA §2.3 and §7, and the ADR-0030 header and (e).
3. **[MINOR] VI.6 cites AVG art. 13(3) and states the breach as certain.**
   - Art. 13(3) covers further processing. Informing at collection is 13(1), or art. 14(3) within a month.
   - The DPIA is only "very likely" required, so the breach is conditional. Question 15 says the same thing flatly.
   - The wrong citation came from the auditor's own round-2 text.
4. **[MINOR] The new severity line could downgrade pupil data in logs or the repo to MAJOR**, because VI.7 labels those
   two rules as defaults. State that they follow from VI.2, or that such content is CRITICAL.
5. **[MINOR] "never sees a name" and "de AI geen namen krijgt" are still overclaims** in the ADR index and in TB-005
   AC3 (R25).
6. **[MINOR] E7-06 does not name the art. 9 data** in the register's list of categories (AVG art. 30(1)(c)).
7. **[MINOR] Directie is not told that a menggroep recorded as K2 gets no report for its K3 children** (D9). Annotate
   the Art. XIV graadklas bullet, and add a sentence to question 14 or 15.

- **[QUESTION 1]** Ten em dashes in the new FR-13 lines of the FA follow the FA's house format. Does Art. II.5 bind the
  FA? The fix would be a colon.
- **[QUESTION 2]** R6 against R3: may directie edit the K3 set? Finding 1 makes the text consistent either way.

## Checks run

- Art. I, II, IV, V, VI, IX.4, XI and XIV, line by line against R11–R28.
- Markdown tables and nested lists, including the seven-column ADR-0030 matrix.
- U+2014 in the added lines.
- The working tree held one uncommitted change: the TB-005 werklog line recording the owner's confirmation of R29.
