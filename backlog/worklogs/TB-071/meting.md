# TB-071: render measurement before and after

Measured 2026-09-24 in headless Chrome over CDP, against `pnpm dev:mock` (the fixed mock agenda, week of 16 November
2026, 1440x900), `origin/main` before and this branch after. No React DevTools in a headless browser, so a stub
`__REACT_DEVTOOLS_GLOBAL_HOOK__` counts per commit every function component whose props or hook state changed
identity (a bail-out keeps both, so it is not counted). The same script drags the same block both times.

| Phase | Before | After |
|---|---|---|
| Drag starts (pointer past the 6px threshold) | Agendascherm 1, Schermkop 1, Dekkingsbalk 1, Hoekenpaneel 1, Tijdraster 1, Dagkolom 22, Blok 106 | Agendascherm 0, Schermkop 0, Dekkingsbalk 0, Hoekenpaneel 0, Tijdraster 0, Dagkolom 22, Blok 106, Sleepoverlay 1 |
| Three moves inside one quarter | Dagkolom 3, Blok 24, Landingsvak 3 | Dagkolom 0, Blok 3 (the dragged block's own transform), Landingsvak 0 |
| 15 moves across four quarters | Dagkolom 15, Blok 120 | Dagkolom 4, Blok 43 |
| Drop (the save re-renders the screen through its mutation) | Agendascherm 3, Dagkolom 28, Blok 128 | Agendascherm 3, Dagkolom 35, Blok 160 |
| Cancel with Escape | Agendascherm 1, Schermkop 1, Dekkingsbalk 1, Hoekenpaneel 1, Tijdraster 1, Dagkolom 14, Blok 64 | Agendascherm 0, Schermkop 0, Dekkingsbalk 0, Hoekenpaneel 0, Tijdraster 0, Dagkolom 14, Blok 64 |
| Minute clock tick (week of today) | Tijdraster 1, Dagkolom 7 | Tijdraster 1, Dagkolom 7; the overlap layout (`kolommen`) is no longer recomputed (unit test) |

What remains on a drag start and a cancel is dnd-kit itself: every `useDroppable` and `useDraggable` reads its internal
context, which changes when a drag becomes active or ends, so every column and block renders once there. Stopping that
would need `React.memo` plus a different subscription, which the measurement does not justify for a once-per-drag
cost. The drop row is one run each way and was not investigated further: the drop saves, and its mutation re-renders the
screen before and after this change alike. Both runs moved the block to the same place.

Behaviour in the same runs, identical before and after: the dragged block (8:30-9:20) dropped 69px lower landed at
9:45-10:35; Escape put the block back and removed the overlay; the name followed the pointer during the drag; a month
card dragged one cell right moved to that day; the now-line label went from one minute to the next; the week at 390px
renders its three days.

## Antagonist

COMPLIANT, one round. MINOR findings left open: the drop row is a single run each way (above); `naamVan={sleepnaam}`
is a new function each render, so the monitor in `Sleepoverlay` re-registers when the screen renders (harmless); the
overlay test finds the overlay by its classes (`.shadow-lg.truncate`) rather than by a role or test id.
