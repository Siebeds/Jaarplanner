# TB-002 / E10-03 agenda half: antagonist round 4

- **Audited:** `1d6e34f..db1383a` on `story/E10-03-agenda`, 2026-09-14. This was the final round and covered only the fixes for round 3's two findings.
- **Verdict:** COMPLIANT. No findings.

**Verified by the auditor:**
- **Failed refetch keeps the loaded list.** A failed background refetch no longer hides a list that had loaded. Switching class cannot show the previous class's list, because neither query uses `placeholderData`. The new test would have failed on the old code: the auditor traced the timer order in Testing Library and TanStack Query to confirm it.
- **ADR-0029 note matches the code.** From `lg` there is a side column in which the switches close or swap the list; on a phone the list opens as a sheet. The note is not on `main`, so correcting it in place on this branch does not rewrite a decision.
- **Gates, re-run by the auditor:**

  | Check | Result |
  | --- | --- |
  | `pnpm lint` | clean |
  | Full Vitest | 38 files / 258 tests |
  | `dotnet format --verify-no-changes` on the changed C# | exit 0 |
  | `AlgemeneFicheplaatsingTests` | 8/8 |
  | `tickets.mjs check` | 0 errors |

**One optional note:** round 3's worklog quoted "19/19" without naming the files. The figure was removed.

**The whole run:**

| Round | Result |
| --- | --- |
| 1 | 2 MAJOR, 5 MINOR, 2 questions |
| 2 | 4 MINOR, 1 question |
| 3 | 2 MINOR |
| 4 | COMPLIANT |
