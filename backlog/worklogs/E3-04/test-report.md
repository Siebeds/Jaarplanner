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

---
---

# E3-04 (persistence half) — Test report (round 2, fix verification)

**Verdict:** PASS. All ten fixes reproduce, the MAJOR from both gates is genuinely closed in a real browser,
the contested `role` finding is **withdrawn** (the implementer's dispute is factually correct, evidence below),
and no criterion from round 1 has regressed. Two MINOR items are filed; neither blocks the story.
**Mode:** both (xUnit unit + integration against real PostgreSQL, Vitest, and a Playwright browser pass with
route interception)
**Branch:** `story/E3-04-persistentie` @ `c381be2` (3 commits; round 1 verified `90035ec`), based on `main` @ `b44c869`
**Environment:** native PostgreSQL 17 on `127.0.0.1:5432`, fresh scratch database `jaarplanner_e304` migrated from the
real migrations, API on **:5384**, Vite on **:5373**. No `AzureAI:ApiKey`, so every generation 500s by design.
`JAARPLANNER_TEST_POSTGRES` used the correct local password (`jaarplanner_local`); **0 skipped** in both suites
proves the Postgres tests really ran and that no `28P01` masquerade occurred.

## Gates, reproduced exactly as claimed

| Gate | Claimed | Measured |
| --- | --- | --- |
| `dotnet test` unit | 478 / 0 failed / 0 skipped | **478 passed, 0 failed, 0 skipped** (4 s) |
| `dotnet test` integration | 112 / 0 failed / 0 skipped | **112 passed, 0 failed, 0 skipped** (1 m 14 s) |
| `corepack pnpm test` | 125 / 9 files | **125 passed, 9 files**, 0 failed, no act() warnings |
| `corepack pnpm lint` | | exit 0 (`eslint . --max-warnings 0 && tsc --noEmit`) |
| `corepack pnpm build` | | exit 0, 7,92 s |
| `dotnet format --verify-no-changes` | | exit 0 |

## Fix 1 (the MAJOR, from both gates) — PASS

Reproduced the same way the defect was: real Edge, DPR 2, with **only** `GET .../jaarplan/parameters` intercepted and
forced to 500, against the live API holding real stored settings (`Water` on period 2 plus a blocking `Schoolfeest`).

| What the fix had to do | Measured |
| --- | --- |
| Collapsed trigger reads `(instellingen niet geladen)`, never `(niets ingesteld)` | trigger text `Vooraf instellen: startthema's en vaste momenten (instellingen niet geladen)`, with `aria-expanded="false"` |
| A `role="alert"` visible **without** opening the panel | exactly one `[role="alert"]`, `visible: true`, at `y=469` (above the fold at 900 px), panel still collapsed. Text: *"Je bewaarde instellingen konden niet geladen worden. Zolang dat zo is, kan je niet genereren: je zou niet weten welke instellingen meegaan. Herlaad de pagina en probeer opnieuw."* |
| Generate button disabled | `isDisabled() === true` |
| Pressing it fires **no POST** | forced click, waited 1,5 s: `postsAfterClick == []` |

Evidence: `docs/ux/wireframes/e3-04-fix-instellingenfout.png` (desktop),
`docs/ux/wireframes/e3-04-fix-390px-fout.png` (390 px).

**Pending half, PASS.** With the same request left permanently unanswered: trigger reads `(instellingen laden...)`,
`aria-expanded="false"`, button disabled, click posts nothing.
Evidence: `docs/ux/wireframes/e3-04-fix-instellingen-laden.png`.

**Worth knowing, and it shapes MINOR-1 below:** the default `QueryClient` retries three times with exponential
backoff, so the error state does **not** arrive for roughly 7 seconds. My first probe at 1,2 s saw
`(instellingen laden...)` and zero alerts; only a 13 s settle produced `(instellingen niet geladen)`. Both states are
honest and both refuse the run, so the criterion holds throughout. But for those 7 seconds the disabled primary
action's only explanation is the word *"laden..."* inside a collapsed disclosure label.

## Fix 2 — the judgement call: refusing generation while the settings are unknown

**The strict route is the right call, and the way forward on offer is thin but real. Filed as MINOR-1, not a blocker.**

The reasoning stands: a body-less run applies whatever the server has stored, and a screen that cannot state those
settings cannot obtain consent for them. Refusing is the only option that neither lies nor acts unilaterally, and the
two alternatives are both worse: generating with a summary the screen admits is unknown, or silently sending two
empty arrays and wiping durable teacher input to make the screen true.

**What the screen actually offers the teacher.** I enumerated every interactive element in `main` in the failure
state: `Jaarplan genereren...` (disabled), the disclosure trigger, and seven per-card `Aanpassen` buttons. **There is
no retry control and no escalation.** The alert's own instruction is *"Herlaad de pagina en probeer opnieuw."*

**Judgement.** This is not the E3-06 violation ("never ship a control that does nothing"). That rule is about a
control that *appears* to work and does not; here the button is visibly greyed and an adjacent alert states the
reason and an action in plain Dutch. A page reload is an action every teacher can perform. So the letter of the rule
is met.

But it is the weakest possible way forward, for two reasons the screen does not admit:

1. **A reload is the action the app has already taken three times.** The alert only appears *after* TanStack Query
   exhausted its retries, so "probeer opnieuw" is advice to repeat what just failed. For a transient blip it works;
   for a durable fault the teacher loops.
2. **There is no escalation, unlike the sibling failure.** When *generation* fails, this same screen says
   *"Meld dit aan de beheerder van de tool."* When the *settings load* fails, it does not, so the teacher whose
   endpoint is durably down has no next step at all, on the screen that owns the core task.

Neither costs a criterion. Both are cheap to fix (an *"Opnieuw proberen"* button calling `instellingen.refetch()`,
plus one sentence naming the beheerder). See MINOR-1.

## Fix 3 — the disputed `role` on the stranded notice: **finding withdrawn**

The implementer's dispute is **factually correct on both halves**, checked in the code and then in the behaviour.

**The code.** `TeHerzien` on `main` @ `b44c869`, that is *before* this branch, from E3-07, is already
`role="region"` plus `aria-labelledby` with an sr-only `<p role="status">` carrying only the count sentence, and its
own docstring gives exactly the reason cited: it gained a select and several buttons per card, and a live region
wrapping controls re-announces its whole contents. So this is a pre-existing house pattern the notice was aligned
*to*, not a rationalisation invented for the fix. My round-1 finding named the wrong target.

**The behaviour**, measured in the browser on a real stranded setting (`Water` stored for `2026-10-05`, which starts
no block):

| Claim | Measured |
| --- | --- |
| It is a labelled region | `role="region"`, `aria-labelledby=":r3:"`, and the id **resolves**: accessible name *"Een bewaard startthema hoort bij een periode die niet meer bestaat"* |
| It carries an sr-only status | `<p role="status">` with the count sentence; computed `position: absolute; width: 1px; height: 1px; overflow: hidden`, so genuinely sr-only and not merely small |
| Announced | the status text is new content mounted when the notice mounts, and `role="status"` carries implicit `aria-live="polite"` |
| Keyboard reachable | *Weghalen* is reached on **Tab 12** from the top of the document |
| Impossible to silence without an explicit action | the notice's **only** control is `BUTTON: Weghalen`. No close, no dismiss, no "later", no link |
| *Weghalen* removes the entry from the next request | POST body after pressing it: `{"gewensteStartthemas":[],"vasteMomenten":[{"naam":"Schoolfeest","datum":"2026-09-15","blokkeertPlaatsing":true}]}`, so the stranded preference is gone and the unrelated vast moment is untouched |
| and *Weghalen alone* cannot silence it | pressed *Weghalen*, then reloaded **without** generating: the notice is **back**, the trigger reads `(1 vast moment, 1 zonder periode)` again, and `GET .../parameters` still returns `2026-10-05 / Water`. Silencing it requires the explicit regenerate the copy asks for |

Evidence: `docs/ux/wireframes/e3-04-fix-vervallen.png`.

**Also fixed and confirmed (antagonist MINOR, the double count):** the trigger reads `(1 vast moment, 1 zonder
periode)`, one kept setting and one clause. It used to read `(1 startthema, 1 vast moment, 1 zonder periode)`, two
settings where there is one.

## Fix 4 — contrast of the new alert, measured in the real browser

Measured twice by independent routes that agree, so the alpha is genuinely composited rather than assumed.

1. **CSS walk:** the alert's own `background-color` is `rgba(184, 30, 30, 0.1)`; the first opaque ancestor is the
   card's `rgb(255, 255, 255)`. Composited: `rgb(247.9, 232.5, 232.5)`.
2. **Real pixels:** element screenshot at **DPR 3** (3522x111 px), histogrammed in-page. The dominant colour is
   `rgb(247, 232, 232)` (357 168 px) and the text core is `rgb(184, 30, 30)` (15 430 px), so the rendered fill matches
   the composited prediction to within sub-pixel rounding.

| What | Foreground | Background (composited) | Ratio | Needs |
| --- | --- | --- | --- | --- |
| Alert text `text-suggestie-geweigerd` on `bg-suggestie-geweigerd/10`, 12 px / weight 500 | `rgb(184,30,30)` | `rgb(247,232,232)` | **5,45:1** | 4,5:1 (SC 1.4.3, normal text) |

**PASS**, with headroom. Note for the record: had the 10% tint been treated as a solid `#b81e1e` fill the check would
have reported about 1,0:1 and failed the fix wrongly; treating it as pure white would have reported 5,87:1 and passed
it too generously. Both directions were confirmed, which is why the histogram was taken. The alert carries no
colour-only state: the message *is* the text, so Art. XII is satisfied trivially. The stranded notice's own five
measurements from round 1 are unchanged, its computed colours being identical (`bg rgb(254,248,236)`, title
`rgb(103,54,20)`, border `rgb(179,97,15)`, *Weghalen* border `rgb(150,138,115)`).

## Fix 5 — 390 px, the `flex-wrap` trigger

**PASS on overflow; a net improvement, with one new cosmetic wrinkle.** Real Edge at 390x844, DPR 2, `isMobile`, in
three states (collapsed, panel open, scrolled to the startthema rows) and in the failure state:
`document.documentElement.scrollWidth == clientWidth == body.scrollWidth == 390` in **all four**. No document overflow.

Worst case measured (`(1 startthema, 1 vast moment, 1 zonder periode)`, the three-clause summary): the trigger is
316x80 px, four 20 px lines, `flex-wrap: wrap`. Child boxes:

| Child | Box |
| --- | --- |
| chevron glyph | `x=37 y=627 w=11 h=16`, **alone on line 1** |
| Label *"Vooraf instellen: startthema's en vaste momenten"* | `x=37 y=645 w=316 h=40` (two lines) |
| Summary *"(1 startthema, 1 vast moment, 1 zonder periode)"* | `x=37 y=687 w=305 h=20` (**one line**) |

The round-1 finding is fixed: the summary is no longer a three-line column squeezed beside a three-line label, it
reads as one sentence on its own line. **It still reads as one control**, being one `<button>`, so one tab stop and
one accessible name, with the whole 316x80 box as the hit target.

The wrinkle: because the label span takes the full 316 px, the chevron can no longer share its line and is now
orphaned above it. Visible in `docs/ux/wireframes/e3-04-fix-390px-ok.png`. Cosmetic, strictly better than what it
replaced, filed as MINOR-2.

## Fix 6 — the round-1 criteria, re-checked for regression

**No regressions. All still PASS**, and two of them are now pinned by *stronger* evidence than round 1 had.

### The reload that is the whole story — PASS, and now with the request body read directly

Loaded `/jaarplan` deep-linked to the seeded klas, with `Water` on period 2 plus a blocking `Schoolfeest` stored.

- Collapsed trigger before opening anything: `(1 startthema, 1 vast moment)`.
- Panel contents, read off the live DOM: **seven** live independent period rows;
  `Periode 2 (2 okt - 1 nov)` selected `"Water"`; periods 1 and 3 to 7 all `Geen voorkeur`, so nothing leaked to a
  neighbour; `Wat is het? = "Schoolfeest"`, `Wanneer? = 2026-09-15`, `radio "Nee, die periode is bezet" [checked]`.
- **An untouched form plus generate resends exactly what was stored.** Round 1 could only infer the wire shape from a
  400-versus-500 discrimination, because the MCP tool hides request bodies. Driving Playwright directly, the body is
  `{"gewensteStartthemas":[{"blokStart":"2026-10-02","themaNaam":"Water"}],"vasteMomenten":[{"naam":"Schoolfeest","datum":"2026-09-15","blokkeertPlaatsing":true}],"isLeeg":false}`
  Keyed on `blokStart` and never an ordinal, read off the wire rather than inferred.

Evidence: `docs/ux/wireframes/e3-04-fix-paneel-ok.png`.

### A duplicate-period body is 400, and no body still means "use the stored settings" — PASS

Exercised against the running API on :5384, all four cases back to back, then the store re-read:

| Request | Status | Verdict |
| --- | --- | --- |
| two `gewensteStartthemas` on the same `blokStart` | **400** | refused at the boundary, no longer silently thinned |
| body omitting `gewensteStartthemas` | **400** | `[JsonRequired]` holds |
| body omitting `vasteMomenten` | **400** | `[JsonRequired]` holds |
| **POST with no body at all** | **500** | **not caught by `[JsonRequired]`**: it passed validation and reached the missing AI key, which is exactly "use what is stored" |
| store re-read after all four | `Water` @ `2026-10-02` plus the blocking `Schoolfeest`, intact | nothing was destroyed by any refusal |

The no-body path is the one that could have been broken by making both arrays required, and it is not: 500 means it
got past model binding to the AI call. That it *uses* the stored settings is pinned by
`Bewaarde_parameters_zijn_uitleesbaar_en_gelden_bij_een_volgende_run`, which posts settings, then calls
`PostAsync(..., content: null)` and asserts `AantalNieuw == 0` plus a single `GeweigerdDoorVastMoment` named
`Schoolfeest`. Re-run under a filter: Passed.

### Settings survive a failed generation — PASS

Every POST in this session returned 500 (no AI key) and `GET .../parameters` returned the posted settings afterwards,
every time. The Art. IV.5 order (validate, then persist, then model) holds.

### New behaviour in this delta the browser had not seen: the tier guard (`niveau`) — PASS

Not in the brief, but new user-facing copy, so I drove it: intercepted `/rooster` to return
`niveau: "Subthemaperiode"` with two fortnight blocks. Measured: **zero** period selects offered, so no row can carry
a date the server would report as vervallen; the panel says *"Startthema's horen bij de periodes van het
jaaroverzicht. Zet de kalender terug op het hele jaar om ze in te stellen."*; **no** stranded notice is claimed; and
the kept setting is still sent verbatim (`{"blokStart":"2026-10-02","themaNaam":"Water"}`). Correct on all four
counts. Evidence: `docs/ux/wireframes/e3-04-fix-paneel-subniveau.png`.

*Recorded, not filed:* that copy tells the teacher to "zet de kalender terug op het hele jaar", and no zoom control
exists until E3-08. The state is unreachable today, since `/rooster` always answers `Themaperiode`, so nothing
misleads anyone now. But whoever builds E3-08 must make its control's label match this sentence.

### Concurrency fix (owner ruled it in) — PASS, against real PostgreSQL

`Een_geweigerde_gelijktijdige_insert_laat_de_context_bruikbaar`, a `[PostgresFact]`: it inserts the winner's row in
one context, then in a second context asserts `ProbeerGeneratieparametersToeTeVoegenAsync` returns **false**, that the
winner's row still **loads on that same context** (so the detach of owner *and* both owned collections works), and
that after `BewaarAsync` there is exactly one row holding the loser's settings, last write wins. Run under filter:
Passed, 0 skipped. The `IsUniekeSleutelSchending` guard is scoped by constraint name, so a `23505` on another table
cannot be swallowed.

### New tests read, not merely run

`Een_body_zonder_gewensteStartthemas_is_een_400_en_wist_de_bewaarde_lijst_niet` asserts **both** halves, the 400 for
the partial body *and* the 200 plus preserved store for the bodyless one, so it would fail if `[JsonRequired]` had
caught the no-body path. `Twee_startthemas_voor_dezelfde_periode_zijn_een_400_en_bewaren_niets` asserts the store is
still empty afterwards, not just the status. On the frontend, the two new collapsed-state tests assert
`aria-expanded === "false"` **before** looking for the alert, assert the summary is `samenvattingOnbekend` and
explicitly `not.toContain(samenvattingLeeg)`, and assert `posts` stays `[]` after a click, which is the shape round
1's test could not catch because it called `openForm()` first. The shared `genereer()` helper now waits for the button
to be **enabled**, so no other test can pass by silently clicking a disabled button.

## Commands run (round 2)

| Command | Result |
| --- | --- |
| `git log --oneline` and `git diff --stat 90035ec..HEAD` | 3 commits; 20 files, +1177 -97 |
| `dotnet ef database update` on a fresh `jaarplanner_e304` | migration applied, `Done.` |
| `dotnet test` with `JAARPLANNER_TEST_POSTGRES` (password `jaarplanner_local`) | 478 + 112 passed, **0 failed, 0 skipped** |
| `dotnet test --filter` on the four new/named tests | 4 Passed, 0 skipped (includes the `[PostgresFact]`) |
| `dotnet format --verify-no-changes` | exit 0 |
| `corepack pnpm install`, `test`, `lint`, `build` | exit 0 / 125 passed / exit 0 / exit 0 |
| five `curl` calls against :5384: duplicate period, two omitted arrays, no body, store re-read | 400 / 400 / 400 / 500 / settings intact |
| Playwright plus real Edge, `route()` forcing the settings GET to 500 | trigger `(instellingen niet geladen)`, one visible `role="alert"`, button disabled, `posts == []` |
| Playwright, settings GET never fulfilled | trigger `(instellingen laden...)`, button disabled, `posts == []` |
| Playwright, stranded setting | `role="region"` plus sr-only `role="status"`, Tab 12 reaches *Weghalen*, one control only, body drops the entry, reload without generating brings it back |
| Playwright, element screenshot at DPR 3 plus in-page canvas histogram | fill `rgb(247,232,232)`, text `rgb(184,30,30)`, **5,45:1** |
| Playwright at 390x844, four states | `scrollWidth == clientWidth == 390` in all four |
| Playwright, `/rooster` rewritten to `Subthemaperiode` | no selects, `anderNiveau` copy, no stranded claim, setting still sent |

Console over the whole session: only the expected 500s (the intercepted settings GET and the AI-less generation) plus
Vite's HMR chatter. No React warnings and no other errors.

## Evidence (round 2)

- `docs/ux/wireframes/e3-04-fix-instellingenfout.png`: the MAJOR fixed, showing `(instellingen niet geladen)`, the alert visible with the panel collapsed, and generate greyed out
- `docs/ux/wireframes/e3-04-fix-instellingen-laden.png`: the pending half, `(instellingen laden...)`
- `docs/ux/wireframes/e3-04-fix-vervallen.png`: the stranded notice in its new region plus status shape
- `docs/ux/wireframes/e3-04-fix-paneel-ok.png`: the kept settings loaded into the panel
- `docs/ux/wireframes/e3-04-fix-paneel-subniveau.png`: the tier guard
- `docs/ux/wireframes/e3-04-fix-390px-ok.png`, `e3-04-fix-390px-open.png`, `e3-04-fix-390px-fout.png`: 390x844
- Round 1's screenshots are unchanged and still referenced above.

## Defects (round 2, both MINOR, neither blocks the story)

### [MINOR-1] The refusal is right, but the only way forward is "reload", with no retry and no escalation

See "Fix 2" above for the full judgement. In the failure state the sole controls in `main` are the disabled
`Jaarplan genereren...`, the disclosure trigger, and seven card-level `Aanpassen` buttons. The alert says *"Herlaad de
pagina en probeer opnieuw."*, which is what `QueryClient` already did three times before the alert appeared, and there
is no *"Meld dit aan de beheerder van de tool."* the way the sibling generation failure has. On the screen that owns
the core task, a teacher with a durably failing endpoint has no next step.

**Suggested:** an *"Opnieuw proberen"* button calling `instellingen.refetch()` inside the alert, plus the beheerder
sentence. **Secondary:** for about 7 s of retry backoff the disabled button's only explanation is the word *"laden..."*
inside a collapsed disclosure label; consider stating that generation waits for the settings.
**Not a violation of "never ship a control that does nothing":** the button is visibly disabled and an adjacent alert
gives a reason and an action, which is the opposite of the E3-06 failure mode.

### [MINOR-2, cosmetic] At 390 px the `flex-wrap` fix orphans the disclosure chevron on its own line

The chevron glyph measures 11 px wide at `y=627` while the label span takes the full 316 px and starts at `y=645`, so
the arrow now floats alone above its own label instead of sitting beside it. Strictly better than the round-1 shape it
replaced, since the summary now reads as one line, and still one button with one tab stop, so this is polish rather
than a fault. Fix by nesting the chevron with the first line in a non-wrapping inner flex, or by dropping the chevron
to `shrink-0` inside a `min-w-0` label wrapper.

### [WITHDRAWN] Round 1's MINOR about the stranded notice being a plain div rather than an alert or a region

The implementer's dispute is upheld: `TeHerzien` on `main` already used region plus sr-only status before this branch,
for the stated reason, and the notice's behaviour now matches on every measurable count. See "Fix 3".

### [OBSERVED, out of scope, unchanged] The demo `Klas.Naam` and the open Art. II.3 server-string question

The seeded class name is rendered verbatim by the header. That is E3-06 demo data plus the open Art. II.3 ruling, not
this story. Recorded again only so nobody thinks the browser pass missed it.

**Correction to round 1 on that last point:** the em dash is **gone**. `GET /api/klassen` now returns
`"naam":"L3 derde leerjaar (demo)"`, fixed on `main` by the `amendment/taal-en-emdash` merge that this branch is based
on. Only the open Art. II.3 question about rendering server-generated strings to a user survives, and it is still not
this story's.
