# Antagonist review: FB-001, round 5 (fix round 4) and overall verdict

*Saved by the orchestrator, because the antagonist has no write tool. The report is condensed.*

- **Verdict:** COMPLIANT.
- **Scope audited:**
  - `git diff 1df6d4d..HEAD`: the one commit `8a54bf9`, with 4 files and no product change;
  - the whole branch at `8a54bf9` against merge-base `3ac98b4` (63 files).

## Finding I (round 4): resolved

The rewritten doc comment of `fout` in `selectie.ts` was checked with a Node probe against the installed
`@tanstack/query-core` 5.102.0. The probe had the schooljaren query rejecting while the klassen query never resolved.

| Clause | Probe result |
| --- | --- |
| "failed to load the first time, so it has no data at all and reads as empty" | holds: `isLoadingError: true`, `data === undefined` |
| "`laadt` can be true at the same moment" | holds: `fout: true`, `laadt: true` |
| "A failed refetch does not count" | holds: `isRefetchError: true`, `isLoadingError: false`, the data kept |

- The only consumer that reads `fout` checks `laadt` first and `fout` after, as the comment says.
- Nothing else changed.
- No secret or stray file is in the commit.

## Overall: every finding from rounds 1 to 4

| Round | Findings | Status |
| --- | --- | --- |
| 1 | 1 MAJOR, 9 MINOR, 1 QUESTION | The MAJOR is resolved; the QUESTION was decided by the owner; the partly resolved MINORs came back as round 2's A to E. |
| 2 | 5 MINOR (A to E) | All resolved; E's fix introduced F. |
| 3 | 3 MINOR (F, G, H) | All resolved, verified with mutation tests. |
| 4 | 1 MINOR (I) | Resolved. |

## Gates run by the antagonist at HEAD

- **Frontend:**
  - `pnpm lint` exits 0;
  - vitest: 66 files, 653 tests passed.
- **Backend:**
  - `dotnet format --verify-no-changes` exits 0;
  - UnitTests: 1561 passed, 4 skipped.
- **Integration**, reproduced by the antagonist for the first time: `LeerlingEndpointsTests`, `RechtenEndpointsTests`
  and `ElkeWijzigendeRouteVraagtEenRechtTests` against `postgres:17.5`. 30 passed, 0 failed, 0 skipped.
- **Tickets:** `tickets.mjs check` reports 0 errors.
- **Merge readiness:** `git merge-tree` against `main` shows 0 conflicts.

## Notes

- The ticket's "Open vragen" still reads as open. The owner's answers are in the Werklog, and the tester should be
  pointed there.

## Open questions carried over, not blocking

- a TB ticket for the five other screens that call an empty list "no klassen" without checking whether the load failed;
- re-reading `geenK3Klas` / `geenEigenK3Klas` once the graadklas question is decided;
- FB-003 and the delete confirmation's promise;
- Leerlingzorg on the read row in FB-008.
