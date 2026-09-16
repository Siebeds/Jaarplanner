# FB-044 — Test report (round 1)

**Verdict:** PASS
**Mode:** both (Vitest + xUnit, and a real browser: headless Chrome driven by playwright-core)

Branch `ticket/FB-044-doelen-per-leeftijd` at `ee540cb`. API on :5195 (built into `bin-run` from this worktree) and
Vite on :5275, against the throwaway database `jaarplanner_fb044_test` (migrated to `20260916122525_ThemaMinimumdoelen`,
dropped afterwards). Seed: the demo seeder, then as directie the live Op.stap imports (minimumdoelen; leerplandoelen
snapshot 1.2), then a fictional thema "Op bezoek bij de bakker (test)" with:
- K2 subthema "Brood kneden (test)": subdoelen 6.3.GK2.1, 6.3.GK2.10;
- K3 subthema "Taartjes versieren (test)": 4.2.GK3.1, 4.2.GK3.16, 6.3.GK3.1;
- K3 subthema "Koekjes bakken (test)": 6.3.GK3.1 (shared), 6.3.GK3.10.

So K3 has 5 links over 4 distinct leerplandoelen, and 6.3.GK3.1 and 6.3.GK3.10 share minimumdoel K-6.3.1 (the old
minimumdoel count would have differed). Signed in as directie, at 1440x900 (`desktop-*`) and 390x844 (`mobiel-*`);
both viewports gave identical results.

## Criteria checked
- "bij K3 de leerplandoelen en geen groep minimumdoelen" → PASS. The opened block lists only leerplandoel rows (code,
  text, "Via subdoel in ..."); its text contains no "minimumdoel" and no minimumdoel ref. The API response
  `/api/themas/{id}/doelenoverzicht` has no `minimumdoelen` property per leeftijd.
- "Gegeven K3 met 4 verschillende leerplandoelen, dan staat naast K3 '4 leerplandoelen'" → PASS. Row reads
  "K3 4 leerplandoelen", with exactly 4 items listed (the shared code is listed once, naming both subthema's).
  K2 reads "2 leerplandoelen" with 2 items. The margin figure reads "6 leerplandoelen" (distinct over the thema).
- "wanneer men het aanklikt, dan opent het detail met zijn minimumdoel" → PASS. Clicking 4.2.GK3.1 opens the
  "Leerplandoel" sheet with a "Minimumdoel" section: K-4.2.1 and its text, plus "Bekijk dit minimumdoel".
- "Nagekeken in een echte browser op desktop en ~390px" → PASS. Console: no errors or warnings; no API response >= 400.

## Commands run
- `dotnet build … -o bin-run` → 0 errors; `dotnet ef database update` (throwaway DB) → Done.
- curl: /health 200, Vite 200, proxy /api/klassen 401 → healthy.
- `node fb044-browser.mjs desktop 1440 900` and `… mobiel 390 844` (scratchpad) → as above.
- `corepack pnpm exec vitest run src/features/themas` → 9 files, 79 tests passed.
- `dotnet test --filter ThemaDoelenoverzicht|SchoolcontentBeheerEndpointsTests` → unit 7/7, integration 6/6 passed.
  The changed assertions pin the behaviour (no `minimumdoelen` property; leerplandoelen with their `minimumdoelRef`).

## Evidence
- `desktop-01-doelen-per-leeftijd-dicht.png`, `desktop-02-doelen-per-leeftijd-open.png`,
  `desktop-03-blok-open-volledig.png`, `desktop-04-detail-leerplandoel.png`, and the same four as `mobiel-*`.

## Observations (not FB-044 defects)
- The thema's summary card reads "7 op subthema's" (links, not distinct doelen) next to the margin's 6 distinct
  leerplandoelen. This was not changed here and is out of scope.
