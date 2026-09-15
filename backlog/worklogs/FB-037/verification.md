# FB-037 — browser verification

- **Date:** 2026-09-15, session `stroken-doorklik`.
- **Build:** branch `ticket/FB-037-stroken-doorklik` at f0c924e; API built into `bin-run` from the worktree on port 5185,
  Vite on 5177 proxying to it.
- **Database:** throwaway copy `jp_fb037` of the dev database (machine B, Docker), migrated to the latest migration.
  Seeded through the API as directie: two L3 subthema's under "Ik en mijn klas" ("Wie zit er in de klas", "Onze
  klasregels"), the first planned for the L3 klas from 14 to 25 September 2026. No pupil data involved.
- **Tool:** headless Chrome over CDP from a Node 24 script (the Playwright MCP profile is shared between sessions).
  Clicks are real `Input.dispatchMouseEvent` presses, the tap at 390 a real `Input.dispatchTouchEvent` with touch
  emulation, the keyboard pass real `Tab`/`Enter` key events. Contrast composites every ancestor background on a 1×1
  canvas. Light mode is set explicitly: this machine's headless Chrome reports dark by default, and the first run's
  "light" figures were dark ones; the second run below measured both.

## Result: 35 of 35 checks green

| Check | Result |
| --- | --- |
| Week 1440: thema band is a link on every teaching day | 7 links |
| Week 1440: subthema strip is a link on every day of the run | 7 links |
| No strip link in the tab order | every `tabIndex` −1 |
| Subthemabalk holds the thema link and the subthema link | "Open thema Ik en mijn klas", "Open subthema Wie zit er in de klas op de themapagina" |
| Balk links at least 24×24 | 117×32 and 28×28 |
| Click the subthema strip on a Wednesday (no name printed) | `/themas/{thema}?subthema={id}` |
| Themapagina: requested chapter open, focused, in view; the other shut | open, focus, top 513 px of 900; "Onze klasregels" shut |
| Back button | same week, `/agenda/dag/2026-09-16` |
| Click the thema band on a Thursday | `/themas/{thema}` |
| Keyboard: Tab through the agenda | no focus inside an `aria-hidden` band; thema link reached at stop 14, subthema link after it |
| Enter on the balk's subthema link | opens the subthema |
| Month 1440: balk above the month, links in the cells | 12 subthema and 31 thema links; click opens the subthema; back returns to the month |
| Day 1440: both bands are links | click on the thema band opens the thema |
| Three thema's in one period (9 Nov) | band "Licht en donker +2" opens Licht en donker; all three in the balk |
| Period without a thema (13 Jan 2027) | "Nog geen thema" band has no link |
| Contrast, light | thema band 10.82:1 at rest, 8.27:1 on hover; subthema strip 5.02:1 and 10.82:1; underline on hover |
| Contrast, dark | thema band 7.66:1 and 5.58:1; subthema strip 6.01:1 and 7.66:1 |
| 390 week: strip links in view, no horizontal scroll, a real tap opens the subthema | 6 links; 390 = 390; opens |
| 390 month: balk present, no horizontal scroll | 390 = 390 |
| Console | no errors |

## Looked at

Screenshots of the week, the hovered strip, the month, the day, three thema's in one period and the themapagina, at
1440 in light and dark and at 390. The rail reads as thema, then its subthema cards; on the month it also names the
thema of the October days at the end of the grid ("Herfst en oogst"). After a mouse click or a tap the focused
chapter shows no focus ring; after the keyboard route it does.
