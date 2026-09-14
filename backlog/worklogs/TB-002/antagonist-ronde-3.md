# TB-002 / E10-03 agenda half: antagonist round 3

- **Audited:** `4f102c0..1d6e34f` on `story/E10-03-agenda`, 2026-09-14.
- **Verdict:** VIOLATIONS FOUND. 2 MINOR. All five round-2 items were resolved.

| # | Severity | Finding | Resolution |
| --- | --- | --- | --- |
| 1 | MINOR | The round-2 error branch is gated on `isError`. In TanStack Query v5 that is also true when a background refetch fails while data is still cached. After every placement the fiche list is refetched with the panel still open, so a failed refetch would swap the list she was dragging from for "Deze lijst kon niet geladen worden." | `mislukt` is now `isError && data === undefined` for both lists. A test loads the list, makes the refetch fail, and asserts that the fiches stay visible and the message does not appear. |
| 2 | MINOR | The ADR-0029 decision 7 note said that on a phone too, each switch opens "the same side column" and that the other one swaps the list. Below `lg` the chip opens a sheet, and the sheet covers the chips. | The note is narrowed. From `lg` the list opens in the side column, where the switches close or swap it; on a phone the chip opens the list as a sheet. It stays an appended note; decision 7 itself is unchanged. |

**Checks the auditor re-ran itself:**
- Vitest on the affected frontend test files: green. Round 3 gave a count without naming the files and round 4 could
  not reproduce it, so the figure is left out rather than kept unverifiable.
- `pnpm lint`: clean.
- `AlgemeneFicheplaatsingTests`: 8/8.
- `dotnet format --verify-no-changes` on the changed C# files: exit 0.
