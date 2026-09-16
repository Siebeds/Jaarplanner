# ADR-0045 — The agenda's thema and subthema bands are 24 px targets and a keyboard's stop

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Project owner. On 2026-09-15 (FB-039) the owner had the subthemabalk above the agenda removed, the
  control ADR-0042 decision 3 relied on to meet WCAG 2.2 AA. On 2026-09-16, asked whether Art. VIII should get an
  exception for the bands or the bands should be made to comply, the owner chose **no exception**: the bands comply
  themselves.
- **Supersedes:** [ADR-0042](0042-stroken-openen-de-themapagina.md) decision 3 (the subthemabalk as the equivalent
  control) and the part of its decision 2 that keeps every band out of the tab order and the accessibility tree.
  ADR-0042 decisions 1, 4 and 5 stand.
- **Realises:** FB-039. **Constitution:** Art. VIII (WCAG 2.2 AA, unchanged, via [ADR-0017](0017-ui-ux-design-system.md)),
  Art. XII (no new hue), Art. II.3 (copy in `nl.json`). No article changes.
- **Backlog:** FB-039.

## Context

Every teaching day in the week and day views, and every day in the month grid, carries a thema band and up to two
subthema strips along its top edge. Since FB-037 each is a link to the themapagina, but a 16 px one, `aria-hidden` and
out of the tab order. That met SC 2.5.8 (target size) and SC 2.1.1 (keyboard) only through the subthemabalk, a row of
24 px links above the grid that did the same thing. FB-039 removed that row. Without it the bands fail both criteria,
and the menu Thema's is not an equivalent on the same page: it opens a list, not the thema or the subthema's chapter.

ADR-0042 weighed and rejected the two ways out that remain: 24 px bands cost height in every day heading and month cell,
and a tab stop per band per day puts forty stops in front of the grid. This ADR takes the first cost and avoids the
second.

## Decision

1. **Every band's link is a 24 px slot.** The link fills a 24 px tall slot the full width of the day, and the band is
   drawn 20 px tall along the top of it. Stacked slots abut, so no two targets overlap and each meets the 24 by 24 px
   minimum of SC 2.5.8 without relying on an exception. The 4 px under each band keeps the thema and the subthema
   visibly two bands.
2. **One tab stop per run per row: the band that prints the name.** That is the band on the day its period or run
   starts, on the first day of each week row, and on every day where no neighbour carries the name (the day view and a
   phone's three-day week). Such a band is focusable, in the accessibility tree, and named after where it goes:
   "Open thema {naam}" or "Open subthema {naam}". The name contains the visible label (SC 2.5.3). Enter follows the
   link, as for any link (SC 2.1.1). The blank bands beside it lead to the same page for a pointer, keep
   `tabIndex={-1}` and are `aria-hidden`, because the day's own button already speaks what runs on the day.
3. **A week whose Monday is closed names its bands on its first teaching day**, since a closed day draws no bands and
   would otherwise leave the week without a name and without a tab stop.
4. **The focus ring is the app's own**, drawn inside the slot (`outline-offset: -2px`), because the month cell clips
   what lies outside it.

## Consequences

- **Taller headings.** A band took 16 px plus a 1 px gap; it now takes a 24 px slot, drawn 20 px tall, so every day
  heading of the week and day views grows by about 7 px per band, and a month cell gives up the same from its 112 px
  (on `sm` and up; the phone's month shows no bands).
- **A keyboard reaches each thema and each subthema chapter from the agenda** in a handful of stops per week: one per
  thema and one per named run on the week's first day, plus one on every day a new run or period starts.
- **A second thema in one period** is still not a band of its own (ADR-0042 decision 4); it is reached through the menu
  Thema's, as the first one is also.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| **An exception in Art. VIII for the bands** | The owner declined it on 2026-09-16. |
| **Bring back the subthemabalk** | The owner had it removed (FB-039). |
| **A tab stop on every band** | Forty stops before the grid in a month, the cost ADR-0042 rejected. |
| **Visible bands 24 px tall** | The same height cost with heavier headings; the 4 px under a 20 px band keeps the thema and subthema apart. |
| **16 px bands spaced 24 px apart (the SC 2.5.8 spacing exception)** | Costs the same height, and a band's 24 px circle would still reach into the day button beside it. |

## Compliance trace

| Claim | Where |
| --- | --- |
| Every band link is at least 24 by 24 px | WCAG 2.2 AA SC 2.5.8, decision 1 |
| Every destination reachable by keyboard from the agenda | WCAG 2.2 AA SC 2.1.1, decisions 2 and 3 |
| Visible focus | WCAG 2.2 AA SC 2.4.7, decision 4 |
| Accessible names contain the visible label | WCAG 2.2 AA SC 2.5.3, decision 2 |
| No new hue; the accent keeps its meaning on the bands | Art. XII / ADR-0024 |
| Every user-facing string lives in `nl.json` | Art. II.3 |
