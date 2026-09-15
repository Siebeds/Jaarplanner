# FB-017 browser pass

2026-09-15, branch `ticket/FB-017-activiteiten-in-zijbalk`, worktree `fb-017-activiteiten`.

**Setup.** API built from the worktree into `bin-run` on port 5192 against a throwaway database `jp_fb017` (all
migrations applied, Development demo seed), Vite on 5193 proxying to it. Test data made through the API as directie:

- a klas "K3 zon (test)";
- three K3 subthema's:
  - Druppels, under Water, with three activiteiten and a subthemaperiode from 14 to 25 September;
  - Schaduwen, under Licht en donker, with two activiteiten;
  - Kleuren van het licht, empty;
- a hoek "Waterhoek" in that klas;
- a gebruiker "Kijker (test)" with no right at all, who reads every klas and plans none (I9).

Fictional names only. Signed in through the development sign-in, first as `directie@jaarplanner.local`, and for L as
the kijker. Placements were cleared before the final run, so no check leaned on an earlier one's leftovers.

**Driver.** Headless Chrome over the DevTools protocol from Node, because the Playwright MCP browser was held by
another session. `Emulation.setDeviceMetricsOverride` gives a true 1440×900 and 390×844 (mobile) layout. Clicks and
drags are real `Input.dispatchMouseEvent` sequences, so dnd-kit's pointer sensor and the agenda's pointer listener
see what a mouse sends.

## Final run: all checks pass

| Check | Result | Evidence |
| --- | --- | --- |
| A. The Activiteiten switch opens the list on the subthema running in the week | PASS | select on Druppels, "Loopt in week 38", 3 cards |
| B. The list offers only this klas's leeftijd, grouped per thema | PASS | groups: Licht en donker (2), Water (1) |
| C. A card dragged to Tuesday lands where it is carried | PASS | aimed at 11:00; preview and block both 11:00–11:50 |
| D. A clicked card opens the sheet on the day on screen and is planned on Wednesday 9:00 | PASS | sheet started on 15 September; block on the 16th at 9:00 |
| D2. Planning the same again is refused, and the sheet keeps the server's reason | PASS | "Deze activiteit begint al om 9:00 op 16 september 2026. …" |
| J. An existing block, picked up in its lower quarter, moved to Thursday 13:00 | PASS | preview 13:00–13:50, block at 13:00 |
| K. A hoekfiche dropped on Friday 10:00 opens its sheet on that hour | PASS | Van = 10:00 |
| E. Choosing another subthema swaps the cards and drops "Loopt in week …" | PASS | |
| F. An empty subthema says so; the tile opens "Nieuwe activiteit"; Escape returns focus to the tile | PASS | focus on "Activiteit toevoegen" |
| G. From the list, Tab reaches the first card, with a visible focus ring | PASS | outline solid 2px |
| H. A week with no subthema says so and offers the list on "Kies een subthema" | PASS | "In week 46 loopt er geen subthema." (9–15 November) |
| I. Phone: chip, sheet, card; the placement sheet replaces the panel sheet; the card is planned | PASS | one dialog at a time, scrollWidth 390 |
| L. Read-only gebruiker at 1440: the Activiteiten switch, cards without controls, no fiche switches, no tile | PASS | the only button in the panel is "Activiteiten sluiten" |
| L. Read-only gebruiker at 390: only the Activiteiten chip | PASS | no fiche chips |
| Console free of errors and warnings | PASS | |

## Found on the way and fixed

**Grab offset (C, J, K).** The first runs landed a card 45 minutes below where it was carried: the overlay followed
the pointer at the card's grab offset, while the landing preview ignored that offset.

- **Cause:** `beginSleep` read the grab offset from `active.rect.current.initial`. dnd-kit fills that value in a
  layout effect that runs after `onDragStart`, so it was null on every drag and the offset was always 0.
- **Reach:** every drag in the agenda (blocks and fiches too). For the fiches the sheet asks the hour again, so it did
  not show. An activiteit card is planned on the drop, so for FB-017 it had to be fixed.
- **Fix:** `beginSleep` now measures the pressed draggable itself (`tijdsleep.ts`, covered by `tijdsleep.test.ts`).
- **Proof:** J and K confirm that existing blocks and hoekfiches land where they are carried after the fix.

**After the antagonist's first round:**

- The week is named by its number ("Loopt in week 38", "In week 46 loopt er geen subthema.").
- Nothing is said about the week until it has been read.
- A chosen subthema holds only for its klas and week.
- The owner ruled that whoever may only read the klas sees the cards read-only (check L).
