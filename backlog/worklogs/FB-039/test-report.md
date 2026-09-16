# FB-039 — Test report (round 1)

**Verdict:** FAIL
**Mode:** Playwright (playwright-core driving local Chrome, headless) + Vitest

Build under test: `ticket/FB-039-stroken-toegankelijk` @ `3479c9c`. API on :5191 against the throwaway database
`jaarplanner_fb039` (demo seed plus test subthema's "Onze klasafspraken", "Vriendschap", "Mijn sterke kanten" under
"Ik en mijn klas", September 2026, and "Op reis" under "Zomer en vakantie", 10–21 May 2027). Vite on :5271.
Signed in as `directie@jaarplanner.local`.

## Criteria checked
- "Boven de agenda staat geen rij met het thema en het subthema" (week, dag, maand) → PASS. At 1440px and at 390px the
  heading row is followed directly by the grid in all three views, and no link to `/themas/…` sits outside the day
  headings. Screenshots: `desktop-week.png`, `desktop-dag.png`, `desktop-maand.png`, `mobiel-week.png`, `mobiel-dag.png`,
  `mobiel-maand.png`.
- "Klik op een themastrook of subthemastrook opent de themapagina (FB-037)" → PASS. A click (desktop) or tap (390px)
  on the subthema strip goes to `/themas/344be461…?subthema=545a5fc3…`. On arrival only "Onze klasafspraken" has
  `aria-expanded=true`. Screenshots: `desktop-klik-themapagina.png`, `mobiel-klik-themapagina.png`.
- "Aanraakdoel minstens 24 px hoog, ook op ~390px" → PASS. `getBoundingClientRect().height` is 24 for every visible
  strip link: week 16/16, day 2/2, month 57/57 (1440px); 390px week 6/6 (about 89px wide), day 2/2. The phone month
  draws no strips, as designed.
- "Tab door de dagkoppen: elke strook krijgt een zichtbare focus, Enter opens the same page as a click" → PASS.
  Week of 7 Sep: stops are the day button, then "Open thema Ik en mijn klas" and "Open subthema Onze klasafspraken"
  (Monday), then a stop only where a run starts. Blank strips have `tabindex=-1` and `aria-hidden`. The focus style is
  `outline: solid 2px rgb(18,108,120)`, offset -2px, with `:focus-visible` true. No overflow ancestor clips it in the
  week, day or month view (`desktop-week-focus.png`, `desktop-maand-focus-1.png`). Enter lands on the same URL with the
  same chapter open (`desktop-enter-themapagina.png`). At 390px every one of the 3 days is a stop, and Tab and Enter
  work the same way (`mobiel-week-focus.png`, `mobiel-enter-themapagina.png`). Accessible names: "Open thema {naam}"
  and "Open subthema {naam}", both from `nl.json`.
- ADR-0045 decision 3 (closed Monday) → PASS. In the week of Pinkstermaandag (17 May 2027), Tuesday carries
  "… Zomer en vakantie" and "… Op reis" and holds both tab stops (`desktop-pinkstermaandag-week.png`).
- "Verder verandert er niets aan de agenda" (orchestrator check 5: month cells with 2–3 strips keep readable
  activity chips) → **FAIL**. See the defect below (`fb039-maand-chips.png` against `main-maand-chips.png`).
- "Nagekeken in een echte browser op desktop en op ~390px, ook met het toetsenbord" → done (this report).

## Commands run
- `dotnet ef database update` (throwaway DB) → OK; `dotnet build -o bin-run` → 0 errors
- API :5191 `/health` → 200; Vite :5271 → 200; proxy `/api/klassen` → 401 (healthy)
- `pnpm exec vitest run Themastroken Subthemastroken Tijdraster` → 3 files, 61 tests passed
- Playwright scripts (scratchpad) for the measurements, the Tab walk, Enter, click and tap
- Baseline: `git archive main frontend`, served temporarily on :5271 against the same API and data, for the month comparison

## Evidence
- Browser console: no errors or warnings during the runs.
- Month-cell measurements at 1440px, same data (cell height 112px):

| cell | slots | main: list height / fully visible | FB-039: list height / fully visible |
|---|---|---|---|
| 7 Sep (thema + 1 subthema, 2 activities) | 2 | 42px / both chips | 27px / 1 chip, the other a clipped sliver |
| 8–16, 21, 28, 29 Sep (thema + strip + "+2", 3 activities) | 3 | 25px / "nog 1" | **3px / nothing** |

## Defects (these go back to the implementer)
- [MAJOR] **The month view hides the activity chips on days with a subthema.** A slot now takes 24px instead of 17px,
  and the month cell stays 112px tall (`sm:h-28`, `Maandrooster.tsx`). Its `ul` (`flex-1 overflow-hidden
  justify-end`) keeps only what is left over.
  Repro: open `/agenda/dag/2026-09-14?weergave=maand` at 1440px on a day with a thema, a subthema strip and 2–3
  planned activities.
  Expected, as on main: 2 chips (or a chip and "nog N") are readable.
  Actual: with 3 slots the list is 3px tall, so no chip and no "nog N" shows, and the day looks empty. With 2 slots
  (thema + 1 subthema, the normal case inside a subthema period) only 1 of 2 chips shows, and the top edge of the
  other shows as a clipped sliver.
  This breaks "Verder verandert er niets aan de agenda". ADR-0045 "Consequences" names the cost ("a month cell gives up
  the same from its 112 px") but does not handle it. A fix has to leave room for the chips, for example a taller cell
  when it draws strips, or fewer slots in the month (the ADR allows the rest to be reached through the day). Re-verify
  at 2 and 3 slots.

## Notes (not blocking)
- With 3 overlapping runs only the first subthema gets a strip, and "+2" leads nowhere. On such days the other
  subthema's are reachable from the agenda by neither pointer nor keyboard. This is behaviour from before FB-039
  (FB-037), not a 2.1.1 gap, but it qualifies ADR-0045's "a keyboard reaches each … subthema chapter from the agenda".
- Planning an activity of a subthema on a day extends that subthema's strip to that day. That behaviour predates
  FB-039 and is only why the test data shows long runs.

## Re-check (round 2)

**Verdict:** PASS
**Mode:** Playwright (playwright-core driving local Chrome, headless) + Vitest

Build under test: `ticket/FB-039-stroken-toegankelijk` @ `a3c510d` (a frontend-only fix, so the round 1 `bin-run` API still
applies). API on :5191 against `jaarplanner_fb039`, Vite on :5271, signed in as `directie@jaarplanner.local`. Extra
test data for a row whose largest day has exactly 2 slots: two activities of "Op reis" ("Koffer inpakken" and
"Reisroute tekenen") planned on 12 May 2027, inside that subthema's own period.

### Defect re-checked
- [MAJOR] "The month view hides the activity chips on days with a subthema" → **FIXED.** Measured at 1440px, same method
  as round 1 (a chip counts only when it is fully inside its list):

| cell | slots (most in row) | cell height | list height | fully visible | main (round 1) |
|---|---|---|---|---|---|
| 12 May 2027 | 2 (2) | 127px | 42px (41.95) | "Koffer inpakken", "Reisroute tekenen" | 42px, 2 chips |
| 8, 9, 10, 14, 15, 16, 21, 28, 29 Sep 2026 | 3 (3) | 134px | 25px | "nog 1" | 25px, "nog 1" |
| 7 Sep 2026 | 2 (3, from its row) | 134px | 49px | both "Kringgesprek" chips | 42px, 2 chips |

  The 3-slot cells look as they do on main, including the top edge of the first chip above "nog 1"
  (`recheck-maand-chips.png` against `main-maand-chips.png`). The 2-slot cell is `recheck-mei-2slots.png`.

### Side checks
- Row heights follow the row's largest day: 0 slots → 112px (week of 9 Nov 2026 and week of 4 Jan 2027), 1 → 120px,
  2 → 127px (weeks of 10 and 17 May 2027), 3 → 134px (September 2026). Every cell in a row has the same height
  (`recheck-nov-zonder-stroken.png`).
- Strips still 24px: every visible strip link measures 24px (September 57/57, May 42/42, November 35/35).
- Focus ring in a month cell is not clipped: Tab from "Vandaag" reaches "Open thema Ik en mijn klas" (1 Sep, then 7 Sep).
  Both have `outline: solid 2px`, offset -2px, `:focus-visible` true, and the ring lies wholly inside the cell with no
  clipping ancestor (`recheck-maand-focus-0.png`, `recheck-maand-focus-1.png`).
- 390px month view unchanged: cells 64px, no strips, and the screenshot of `/agenda/dag/2026-09-09?weergave=maand` is
  byte-identical to round 1's `mobiel-maand.png` (sha1 `4ea9a2e63c28…` for both; `recheck-mobiel-maand.png`).
- Browser console: no errors or warnings.

### Commands run
- API :5191 `/health` → 200; Vite :5271 → 200; proxy `/api/klassen` → 401 (healthy)
- `pnpm exec vitest run Maandrooster Themastroken Subthemastroken Tijdraster` → 4 files, 66 tests passed
- Playwright scripts (scratchpad): the month measurement, a scan of Oct 2026 to Jun 2027 row heights, the Tab walk, the 390px comparison

### Evidence
- `recheck-maand-chips.png`, `recheck-maand-volledig.png`, `recheck-mei-2slots.png`, `recheck-nov-zonder-stroken.png`,
  `recheck-maand-focus-0.png`, `recheck-maand-focus-1.png`, `recheck-mobiel-maand.png`
