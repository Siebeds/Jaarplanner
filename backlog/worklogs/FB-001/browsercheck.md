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

## Addendum, 2026-09-15: after fix round 1 (antagonist round 2, finding C)

- **The rebuilt API.** The API was stopped, rebuilt from `7cdefc9` and restarted on 5186, against the same `jp_fb001`.
  As directie, the klas choice on `/ontwikkelingsrapport` then offered exactly K3 blauw and K3 groen, now from the
  server's `kanLeerlingenHebben` rather than from the jaarfase. K2 rood and the demo L3 klas were not offered.
- **The no-access sentence** is now "Je hebt geen toegang tot het ontwikkelingsrapport." (round 1, finding 8). The line
  above quoting Bram's screen shows the wording at the time of that pass and is left as it was.
- **Contrast.** Measured in the running app (Chromium, Playwright) from the resolved tokens. The dark theme was measured
  by setting `data-weergave="donker"` on `<html>`.

  | Pair (where on this screen) | Light | Dark |
  | --- | --- | --- |
  | inkt on vlak (title) | 16.58 | 14.62 |
  | inkt-zacht on vlak (explanations, the "voorbij" sentence) | 6.08 | 8.44 |
  | inkt on kaart (names in the list) | 17.78 | 13.12 |
  | inkt-zacht on kaart (field labels, the count) | 6.51 | 7.58 |
  | inkt-zwak on kaart (row buttons at rest, an icon: 3:1 is the bar) | 4.97 | 5.78 |
  | accent-op on accent ("Kind toevoegen") | 6.10 | 7.06 |
  | accent on accent-zacht (the active destination) | 5.51 | 5.13 |
  | attentie-inkt on attentie-zacht (error lines) | 9.39 | 8.00 |
  | lijn-veld on kaart (an input's border, a component: 3:1) | 3.20 | 3.40 |

  Every text pair clears 4.5:1, and every non-text pair clears 3:1.
- **The phone card and the safe area.** `index.html` sets `viewport-fit=cover`. The card at the top of Instellingen
  pads `env(safe-area-inset-top)`, and so does the sticky `Schermkop` of the part under it. On a phone with a notch,
  where the inset is not zero, that leaves one extra inset of space between the card and the part's title while the
  page is at rest. This is **accepted, not fixed**, for three reasons:
  - Both paddings are needed. The card's keeps it clear of the notch when it is the first thing on the page. The
    header's keeps the title clear of the notch once it sticks at the top while scrolling, when the card has scrolled
    away.
  - Removing either one breaks exactly that case, and the cost of keeping both is some white space above a title.
  - In a phone browser tab the browser's own bar holds the top, so the inset is 0 there. The gap only appears when the
    app runs full screen.

  The Chromium pass at 390 px reports an inset of 0 and cannot show it; this is the reasoning, not a measurement.

## Not covered here

- ~~Contrast was not measured; the screen uses existing tokens only (`inkt`, `inkt-zacht`, `accent` on the primary
  button, `attentie` for errors), each already measured in earlier passes.~~ *Superseded by the addendum of 2026-09-15
  above, which measured it in both themes (antagonist round 3, finding H).*
- The validation error line was not triggered in the browser; the screen test covers it.
