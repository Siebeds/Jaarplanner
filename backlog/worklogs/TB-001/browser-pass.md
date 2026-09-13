# TB-001 — browser pass on the backlog board

2026-09-13, the locally installed Chrome, headless, driven over the DevTools protocol, against a throwaway demo repository built
for the purpose (tickets in every column: two on `main` only, one moved to *in-uitvoering* on an unmerged branch, one
with a final status on an unmerged branch, one with an uncommitted, blocked edit in a worktree, one invalid ticket and
a `README.md` in a ticket folder). The board also ran against the real repository on port 5199, where TB-001 showed
first as an uncommitted worktree edit and, after the first commit, from the branch `feature/ticket-backlog`.

## What was checked, and what it showed

| Check | Result |
| --- | --- |
| Columns at 1440×1000 | All six fit without horizontal scroll (`scrollWidth > innerWidth` is false) after the column minimum went from 250px to 200px. **Before the fix the *Klaar* column was cut off at 1440px**: found by looking, not by any test. |
| Placement | Nieuw FB-002, FB-003 · In uitvoering FB-004 (worktree, uncommitted), FB-001 (branch) · In review TB-002 · Te testen FB-005 · Klaar FB-006, TB-001 · invalid strip FB-007. `README.md` not shown. |
| 390×844 | Columns stack; no horizontal overflow (`scrollWidth` 390); the drawer is 390 wide with no inner overflow. |
| Keyboard | From the search field, Tab reaches the invalid-strip link, Enter opens the drawer (hash becomes the ticket id), Escape closes it and focus returns to the control that opened it. |
| Deep link | `#FB-001` opens the drawer on load. |
| Filter / search | *Technisch* shows only TB-002 and TB-001; searching "woordenschat" shows only FB-004. |
| Live update | Clearing `geblokkeerd` in the worktree file removed the card's *Geblokkeerd* flag within one poll, in the same document (no reload). |
| Dark mode | `prefers-color-scheme: dark` paints `rgb(20, 23, 27)`; board and drawer screenshots taken. |

## Found and fixed during the pass

1. **Six columns did not fit at 1440px** (above).
2. **A wrapped acceptance criterion ran under its checkbox** in the drawer; the box now hangs in the list indent.
3. **A remembered search hid cards on the next visit.** The first run left "woordenschat" in `localStorage`, and the
   second run opened on a board showing one card. The search is no longer persisted; the kind filter still is.
4. **Control borders measured 2.09:1** (search field, kind toggle, "Toon alle"), under the 3:1 WCAG 1.4.11 asks.
   A `--control` token now gives 4.45:1 on white in light and 3.40:1 on the card in dark.

## Contrast, computed from the tokens (solid colours; the one tint is composited)

Light: body text on card 16.18, muted text on card 6.38 and on the column 5.26, kind tags 6.42 (FB) and 5.26 (TB),
blocked flag 5.58, warning flag 5.75, muted text on the composited flag tint 5.51, the kind bars against the card 7.54
and 6.13. Dark: every pair above is between 6.23 and 12.30.

## Rerun on the audit fix rounds

The same pass was run twice more against the demo repository, rebuilt each time for the current format (TB gained
*Open vragen*): once on `8543ff9` (round-1 fixes), and once on the round-2 fixes, with one ticket extended so its
*Gewenst gedrag* holds a code span inside a link (`` [`FB-004`](https://example.com/fb-004) ``), the case round 2
found broken in the renderer.

| Check | Result on the round-2 code |
| --- | --- |
| Placement, 1440×1000 | Unchanged from the first pass: Nieuw FB-002, FB-003 · In uitvoering FB-004, FB-001 · In review TB-002 · Te testen FB-005 · Klaar FB-006, TB-001 · invalid strip FB-007; no horizontal overflow |
| Code span inside a link | The drawer renders `<a href="https://example.com/fb-004">` around `<code>FB-004</code>`; no private-use placeholder character anywhere in the drawer text |
| Keyboard, deep link, filter, search | Unchanged: Tab reaches the invalid-strip link, Enter opens, Escape closes with focus returned; `#FB-001` opens; *Technisch* shows TB-002 and TB-001; "woordenschat" shows FB-004 |
| 390×844 | No overflow on the board (`scrollWidth` 390) or in the drawer (390 wide) |
| Dark mode, live update | Unchanged: dark ground `rgb(20, 23, 27)`; clearing `geblokkeerd` on disk removes the flag without a reload |
| Malformed request | `GET http://a:99999/` with a valid Host header gets `400 Bad Request`, and the next `/api/board` request still answers 200 |

A third run on `723dd55` (after audit round 8, the last fix round that touched the board: later rounds changed only
the CLI and the documents, not `server.mjs`, `lib/` or `public/`), on a freshly rebuilt demo repository and a
restarted server, gave the same results on every row of the table above.

The screenshots below are from the first pass; the layout did not change in the fix rounds.

## Screenshots

`board-1440.png`, `board-390.png`, `board-dark.png`, `detail-1440.png`, `detail-390.png`,
`detail-keyboard-1440.png` (the invalid ticket's drawer, opened from the keyboard).
