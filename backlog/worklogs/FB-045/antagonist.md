# FB-045: antagonist audit

## Round 1: COMPLIANT

Scope: `git diff origin/main...HEAD` on `ticket/FB-045-dekkingsprognose` (6319f88..6bc9145). Checked against Art. II,
III, IV, V, VI, VIII, IX, X, XIV and ADR-0047 D1–D7, S1–S4. No CRITICAL or MAJOR finding.

### Not blocking

- [MINOR] `Subthemaplaatsing.cs` and `Activiteitplaatsing.cs` still described the old Art. V.1 rule. **Fixed.**
- [MINOR] `JaarplanGeneratiePromptBuilder.cs` said DekkingService counts four link layers. **Fixed.**
- [MINOR] The export's note gave a stale reason why the minimumdoel level is not in the file. **Fixed:** it now says the
  level is on the dekkingsscherm and not yet in the file.
- [MINOR] At leerplandoel level every `NietIngepland` action links to `/agenda`, also when the named source is a thema
  (an accepted doelsuggestie of an unplaced thema), whose fix is on `/agenda/periodes`. **Left:** the payload does not
  say which kind a name is; `/agenda` reaches the periodes too. Worth a field when the export is reworked.
- [QUESTION] The generation prompt still maximises coverage with themadoel codes, which ADR-0047 D5 no longer counts,
  and does not see a thema's minimumdoelen. **For the owner:** a follow-up ticket.
- [QUESTION] Should these rulings go to directie in `docs/besluiten-gevraagd.md`? **For the owner.**
