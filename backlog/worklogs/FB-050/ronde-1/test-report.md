> **Superseded.** This pass tested the first build (a required soort). The current build makes the soort optional; see `../test-report-2.md`.

# FB-050 — Test report (round 1)

**Verdict:** PASS
**Mode:** Browser (Playwright, driven by a `playwright-core` script against the installed Chrome) plus Vitest

Setup: the app was already running from the fb-050 worktree (Vite on http://localhost:5179, API on 5186, throwaway database
`jaarplanner_fb050`). Signed in as the development user directie@jaarplanner.local. The seed had no subthema's, so a
subthema "Drijven en zinken" (L3) was created through the UI under thema "Water". Commit under test: 7f01f89.

## Criteria checked
- "Gegeven een nieuw activiteitformulier, wanneer het opent, dan is er geen soort gekozen." → PASS.
  Thema Water > subthema Drijven en zinken > "Activiteit toevoegen" opens dialog "Nieuwe activiteit". Select value `""`.
  The accessibility tree shows `option "Kies een soort" [disabled] [selected]`, then the eight soorten. Same at 1440x900 and 390x844.
- "Gegeven dat formulier zonder soort, wanneer men bewaart, dan wordt er niets bewaard en staat bij het veld dat er een
  soort gekozen moet worden." → PASS.
  Naam filled in, Bewaren pressed: zero non-GET requests were recorded, the dialog stays open, and the name does not appear in the list.
  `combobox "Soort" [invalid]` is followed by `alert: Kies een soort voor de activiteit.`. The select has `aria-invalid="true"`,
  and `aria-describedby` points to `<p role="alert">` with that text. Choosing a soort removes the alert and `aria-invalid`.
  The same happens at both widths.
- "Gegeven een gekozen soort, wanneer men bewaart, dan heeft de activiteit die soort." → PASS.
  Choosing "Hoek" and pressing Bewaren sent one `POST /api/subthemas/d669c58c-.../activiteiten` and closed the dialog.
  The list shows "Bootjes laten drijven" with "Hoek". The thema GET response returns `activiteitType: "Hoek"`.
- "Gegeven een bestaande activiteit, wanneer men ze bewerkt, dan staat haar eigen soort ingevuld." → PASS.
  "Activiteit Bootjes laten drijven bewerken" opens "Activiteit bewerken" with Soort value `Hoek` and the "Welke hoek" field.
  The options are only the eight soorten, without "Kies een soort".
- "Nagekeken in een echte browser op desktop en ~390px, en de melding is bereikbaar voor een schermlezer." → PASS.
  Checked in Chrome at 1440x900 and 390x844.
  - At 390px the message box is x=20, width=350 and fully in view. `scrollWidth` equals `clientWidth` (390), so the page does
    not scroll sideways, and no element inside the dialog overflows horizontally.
  - Screen reader: the message has role=alert, and the select carries aria-invalid and aria-describedby.
  - Contrast measured in the browser: rgb(103,54,20) on white is about 9.9:1, with 13px text at weight 500 and opacity 1.

## Commands run
- `node run.mjs 1440 900 desktop "Bootjes laten drijven" save` (scenarios 1–3) → as above
- `node step4.mjs` (scenario 4) → as above
- `node run.mjs 390 844 mobiel "Schepjes vullen"` (scenario 5 = 1–2 at 390px) → as above
- `node contrast.mjs` → fg rgb(103,54,20), bg rgb(255,255,255)
- `corepack pnpm vitest run src/features/activiteiten/Activiteitformulier.test.tsx src/features/plan/Nieuweactiviteitblad.test.tsx` → 2 files, 13 tests passed

## Evidence
- `desktop-1-soort-leeg.png`: new form at 1440px, Soort shows "Kies een soort"
- `desktop-2-soort-fout.png`: after Bewaren without soort, the message under Soort
- `desktop-3-hoek-bewaard.png`: activiteit saved, listed as Hoek
- `desktop-4-bestaande-activiteit.png`: edit form with Soort = Hoek
- `mobiel-1-soort-leeg.png`, `mobiel-2-soort-fout.png`: the same at 390x844 (bottom sheet)
- Console: no errors or warnings were logged during the runs.

## Observations (not defects)
- On a failed save, focus stays on Bewaren and does not move to the invalid field. The alert is announced, so this is not an
  accessibility failure, and the existing naam validation behaves the same way.
- The agenda's "Nieuwe activiteit maken" route (`Nieuweactiviteitblad`) uses the same `Activiteitformulier`. It was not
  driven in the browser; its Vitest file passes.
- Test data left in `jaarplanner_fb050`: subthema "Drijven en zinken" under Water, and activiteit "Bootjes laten drijven" (Hoek).

## Defects
- None.
