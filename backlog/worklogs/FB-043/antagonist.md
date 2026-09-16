# FB-043: antagonist audit

## Round 1: VIOLATIONS FOUND

Scope: `git diff main...HEAD` on `ticket/FB-043-minimumdoelen-als-themadoel`, commits 795fc77..a31bc9b.

### Blocking

- **[MAJOR] Art. XI.1: the constitution amendment had no commit of its own and skipped the functional analysis.**
  The amendment sat inside the frontend commit, and `docs/Functionele_Analyse_Jaarplanner.md` still called a themadoel
  one of "2–3" goals (A.4) and named step (2) "2–3 themadoelen" (A.7). The log row carried no "amended in step" note.
  `CLAUDE.md` states no count and needs no change.
  **Fixed:** the amendment is its own commit (0441255: constitution, log, FA A.4 and A.7, ADR-0046, ADR index), split
  from the code commit; the log row names what was amended in step.

### Not blocking

- [MINOR] Two backend comments cited ADR-0045 for ADR-0046. **Fixed.**
- [MINOR] Art. IX.2's `DoelKoppeling` clause still said "used for themadoelen". **Fixed:** "the themadoelen the FR-1
  import writes".
- [MINOR] `queries.ts`: `useMinimumdoelen` was inserted between `useMinimumdoel` and its JSDoc. **Fixed.**
- [MINOR] `mutaties.ts`: a JSDoc block separated from `useKoppelSubdoel` by a blank line. **Fixed.**
- [MINOR] The demo seed now adds fake `DEMO-4-xx` minimumdoelen on an empty database; they show in the register and the
  next minimumdoelen import flags them as gone. Clearly labelled, same pattern as the DEMO leerplandoelen. **Left as
  is.**
- [QUESTION] Question 8 in `docs/besluiten-gevraagd.md` asks directie whether the thema-level goal picker should be
  narrowed to the klas. With themadoelen as minimumdoelen that half is moot; the owner may want to trim the question.
  **For the owner.**

### Checked and compliant

Art. III (restricting FK to `minimumdoelen.Ref`, never deleted by the import; unknown ref refused), Art. IV (link made
only by a person, doelsuggesties and wizard untouched), Art. V (dekking computed, drop accepted, migration test shows
only `themadoelen` rows go), Art. VI.1 (both routes `ThemaBewerken`, refusals tested), Art. II (copy in `nl.json`, no
em dash), Art. VIII, Art. IX.2.

## Round 2 (re-audit of the MAJOR only): COMPLIANT

The amendment is the only commit touching the constitution, the log and the FA; A.4 and A.7 are updated; the log row
names what was amended in step. No new CRITICAL or MAJOR finding.
