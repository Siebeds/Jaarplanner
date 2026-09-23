# Antagonist: FB-096, round 1

**Verdict:** COMPLIANT. Scope: `git diff origin/main...HEAD` at commits eb391388, 53727642, 8e1710b5.

## Findings (none blocking)

- **MINOR, Art. V.1 / ADR-0049.** The comments in `Subthemaweghaling.cs` and `subthemaweghaling.ts` said that removing a
  run with no stored window "changes nothing" for the dekking. An own activiteit counts on its own wherever it is
  planned, so its removal can still lower the dekking. **Fixed:** both comments now say so. The confirmation stays silent
  about it, which the "say less" rule allows.
- **MINOR, same cause.** `subthemaWeg.dekkingBlijft` is true for the subthema's own goals, but an own activiteit removed
  in the same stretch can still take its goals out of the dekking. **Not changed:** the sentence is incomplete, not false.
- **MINOR, ticket text.** Acceptance criterion 2 asks for the dekking sentence every time. The build leaves it out when
  no stored window goes (then the subthema's goals never counted through it) and says "blijven meetellen" when another
  window of the subthema stays. **To tell the owner** when the ticket goes to testing.

## Checked and in order

Art. II (copy in `nl.json`, no em dash, Dutch 404 is teacher-actionable), IV (removing open weekvoorstel proposals is
the teacher's explicit discard; thema placements untouched), V (nothing stored; count and delete share one selection),
VI (both routes `KlasplanningBewerken` on `Rechtbron.Klas`; Postgres test for a read-only user; button only with
`magPlannen`), VIII (layering), IX (hoekverrijkingen go with their window, per the owner's rule "mee weg, met aantal";
other content stays), X (unit, Postgres and frontend tests), XIV (no open decision assumed).
