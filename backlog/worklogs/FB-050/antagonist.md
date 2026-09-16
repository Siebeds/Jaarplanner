# FB-050 antagonist audits

## Round 2: optional soort (current build)

Verdict: COMPLIANT, no CRITICAL or MAJOR findings. Covers the constitution amendment (Art. IX.2), the nullable
column and migration, the prompt change, the weekplanning records and the frontend.

MINOR findings:
- Round-1 worklogs described the replaced behaviour (a required soort). Fixed: moved to `ronde-1/`, marked superseded.
- No test covers a planned activiteit without a soort in the week view (`EfWeekplanningOpslag`, `WeekplanningService`,
  `Activiteitkiezer`). Left open; the round-2 browser pass placed one in the agenda and the week view loaded
  (`test-report-2.md`, `r2-desktop-8`).
- The constitutie-log row is worded more briefly than its neighbours. Left as is; the content is complete.
- Question for the owner: an FR-1 re-import that matches an activiteit whose soort was cleared writes the import's
  soort over it, as it does for every activiteit attribute.

## Round 1: required soort (superseded)

COMPLIANT. That build made the soort required; the owner then ruled the soort optional, and the build was replaced.
The report and screenshots of that round are in `ronde-1/`.
