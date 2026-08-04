# E5-02 — Test report (round 1)

**Verdict:** PASS
**Mode:** both (browser pass over a real API + PostgreSQL, plus the full unit/integration/frontend suites)
**Commit verified:** `d1eeb3e` on `story/E5-02-dekkingsoverzicht`, worktree clean (`git status --short` empty).
**Environment:** API on `127.0.0.1:5501`, Vite on `127.0.0.1:5502`, PostgreSQL database `jp_e502gate` (created, migrated, seeded, dropped afterwards).

## Acceptance criterion

> *Done when:* **the view matches the plan state live.** (FR-9.1)

Met. Accepting a placement on the kalender and walking to `/dekking` through the nav shows the raised
figure with no save and no page reload; the dekking request is re-issued on every arrival; and every
withholding rule the directie ruling of 2026-07-28 imposes holds in the browser, not only in a test.

## Criteria checked

**1. "`/dekking` renders every in-scope leerplandoel as gedekt or niet gedekt, with the covering thema
named beside a covered one" — PASS.** `aantalLeerplandoelen` = 14 (L3 scope) and exactly 14 rows are
rendered; 15 in `HeelCurriculum` and 15 rows. Every row carries the word "Gedekt" or "Niet gedekt" as
text, not colour alone, plus a dekking-coloured left border. Covered rows read
`DEMO-L3-01 / G / L3 / Voorbeelddoel 1 ... / Gedekt door Ik en mijn klas / Gedekt`.
Screenshots `01-baseline-1440.png`, `03-stale-1440.png`, `05-heelcurriculum-1440.png`.

**2. "Accepting a placement raises the coverage figure without any manual save or refresh beyond normal
navigation" — PASS.** Driven entirely through the UI: on `/dekking` the summary read
**"0 van 14 doelen gedekt"**; clicked the nav item **Jaarplan**; clicked the card button
`aria-label="Ik en mijn klas aanvaarden"` (E4-02), which issued
`PUT /api/klassen/{id}/jaarplan/plaatsingen/84bfd426.../status`; clicked the nav item **Dekking**; the
summary read **"2 van 14 doelen gedekt"** with both doelen showing *"Gedekt door Ik en mijn klas"*. CDP
recorded exactly **one** request of `type: Document` for the entire session (the initial navigation), so
no page reload occurred; arriving on `/dekking` fired one fresh
`GET /api/klassen/{id}/dekking?bereik=EigenJaarFase`.

**3. "While a stale placement is unresolved, no coverage figure appears anywhere on the screen" — PASS,
with one MINOR noted below.** Stale state produced with
`UPDATE themaplaatsingen SET "BlokStart" = DATE '2026-08-01'`; the API then reports
`isBetrouwbaar: false`, `aantalOnopgelosteVervallenPlaatsingen: 1`, `aantalGedekt: null`. Probed **four**
variants: with and without an out-of-scope doel, in each of the two scopes. In every one of them:

- a fraction regex (digits, then `van` / `/` / `of` / `op`, then digits, case-insensitive) over
  `document.body.innerText` matched **nothing**;
- the same regex over **every** `title`, `aria-label`, `aria-describedby`, `aria-valuetext`,
  `aria-valuenow`, `aria-valuemax`, `alt`, `placeholder`, `value` and `content` attribute in the document
  matched **nothing**, so there is no tooltip or assistive-tech leak;
- a percentage regex matched **nothing**;
- `document.title` was `"Jaarplanner"` and the `meta` elements carried no figure;
- `progress, meter, [role=progressbar], [role=meter]` returned **no elements**, so no figure hides in a
  non-textual widget.

The group header rendered as `"Demo · Demo"` with **no tally**, against `"Demo · Demo | 2 van 14 gedekt"`
in the healthy state; in `HeelCurriculum` **both** headers lost it. The summary read
*"Nog geen betrouwbaar cijfer"* plus the unresolved-placement count, the geweigerd reconciliation
sentence, and the link *"Los dit op in het jaarplan"*. **No third leak was found in the rendered steady
state.** The combination the story had not exercised (stale *and* a non-zero `aantalBuitenBereik`, in both
scopes) was checked specifically, since a leak would most plausibly have hidden there; the
`buitenBereik` sentence states how many doelen are excluded, which is not a coverage figure and does not
disclose the denominator.

**4. "A class whose scope holds no doelen shows nog niets om tegen te meten rather than a full 0 of 0" —
PASS.** Inserted a `klassen` row with `"Leerjaar" = 1` while only L3 and K3 doelen exist; the API returned
`aantalLeerplandoelen: 0`, `aantalBuitenBereik: 15`. The screen showed **"Nog niets om tegen te meten"**
and *"Voor deze klas staan er nog geen leerplandoelen in de tool, dus valt er niets te berekenen. Er zijn
wel 15 doelen van andere jaren of fases ingeladen."* The fraction regex over the whole body matched
**nothing**: no `0 van 0`, no rows, no group headers. Screenshot `07-leeg-1440.png`.

**5. "The scope switch changes the denominator via a new request, puts the choice in the URL, and a shared
link opens at that scope" — PASS.** An out-of-scope doel was inserted (`"JaarFase" = 'K3'`). Default state:
`2 van 14 doelen gedekt`, *"Gemeten tegen de doelen van L3."*, *"1 ingeladen doel hoort bij een ander jaar
of een andere fase en blijft hier buiten."*, with `aria-pressed="true"` on **Deze klas**. Clicking **Heel
curriculum** fired exactly one new request, `GET /api/klassen/{id}/dekking?bereik=HeelCurriculum`; the URL
became `...&bereik=HeelCurriculum`; the figure became **`2 van 15 doelen gedekt`**; a second group
`Kleuterdomein · Kleutersubdomein | 0 van 1 gedekt` appeared; and the pressed state moved. A **cold
document load** of that URL, after navigating to `about:blank` first, opened at `2 van 15` with **Heel
curriculum** pressed and issued `?bereik=HeelCurriculum` on its own.

**6. "A class whose Leerjaar maps to no jaar/fase falls back to the whole curriculum and says so on screen
while Deze klas is still the pressed option" — PASS.** Inserted a `klassen` row with `"Leerjaar" = 7`. The
API returned `bereik: "HeelCurriculum"`, `isTerugvalNaarHeelCurriculum: true`, `gemetenJaarFasen: []` for a
request that asked for `EigenJaarFase`. The screen showed **"Van deze klas is geen jaar of fase bekend,
dus meet dit overzicht tegen het hele curriculum."** together with *"Gemeten tegen alles wat de school
heeft ingeladen, dus ook de doelen van andere jaren en fases."*, the denominator 15, and the switch still
reporting `{label: "Deze klas", pressed: "true"}`. Screenshot `06-leerjaar7-1440.png`.

**7. "The screen states, in visible copy, that it does not report minimumdoel level" — PASS.** The second
paragraph under the title, present in all six states probed: *"Dit overzicht gaat over leerplandoelen.
Dekking op het niveau van de minimumdoelen, wat de onderwijsinspectie toetst, kan pas zodra de
minimumdoelen ingeladen zijn."* (`nl.json` key `dekking.alleenLeerplandoelen`). Visible body copy, not a
`title` tooltip, so the E3-06 rule holds.

**8. "No horizontal overflow at 1440px and at exactly 390px" — PASS.** Real layout viewports were set with
CDP `Emulation.setDeviceMetricsOverride`, so no window clamping and no iframe was involved. At **1440px**
in four states: `clientWidth` 1425 to 1440 (1440 minus the 15px classic scrollbar),
`documentElement.scrollWidth === clientWidth`, and **zero** elements under `main` whose
`getBoundingClientRect().right` exceeded `clientWidth + 1` or whose `left` was below -1. At **390px** in
four states (stale, healthy plus HeelCurriculum, leerjaar 7, empty scope): `clientWidth` 375 or 390,
`scrollWidth === clientWidth`, **zero** overflowing elements. Screenshots `04-stale-390.png`,
`08-healthy390.png`, `08-lj7-390.png`, `08-leeg390.png`.

**9. "The self-reported gates hold at `d1eeb3e`" — PASS, with one figure corrected upward.** Re-derived
rather than copied:

| Gate | Command | Result |
|---|---|---|
| Backend build | `dotnet build` | 0 Warning(s), 0 Error(s) |
| Unit tests | `dotnet test --no-build` | `Failed: 0, Passed: 554, Skipped: 0, Total: 554` — matches |
| Integration tests | same run, `JAARPLANNER_TEST_POSTGRES` set | `Failed: 0, Passed: 182, Skipped: 0, Total: 182` — matches, and **0 skipped confirmed against real PostgreSQL** |
| Formatting | `dotnet format --verify-no-changes` | exit 0, zero lines of output |
| Frontend tests | `corepack pnpm test` | `Test Files 17 passed (17)`, `Tests 349 passed (349)` — **349, not the 348 claimed in the worklog and the backlog entry** |
| Frontend lint | `corepack pnpm lint` | exit 0 (`eslint . --max-warnings 0 && tsc --noEmit`, no output) |
| Frontend build | `corepack pnpm build` | built in 19.79s |

The frontend count is the only divergence and it is in the safe direction: the worklog was written at
`60fa4a3`, before `d1eeb3e` landed. Nothing is overstated.

My first format and lint checks piped through `tail` and therefore read `tail`'s exit status, which proves
nothing. Both were re-run unpiped; the exit codes above are from the unpiped run.

### Do the tests exercise the behaviour, or merely pass?

Read, not just counted. `DekkingEndpointsTests` drives the rules over HTTP against real PostgreSQL:
`Een_geplaatst_thema_dekt_zijn_doel_en_noemt_zichzelf_als_bewijs`,
`Een_vervallen_plaatsing_houdt_het_cijfer_tegen_tot_aan_de_HTTP_grens`,
`Een_voorgestelde_plaatsing_dekt_ook_over_HTTP_niets`,
`Een_klas_met_een_niet_afleidbaar_leerjaar_valt_terug_op_alles_en_zegt_dat`,
`Een_klas_zonder_doelen_in_haar_bereik_meldt_nul_van_nul_en_niet_alles_gedekt`.
On the frontend, the load-bearing assertions assert **absence** rather than presence, which is the shape
this story's own defect required: `queryByText(TOTAALVORM)).not.toBeInTheDocument()` scoped to the summary,
and `queryByText(/van \d+ gedekt/)).not.toBeInTheDocument()` for the group tallies. All copy is in
`nl.json` (33 `dekking.*` keys; every component string goes through `t()` or `tAantal()`, and no bare Dutch
string was found in the four components).

## Commands run

- `dotnet build` → succeeded, 0/0
- `JAARPLANNER_TEST_POSTGRES=... dotnet test --no-build` → 554 + 182 passed, 0 skipped
- `dotnet format --verify-no-changes` → exit 0, no output
- `corepack pnpm test` / `pnpm lint` / `pnpm build` → 349 in 17 files / exit 0 / built
- `psql ... CREATE DATABASE jp_e502gate`, then `dotnet ef database update` → `Done.`
- `ASPNETCORE_ENVIRONMENT=Development Demo__Seed=true dotnet run ... --no-launch-profile --urls http://127.0.0.1:5501` → seeded 2026-2027, one L3 class, a voorgesteld jaarplan
- `VITE_API_PROXY_TARGET=http://127.0.0.1:5501 corepack pnpm vite --port 5502 --strictPort --host 127.0.0.1` → serving, `/api` proxy 200
- Six `GET /api/klassen/{id}/dekking?bereik=...` probes across three classes and two scopes
- Browser: headless Chrome over CDP, six screen states, two widths

> **A trap worth recording for the next agent.** `ASPNETCORE_ENVIRONMENT` must be `Development` or the
> seeder never runs: `DependencyInjection.cs:217` gates it on
> `configuration.GetValue<bool>("Demo:Seed") && environment?.IsDevelopment() == true`, and
> `--no-launch-profile` leaves the environment as Production. `Demo__Seed=true` on its own gives you an
> empty database and a silent, entirely correct-looking `[]` from `/api/klassen`.

## Evidence

Under `%TEMP%\claude\C--source-Jaarplanner\1487800c-228f-48f0-9f90-7630354e780c\scratchpad\e502\`:

- `01-baseline-1440.png` — 14 rows, all niet gedekt, `0 van 14 doelen gedekt`
- `02-after-accept-1440.png` — after accepting on the kalender: `2 van 14`
- `03-stale-1440.png` — *"Nog geen betrouwbaar cijfer"*, no figure, no group tally
- `04-stale-390.png`, `08-healthy390.png`, `08-lj7-390.png`, `08-leeg390.png` — 390px
- `05-heelcurriculum-1440.png` — `2 van 15`, two groups
- `06-leerjaar7-1440.png` — fallback notice with "Deze klas" still pressed
- `07-leeg-1440.png` — *"Nog niets om tegen te meten"*
- `facts-*.json` — full DOM facts per state: body text, every attribute, fraction matches, overflow measurements

The console carried no warnings or errors during the browser pass: only `[vite] connecting...`,
`[vite] connected.` and React's DevTools info notice.

**Playwright MCP was not usable, and it was not broken.** It answered *"Browser is already in use for
...\ms-playwright-mcp\mcp-msedge-a1f3e3d"*. Checked before assuming: a live `msedge.exe` tree holds that
`--user-data-dir` (parent process created 10:11 today, a renderer at 14:23) and `lockfile` is present in
the profile directory. That is another session's live browser rather than an orphan, so nothing was
killed. Fell back to headless Chrome driven over CDP from Node, but **not** by resizing a window and
**not** through `--dump-dom`: `Emulation.setDeviceMetricsOverride` sets a true layout viewport at any
width, so 390px is a genuine 390px layout, and `Runtime.evaluate` reads the live DOM directly. That avoids
both traps this story's own evidence fell into.

## Minor observations (none blocks the verdict; the implementer may judge each)

- **[MINOR] A cached figure renders for about 120 ms after the plan goes stale out of band.** Measured:
  land on `/dekking` with `2 van 14` cached; make a placement stale in the database; SPA-navigate Jaarplan
  then Dekking while sampling the summary every 40 ms. Result: `t≈0ms: 2 van 14 doelen gedekt`, then
  `t≈120ms: Nog geen betrouwbaar cijfer`. The value shown is the last **true** response rather than a
  figure derived from a withheld one, and it self-corrects within about 120 ms, so the steady state is
  right in every case. Reported because criterion 3 says *no coverage figure anywhere*, and this is the
  only path on which one briefly appears. Related and out of scope: with **no** navigation at all, a plan
  that goes stale in another tab or session leaves the old figure on screen indefinitely, because there is
  no polling and no cross-tab invalidation. Nothing in the story or the backlog promises that, so it is
  noted rather than filed.
- **[MINOR, cosmetic] The empty-scope state renders an empty list container.** With zero groups the
  `overflow-hidden rounded-lg border border-border bg-card` wrapper still renders, so a bare 1px rule sits
  below the summary. Visible in `07-leeg-1440.png` at roughly y=450.
- **[MINOR, docs] `implementation.md` is out of date on its own "Still open" list.** It lists
  `kalender.herzienUitleg` as unfixed and offered to E3-07, but `d1eeb3e` fixed exactly that sentence. The
  same section's frontend test count (348) is one low; the real number is 349. Both are artefacts of the
  worklog having been committed one commit early.
- **[MINOR, pre-existing and already disclosed] The em dash reaches a user.** `DemoDataSeeder` writes
  `"Voorbeelddoel 1 — demodata..."` into `Leerplandoel.Tekst` and this screen renders it. The story logged
  this and declined to fix it as the seeder's string; confirmed visible in every screenshot.

## Defects

None. No criterion is unmet, no gate is red, the app starts and serves, and no test was found green for
the wrong reason.

## Cleanup

The API (5501), Vite (5502) and the headless Chrome (CDP 9333) that I started were stopped, each after
reading its command line to confirm ownership. Ports 5495 to 5500 were never touched, and the other
session's `msedge.exe` tree was left running (13 processes still alive afterwards). `jp_e502gate` was
dropped, which took the three test rows with it (`GATE-K3-01`, the leerjaar-7 class and the L1 class).
Pre-existing `jp_test_*` databases from other sessions' runs were left alone.
