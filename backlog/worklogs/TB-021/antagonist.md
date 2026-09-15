# TB-021 — Antagonist verdicts

Bounded rules of ADR-0037: one audit of the finished diff, only CRITICAL and MAJOR block, at most two rounds.

## Round 1 — `f5804bc..HEAD` (2026-09-15): VIOLATIONS FOUND

Verified clean: the ratification log moved verbatim (rows 1–19 match once links are rewritten; all 12 link targets
resolve from `docs/`); every R-, I- and D-item reference in the article text survives; the `deploy-azure-demo` lock is
still an atomic mutex on the same path; Art. X.7, XIII and XI.4 agree with CLAUDE.md, ADR-0037, `antagonist.md`,
`jaarplan-build` and `ticket-uitvoeren`; no active instruction still asks for a groepschat claim, chat post or session
file.

- **[MAJOR]** Three clauses of the deleted resolved list of Art. XIV were not in the articles the new pointer names:
  "auth remains wrapped/swappable", "calendar zoom levels (E3-08) map to these two tiers", and "two-tier default
  documented, not compiled-in". **Fixed:** the first added to Art. VI.1, the other two to Art. IX.3 `Jaarplan`, in
  their old wording.
- [MINOR] Outstanding directie confirmations for V.1 (algemene fiche), VI.1 (role model, question 13) and VII.2 (API
  source, Excel refusal) were only in the log. **Fixed:** restored in each article.
- [MINOR] VII.2 lost "amended" on the ADR-0032 decision 8 pointer. **Fixed.**
- [MINOR] CLAUDE.md said only the owner moves an FB ticket's status; sessions do so through the CLI. **Fixed:** "by
  hand".
- [MINOR] `tickets.mjs` `announce()` still appended to `groepschat.md` when present; `.gitignore` did not name the
  demo lock. **Fixed:** `announce()` and its test assertion removed; comment extended.
- [QUESTION] Art. XI.1 asks for a "dedicated commit"; the amendment commit also carries the tooling changes of the same
  ADR-0037 decision. Read as met in substance by the auditor; left to the owner.

## Round 2 — re-audit of the fix diff against `4cc132a` (2026-09-15): COMPLIANT

- The MAJOR is resolved: the three clauses stand in Art. VI.1 and Art. IX.3 `Jaarplan` in the wording of `f5804bc`
  (lines 428 and 433), where the pointer in Art. XIV sends the reader.
- The fix diff adds no CRITICAL or MAJOR: the restored confirmation notes point to existing questions (1, 4, 13, 14)
  and assume no answer; removing `announce()` leaves nothing dangling; the board suite passes (84/84).
