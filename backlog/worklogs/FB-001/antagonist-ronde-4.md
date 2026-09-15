# Antagonist review: FB-001, round 4 (fix round 3)

*Saved by the orchestrator, because the antagonist has no write tool. The report is condensed.*

- **Verdict:** VIOLATIONS FOUND. 0 CRITICAL, 0 MAJOR, 1 MINOR, 0 QUESTION.
- **Scope audited:** `git diff 0d39af2..HEAD`, which is the one commit `1df6d4d`, with 8 files and no backend.

## Round 3 findings, checked by running something, not only by reading

| # | Status | Evidence |
| --- | --- | --- |
| F | Resolved, apart from finding I | See "F: what was checked" below. |
| G | Resolved | See "G: mutation results" below. |
| H | Resolved | The struck line points at the addendum, which exists above it. |

### F: what was checked

- **The query library.** In `@tanstack/query-core` 5.102.0:
  - `isLoadingError` is `isError && !hasData`;
  - a failed refetch keeps its data (`...state` in the `"error"` action), so it counts as `isRefetchError`, not as
    `isLoadingError`;
  - neither hook uses `select` or `placeholderData`.
- **The sentence under its render condition** (the E5-03 rule): "Het is niet gelukt deze pagina te laden. Herlaad de
  pagina." says no more than the condition proves. It names neither list and has no em dash.
- **The "first time" edge case:** the only other way to lose data is `queryClient.clear()` at sign-out.

### G: mutation results

The unchanged `selectie.test.tsx` was run against mutated copies of the hook:

| Mutation | Result |
| --- | --- |
| None | 4 of 4 pass |
| `fout: false` | caught |
| `fout` from the schooljaren only | caught |
| `fout` from the klassen only | caught |
| `isError` instead of `isLoadingError` | caught by the refetch test, which also proves it sees the render after the error |
| `&&` instead of `\|\|` | caught |

## Finding

### [MINOR] I. The doc comment of `fout` says "`laadt` is false then"

- **Why that is wrong:** it is false while the other list is still loading. A probe proved it: with the schooljaren
  failing and the klassen still pending, the hook gives `fout === true && laadt === true`.
- **Behaviour is not affected:** the screen checks `toegang && laadt` before `fout`.
- **The problem is the comment:** it tells the next consumer an implication that does not hold. The clause was rewritten
  in round 3 and was already present in round 2.
- **Required:** say only what `fout` guarantees, or strike the `laadt` clause.

## Checks the antagonist ran

- **Code and copy:** the one changed string is in `nl.json` with no em dash, and no Dutch literal was added to a product
  file.
- **Rights and pupil data:** no rights logic changed, and no child's name appears.
- **Secrets:** none.
- **Gates:**
  - `pnpm lint` exits 0;
  - the full vitest run: 66 files, 653 tests;
  - `tickets.mjs check`: 0 errors.
- **The commit:** exactly the 8 expected files.

## Open questions carried over

- the five other screens that call an empty list "no klassen" (a separate ticket, for the owner);
- re-reading `geenK3Klas` / `geenEigenK3Klas` once the graadklas question is decided;
- FB-003 and the delete confirmation's promise;
- Leerlingzorg on the read row in FB-008.
