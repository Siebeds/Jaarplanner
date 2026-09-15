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

## Round 2, after antagonist round 1 (2026-09-15)

- **What ran:** the same worktree with fix round 1 applied (not yet committed). The API was rebuilt into `bin-run` and
  restarted on port 5186 against `jp_fb001`; Vite stayed on port 5178.
- **Data added to `jp_fb001`**, all through the API as directie:
  - the Op.stap Excel of discipline 1 (`assets/opstap-xlsx/Nederlands en communicatie.xlsx`), 358 goals, 63 of them
    K3 G. The Excel route was still open, because `jp_fb001` never had an API import;
  - two invented thema's: "Herfst in het bos" with the K3 subthema's Paddenstoelen and Bladeren, and "Op straat" with
    the K3 subthema Oversteken;
  - two K3 G leerplandoelen per subthema as subdoelen (`Manueel`, so decided), picked for long texts (198 to 314
    characters);
  - Bram, until now only a leerkracht of K2 rood, appointed hoofdleerkracht of K3 in 2026-2027.
- **API:** `GET /api/rapportdoelen/kandidaten` as Lotte gives the six subdoelen. A `PUT` that empties the old
  titel-only "Luisteren en spreken" gets 400 "Kies minstens één subdoel.".

### Lotte, 1440 × 900

- The row made in round 1 now reads "Geen subdoelen." under its titel.
- **The picker sheet** shows the pool in three groups ("Herfst in het bos › Bladeren", "… › Paddenstoelen",
  "Op straat › Oversteken"). Each row is a checkbox, the G mark, the code and the full text, which wraps under the code
  and not under the checkbox.
- **Bewaren with a titel and no subdoel** shows "Kies minstens één subdoel." and sends nothing.
- **Searching "groeten"** leaves only 1.4.GK3.12, under its group heading.
- **Found and fixed:** after ticking it, the refusal stayed beside "1 gekozen". Ticking now clears that sentence; seen
  live after the fix, when ticking 1.4.GK3.7 took it away.
- **Saving "Natuur ontdekken"** with 1.4.GK3.12 and 1.4.GK3.7 closes the sheet. The row reads "2 subdoelen", folded.
  Unfolded, each subdoel shows its G mark, code and text, with "thema › subthema" under it.
- The console holds no errors or warnings.

### Lotte, 390 × 844

- **Found and fixed:** unfolded, the subdoelen sat beside the four row buttons, in a column about 140px wide, and a word
  broke in the middle ("interactiestrategieë n"). After the fix the titel and the buttons share the first line and the
  subdoelen use the whole row width. No horizontal scroll (`scrollWidth` equals `clientWidth`, before and after).
- The picker opens as a bottom sheet. The texts wrap cleanly, and Bewaren and Annuleren stay in the footer.

### Bram, hoofdleerkracht of K3 without a K3 klas (the owner's widening of D18)

- **390:** Instellingen shows the "Ontwikkelingsrapport" link at the top. The bare `/ontwikkelingsrapport` opens
  Rapportdoelen. The switch offers Rapportdoelen and Sterrenschaal, not Kinderen. The list has no buttons and no
  "Rapportdoel toevoegen", and it says "Je kan de rapportdoelen bekijken, maar niet aanpassen."
- **1440:** the sidebar lists Doelen, Thema's, Agenda, Dekking, Ontwikkelingsrapport, Instellingen, with the report
  above Instellingen. This was read from the DOM: two screenshots at this width timed out while the full test suites
  were running on the same machine.
- **`/ontwikkelingsrapport/kinderen` by address** shows "Je hebt geen toegang tot het ontwikkelingsrapport." under the
  same two-part switch, and the page sends no request to `/api/leerlingen`.
- The console holds no errors or warnings.

### Not rerun in round 2

- **Directie with its own running K3 klas** (the owner's reading of R31) was not set up in the browser. The unit test
  `Een_directeur_die_zelf_een_K3_klas_heeft_wijzigt_de_rapportset_toch_niet`, the integration test of the same name
  (403 on a write, and nothing changed) and `rechten.test.ts` cover it. Plain directie was seen in round 1.

## Not covered here

- **Scenario 6 of the ticket** (refusing a subdoel's goal) cannot be run through the app, because no path sets a
  subdoel to `geweigerd`. See the ticket Werklog.
