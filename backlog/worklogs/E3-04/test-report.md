# E3-04 (persistence half) — Test report (round 1)

**Verdict:** PASS — with one MAJOR defect filed that does **not** fail any of the four acceptance criteria, and
which the implementer should fix before this story is marked `[x]`.
**Mode:** both (xUnit unit + integration against real PostgreSQL, Vitest, and a Playwright browser pass)
**Worktree:** `C:\source\Jaarplanner\.claude\worktrees\agent-a6cdf456eeaf6d126`
**Branch:** `story/E3-04-persistentie` @ `90035ec`, based on `main` @ `b44c869` (confirmed with `git branch --show-current`)
**Environment:** native PostgreSQL 17 on `127.0.0.1:5432`, a dedicated scratch database `jaarplanner_e304`
migrated from the real migrations, API on **:5384**, Vite on **:5373** (own ports, because a parallel agent may be
in this repo). **No `AzureAI:ApiKey`**, so every generation returns 500 by design.

---

## Criteria checked

### Ruling point 1: "`JaarplanGeneratieParameters` becomes persisted state: entity, table, migration (Art. IX)"
**PASS.**
- Entity: `backend/src/Jaarplanner.Domain/Planning/Generatieparameters.cs`, aggregate plus owned
  `BewaardStartthema` / `BewaardVastMoment`, both with client-generated `Guid` keys.
- Table + migration: `Persistence/Migrations/20260730191341_GeneratieparametersPerKlasEnSchooljaar.cs` creates
  `generatieparameters`, `startthemavoorkeuren`, `vastemomenten`, a **unique** index on `(KlasId, SchooljaarId)`,
  a **unique** index on `(GeneratieparametersId, BlokStart)`, an FK to `klassen` (Cascade) and one to
  `schooljaren` (Restrict).
- Applied for real: `dotnet ef database update` against a fresh database ran the migration and wrote the
  `__EFMigrationsHistory` row.
- Schema pinned by assertion rather than by claim: `De_bloksleutel_is_een_datum_en_er_is_geen_ordinaalkolom`
  queries `information_schema.columns` and asserts `BlokStart` exists with `data_type = 'date'` and that no
  `Ordinaal` / `BlokOrdinaal` / `Positie` column exists. Ten `[PostgresFact]` tests in
  `GeneratieparametersPersistentieTests` cover the round-trip, both unique indexes, both FKs,
  replace-deletes-rows, replace-on-an-existing-row, the klas cascade and the column length.

### Ruling point 2: "The form must load the saved settings and show them instead of starting empty"
**PASS, verified in a real browser, which is the gap the implementer left open.**
1. Opened `/jaarplan`, picked schooljaar 2026-2027 and klas `L3 ... (demo)`.
2. Opened *"Vooraf instellen: startthema's en vaste momenten"*. All **seven** period rows render live and
   independent: no growing list, no disabled rows, no clear-cascade.
3. Set **period 2 only** (`2 okt - 1 nov`) to `Water`; added a vast moment `Schoolfeest` / `15/09/2026` /
   *"Nee, die periode is bezet"*. The collapsed summary read `(1 startthema, 1 vast moment)`.
4. Pressed **Jaarplan genereren...** so `POST .../jaarplan/generatie` returned **500** (no API key), and the UI
   said *"Het genereren is nu niet beschikbaar. Er is niets gewijzigd aan je jaarplan. Meld dit aan de beheerder
   van de tool."* A configuration fault, with the model not blamed.
5. **Reloaded the page.** The collapsed trigger already read `(1 startthema, 1 vast moment)`; opening the panel
   showed `Periode 2 ... option "Water" [selected]`, `Schoolfeest`, `2026-09-15` and
   `radio "Nee, die periode is bezet" [checked]`. Periods 1 and 3 to 7 all still `Geen voorkeur [selected]`, so
   no preference leaked to a neighbour.
   Evidence: `docs/ux/wireframes/e3-04-persistentie-na-reload.png`.
6. `GET .../jaarplan/parameters` returned
   `{"gewensteStartthemas":[{"blokStart":"2026-10-02","themaNaam":"Water"}],"vasteMomenten":[{"naam":"Schoolfeest","datum":"2026-09-15","blokkeertPlaatsing":true}],"isLeeg":false}`,
   so the settings survived a generation that **failed**, which is what "validate, then persist, then model" buys.

### Ruling point 3: "Regeneration (FR-8 / E4) must honour them: a period marked bezet stays bezet on the next run"
**PASS on the code path, by assertion rather than in the browser.** A live regeneration cannot be shown here
because generation 500s without an API key, the residual E3-01/E3-02/E3-04 already record.
- `JaarplanGeneratieServiceTests.Een_tweede_run_zonder_body_honoreert_de_bewaarde_parameters`, read and checked:
  run 1 posts a blocking `Schoolfeest`; run 2 is `GenereerAsync(klas.Id)` with **no** parameters and asserts
  `DoesNotContain(plaatsingen, p => p.BlokStart == blokken[0].Start)`, a single `GeweigerdDoorVastMoment` naming
  `Schoolfeest`, **and** that the moment really is in the store (`opslag.Generatieparameters`). It asserts the
  behaviour, not the fake.
- Over HTTP, through the real DI container, with a stub AI client:
  `JaarplanEndpointsTests.Bewaarde_parameters_zijn_uitleesbaar_en_gelden_bij_een_volgende_run` posts settings,
  reads them back through a fresh `GET`, then calls `client.PostAsync(..., content: null)` and asserts
  `AantalNieuw == 0` plus a single `GeweigerdDoorVastMoment` named `Schoolfeest`. Every POST asserts its status.
  It also asserts that an explicitly **empty** body clears the settings.

### Ruling point 4: "`parameters.uitleg` must change in the same commit"
**PASS.** `frontend/src/i18n/nl.json`, same commit (`8c5b5b5`): the old *"Deze instellingen gelden voor deze
generatie: genereer je later opnieuw, vul ze dan opnieuw in."* is now *"Wat je hier instelt, blijft bewaard voor
deze klas: genereer je later opnieuw, dan gelden deze instellingen weer. Wil je iets niet meer, haal het dan hier
weg en genereer opnieuw."* Read on screen in the browser. `startthemasAlleGevuld` and `startthemasWisUitleg` are
deleted, so no orphan copy describing the removed clear-cascade survives.

### Design problem A: scoping, a dated `VastMoment` must not leak across school years
**PASS.** The key is `(KlasId, SchooljaarId)`, and the school year sits in the **lookup predicate** rather than in
an assertion afterwards (`EfJaarplanOpslag.LaadGeneratieparametersAsync`). The unit fake keys on both ids too,
with a comment saying why, so `Bewaarde_parameters_van_een_ander_schooljaar_worden_niet_gelezen` is not testing a
permissive fake. That test writes settings for the same klas under a different `schooljaarId`, then asserts
`Assert.Same(JaarplanGeneratieParameters.Geen, ...HaalParametersAsync(...))`, that the stale blocking moment
refuses nothing, and that the prompt never mentions it. Pinned against real PostgreSQL as well
(`Parameters_van_twee_schooljaren_staan_naast_elkaar_en_worden_niet_verward`, `[PostgresFact]`, passed).

### Design problem B: keying on `blokStart`, never an ordinal, in **both** storage and the request
**PASS, and the wire shape is confirmed against a running server.**
- Storage: `startthemavoorkeuren.BlokStart date`, and no ordinal column (schema test above).
- Request: `Startthemakeuze(DateOnly BlokStart, string ThemaNaam)`.
- The **old positional shape is now rejected**, measured against the live API on :5384:
  `{"gewensteStartthemas":["Water"],...}` gives **400**, while
  `{"gewensteStartthemas":[{"blokStart":"2026-10-02","themaNaam":"Water"}],...}` gives **500**, i.e. it is
  accepted and gets as far as the missing AI key.
- The browser's own POST returned **500, not 400**, and the row it persisted is `blokStart = 2026-10-02`, the
  start date of period 2, the row I set. A bare string cannot bind to `Startthemakeuze`, and an absent
  `blokStart` would have stored `0001-01-01`, so the browser demonstrably sent
  `{"gewensteStartthemas":[{"blokStart":"2026-10-02","themaNaam":"Water"}],"vasteMomenten":[{"naam":"Schoolfeest","datum":"2026-09-15","blokkeertPlaatsing":true}]}`.
  *Stated honestly:* the Playwright MCP network tool in this harness lists requests but does **not** expose the
  request body, so the shape is established by the 400-versus-500 discrimination plus the persisted row rather
  than by reading the body off the panel.

### Design problem C: a stale `blokStart` is flagged loudly, never dropped and never relocated (directie 2026-07-28)
**PASS.** Made real rather than simulated: I moved `Herfstvakantie` from `2026-11-02...11-08` to
`2026-10-26...11-01` in `schoolsluitingen`, after which `GET .../rooster` returned
`(1, 2026-09-01 to 09-28), (2, 2026-09-29 to 10-25), ...`, so the stored `2026-10-02` starts no block any more.
No beheerder API exists for this yet (E6-03 owns it), so the edit went straight to the table, which is the same
trigger E3-06's entry describes. On reload:
- The notice renders **outside the collapse**, with the panel still collapsed (`▸`).
- It **names the thema and its stored date**: *"Water, bewaard voor de periode vanaf 2 okt"*, a Dutch date with
  no ISO string.
- Title in correct singular: *"Een bewaard startthema hoort bij een periode die niet meer bestaat"*.
- Collapsed summary: `(1 startthema, 1 vast moment, 1 zonder periode)`.
- **No period silently acquired the preference:** all seven selects read `Geen voorkeur [selected]`, including the
  new period 2 (`29 sep - 25 okt`) whose date is adjacent to the stored one.
- **Not dismissible away into silence:** the only control is *Weghalen*, which clears the setting from the form and
  drops the summary to `(1 vast moment)`, but `GET .../jaarplan/parameters` still returns the stored preference,
  and after a reload the notice **is back**. Silencing it requires an explicit regenerate, which is exactly what
  the copy tells the teacher to do.
Evidence: `docs/ux/wireframes/e3-04-persistentie-vervallen.png`.
*Not verifiable here:* `ParameterRapport.VervallenStartthemas` as rendered by `Parameteroverzicht` in the browser,
because that needs a successful run. Covered over HTTP by
`Een_startthema_op_een_verdwenen_periodegrens_wordt_gerapporteerd` and in Vitest.

### ~390px, no horizontal overflow
**PASS, measured rather than eyeballed.** Real Edge at `390x844`, DPR 2, driven with `playwright-core`:
`document.documentElement.scrollWidth = 390`, `clientWidth = 390`, `body.scrollWidth = 390` in all three states
(collapsed, panel open with the notice showing, scrolled to the startthema rows), so **no document overflow**. The
only elements extending past `innerWidth` are the `LI`/`A` children of the E0-10 main nav, which lives in its own
horizontally-scrollable strip and is pre-existing, not this story's. The notice, the *Weghalen* button and the
seven period rows all wrap.
Evidence: `docs/ux/wireframes/e3-04-persistentie-390px.png`.

### Contrast of the new notice, measured in a real browser
**PASS.** Sampled from the real rendered pixels of a device-scale element screenshot **and** cross-checked against
`getComputedStyle` in Edge; the two agree exactly, so the alpha is composited rather than assumed.

| What | Foreground | Background | Ratio | Needs |
| --- | --- | --- | --- | --- |
| Notice title + uitleg (`text-attentie-ink`, 12px) | `rgb(103,54,20)` `#673614` | `rgb(254,248,236)` `#fef8ec` | **9,39:1** | 4,5:1 |
| "Water, bewaard voor de periode vanaf 2 okt" (`text-ink`) | `#15272e` | `#fef8ec` | **14,58:1** | 4,5:1 |
| *Weghalen* label | `#15272e` | `#ffffff` | **15,42:1** | 4,5:1 |
| *Weghalen* boundary (`border-input`) | `rgb(150,138,115)` `#968a73` | `#fef8ec` | **3,21:1** | 3:1 (SC 1.4.11) |
| Notice frame (`border-attentie`) | `#b3610f` | `#fef8ec` | **4,28:1** | 3:1 |

Never colour alone: every state also carries the `▲` glyph and a text label.

### Dutch copy: singular for one, and no em dashes
**PASS.** Every count of one read as singular on screen: `(1 startthema, 1 vast moment, 1 zonder periode)` and
*"Een bewaard startthema hoort bij een periode die niet meer bestaat"*. All three new count families
(`samenvattingVervallen*`, `vervallenTitel*`, `rapportVervallen*`) route through `tAantal` with real singular
copy. **Zero U+2014 and zero U+2013 in the whole of `nl.json`**, counted directly, and the guard test is now a
real catalogue-wide assertion (`expect(JSON.stringify(nl)).not.toContain(emdash)`) rather than the assertion over
`{}` it used to be.

---

## Commands run

| Command | Result |
| --- | --- |
| `git branch --show-current` (worktree) | `story/E3-04-persistentie`; `git log` gives `90035ec` on `b44c869` |
| `dotnet ef database update` (scratch DB `jaarplanner_e304`) | migration `20260730191341_GeneratieparametersPerKlasEnSchooljaar` applied, `Done.` |
| `dotnet test` with `JAARPLANNER_TEST_POSTGRES` set | **475 unit passed / 0 failed / 0 skipped** (28 s) and **109 integration passed / 0 failed / 0 skipped** (1 m 50 s). Reproduces the implementer's figures exactly, and **0 skipped** confirms the Postgres suite really ran |
| `dotnet test --filter` on the six named tests | all **Passed**, including the two `[PostgresFact]` ones |
| `corepack pnpm install` (fresh worktree) | exit 0 |
| `corepack pnpm lint` | exit 0 (`eslint . --max-warnings 0 && tsc --noEmit`) |
| `corepack pnpm test` | **122 passed / 9 files**, 0 failed, no `act()` warnings. Reproduces the claim |
| `corepack pnpm build` | exit 0, built in 8,07 s |
| `dotnet run` API :5384 plus `pnpm dev` :5373, demo seed on | started; *"Demo seed created schooljaar 2026-2027, klas cf206599... and 7 placements"* |
| `curl` old versus new request shape | positional array gives **400**; `{blokStart, themaNaam}` gives **500** |
| `psql` UPDATE on `schoolsluitingen` plus `GET .../rooster` | grid re-derived, `2026-10-02` no longer a block start |
| Real Edge at 390x844 via `playwright-core` | `scrollWidth == clientWidth == 390` in three states |

Named tests confirmed to assert what their names claim (all read, not merely run):
`Een_tweede_run_zonder_body_honoreert_de_bewaarde_parameters`,
`Een_mislukte_generatie_verliest_de_ingevulde_parameters_niet` (also asserts `opslag.Jaarplan is null`, Art. IV.5),
`Bewaarde_parameters_van_een_ander_schooljaar_worden_niet_gelezen`,
`Een_plaatsing_toevoegen_aan_een_bestaand_plan_slaagt` (writes a plan, reopens the context, adds a second
placement, then asserts `COUNT(*) = 2` in raw SQL, a genuine regression test for the Added-versus-Modified defect).

## Evidence

- `docs/ux/wireframes/e3-04-persistentie-na-reload.png`: the settings are still there after a reload
- `docs/ux/wireframes/e3-04-persistentie-vervallen.png`: the stranded-setting notice, panel collapsed
- `docs/ux/wireframes/e3-04-persistentie-390px.png`: 390x844
- `docs/ux/wireframes/e3-04-persistentie-defect-instellingenfout.png`: the defect below
- Console over the whole session: **one** message, the expected `500` on `.../jaarplan/generatie`. No React
  warnings and no other errors.

---

## Defects (back to the implementer)

### [MAJOR] A failed settings load leaves the collapsed screen asserting "(niets ingesteld)" while the next run silently applies the stored settings

This does **not** fail any of the four acceptance criteria, but it re-creates the exact defect shape UI audit
round 2 finding 1 recorded, one layer up, and the component's own docstring says why it must not happen: *"an
empty form ... and the teacher would then generate while the server still applies settings the screen never
mentioned."*

**Repro** (done in real Edge against the live API, with only that one GET intercepted):
1. Stored settings exist for the class (`Water` on period 2, blocking `Schoolfeest`).
2. Make `GET .../jaarplan/parameters` return 500. Load `/jaarplan`. Do **not** open the panel, since collapsed is
   the default.
3. Observed: the trigger reads `▸ Vooraf instellen: startthema's en vaste momenten (niets ingesteld)`;
   `parameters.instellingenFout` is **not visible**, because it is rendered inside `{open && ...}` and the panel is
   closed by default; and the stranded-setting notice is **not** rendered either, because it derives from the
   settings that failed to load.
4. Press **Jaarplan genereren...**. Observed: `request.postData() === null`, so **no body**, which by this story's
   own contract means "use the stored settings". The run therefore applies the `blokkeertPlaatsing: true`
   constraint and the `Water` preference the screen has just said were not set.

**Expected:** the failure is stated where a collapsed teacher can see it (in or beside the trigger, the same place
the `vervallen` notice already sits), or the summary says something like *"instellingen onbekend"* rather than
*"niets ingesteld"*. What it must not do is assert that nothing is set.
**Introduced by this commit:** before persistence there was nothing to load, so `(niets ingesteld)` was always
true. `useGeneratieparameters`, the `wijziging ?? instellingen.data` fallback and the placement of
`instellingenFout` inside the collapse are all new here.
**Why MAJOR and not CRITICAL:** the run's own `Parameteroverzicht` afterwards names the applied and refused
moments, so the teacher does learn eventually, and generation only ever adds `Voorgesteld` proposals, so nothing
is destroyed.
**Test gap:** `"says so when the kept settings cannot be loaded, instead of showing an empty form"` calls
`await openForm()` first, so it cannot catch this. The sibling plural test deliberately collapses the panel first
for exactly this reason; do the same here.

### [MINOR] The stranded-setting notice is a plain `<div>`, not `role="alert"` or `role="region"`
E3-06's stale-**placement** notice, for the same directie ruling, is a non-dismissible `role="alert"` naming each
thema. This one is a bare `div` with a heading paragraph, so it is announced only as ordinary content. It is
present at page load, so nothing is lost for a screen reader arriving fresh, but it also appears on the
settings-refetch path with no announcement. Cheap to align with its E3-06 sibling.

### [MINOR, cosmetic] At 390px the disclosure trigger label wraps to three centred lines beside a three-clause summary
`(1 startthema, 1 vast moment, 1 zonder periode)` pushes the trigger's flex row into a three-line label plus a
three-line summary block. Legible and non-overflowing, but ungainly. The third clause is new in this commit.

### [OBSERVED, out of scope] The demo `Klas.Naam` renders an em dash to a user
The seeded class is `"L3 <em dash> derde leerjaar (demo)"` and the header prints it verbatim. That is E3-06 demo
data plus the open Art. II.3 server-string question, not this story. Recorded only so nobody thinks the browser
pass missed it.
