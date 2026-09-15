# Antagonist review: FB-001, round 2 (fix round 1)

*Saved by the orchestrator, because the antagonist has no write tool. The report is condensed; how each finding was
handled is in `implementatie-frontend.md` (fix round 2).*

- **Verdict:** VIOLATIONS FOUND. 0 CRITICAL, 0 MAJOR, 5 MINOR, 0 QUESTION. The round 1 MAJOR is resolved.
- **Scope audited:** `git diff 2285acd..HEAD`, 23 files: `fcdf50a` and `7cdefc9` on `ticket/FB-001-kinderen-van-de-klas`.

## Round 1 findings, checked

| # | Status |
| --- | --- |
| 1 (MAJOR) | **Resolved.** All four `KlasWeergave` construction sites pass `Leerling.KlasKanLeerlingenHebben`, the record defaults to `false`, `/api/klassen` returns it, and the screen filters on it. No production TypeScript compares a jaarfase to "K3". |
| 2 | Resolved. |
| 3 | Resolved. |
| 4 | Resolved. Not run by the antagonist: the Postgres tests skipped without a connection string. |
| 5 | Partly resolved. The fix round 1 gate results were recorded nowhere (B). |
| 6 | Partly resolved. The browser record predates the fix, the safe-area question is open, and no contrast was measured (C). |
| 7 | Resolved. |
| 8 | Resolved, but a test name was left stale (D). |
| 9 | The branch was added, but its condition does not prove its sentence (E). |
| 10 | Resolved. |
| 11 | Resolved. `git check-ignore` matches the pattern, and no tracked file became ignored. |
| 12 | Resolved: the owner ruling is recorded. |

**The reflog and secrets:**

- `acecf2e` has no ref or reflog entry left. It remains only as an unreachable object, which cannot be pushed.
- No secret is in the tree or in either new commit.
- The new records hold invented names only.

## Findings

- **[MINOR] A.** The menggroep test pins only one direction of "follow the server". A klas stated as K3 that the server
  says cannot hold children is missing, so `jaarfase === "K3" || kanLeerlingenHebben` would still pass every test.
- **[MINOR] B.** The fix round 1 gate results are recorded nowhere, and the record points at the audit instead, which
  is circular.
- **[MINOR] C.** Three gaps:
  - the browser record predates the fix and still quotes the old no-access sentence;
  - the safe-area question is still open: `viewport-fit=cover`, the phone card and the sticky `Schermkop` below it each
    pad the inset;
  - no contrast was measured.
- **[MINOR] D.** The test name "zegt … voor wie het is" describes the old sentence.
- **[MINOR] E.** "Er is nog geen schooljaar." and "Dit schooljaar heeft geen klas …" also appear when a load failed:
  `useActieveSelectie` hides the error behind empty lists. The new branch is also untested.

## Checks the antagonist ran

- `dotnet build`: 0 warnings;
- `dotnet test` UnitTests: 1561 passed, 4 skipped;
- `dotnet format --verify-no-changes`: exit 0;
- `pnpm lint`: clean;
- 5 vitest files, 267 tests;
- `tickets.mjs check`: 0 errors.

**Not reproduced by the antagonist:** the integration suite, because `JAARPLANNER_TEST_POSTGRES` was not set.

## Open questions surfaced

- **Graadklassen (Art. XIV, question 14).** When directie decides, re-read two texts that speak of "K3":
  - `geenK3Klas` / `geenEigenK3Klas`;
  - the ADR-0030 note on Leerlingzorg reading "every K3 klas's names".
- **Carried over:** FB-003 must make the delete confirmation's promise true, and FB-008 puts Leerlingzorg on the read
  row.
