# FB-002: frontend half and the session's own decisions

- **Ticket:** FB-002, "K3-leerkrachten beheren de gedeelde rapportdoelen en de sterrenschaal". FR-13.2.
- **Session:** `kindvolg`, 2026-09-15. The backend half was built by an implementer subagent; see
  `implementatie-backend.md`.
- **Branch:** `ticket/FB-002-rapportdoelen-sterrenschaal`, stacked on `ticket/FB-001-kinderen-van-de-klas` (owner
  ruling, 2026-09-15). Merge FB-001 first.

## Owner rulings in session, 2026-09-15

- **The scale starts with the owner's example** ("Met jouw voorbeeld (Aanbevolen)"): "Volledig bereikt" in green, then
  "Nog niet volledig" in orange. The server seeds both.
- **The fixed palette** ("Voorstel overnemen (Aanbevolen)"): six colours, groen, lichtgroen, geel, oranje, rood and
  blauw, each a fill with a deeper edge.
  - The proposal was shown to the owner as a private artifact ("Sterrenschaal K3"). It set the stars next to the marks
    the app already colours green and orange: the aanvaard dot, the doelsoort + and A squares, and the attentie wash.
  - The same ruling: on FB-003's invulscherm the subdoelen carry no status dot, so a green star never stands beside a
    green "Aanvaard". This is recorded for FB-003; this ticket shows no status dot anywhere either.

## Design (frontend-design step)

- **The destination gains parts, each at its own address:** `/ontwikkelingsrapport/kinderen`, `/rapportdoelen` and
  `/sterrenschaal`.
  - A switch under the title chooses between them, drawn like Instellingen's phone switch.
  - The bare address opens the first part this person may see.
  - The kinderen part is the FB-001 screen, unchanged apart from the switch in its header.
- **Only the children sit behind the report's right** (R17, D18). The set and the scale are not pupil data, and
  directie and a K3 hoofdleerkracht without a klas must be able to view them, also by address (AC5). So the switch
  offers those two parts to everyone, and the children only to whoever may read a report.
- **Stars are always a star plus a label** (Art. XII).
  - The colour choice is a radio group: each option is a star and the colour's Dutch name, and the native radio is kept
    but visually hidden.
  - Which colours exist is the server's list (`GET /api/gradaties/kleuren`). The frontend table only maps each one to
    its two tokens and its name.
- **Six new tokens** (`--color-ster-*` and `-rand`), light and dark, in `index.css`. Their comment records why they may
  share hues with meanings the app already has.
- **Rapportdoelen lead with the titel**, because that is what a parent sees (R11).
  - The subdoelen fold under a count, each with its doelsoort mark, code, text and "thema › subthema".
  - Picking happens in a sheet, because the pool can run to a hundred: the pool is grouped by thema and subthema, and
    the teacher can search it.
- **Reordering** is a chevron up or down on each row, the size of the row buttons. The lists are short, so a drag
  handle would add nothing.
- **Rights:**
  - The new row `RapportsetBewerken` is mirrored in `lib/rechten.ts`, with `ZONDER_DIRECTIE`, the one row directie
    does not pass (R31).
  - Its column reads `lopendeRapportklasIds` (D4 through the one klas→leeftijden mapping).
  - `mag.rapportsetBewerken` deliberately has no `isDirectie` short-circuit.
- **Copy:**
  - One unconditional sentence per part says the set or the scale holds for all K3 klassen and reaches reports already
    written (R7).
  - For anyone who may not change them, one sentence says they can view and not change, which is all that condition
    proves (the E5-03 rule).

## Files (frontend)

- **New in `src/features/ontwikkelingsrapport/`:**
  - `SterrenschaalScherm.tsx` and `RapportdoelenScherm.tsx`;
  - `Rapportwissel.tsx` (the switch and `Rapportstart`), `rapportdelen.ts`, `rapportset.ts`;
  - `Ster.tsx`, `sterkleuren.ts`, `Verschuifknop.tsx`;
  - `Foutregel.tsx` and `rapporthulp.ts` (`foutzin`), shared with the kinderen part instead of copied into it.
  - Tests: `SterrenschaalScherm.test.tsx`, `RapportdoelenScherm.test.tsx`, `Rapportwissel.test.tsx`.
- **Changed:**
  - `App.tsx`: the nested routes;
  - `OntwikkelingsrapportScherm.tsx`: the switch in its header, and the shared helpers;
  - `lib/rechten.ts` and `lib/rechten.test.ts`: the row, `ZONDER_DIRECTIE`, the directie exception asserted;
  - `index.css`: the star tokens;
  - `i18n/nl.json`: the new keys.

## Open

- **Scenario 6 cannot be run through the app today.** No path sets a subdoel's goal to `geweigerd`: every write
  creates `manueel`. D11 is covered by the server's read filter, and a deleted subdoel leaves every rapportdoel. This is
  recorded in the ticket Werklog.

## Gates

*Filled in once the backend half has landed; see below.*
