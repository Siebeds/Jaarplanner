# Antagonist: FB-026 (audit, round 1)

**Verdict:** COMPLIANT
**Scope:** `git diff $(git merge-base HEAD origin/main) HEAD` (merge base 14bdb5d8), 44 files.

## Checked and sound
- **Art. IV:** proposals stored as `Voorgesteld` with a required motivation; structured JSON through
  `DoelMatchResponseParser` and `ActiviteitDoelsuggestieValidator`; an unreadable answer is a 422 and stores nothing;
  `IAiClient` injected and stubbed; the prompt holds only the activiteit, its subthema and thema, and the loaded goals of
  its leeftijd.
- **Art. VI.1:** both routes on `DoelenKoppelen` against the activiteit; `BeslisAsync` finds the link only inside that
  activiteit. Tests: shared activiteit refused for a leerkracht without HL right, own activiteit decided by its owner and
  refused for the HL, R25 delete with only a proposal or a rejected goal.
- **Art. V:** nothing stored; dekking already counts only decided activiteit links.
- **Art. IX:** `Subdoelvoorstel.ActiviteitId` nullable, `SetNull` on delete; clean migration.
- **Art. II, VIII, VI.4, VI.7:** copy in `nl.json` without em dashes; no new dependency, secret or pupil data.

## Findings and what was done
- [MINOR] Art. IX.2 defined `Subdoelvoorstel` only as the FB-057 placement. **Fixed:** the definition names the second
  origin (ADR-0054, owner ruling 2026-09-15), and the constitutie-log entry lists IX.2.
- [MINOR] Art. VI.1 defaults I19, I26, I27 still say "a goal link" while the code counts only decided links there
  (ADR-0054 D5, the session's extension of the owner's R25 ruling). **Put to the owner** at hand-off; the constitution
  text is left as it is until he confirms.
- [MINOR] No test fed the changed readers a proposed or rejected link. **Partly fixed:** the R25 test now also covers the
  leerkracht move (I19) and the library count. The wizard guards (I26, I27, Q4) remain untested with such a link.
- [MINOR] `doelvoorstel.subdoelUitleg` claimed more than the code guarantees. **Fixed:** "tenzij het daar al staat, al
  wacht of geweigerd werd."
- [QUESTION] An own activiteit's owner without HL right causes a `Subdoelvoorstel` on the shared subthema by accepting a
  goal. It stays a proposal the HL decides (ADR-0054 consequences, owner ruling 2026-09-15). **Put to the owner** at
  hand-off.
