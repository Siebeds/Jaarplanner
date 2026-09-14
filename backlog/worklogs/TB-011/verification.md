# TB-011 — verification

Ticket: `backlog/technische-backlog/TB-011-hoekmoment-verplaatsen-weigert-een-dag-zonder.md`
Branch: `ticket/TB-011-hoekmoment-schooldag`

## What changed

- `Hoekplaatsing.VerplaatsMoment` takes the class's `Schooljaar` and refuses a day without school (a weekend day or a
  closure) with *"Op die dag is er geen school. Kies een schooldag."*, the sentence
  `AlgemeneFicheplaatsing.VerplaatsMoment` already gives. The window and same-start checks still run first.
- `HoekplaatsingService.VerplaatsMomentAsync` loads the klas and its schooljaar, as `AlgemeneFicheplaatsingService` does.
- Documentation: `IHoekplaatsingService`, `frontend/src/features/hoeken/gegevens.ts`, and the comments on both
  `VerplaatsMoment` methods. No production frontend code changed.

## Gates

| Gate | Result |
| --- | --- |
| Backend unit tests | 1135 passed, 4 skipped (live-contract tests); after the round-1 fixes the Planning subset, 316 passed |
| Integration tests on PostgreSQL (`JAARPLANNER_TEST_POSTGRES`, container on 5433) | 357 passed, 1 skipped (live KOV import) |
| `dotnet format backend/Jaarplanner.sln --verify-no-changes` | exit 0 |
| `pnpm lint` (oxlint + tsc) | exit 0 |

## Antagonist, round 1: VIOLATIONS FOUND

1. **MAJOR: "the grid already refuses that drop" was false for weekends.** The week view (desktop) and the month grid
   run Monday to Sunday, the server sends a Saturday as `isLesdag: true` (`Weekplanningweergave.cs`), and a column is
   only disabled on `!isLesdag`. So dragging a hoek block onto a Saturday wrote a Saturday row before this change.
   Resolved:
   - The comments in `Hoekplaatsing.cs` and `AlgemeneFicheplaatsing.cs` now say the grid refuses a closure only.
   - The ticket text is corrected, with a correction note and a Werklog line.
   - The first commit message (`a54268d`) repeats the false claim; the correcting commit says so.
   - The owner chose a browser check without a Vitest test. No agenda test simulates a drop today, and building that
     harness is outside this ticket.
2. **MINOR: stale lists of refusals** in `IHoekplaatsingService` and `useVerplaatsHoekmoment`. Resolved.
3. **MINOR: no test pinned the order of the checks.** `HoekplaatsingTests` now asserts that Saturday 19 December,
   outside the window and without school, gets *"Die dag valt buiten de periode van de hoek."* Resolved.

Open question the antagonist raised, **whether a weekend is a school day**: the owner left it with E9-02 on
2026-09-14. No new work.

## Browser check (2026-09-14)

Setup:
- API `bin-run` on port 5186 and Vite on port 5178, both from the worktree.
- A throwaway database `jp_tb011_browser` on the local container, migrated and seeded by the demo seeder.
- Signed in as `directie@jaarplanner.local` through the development sign-in.
- Hoek "Bouwhoek TB-011" placed through the API, 10:00–10:50.

1. **Placement 14–18 September; the Tuesday block dragged onto Saturday 19 September** (outside the window): 400,
   *"Die dag valt buiten de periode van de hoek."* The window rule speaks first, as intended.
2. **Placement 21 September – 2 October; the Tuesday 22 block dragged onto Saturday 26 September** (inside the window),
   at 1440×900: `PUT …/momenten/…` answered 400, detail *"Op die dag is er geen school. Kies een schooldag."* The
   agenda's message strip holds exactly that sentence, read from the DOM (`p.bg-attentie-zacht`): at this width the
   strip sits below the fold, and the screenshot shows only a clipped sliver of it. The block stays on Tuesday: block
   x-positions were equal before and after, and the Saturday column stayed empty, which is what
   `zaterdag-geweigerd-1440.png` shows. The 390 screenshot below shows the sentence legibly.
3. **The same at 390×844**, where the three-day week is anchored on Friday 25: the Friday block dragged onto Saturday 26
   gives the same 400 and the same sentence in the strip, and the block stays. No horizontal scroll (scrollWidth 375 =
   clientWidth 375). Screenshot: `zaterdag-geweigerd-390.png`.

## Observed, outside this ticket (reported to the owner, not built)

- **The drag announcer says the move succeeded when the server refused it.** After the refused drop the live region
  read *"Bouwhoek TB-011 op zaterdag 19 september gezet"*. dnd-kit announces the drop before the server answers. The
  cause is in the shared `kalenderMeldingen` path, so it applies to every refused move (activiteit, fiche, hoek), not
  only to this rule.
- **The message strip sits below the time grid**, under the fold at both widths (y ≈ 890 of 900 on desktop, 907 of 844
  on a phone). A teacher who drops a block sees nothing happen unless she scrolls. This is the existing layout of the
  strip.

All data in the screenshots is the demo seeder's fictional data.
