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

## Owner rulings after antagonist round 1, 2026-09-15

The round-1 report is `antagonist-ronde-1.md`. The owner answered its MAJOR and its questions:

- **A rapportdoel always has at least one subdoel** ("Altijd minstens één (Aanbevolen)"), on create and on update. The
  last subdoel cannot be taken out; the teacher deletes the rapportdoel instead. The server refuses it with
  "Kies minstens één subdoel." and the sheet checks it before sending. The domain still allows an empty rapportdoel,
  because D3's cascade can empty one when someone else deletes a subdoel.
- **R31 means "never a person holding directie"** ("Nooit wie directie heeft"): a directeur with a running K3
  klastoewijzing still does not edit the set or the scale. `Rechtenmatrix.StaatToe` and `lib/rechten.ts` `staatToe`
  now return `!rij.ZonderDirectie` for directie, whatever other column they hold.
- **The tab also shows to a hoofdleerkracht of K3** ("Ook hoofdleerkracht K3 (Aanbevolen)"). They see Rapportdoelen and
  Sterrenschaal, not Kinderen. The new `mag.ontwikkelingsrapportTab` drives the sidebar tab and the phone link in
  Instellingen; `mag.ontwikkelingsrapportZien` still decides who reads reports. ADR-0035 D18 carries a dated note.
- **Red and blue keep their hues** ("Ja, zo laten (Aanbevolen)"). The owner was shown that red shares its hue with
  gevaar, geweigerd and niet gedekt, and blue with doelsoort MD and voorgesteld. The `ster` token comment records it.

## Fix round 1

- **MAJOR (empty rapportdoel):** `RapportsetService.GeenSubdoel`, refused in `KeurSubdoelenAsync`; the pre-check in
  `RapportdoelenScherm.bewaar()` with `ontwikkelingsrapport.subdoelVerplicht`; tests on the server (POST without the
  list, POST with an empty list, PUT that empties) and in the sheet (nothing is sent). `geenSubdoelen` now reads
  "Geen subdoelen.", because "Nog geen" promised a state the app no longer lets a teacher reach.
- **MINOR (NUL byte):** the group key is `JSON.stringify([themaNaam, subthemaNaam])`; the file is text to `grep -I`.
- **MINOR (hue record):** the `ster` token comment names red and blue and the owner's answer.
- **MINOR (browser pass of the picker):** see `browsercheck.md`, round 2.
- **QUESTION (accent on the checkbox):** the picker's checkbox is drawn in ink (`accent-inkt`), so the accent's ration of
  five uses stays as it was.
- **QUESTION (R31) and QUESTION (D18):** the owner's rulings above.
- **Found in the browser pass of round 2, and fixed:**
  - "Kies minstens één subdoel." stayed on screen after a subdoel was ticked, beside "1 gekozen". Ticking now clears
    that sentence (a titel error stays), and `RapportdoelenScherm.test.tsx` asserts it.
  - At 390px the unfolded subdoelen sat beside the four row buttons, in a column about 140px wide, and words broke in
    the middle. The row is now a grid: the titel and the buttons share the first line, and the subdoelen span the whole
    row below them. The markup keeps the titel, the buttons and the list in that order, so the focus order matches what
    the eye sees.

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

## Gates (2026-09-15, on `6b5a4c9` with FB-001's fix rounds merged in)

- **Backend** (the session's own run, not only the implementer's):
  - `dotnet build`: 0 warnings;
  - `dotnet format --verify-no-changes`: exit 0;
  - UnitTests: 1596 passed, 4 skipped;
  - IntegrationTests: 491 passed, 1 skipped (the live KOV import), against the Docker Postgres through
    `JAARPLANNER_TEST_POSTGRES`;
  - no stray files in the tree.
- **Frontend:**
  - oxlint and `tsc` clean;
  - vitest: 69 files, 682 tests passed.
- **Browser:** the pass at 1440 and 390 is in `browsercheck.md`, including the stars' contrast in both themes.

## Gates after fix round 1 (on `c2e5ebc`)

- **Backend:**
  - `dotnet build`: 0 warnings, 0 errors;
  - `dotnet format --verify-no-changes`: exit 0;
  - UnitTests: 1596 passed, 4 skipped;
  - IntegrationTests: 491 passed, 1 skipped (the live KOV import), against the Docker Postgres. The first run failed one
    test that still created a rapportdoel without a subdoel; it now gets one. A second run was killed for low memory
    and was run again alone.
- **Frontend:** oxlint and `tsc` clean; vitest 69 files, 686 tests passed. After the re-audit one test was added (the
  last subdoel of an existing rapportdoel cannot be unticked and saved, no PUT is sent); its file passes 8 of 8.
- **Browser:** round 2 in `browsercheck.md`.
- **Antagonist:** round 2, the re-audit of the one MAJOR, is COMPLIANT (`antagonist-ronde-2.md`). The owner ruled that
  it is the last round.
