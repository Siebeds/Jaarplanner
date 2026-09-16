# FB-025: antagonist audit

## Round 1 (2026-09-17): VIOLATIONS FOUND

**MAJOR.** ADR-0054 D2, a build default, hid activiteitvoorstellen from directie, against Art. VI.1 (R3, directie sees and
edits everything); VI.1 was not amended and IV.1/IX.2 said "only the asker".
**Resolution:** the owner ruled A3 (directie sees and decides every leerkracht's proposals). New matrix row
`ActiviteitvoorstelBeslissen` (asker while "LK leeftijd", and directie), mirrored in the frontend; the GET sends
directie every asker's proposals; VI.1 gains the activiteitvoorstel paragraph and ADR-0054 D1 to D9 in its defaults;
IV.1, IX.2, XII, ADR-0054, the log, CLAUDE.md and FA A.7 follow. Commit b42ee997.

**MINOR, handled:**
- Art. IV.8 did not name step 7: added.
- An empty run deleted the open proposals and its sentence claimed more than it knew: an empty run now keeps them, and
  the sentence reads "Er is geen nieuw voorstel bijgekomen."
- Two simultaneous accepts could create two activiteiten: an `xmin` row version now refuses the second.
- Rejecting also needs the leeftijd right: written down in ADR-0054 D2.

**MINOR, not done:**
- No test goes through the dekking endpoint for an accepted proposal. It is created through the ordinary own-activiteit
  path (`Subthema.VoegActiviteitToe` with owner, `aanvaard` links), which the existing Art. V.1 tests cover.

## Round 2 (2026-09-17): COMPLIANT

The round-1 MAJOR is resolved (commit b42ee997); the fix introduced no new CRITICAL or MAJOR finding.
