# FB-061 — Test report (round 1)

**Verdict:** PASS
**Mode:** Playwright (playwright-core driving headless system Chrome against http://localhost:5179, API on :5187, database `jaarplanner_fb061`, signed in as directie). Unit tests and lint were not rerun: the caller had already run them.

## Criteria checked
- "Nieuw thema, breed scherm: naam, duur en invalshoeken onder elkaar, woordenschatlijsten naast elkaar met teller en uitleg, geen voorbeeldkaart" → PASS. At 1440×900 the form's children are stacked at x=724, w=696 (naam y=93, duur y=181, invalshoeken y=269, woordenschat y=408). Invalshoeken is a `<textarea>` (rows=3, 88px high). The two lists sit side by side: grid `340px 340px`, kern at x=724 and rijk at x=1080, both at y=454. Each list shows a count (0, then 2 and 1, plus a "3 woorden" total). The lines "Wat elk kind op het einde kent." and "Extra woorden voor wie verder kan." are visible. The dialog text contains neither "voorbeeld" nor "klassen", and no preview card was found.
- "Nieuw thema met naam → Thema aanmaken → themapagina opent" → PASS. The page moved to `/themas/f99e4222-25a5-44ce-b39b-c2b47a9443d9`, the h1 shows "Op de boerderij 53118" and the dialog is closed. The page also shows the saved invalshoeken and the words (koe · kip / stal).
- "Bestaand thema: paneel heet '<naam> bewerken', Bewaren werkt nog niet" → PASS. The dialog is named "Op de boerderij 53118 bewerken" and "Bewaren" is disabled.
- "Duur wijzigen → 'gewijzigd' bij Duur en Bewaren werkt; terugzetten → beide weg" → PASS. After choosing 6, the legend reads "Duur gewijzigd" and Bewaren is enabled. After choosing 4 again, the legend reads "Duur" and Bewaren is disabled.
- "Onbewaarde wijzigingen: sluiten/Annuleren vraagt eerst; Verder bewerken laat alles staan; Weggooien sluit zonder bewaren" → PASS.
  - Change the naam and click X: "Je wijzigingen zijn nog niet bewaard." appears with Weggooien and Verder bewerken, the dialog stays open and focus is on "Verder bewerken".
  - Verder bewerken: the question goes away, the naam keeps "... X" and Bewaren stays enabled.
  - Escape with a change: the question appears and the dialog stays open. A second Escape also leaves the dialog open.
  - Annuleren: the question appears. Weggooien: the dialog closes and the h1 is unchanged, also after a reload. Reopening shows the original naam with Bewaren disabled.
  - A new thema with words and Escape: the question also appears (at 390).
- "Telefoon 390 px: lijsten onder elkaar, geen horizontale scroll, chips geen pillen" → PASS. Grid `350px` with kern at y=572 and rijk at y=687. `scrollWidth`/`clientWidth` is 390/390 for the new form (empty and with words) and for the edit form (also with the question showing). The computed chip `border-radius` is **4px** at both widths, with chips 32–34px high, so they are not pills.
- Save a real change → PASS. Naam changed to "... B", duur 6 and the word "tractor" added to rijk. Markers "gewijzigd" appeared at Naam, Duur and Rijke woordenschat (not at Invalshoeken or Kernwoordenschat). After Bewaren the dialog closed and the page shows "Op de boerderij 53118 B", 6 weken and "stal · tractor". This persists after a reload.
- Contrast (measured in Chrome with alpha composited, opacity 1) → PASS
  - "gewijzigd" marker: rgb(88,94,106) on #fff = **6.51:1** (all three markers)
  - explanation lines: rgb(88,94,106) on #fff = **6.51:1**
  - question banner text: rgb(103,54,20) on rgb(254,248,236) = **9.39:1**
  - Weggooien / Verder bewerken: 17.78:1

## Commands run
- `npm i playwright-core` (scratchpad) → ok
- `node run.mjs` (new form at 390 and 1440, create) → ok. The edit locator `name: 'Bewerken'` did not match because the button's accessible name is "<naam> bewerken". Fixed in the script only.
- `node run2.mjs` (edit, dirty, question, Escape, discard, save, 390 edit) → all steps as expected
- Network/console: no 4xx/5xx and no console errors during the runs. A single 404 appeared once during the first sign-in probe, before any form was opened.

## Evidence
Screenshots are in `C:\Users\Dyllis\AppData\Local\Temp\claude\C--source-Jaarplanner\1d9b134b-3031-43a5-b633-1d548c283571\scratchpad\shots\`:
- `nieuw-1440.png`: new form at desktop, lists side by side
- `nieuw-390.png`, `nieuw-390-onder.png`: new form at 390, lists stacked
- `bewerk-duur-gewijzigd-1440.png`, `bewerk-gewijzigd-1440.png`: markers
- `bewerk-vraag-1440.png`, `bewerk-vraag-390.png`: edit form with the question showing
- `themapagina-na-aanmaken-1440.png`, `na-bewaren-1440.png`

## Observations (not blocking)
- [MINOR] At 390 the question banner uses its row layout (`@sm:flex-row`) inside a ~350px box. The sentence wraps over four lines, and "Verder bewerken" wraps onto two lines inside its button (see `bewerk-vraag-390.png`). It is readable and usable, but cramped. Stacking the banner below `@md` would read better.
- [MINOR] An outlined (rijk) chip is 34px high and a filled (kern) chip 32px. The 1px border adds height, so the two lists' chips are not quite aligned.
- [INFO] On the thema page, invalshoeken entered on two lines show as one line ("dieren werk op het land"). The detail page is outside this ticket's changed files.

## Defects
None.
