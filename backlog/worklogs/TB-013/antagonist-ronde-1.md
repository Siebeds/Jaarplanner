# Antagonist Review: TB-013, round 1

*Saved by session `kindrapport` on 2026-09-14. Audited commits: `2399ee4` and `716feba`. All findings were fixed in the
closing commit of TB-013, which was not audited again.*

**Verdict:** VIOLATIONS FOUND. 1 MAJOR, 3 MINOR, 2 QUESTION.

## Findings

- **[MAJOR] The ratification-log row was changed to count R32** ("32 rulings (R1 to R32) with the options offered").
  - R32 had no options and was never ratified.
  - The row describes the event of 2026-09-14, and the edit sat in a non-dedicated commit (Art. XI.1).
  - The change is not needed: Art. VI.7's closing clause already makes §3.10's D17 and D18 defaults.
  - **Fix:** revert it.
- **[MINOR] Attribution.**
  - The FA line credits D18 ("alleen wie rapporten mag zien") to the owner's R32.
  - ADR §3.10's "R32:" bullet paraphrases the quote under his label.
- **[MINOR] D17 names the `ONDERAAN` array.**
  - Every entry of that array is also a phone tab, so naming it pre-empts the phone question the section leaves open.
  - The array means "settings" in `routes.ts`.
  - It gives the rule to index 0 only.
  - **Fix:** describe a position and leave the code to build ticket 1.
- **[MINOR]** The Deciders line and the §1 introduction do not mention that R32 was unprompted.
- **[QUESTION]** Does "ONDERAAN" mean the very bottom, below Instellingen? This goes to the design pass of build
  ticket 1.
- **[QUESTION]** A gebruiker with only Leerlingzorg would see a tab with nothing behind it until build ticket 3.

## Confirmed

- §1.7 quotes the owner exactly.
- D18 is consistent with §3.3, Art. VI.7 and FR-13.7.
- No em dash was added to the FA.
- The ticket follows TICKETS.md.
- No pupil data or secrets.
