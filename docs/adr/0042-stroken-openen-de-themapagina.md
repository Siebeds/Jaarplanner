# ADR-0042 — The agenda's thema and subthema bands open the themapagina

- **Status:** Accepted; decision 3 superseded by [ADR-0045](0045-stroken-met-het-toetsenbord.md). *The consequence that
  the month's subthemabalk makes FB-020's verrijkingen reachable no longer holds: [ADR-0044](0044-hoekverrijking-in-het-zijpaneel.md)
  (FB-038) moved them to the side panel. Decision 3, and decision 2's keeping of every band out of the tab order, are
  superseded by ADR-0045 (FB-039): the subthemabalk is gone, and the bands are 24 px targets whose named band is a tab
  stop.*
- **Date:** 2026-09-15
- **Deciders:** Project owner, in session on 2026-09-15: *"in de agenda wil ik op thema en subthema kunnen klikken om
  naar de detailpagina te navigeren hiervan"*, and three rulings the same day: a subthema opens its thema's page with
  its own chapter open; the bands themselves are what a teacher clicks, in the week, day and month views; the keyboard
  reaches the same pages from the subthemabalk.
- **Supersedes:** [ADR-0026](0026-streefwoordenschat-op-subthema.md) decision 5, *in part*: the bands are no longer
  decorative. What that decision protected (no tab stop per day, nothing doubled in the accessibility tree, a control of
  at least 24 px for every function) still holds, by the route below.
- **Realises:** FB-037. **Constitution:** Art. XII (no new hue), Art. II.3 (copy in `nl.json`); WCAG 2.2 AA through
  [ADR-0017](0017-ui-ux-design-system.md). No article changes.
- **Backlog:** FB-037; E10-01 (its note on `Subthemastroken` follows this ADR).

## Context

Every teaching day in the agenda carries two bands along its top edge: the thema of its themaperiode and the subthema
that runs. The owner clicked them expecting to land on the thema's page, and nothing happened. ADR-0026 had made that a
deliberate choice: turning the band into the button would give one control per day to one destination, put the
subthema back in the accessibility tree once per cell, and fail WCAG 2.2 SC 2.5.8, since a band is 16 px tall and cannot
grow. The owner asked for the band to be the thing a teacher clicks all the same.

A subthema has no page of its own. It is a chapter of its thema's page, shut by default (FB-011).

## Decision

1. **Both bands are links for a pointer.** The thema band opens `/themas/{themaId}`; a subthema strip opens
   `/themas/{themaId}?subthema={subthemaId}`, where the page opens that chapter, scrolls it into view and gives its fold
   button focus. They are links, so a middle click opens a new tab and the back button returns to the same week of the
   agenda, whose date is in its URL.
2. **They stay out of the keyboard's way.** The container keeps `aria-hidden`, each link takes `tabIndex={-1}`. The
   day's own button already speaks the thema and the subthema, once; nothing is added to the accessibility tree and no
   tab stop is added per day.
3. **The subthemabalk is the equivalent control**, and so it stands above the month grid too, not only above the time
   grid. It lists each thema in view as a link, followed by the runs of its subthema's, and each run's card gets a link
   to its chapter **beside** the button that opens its verrijkingen (FB-020), never inside it. Both links are at least
   24 px and carry the mark the menu gives Thema's. This is what lets a 16 px band be a target at all: SC 2.5.8 exempts
   a target whose function a conforming control on the same page also performs, and SC 2.1.1 is met by the same links.
4. **What a band does not open.** An empty period names no thema and opens nothing. With two thema's in one period the
   band opens the one its label names first ("Herfst +1"); the other is a link in the subthemabalk. The "+2" strip that
   stands in for runs that did not fit names no run and opens nothing.
5. **The hover is ink, not colour.** One step darker fill, firmer ink, the name underlined. No accent: on these bands
   the accent tick already means "starts here". No new hue (Art. XII).

## Consequences

- **The month view gains the subthemabalk**, and with it FB-020's verrijkingen become reachable from the month. It costs
  vertical space above the month grid, most on a phone, where each run is a full-width card.
- **A pointer user has a target on every day; a keyboard user has one per thema and one per run.** The two routes lead to
  the same pages. That asymmetry is the point: forty tab stops to one destination is what ADR-0026 rejected, and it still
  is.
- `Subthemareeks` carries the thema (`themaId`, `themaNaam`), which the activiteit and the stored window both already
  had.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| **Focusable bands, one tab stop where the name is printed** | One stop per week per band, a thema and a subthema target 17 px apart (their 24 px circles overlap, so SC 2.5.8's spacing exception fails), and the subthema doubled in the accessibility tree. |
| **Only the subthemabalk, bands stay decorative** | Meets every criterion with no change to the bands, but it is not what the owner clicks. |
| **Grow the bands to 24 px** | Adds 16 px to every day heading and takes 48 of a month cell's 112 px; ADR-0026 already showed the cell stops being a day. |
| **A page per subthema** | The owner chose the thema's page with the chapter open; a second page would show the same content twice. |

## Compliance trace

| Claim | Where |
| --- | --- |
| No new hue; the accent keeps its one meaning on the bands | Art. XII / ADR-0024, decision 5 |
| Target size met by an equivalent control on the same page | WCAG 2.2 AA SC 2.5.8, decision 3 |
| Keyboard access to every destination | WCAG 2.2 AA SC 2.1.1, decisions 2 and 3 |
| Accessible names contain the visible label | WCAG 2.2 AA SC 2.5.3, decision 3 |
| Every user-facing string lives in `nl.json` | Art. II.3 |
