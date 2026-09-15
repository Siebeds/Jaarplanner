# FB-003: implementation

Ticket: `backlog/functionele-backlog/FB-003-leerkracht-vult-het-ontwikkelingsrapport-van-een.md` (FR-13.3, FR-13.7,
FR-13.9; Art. VI.7, IX.4; ADR-0035 §3.1 to §3.3). Branch `ticket/FB-003-rapport-invullen`, session `rapport-invullen`.
Moved to `klaar-voor-bouw` by the owner's go-ahead in this session (`--by eigenaar`), then picked up.

## What was built

**Domain** (`Jaarplanner.Domain/Ontwikkelingsrapport`)
- `Ontwikkelingsrapport`: one per (leerling, moment), with `Besluit` and `BesluitStatus`. Made on the first write, never
  on a read. Validation names the field, never the text.
- `Rapportbeoordeling`: per (report, rapportdoel), an optional `GradatieId`, `Tekst` and `TekstStatus`. A row exists
  only while it holds a star or a text, so "used by a report" (D1) is "named by a row".
- `Evaluatiemoment` (1..3, a value) and `Tekststatus` {`Manueel`, `Aanvaard`} (Art. IX.4: `manueel` or `aanvaard`, plus a
  separate `geweigerd` mark that FB-004 adds). A changed text becomes `Manueel`; an unchanged one keeps its status.
- The class is named `Ontwikkelingsrapport` as in Art. IX.4. That name is also its namespace's, which the Application,
  Infrastructure and test namespaces of the same name would shadow, so those files use a `Rapportentiteit` alias.

**Persistence**: migration `AddOntwikkelingsrapporten`. `ontwikkelingsrapporten` has a unique (LeerlingId, Moment), a
check constraint on Moment 1..3, and cascades from `leerlingen` (D8). `rapportbeoordelingen` is keyed by the pair,
cascades from its report, and is `Restrict` on `rapportdoelen` and `gradaties` (the D1 backstop), with an index on each.

**Rights**: new matrix row `RapportInvullen` (§3 "Een ontwikkelingsrapport invullen (gradatie, tekst, besluit,
tekening) en een AI-herwerking vragen"), column `LeerkrachtRapportInvullen`, directie passes. Reading reuses
`OntwikkelingsrapportLezen`. Mirrored in `frontend/src/lib/rechten.ts` (`mag.rapportInvullen`).

**API** (`OntwikkelingsrapportenController`, all on the child's klas via `[RechtOp(…, Rechtbron.Leerling, "leerlingId")]`):
- `GET /api/leerlingen/{leerlingId}/rapporten/{moment:int:range(1,3)}`: every rapportdoel of the set in order, with its
  decided K3 subdoelen from `IRapportsetService` (D11, D12 filter) and what is filled in; `no-store`.
- `PUT …/rapportdoelen/{rapportdoelId}` with `{ gradatieId, tekst }`, and `PUT …/besluit` with `{ tekst }`.
- Limits: 2000 characters per text, 4000 for the besluit. Refusals are Dutch and name no child.
- Two first writes at once collide on a unique key; the service applies the refused one again, once.

**D1** in `RapportsetService`: deleting a gradatie or rapportdoel a beoordeling uses is refused with "… staat al op een
rapport en kan niet verwijderd worden. Je kan ze/het wel hernoemen of verschuiven." A rename shows on every report (R7).

**Frontend**
- `RapportScherm` at `/ontwikkelingsrapport/kinderen/:leerlingId/rapport/:moment` (a child alone opens Rapport 1),
  reached from the child's name in the Kinderen list, which is now a link.
- Layout (frontend-design pass, within ADR-0024): the child's name and klas, a Rapport 1/2/3 switch, the rapportdoelen
  as one card read down, and the algemeen besluit set apart at the bottom. The star choice is the one bold element:
  every star of the scale with its label, the chosen one filled, plus "Geen ster"; a radiogroup per rapportdoel.
- **No save button** (`autobewaren.ts`): a star saves when chosen, a text after 1.2 s without typing or when the field
  is left. One save in flight per field, the last value wins, a pending change is sent on unmount, and the browser asks
  before a reload while one is open. "Bewaard" shows per block; a refusal shows the server's sentence and "Opnieuw
  proberen".
- The subdoelen of a rapportdoel are folded under their count (teacher only, R11).
- Read-only view for whoever may read but not fill in; "Dit schooljaar is voorbij…" only under
  `mag.rapportAlleenNogLezen`. A refused read says "Je hebt geen toegang tot dit rapport."

## Choices the owner may want to revisit

- **Saving without a button.** The ticket's scenario 3 says "en bewaar"; there is no button to press, and the block says
  "Bewaard" once it is. Chosen so twenty reports three times a year do not depend on remembering a button.
- **Subdoelen folded** under "2 subdoelen" rather than listed open under every rapportdoel, which with a real set would
  make the page several screens long. AC1 is met by the fold: they are one click away on every rapportdoel.

## Tests

- Unit: `OntwikkelingsrapportTests` (22), `RechtenmatrixTests` updated.
- Integration (Postgres): `OntwikkelingsrapportEndpointsTests` (11): AC1 to AC6, D2, D8, concurrent first writes,
  Dutch refusals; the route sweeps (`ElkeWijzigendeRouteVraagtEenRechtTests`, sessions) cover the new routes.
- Frontend: `RapportScherm.test.tsx` (9), `rechten.test.ts` updated.
- Full suites: backend unit 1658, integration 505 (+1 after the antagonist fixes), frontend 793; `pnpm lint` and
  `dotnet format` clean.

## Antagonist

One round, COMPLIANT, three MINOR findings, all fixed: see `antagonist-ronde-1.md`.
