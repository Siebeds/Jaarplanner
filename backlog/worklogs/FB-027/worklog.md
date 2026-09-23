# FB-027 worklog: the AI proposes the week's activiteiten

Decision record: [ADR-0067](../../../docs/adr/0067-weekvoorstel-in-de-agenda.md); Art. IV.5 and V.1 amended.

## Built
- A proposed block is an `Activiteitplaatsing` with status `Voorgesteld` and a new `AiMotivatie` column (migration
  `ActiviteitplaatsingAiMotivatie`).
- `POST /api/klassen/{klasId}/jaarplan/weekvoorstel`: the model picks activiteiten of the subthema's whose window
  overlaps the week (shared + the asker's own), in order, with a day and a motivation; `Weekinpassing` fits them with
  the cat's `Vrijmoment` rule inside the schooluren, off the middagpauze, fiches, hoeken and every block.
- `PUT .../weekplanning/{id}/beslissing` (accept / reject), `POST .../weekvoorstel/aanvaard` (accept all in a range).
  Moving an open proposal makes it `Manueel`, and needs the owner's right for a colleague's own activiteit.
- Dekking, the "al ingepland" list and the subthema bands ignore open proposals.
- Frontend: "Stel mijn week voor" (`AiKnop`) and one strip of proposals with motivation and quiet accept/reject in the
  agenda's week views; ringed blocks with the wand in the time grid; mock-mode routes.

## Gates
- Backend: 2350 unit + 613 integration green (Postgres) before the audit fixes; after them the unit suite (2350) and the
  weekplanning/weekvoorstel integration tests (25) green. `dotnet format` run.
- Frontend: 277 Vitest green, `pnpm lint` green.
- Browser (mock mode, headless Chrome over CDP): desktop 1440 and 390px, propose, accept one; no horizontal scroll.
- Antagonist: round 1 one MAJOR (moving a colleague's proposal decided it without the owner check), fixed with a test;
  round 2 COMPLIANT.

## Known and not fixed (MINOR)
- Deleting an activiteit, subthema or thema is still refused while an open proposal of it stands in an agenda (ADR-0067
  Consequences). A hoofdleerkracht without the klas's planning cannot reject it herself. Candidate: discard open
  proposals in those deletes.
- A co-teacher sees accept buttons on a colleague's own-activiteit proposal that the server refuses with a Dutch
  sentence; the weekplanning row carries no owner to hide them by.
- "Today" is the server's local date (`TimeProvider.GetLocalNow`); on a UTC host that is off around midnight.
- When lesvoorbereidingen (ADR-0058) are built, none may be generated on a `Voorgesteld` placement.
- No real AI environment yet (TB-004): the flow is tested with the fake client and mock mode only.
