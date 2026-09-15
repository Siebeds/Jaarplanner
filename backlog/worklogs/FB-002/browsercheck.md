# FB-002: browser pass

- **When:** 2026-09-15, session `kindvolg`.
- **What ran:**
  - The worktree `fb-002-rapportdoelen` at `6b5a4c9`, with FB-001's fix rounds merged in.
  - The API was built into `bin-run` and served on port 5186, against the throwaway database `jp_fb001`, migrated to
    `20260915122050_AddRapportdoelenEnGradaties`.
  - Vite ran on port 5178, restarted for the new `@theme` tokens.
  - Chromium was driven by Playwright through the development sign-in.
- **Data:**
  - The same invented staff as FB-001: Lotte, a leerkracht of K3 blauw in 2026-2027; Bram, of K2 rood; and directie.
  - The scale is the server's seed.
  - There is no decided K3 subdoel in this database, so the subdoel picker was checked through its empty state; see
    *Not covered here*.
  - No real names. The screenshots stay in the gitignored `.playwright-mcp/`.

## API, before the browser

As Lotte:

- `GET /api/gradaties` returns the seed, exactly as the owner ruled: "Volledig bereikt" in `Groen` (order 1), then
  "Nog niet volledig" in `Oranje` (order 2).
- `GET /api/rapportdoelen/kandidaten` answers 200 with 0 items.
- `lopendeRapportklasIds` holds K3 blauw.

## Browser, 1440 × 900

- **Lotte, `/ontwikkelingsrapport/sterrenschaal`.**
  - The switch shows Kinderen, Rapportdoelen and Sterrenschaal, and Sterrenschaal is marked.
  - One sentence under the title: "Eén schaal voor alle K3-klassen. Een wijziging werkt ook door op rapporten die al
    geschreven zijn."
  - Each gradatie is a star with its label and four row buttons. Moving the first one up is disabled, and so is moving
    the last one down.
  - The console holds no errors or warnings. The 8 errors logged just before belonged to the previous page, which was
    still open while the servers were being restarted.
- **Adding a gradatie.**
  - "Bijna bereikt" sent without a colour gives "Kies een kleur." and nothing is sent.
  - With Geel chosen by its named chip:
    - the row appears at the end;
    - the label empties;
    - no colour stays chosen;
    - focus is back in Label.
- **Reordering.** "Bijna bereikt hoger zetten" moves it to second place, and focus stays on that button.
- **Lotte, `/ontwikkelingsrapport/rapportdoelen`.**
  - "Rapportdoel toevoegen" opens the sheet "Nieuw rapportdoel" with focus in Titel. The subdoel count reads "0 gekozen",
    and the pool says "Er zijn nog geen besliste subdoelen van de derde kleuter."
  - Saving "Luisteren en spreken" closes the sheet. The row then reads the titel with "Nog geen subdoelen gekozen." This
    is the empty-rapportdoel default the backend flags.
- **Directie, `/ontwikkelingsrapport/sterrenschaal`.**
  - The same three gradaties, with 0 buttons in the list and no form.
  - "Je kan de sterrenschaal bekijken, maar niet aanpassen." (R31)
  - The switch offers all three parts, because directie reads reports.

## Browser, 390 × 844 (Lotte)

- The sterrenschaal has no horizontal scroll (`scrollWidth` 390).
- The four row buttons fit beside each label.
- The six colour chips wrap onto two lines, each a star and a name.
- The bottom bar keeps its five tabs.

## Contrast of the stars

Measured in the browser from the resolved tokens, against `kaart`. The light theme is the default, and the dark theme
was measured with `data-weergave="donker"`.

| Colour | Edge, light | Fill, light | Edge, dark | Fill, dark |
| --- | --- | --- | --- | --- |
| groen | 6.57 | 4.41 | 10.31 | 7.31 |
| lichtgroen | 4.73 | 2.41 | 11.85 | 9.20 |
| geel | 4.68 | 1.88 | 12.52 | 10.17 |
| oranje | 5.54 | 2.64 | 10.15 | 7.38 |
| rood | 7.68 | 4.71 | 8.54 | 5.21 |
| blauw | 8.17 | 4.75 | 9.18 | 5.92 |

- **Every edge clears 1.4.11's 3:1 in both themes.**
- **Some light fills do not, which is why the stars have an edge.** The fills of lichtgroen, geel and oranje fall below
  3:1 on white.
- **A star is never the only carrier of a rating.** Its label always stands beside it (Art. XII).

The screen's text pairs use the same tokens that FB-001's pass measured (`browsercheck.md` there).

## Not covered here

- **Picking subdoelen in the browser.** `jp_fb001` holds no leerplandoelen, so no decided K3 subdoel exists to pick. The
  picker's behaviour is covered elsewhere:
  - `RapportdoelenScherm.test.tsx` covers choosing, searching, the empty pool and editing.
  - The backend's `RapportsetEndpointsTests` covers the read filter, D3, D11 and D12 on real PostgreSQL.
- **Scenario 6 of the ticket** (refusing a subdoel's goal) cannot be run through the app, because no path sets a
  subdoel to `geweigerd`. See the ticket Werklog.
