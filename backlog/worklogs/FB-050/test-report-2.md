# FB-050 — Test report (round 2: soort optional)

**Verdict:** PASS
**Mode:** Playwright (playwright-core against installed Chrome), plus direct API and database checks

Environment: Vite from the fb-050 worktree on http://localhost:5179, API on 5186, throwaway database
`jaarplanner_fb050` (demo seed), signed in as directie@jaarplanner.local. Branch head `26c0d4e`.
Test data made through the UI: subthema "Drijven en zinken" (K3) and "Waterkringloop" (L3) under thema Water,
and "Samen spelen" (L3) under Ik en mijn klas, for the agenda picker.

## Criteria checked
- "Gegeven een nieuw activiteitformulier, wanneer het opent, dan is er geen soort gekozen." → PASS.
  The Soort select has value `""` and shows "Geen soort". The options are Geen soort, Experiment, Prentenboek, Hoek,
  Uitstap, Spel, Waarneming, Beweging, Onderzoek, and none is disabled. The select is not `required`. Checked on desktop
  and at 390px (`r2-desktop-1-soort-leeg.png`, `r2-mobiel-1-soort-leeg.png`). The agenda's
  "Nieuwe activiteit maken" form also starts on "Geen soort".
- "Gegeven dat formulier zonder soort, wanneer men bewaart, dan wordt de activiteit bewaard zonder soort." → PASS.
  POST `/api/subthemas/{id}/activiteiten` sent `"activiteitType":null` and got 201 back with `"activiteitType":null`.
  The dialog closed, and there was no alert and no validation message. The list row reads
  "Bootjes laten drijven / Nog geen doel": no soort, and the empty meta `<p>` has 0px height. At 390px, "Schelpen
  sorteren" gave the same result (`r2-desktop-2-…`, `r2-mobiel-2-bewaard-zonder-soort.png`).
- "Gegeven een gekozen soort, wanneer men bewaart, dan heeft de activiteit die soort." → PASS.
  POST sent `"activiteitType":"Hoek"` and the response returned `"Hoek"`. The row reads "Waterhoek inrichten / Hoek"
  (`r2-desktop-3-hoek-bewaard.png`). A second one with Hoek, hoek "waterhoek" and kleur Olijf reads
  "Hoek · waterhoek · Olijf".
- "Gegeven een bestaande activiteit, wanneer men ze bewerkt, dan staat haar eigen soort ingevuld, en kan men die leeg
  maken." → PASS.
  Edit opens with Soort = "Hoek" (`r2-desktop-4a-hoek-ingevuld.png`). Choosing "Geen soort" and saving sent PUT
  `/api/activiteiten/{id}` with `"activiteitType":null` and got 200 with `null`. The row now shows no soort
  (`r2-desktop-4b-soort-leeggemaakt.png`), and after a reload the edit form still shows `""`.
- "Gegeven de snelle regel in het koppelpaneel, wanneer ze opent, dan is er geen soort gekozen, en maken zonder soort
  geeft een activiteit zonder soort." → PASS.
  Path: Doelen, then DEMO-L3-01, "Koppel dit doel", Water, Waterkringloop, "Nieuwe activiteit". The Soort select shows
  `""` / "Geen soort" on desktop and at 390px (`r2-desktop-5a-…`, `r2-mobiel-5a-…`). "Maak en koppel" sent POST with
  `"activiteitType":null,"leerplandoelCodes":["DEMO-L3-01"]` and got 201 with `null` and a Manueel doelkoppeling
  (`r2-desktop-5b-koppelpaneel-gemaakt.png`). Choosing Uitstap sent and returned `"Uitstap"`. The sheet lists
  activiteiten by name only, so no stray soort text appears (`r2-desktop-5c-koppelpaneel-lijst.png`).
- "Gegeven een aanvraag aan de backend zonder soort, dan wordt de activiteit bewaard zonder soort, nooit als
  Experiment." → PASS.
  - A direct POST with the field omitted returned 201 with `activiteitType: null`.
  - A direct PUT with the field omitted returned 200 with `null`.
  - A POST with `"activiteitType":""` returned 400 (a model-binding error), not a silent Experiment.
  - In the database, `activiteiten.activiteit_type` is nullable. The 9 rows hold 8 NULL, 0 empty strings, 0 Experiment,
    and 1 Spel.
- "Gegeven een activiteit zonder soort, dan tonen de schermen die de soort van een activiteit tonen geen soort voor
  haar." → PASS.
  - Subthema list: a soort-less activiteit with kleur Olijf reads exactly "Olijf", with no leading " · "
    (`r2-desktop-7-…`, `r2-mobiel-7-…`).
  - Agenda activiteit picker: "Kringgesprek over vriendschap / Nog geen doel" shows no type line, while
    "Gezelschapsspel in groepjes / Spel" does (`r2-desktop-6-agenda-kiezer.png`).
  - Placing the soort-less activiteit in the agenda: POST weekplanning returned 200, and after a reload the weekplanning
    GETs return 200 and the card reads "Kringgesprek over vriendschap / 9:15" (`r2-desktop-8-agenda-geplaatst.png`).
  - The read-only Feit view in Activiteitformulier is guarded in code (line 511). It was not reachable as directie.
- "Nagekeken in een echte browser op desktop en ~390px." → PASS.
  Scenarios 1–6 ran at 1440x900, and 1, 2 and the koppel-row open at 390x844. At 390px the page `scrollWidth` equals
  `clientWidth` (390/390) on the thema page, in the dialog and in the koppel sheet. The thema and agenda flows logged no
  console errors.

## Commands run
- `node r2-login.mjs` (development sign-in, storage state) → OK
- `node r2-setup.mjs` / `r2-setup-l3.mjs` / `r2-ikklas.mjs` (test data through the UI) → all POSTs 201
- `node r2-run.mjs 1440 900 desktop … nieuw|hoek|leegmaken` → scenarios 1–4 as above
- `node r2-run.mjs 390 844 mobiel "Schelpen sorteren" nieuw` → scenario 6 as above
- `node r2-kleur.mjs` → the separator check
- `node r2-koppel.mjs … open|make|look` (desktop and 390) → scenario 5 as above
- `node r2-agenda3.mjs`, `r2-agenda4.mjs` → the agenda picker, the new-activiteit form and a placement
- `curl` POST/PUT with the CSRF header → 201 / 400 / 200 as above
- `docker exec jaarplanner-db psql … activiteiten` → nullable column; 8 NULL, 0 '', 0 Experiment

## Evidence
Screenshots are in this folder, all `r2-*.png`. They show demo data only, and the only account shown is
directie@jaarplanner.local.

## Defects
None against FB-050.

## Observations (outside this ticket, not blocking)
- On `/doelen`, React logs "Cannot update a component while rendering a different component … DoelenScherm" when the
  screen loads. The branch does not touch `frontend/src/features/doelen/` (the `git diff main...HEAD` for it is empty),
  so the warning comes from existing code.
- At 390px on the thema page, the activiteiten `<ul class="divide-y … overflow-hidden">` inside a subthema is 188px wide
  but its content is 199px. Each row's "verwijderen" button ends at 245.5px, 9.5px past the list's clipped edge at 236px,
  so part of its hit area is clipped. The page itself does not scroll sideways. The subthema body is squeezed by the
  right-hand edit/delete column. This comes from the existing layout, not the soort change; it is worth a TB ticket.
- The agenda picker prints the raw enum name (for example "Spel") rather than `activiteitsoort.*` from nl.json. For
  every current value the two are the same text, and this was already so before this branch.
- The API answers `"activiteitType":""` with a 400 model-binding error. The frontend never sends that value.
