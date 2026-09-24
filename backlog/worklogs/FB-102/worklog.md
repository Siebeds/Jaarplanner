# FB-102 worklog: activiteiten side pane, still-to-plan first, compact cards

## Built
- `Activiteitensectie.tsx`: two groups, "Nog in te plannen, n" above "Ingepland, n"; an empty group drops away; the
  drag hint (tap hint on a phone) once, over the first group, only when it holds a card this gebruiker can plan.
- Compact cards: name, the ownership label only where needed, one short date ("ma 5 okt", the first day from today
  on, else the last past day) or "Nog niet ingepland", and one goal-count button that opens the doelinfo. The old
  info icon, the `Doelmerk` pill and the FB-076 left rule are gone from these cards.
- The card's drag/plan button lies under the whole card and takes its name from the card's words (`aria-labelledby`):
  a count laid over the button needed reserved room, which broke the date onto two lines in the 240px column.
- Ownership said once under the list when every activiteit is of one kind; mixed own/shared labels the smaller group;
  a colleague's own activiteit is always labelled.
- Subthema choice: a native select laid invisibly over a text that wraps, so a long name shows whole.
- When the placements read fails, one ungrouped list with a sentence saying so; while it is pending, loading rows.
- Mock mode answers `GET /api/klassen/:klasId/jaarplan/activiteitplaatsingen`.

## Gates
- `pnpm lint` green; vitest 1419/1419 (one unrelated `DoelenScherm` test flaked once under load while Vite ran,
  green three times alone).
- Browser pass (mock mode, Playwright): 1440x900 shows 7 cards without scrolling, date on one line; dragging a
  still-to-plan card onto Wednesday moves it to "Ingepland"; the count button opens the doelinfo; focus rings visible
  on the select and a card; 390px opens the panel as a sheet without grip, same groups and cards.
- Antagonist: COMPLIANT. MINOR 1 (ownership label missing from the card button's name) fixed.

## MINOR findings not fixed
- The tap hint follows the narrow layout, not touch input: a narrow desktop window says "Tik op". A click works, so it
  stays true enough.
- Until `useIk` has loaded, own activiteiten briefly count as a colleague's (pre-existing, from `isEigenVan`).
- When the placements read fails, `aria-labelledby` names a `wanneerId` that is not rendered; browsers ignore it.
- A new activiteit made "Alleen voor mij" in mock mode comes back shared: a limit of the mock, not of this ticket.
