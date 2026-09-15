# FB-001 — browser pass

- **When:** 2026-09-15, session `kindvolg`.
- **What ran:** the worktree `fb-001-kinderen` at `2285acd` plus the count fix below. The API ran from `bin-run` on
  port 5186 against a throwaway database `jp_fb001` (migrated to `20260915090431_AddLeerlingen`, demo seed on). Vite
  ran on port 5178. Playwright (Chromium) signed in through the development sign-in.
- **Data:** seeded through the API only (`fb001-opzet.mjs` in the session scratchpad, not in the repo).
  - 2026-2027: K3 blauw, K3 groen, K2 rood, plus the demo L3 klas.
  - 2025-2026, which has ended: K3 zon.
  - Two invented leerkrachten: Lotte on K3 blauw and K3 zon, Bram on K2 rood.
  - Invented children: Mona Proefmans, Jules Voorbeeld, Fien/Fiene Proefmans, Staf Voorbeeld.
  - No real names anywhere. Screenshots stay in the gitignored `.playwright-mcp/`.

## API, before the browser

| Check | Result |
| --- | --- |
| Lotte reads K3 zon (her klas, year ended) | 200, `Cache-Control: no-store,no-cache`, 2 children |
| Lotte adds a child to K3 zon | 403 |
| Bram (K2 rood) reads K3 blauw | 403 |
| Lotte reads K3 groen (a K3 klas that is not hers) | 403 |
| Directie adds a child to K2 rood | 400, "Alleen een klas van de derde kleuter kan kinderen hebben." |
| `/api/ik` for Lotte | `rapportklasIds` = [K3 blauw, K3 zon], `lopendeRapportklasIds` = [K3 blauw] |

## Browser, 1440 × 900

- **Lotte, 2025-2026 (her year has ended).**
  - The destination sits at the bottom of the sidebar in its own section, over a rule, above Instellingen (D17, owner
    2026-09-15). It is marked active with the accent tint and the 2px rule.
  - The klas choice offers only K3 zon.
  - The list shows both children, preceded by the one sentence "Dit schooljaar is voorbij. …" (R26).
  - There are no fields and no row buttons. The console shows no warnings or errors.
- **Lotte, 2026-2027 (K3 blauw).**
  - Adding "Fien Proefmans" with Enter:
    - the row appears and the count reads "1 kind";
    - both fields empty;
    - focus returns to Voornaam;
    - the polite live region says "Fien Proefmans is toegevoegd.".
  - Renaming via the pencil:
    - the row turns into two fields with focus in the voornaam;
    - "Fiene" + Enter saves it;
    - focus returns to the row's "Fiene Proefmans wijzigen" button;
    - after a reload the new name is still there.
  - Deleting via the bin: the sheet asks "Fiene Proefmans verwijderen?", says "Alle rapporten van dit kind verdwijnen mee.
    Dat is niet terug te draaien.", and after confirming, the list is empty.
- **Bram (K2 rood), typing `/ontwikkelingsrapport`.** There is no destination in the sidebar. The screen says "Het
  ontwikkelingsrapport is er voor de leerkrachten van de derde kleuter en de directie." It shows no klas choice and
  requests no list.
- **Directie.**
  - The klas choice offers K3 blauw and K3 groen only (not K2 rood, not L3).
  - The add form is present and the "voorbij" sentence is absent.
  - The destination is in the sidebar.

## Browser, 390 × 844

- **Ontwikkelingsrapport screen.**
  - Schooljaar and klas wrap onto two lines.
  - The fields stack, with "Kind toevoegen" full width.
  - The row keeps its two icon buttons.
  - The page has no horizontal scroll (`scrollWidth` 390).
- **Instellingen.**
  - The bottom bar shows exactly five tabs (Doelen, Thema's, Agenda, Dekking, Instellingen).
  - "Ontwikkelingsrapport ›" sits as a card at the top of the page (16, 16, 358 × 56), above the Klassen title. This is
    the owner's "Via Instellingen".

## Found and fixed during the pass

- **An empty klas said "0 kinderen" beside "Nog geen kinderen in deze klas.", the same fact twice.** The count now
  shows only when there is at least one child. Screen tests (10) and `oxlint` + `tsc` were rerun and are green.

## Not covered here

- Contrast was not measured; the screen uses existing tokens only (`inkt`, `inkt-zacht`, `accent` on the primary
  button, `attentie` for errors), each already measured in earlier passes.
- The validation error line was not triggered in the browser; the screen test covers it.
