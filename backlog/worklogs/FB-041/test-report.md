# FB-041 — Test report (round 1)

**Verdict:** PASS
**Mode:** both (Vitest + real browser, headless Chrome driven by playwright-core)

Branch `ticket/FB-041-register-ingeklapt` at `52704be`. API on :5192 and Vite on :5272, both started from this
worktree against the throwaway database `jaarplanner_fb041_test` (migrated to `20260916074540_HerschrijvingGeweigerd`).
Seed: the demo seeder (schooljaar 2026-2027), then as directie the live Op.stap imports (998 minimumdoelen, leerplandoelen
snapshot 1.2, 5849 rows), a klas "K3 derde kleuterklas (test)" (jaarfase K3) and a user "Leerkracht K3 (test)"
assigned to it. Every check below ran signed in as that leerkracht, at 1440x900 (`desktop-*`) and 390x844 (`mobiel-*`).
Both viewports gave identical results.

"Expanded" = the number of `button[aria-expanded="true"]` in the register tree.

## Criteria checked
- "wanneer ze naar Doelen gaat, dan is in het register van de leerplandoelen geen enkele discipline uitgeklapt"
  → PASS. 12 disciplines, 0 expanded, Nederlands included (step 01).
- "wanneer ze naar de minimumdoelen gaat, dan is geen enkel leergebied uitgeklapt" → PASS. 9 leergebieden,
  0 expanded (step 02).
- "wanneer de leerkracht een zoekterm intikt, dan blijven alle groepen ingeklapt" → PASS. "tellen" in the
  minimumdoelen: 4 leergebieden, 20 hits, 0 expanded (step 03). The same term in the leerplandoelen: 8 disciplines,
  33 hits, 0 expanded (step 04).
- "Gegeven een groep die de leerkracht openklapte, dan blijft die open tot zij ze sluit of een filter wijzigt"
  → PASS.
  - Search cleared, Wiskunde opened: only "Wiskunde 116" is expanded and its 6 domeinen show (step 06). It is still
    the only open group 3 s later (step 07).
  - Doelsoort filter G toggled: the tree remounts with 0 expanded (step 08).
  - Minimumdoelen: Wiskunde opened, only that group is open (step 10). Closed by hand: 0 expanded (step 11).
    Reopened, then mijlpaal filter changed: 0 expanded (step 12).
- Scenario 1–4 of the ticket → covered by steps 01, 02, 03 and 05–06.

## Commands run
- `dotnet build … -o bin-run` → 0 errors; `dotnet ef database update` (throwaway DB) → Done.
- `curl` /health 200, Vite 200, proxy /api/klassen 401 → healthy.
- `node fb041.mjs desktop 1440 900` and `node fb041.mjs mobiel 390 844` (scratchpad script) → all steps as above.
- `corepack pnpm exec vitest run src/features/doelen` → 4 files, 23 tests passed.
- Servers stopped by port (5192, 5272) → both answer 000.

## Evidence
- Screenshots in this folder: `desktop-01…12-*.png`, `mobiel-01…12-*.png`.
- No API request answered 4xx/5xx during either run.
- Console: one React warning, "Cannot update a component while rendering a different component … DoelenScherm".
  It comes from `volgKlasFase` being called during render in `DoelenScherm.tsx`. This branch did not change that
  code, so the warning is not caused by FB-041.

## Observations (not FB-041 defects)
- At 390px the search field shows two clear icons: the browser's own `type="search"` cancel button and the app's
  own "zoek wissen" button (`mobiel-03`).
- The React setState-in-render warning above.
