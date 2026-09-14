# Antagonist Review: TB-005, round 2

*Saved by session `kindrapport` on 2026-09-14. Audited commits: `9fbfcac`, `8729a15`, `fd8b669`, `ac60a42`. How each
finding was handled is in the TB-005 werklog and in the commit that follows this file.*

**Verdict:** VIOLATIONS FOUND. 1 MAJOR, 9 MINOR, 4 QUESTION, no CRITICAL.

Most of round 1 is fixed: nine findings are resolved, three partly, and all four questions have owner answers. The MAJOR
is new. The amended Art. IV.4 says more than R21's literal *"Alleen de tekst gaat naar de AI"*, because it adds the
rapportdoel title and the child's gradatie label to what the AI receives.

Nothing that E6-02 pushed (`origin/feature/e6-rollen-rechten` at `6c7821e`, already merged) contradicts this branch.

## Round-1 findings

| Round 1 | Status |
| --- | --- |
| MAJOR 1: session design shown as ratified | Partly resolved. What remains is the new MAJOR and MINOR 1 below. |
| MAJOR 2: VI.6 not routed | Resolved. The residue is in MINOR 4. |
| MAJOR 3: dependent texts missing | Largely resolved. The rest is in MINOR 7. |
| MINOR 1: quotes | R16 and R18 resolved. R29 is quoted only as an excerpt (QUESTION 1). |
| MINOR 2, 3, 4, 7 and 8 | Resolved. The MINOR 8 overclaim now sits on the free texts (MINOR 5). |
| MINOR 5 | Resolved by R26. The download is cited to R26 (MINOR 2). |
| MINOR 6 | Resolved in the ADR, not carried into Art. XIV (MINOR 8). |
| QUESTIONs 1–4 | Answered by R23/R24, R25, R26 and R28. |

## Findings

- **[MAJOR] Art. IV.4 adds the rapportdoel title and the gradatie label to what the AI receives.**
  - R21 chose *"Alleen de tekst gaat naar de AI"*.
  - The label is the child's rating, so it is extra pupil data sent to the processor.
  - Art. IV.4 carries no default marker, so the addition reads as ratified text.
  - CLAUDE.md, VI.7 and FR-13.4 do not mention it.
  - **Fix:** remove it from IV.4, and keep it only as a D-item or ask the owner.
- **[MINOR 1] Art. IV.2:** not storing a pending proposal was the premise both of R23's options were put on, not R23's
  answer.
  - ADR §5 says "Rejected by R23"; it was not offered.
  - IV.5's "exactly the placeholders" is unmarked session design.
- **[MINOR 2] VI.7 cites rulings for session design:**
  - the download after the schooljaar, cited to R26;
  - "made on demand, never stored", cited to R13;
  - directie editing the set, cited to R4–R6. R6's unchosen option was "Directie en K3-leerkrachten";
  - "restored after the call", under R25;
  - "D1 to D16 included", although D6 was retired.
- **[MINOR 3] The reminder of R28 is missing** from VI.7, FR-13.8, CLAUDE.md, question 15 point 2 and ADR §6 ticket 7.
  The reminder is the only difference from the option the owner turned down.
- **[MINOR 4] The VI.6 waiver says "waives the order, not the obligation".**
  - For AVG art. 35(1) and 13(3), timing is part of the obligation.
  - The owner is not the verwerkingsverantwoordelijke; the school is.
  - Question 15 point 3 says texts go to the AI "zonder de namen", which R25 contradicts.
- **[MINOR 5] "Nothing else about a child" cannot hold for the free texts.** They can carry care or health information,
  which is AVG art. 9 data, and that text goes to the AI. Narrow the claim, and name art. 9 in question 15.
- **[MINOR 6] ADR-0030 matrix:** the union rule holds for all six rows, but the column definitions were not widened.
  - "LK eigen" covers the planning only, and "LK leeftijd" covers subthema content only.
  - Leerlingzorg is the seventh relation, not the sixth.
  - "Every Directie ✓ rests on R3" clashes with "the R-numbers are ADR-0035's".
- **[MINOR 7] Leftovers that are now false:**
  - the ADR-0030 header, "§4 (no pupil PII) stand unchanged";
  - ADR-0030 (e), "four rights";
  - ADR-0010, which has no narrowing status line;
  - FA §7 *Transparantie* and *Brongegevens*;
  - FA §2.3 *Binnen scope*, which does not list the report;
  - the NFR-6 headline.
- **[MINOR 8]** Art. XIV "Teacher visibility" (R17) and "Export formats" (R13) are not annotated.
- **[MINOR 9] antagonist.md:**
  - item 8 does not list the IX.4 entities, so a `Leerling` entity would fail;
  - item 5 still says "the §3.2 matrix";
  - line 55 makes a deviation from a VI.7 default CRITICAL without saying so.
  - Every other non-negotiable is still enforced in all three files.
- **[QUESTION 1]** Is R29 consent? The edits stay within "mag … niet tegenhouden of blokkeren", but the owner chose
  neither option. Quote R29 in full, and let the owner confirm the three edited texts once.
- **[QUESTION 2]** Whoever holds the directie right, such as an ICT-coördinator, reads and edits every report. The owner
  and directie should see that (AVG art. 5(1)(c)).
- **[QUESTION 3]** R6: does directie's general right still apply to the K3 set?
- **[QUESTION 4]** Should question 15 cover art. 9 data?

## Consistency between the documents

- **Who reads, fills in, downloads and edits:** consistent.
- **What is stored:** consistent, apart from the NFR-6 headline and the free-text overclaim.
- **AI name replacement:** consistent, apart from IV.4 and question 15 point 3.
- **Retention:** inconsistent on the reminder.
- **Never counts for dekking:** consistent.

## Leftovers accepted as true or historical

- **Still true:** E6:38; TICKETS.md:167; ticket-aanmaken:67; ADR-0033:186; ADR-0034:26 and :155; ADR-0031;
  `ToegangService.cs:33`; E5:241; E7:160; ADR-0030:916.
- **Historical, under an updated status line:** the bodies of ADR-0011 and ADR-0016.
- **Deferred to the build:** `JaarplanGeneratiePromptBuilder.cs:129` and `IAiClient.cs`.
