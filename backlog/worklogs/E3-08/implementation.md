# E3-08 — Zoom levels (jaar ↔ periode/blok)

## Build round 1 — a two-option tier switch that drives one `/rooster` fetch

- **FR / Article:** FR-6.3 (zoomniveaus), Art. IX.3 (planningsblokken, two ratified tiers, no calendar
  unit), Art. II.3 (all copy in `nl.json`, no server-authored string on screen), Art. XII + WCAG 2.2 AA
  (never colour alone, measured contrast), Art. X (gates). ADR-0013/ADR-0020 (tier derivation and nesting),
  ADR-0014/ADR-0021 (state ownership — see the deviation below), ADR-0017 (design system).
- **Branch:** `story/E3-08-zoomniveaus`, branched fresh from `main` (`0de4851`).
- **Frontend only.** `git diff --stat -- backend/` is empty. `GET /api/schooljaren/{id}/rooster?niveau=…`
  already existed, already validated `?niveau=99` as a 400 (re-verified live: **400**), and already returned
  `ouderOrdinaal` per sub-block. Nothing in the story needed a backend change, so `dotnet test` was not run.

### Files changed

| File | Why |
|---|---|
| `frontend/src/features/jaarplan/Weergaveschakelaar.tsx` | **New.** The segmented control: `role="group"` with a visible `aria-labelledby` label and two `<button aria-pressed>`s. |
| `frontend/src/features/jaarplan/types.ts` | New `Planningsblokniveau` union (mirrors the backend enum, **no `Maand` member**); `GENERATIEBLOKNIVEAU`'s doc now records that the "another tier" branch is live and that the declaration must stay a bare literal (a backend test parses it). |
| `frontend/src/features/jaarplan/api.ts` | `haalRooster(schooljaarId, niveau)` — the tier is passed explicitly rather than left to the endpoint's default. |
| `frontend/src/features/jaarplan/useJaarplan.ts` | `roosterKey` carries the tier; `placeholderData: keepPreviousData` on the rooster query. Both are load-bearing (traps 1 and 4). |
| `frontend/src/features/jaarplan/Jaarplankalender.tsx` | Holds the level, renders the control above the spine, derives `bordNiveau` + `kanVerplaatsen` from the *answer*, swaps the board's `aria-label` and the explanatory line, threads both down. |
| `frontend/src/features/jaarplan/Jaarspine.tsx` | Takes `niveau`: the sr-only ordinal follows the tier, and the visible date is hidden below `sm` at the fine tier (found by looking — see below). |
| `frontend/src/features/jaarplan/Periodekolom.tsx` | Fine-tier heading (`Subthemaperiode N`), the `ouderOrdinaal` line, and `useDroppable({ disabled })` where a drop cannot land. |
| `frontend/src/features/jaarplan/Themakaart.tsx` | `kanVerplaatsen`: no grip, no period picker, and the stale-placement instruction points at the view where re-placing works. |
| `frontend/src/i18n/nl.json` | 8 new keys; `parameters.anderNiveau` rewritten (obligation 2). |
| `frontend/src/features/jaarplan/Jaarplankalender.stories.tsx` | Serves the real fine grid for `?niveau=Subthemaperiode`, so the control in the review artifact is not a control that lies. |
| `…/Jaarplankalender.test.tsx`, `…/Generatieparameters.test.tsx` | 6 + 3 new tests. |

### Key decisions

1. **One grid, one truth.** The tier is a `/rooster` argument; the spine, the board's accessible name and every
   column heading come from that one answer. `bordNiveau` and `kanVerplaatsen` are derived from `grid.niveau`
   (the response), never from the `niveau` state (the request) — during the one request a switch takes, the
   previous grid is still on screen, and reading the request would label and enable it as the tier it is not yet.
2. **`kanVerplaatsen` is a correctness rule, not a preference.** `VerplaatsPlaatsingAsync` derives candidates as
   `_indeling.Blokken(schooljaar, GeneratieNiveau)` and requires `b.Start == doelBlokStart && b.Niveau ==
   plaatsing.BlokNiveau`, so a subthemaperiode start that is not also a themaperiode start is always a 400. The
   comparison therefore goes through `GENERATIEBLOKNIVEAU`, which is *why* it is true, rather than through a bare
   `"Themaperiode"`. **One nuance the brief slightly overstates and which is worth having on the record:** a drop
   on a parent's *first* sub-block would in fact succeed, because that date **is** the parent's start. That makes
   the affordance worse rather than better — the teacher would think they moved a thema into sub-block 1 when they
   moved it into the whole themaperiode — so removing the affordances outright is still right.
3. **The tier is `useState` in `Jaarplankalender`, not Zustand — a deliberate deviation from ADR-0014/ADR-0021.**
   Both name "view zoom" as Zustand's. The value has exactly one reader tree, rooted in the component that already
   owns the fetch and passes the grid down as props; a module-scoped store would add a second home for a value with
   a single owner and would outlive the component (carrying one class's grain into the next, and leaking between
   tests). E3-07 made the identical call for drag state, which ADR-0014 names in the same sentence, and shipped it
   audited. Recorded here and in a code comment so it is a choice, not an oversight. **If the orchestrator or the
   architect prefers the ADR read, the change is small and local** (one store, plus a reset per class); it should
   then be an amendment note on ADR-0014 rather than a silent edit.
4. **The fine tier does not lie about the plan.** A `Themaplaatsing` keys on a themaperiode start (ADR-0020 §3) and
   *which weeks inside that period it occupies is not modelled*. So the card renders **once**, in the sub-block
   whose `start` equals `blokStart` (the parent's first), with no repetition and no "runs through here"
   continuation — both would assert an extent the data does not contain. Every sub-column states its parent from
   `ouderOrdinaal`, and the legitimately-empty siblings are explained **once above the board**, never per column.
5. **Copy follows the label (obligation 2), which is the opposite of what the old string implied.** Both tiers show
   the whole school year; only the grain differs. `parameters.anderNiveau` now reads *"Startthema's horen bij de
   themaperiodes. Zet de weergave hierboven op “Themaperiodes” om ze in te stellen. Wat je eerder bewaarde, blijft
   ongewijzigd en gaat gewoon mee."* — it names the control and the option, drops the false "hele schooljaar"
   claim, and states that the kept settings travel unchanged (which the browser pass confirmed on the wire).
   A test asserts the *agreement* (`anderNiveau` contains `weergaveGrof` and `weergaveLabel`), so the copy and the
   button cannot drift apart.
6. **No new hue and no new dependency.** `petrol` only; state rides on `aria-pressed` + `font-semibold` +
   fill-vs-transparent on a bordered track. Hand-rolled rather than adding a Radix primitive: two options need no
   roving tabindex, and each button is already a tab stop.
7. **The week counts are deliberately not in the labels.** `4–6 wk` / `~2 wk` are configuration behind the E3-05
   seam; printing them would compile a default into user-facing copy.
8. **`Planningsrooster.niveau` stays `string`.** It is what the server said, not what this app asked for; the
   narrowing to the union happens once, in the kalender, and an unrecognised value degrades to the coarse
   presentation with moving **off** rather than on.

### Two things looking at it found that 196 green tests did not

- **The fine tier's explanation ran the full 1350px as one line** at 1440px (it is twice as long as the coarse
  one, which had never stretched). Now `max-w-4xl`.
- **The spine's dates became noise at 390px on the fine tier**: 19 segments across 390px is ~18px each, so every
  label truncated to `1… 1… 2…`, where the leading digit reads as a day. The visible `<time>` is now
  `hidden sm:inline` at the fine tier only; the sr-only ordinal is untouched, the filled-vs-outline bar still
  carries the state, and every board column below states its own dates in full.

### Tests added (9), and each was mutation-checked

`Jaarplankalender.test.tsx` — `describe("Jaarplankalender — zoomniveaus (E3-08, FR-6.3)")`:
1. *asks the API for the chosen tier and draws the whole screen from that one answer* — pins `?niveau=` on the
   **first** request too, `aria-pressed`, the board's `aria-label` following the tier (trap 2), the
   `ouderOrdinaal` line on all four sub-columns of parent 1, and the spine's sr-only ordinals naming the tier.
2. *caches the two tiers apart* (trap 1) — after fine→coarse the coarse grid is asserted **with no `await`**, so
   it must already be in the cache under its own key; plus the fine grid was derived exactly once, and no
   full-screen loading line ever appeared.
3. *draws a thema once, at the start of its themaperiode, and leaves the rest of that period empty* — one card,
   in sub-column 1, six empty siblings, and the explanation exactly once.
4. *does not declare a healthy plan te herzien at the finer tier* (trap 3) — **asserted, not argued.** The
   non-dismissible "Te herzien" region must not exist and the card must be on the board.
5. *offers no move affordance at the finer tier, and says in visible text where moving works* — grip present at
   coarse (the premise) and absent at fine, no `verplaatsNaar` in the open panel, `uitPeriodeHalen` still there,
   `fijnUitleg` shown and `sleepUitleg` gone.
6. *no axe violations at the finer tier.*

`Generatieparameters.test.tsx` — `describe("Generatieparameters — across a zoom switch (E3-08, FR-6.3)")`:
7. *keeps an unsent edit through a switch to the finer tier and back, and still sends it* (trap 4, the sharpest
   reading of "without losing state") — set a startthema, do **not** generate, switch to fine (panel still
   `aria-expanded="true"`, `anderNiveau` shown, no `combobox`, no stranded region, summary still counts the
   edit), switch back (the row still holds `Herfst`), then generate and assert the POST body is
   `{"gewensteStartthemas":[{"blokStart":"2026-09-01","themaNaam":"Herfst"}],"vasteMomenten":[]}`.
8. *sends the kept settings unchanged while the finer tier is showing* (obligation 1) — a run fired from the fine
   view posts the stored startthema **and** vast moment byte-for-byte.
9. *names the control in the copy* (obligation 2) — the message contains the option label and the group label,
   and no longer contains "hele schooljaar".

**Mutation checks (this repo's rule that a test must be shown to bind):**
- Dropping the tier from `roosterKey` → **all 6** zoom tests fail.
- Dropping `placeholderData: keepPreviousData` → tests 7 and 9 fail, and the failure message is the mechanism:
  *"Unable to find an accessible element with the role group and name Startthema's"*, i.e. the form was
  unmounted by the switch. That is precisely the display/request desync E3-04's fix round 4 closed for a failed
  settings load, and a zoom control would have re-created it.

### Gates

| Gate | Result |
|---|---|
| `corepack pnpm test` | **196 passed / 12 files, 0 failed, 0 skipped** (was 187/12 before this story). |
| React `act()` warnings | **none** — the run was grepped for `act(`/`warning`/`stderr`, empty. |
| `corepack pnpm lint` | exit 0 (ESLint `--max-warnings 0` + `tsc --noEmit`). |
| `corepack pnpm build` | exit 0, built in 2.72s. |
| Backend | **untouched** (`git diff --stat -- backend/` empty), so `dotnet test`/`dotnet format` were not run. |

### Browser evidence (live API + real PostgreSQL, driven with CDP)

The Playwright MCP server is not available in this session, so Chrome was driven from Bash over the DevTools
protocol via Node's built-in `WebSocket` (`Emulation.setDeviceMetricsOverride`, which gives an **exact** 390px
viewport rather than the ~504px `--window-size` clamp). **My own ports, in case a parallel agent had its own:**
API `http://localhost:5385`, Vite `http://localhost:5375` (proxying to 5385), CDP `9333`.

`/health/ready` → `Healthy`. The local database was **missing E3-04's migration**
(`GET …/jaarplan/parameters` → 500, `42P01: relation "generatieparameters" does not exist`), so
`dotnet ef database update` was applied before the pass; that is an environment gap on this machine, not a code
change, and it is why the first screenshots showed *"(instellingen laden…)"*.

Observed at **1440px** and at **exactly 390px**, both tiers, switched both ways:

- 7 columns headed `Periode N` at the coarse tier; **19** headed `Subthemaperiode N` with `Hoort bij themaperiode
  N` at the fine tier (the real 2026-2027 grid). Board `aria-label` flips between *"Themaperiodes van het
  schooljaar"* and *"Subthemaperiodes van het schooljaar"*.
- ~~**No horizontal overflow at either width or tier:** `scrollWidth === clientWidth` (1440/1440, 390/390).~~
  **CORRECTED in fix round 1 (finding 9): that sentence measured the wrong element.** What holds is that the
  **document** does not overflow — `documentElement.scrollWidth === clientWidth`, re-measured as 1425/1425 and 390/390.
  The **board** does overflow, by design: it is an `overflow-x-auto` ribbon, and at the fine tier the `<ol>` measures
  `scrollWidth 5800` against `clientWidth 1384`/`358`. Sideways scrolling *is* the board's mechanism, so a claim that it
  does not scroll would have been a claim that the fine tier is broken. The product was right; the measurement was
  pointed at the wrong node.
- The card carries the grip (`⠿`) at the coarse tier and **not** at the fine one. With the `Aanpassen` panel open:
  coarse → `["Aanpassen sluiten", "Verplaatsen", "Uit deze periode halen"]` with 1 `<select>`; fine →
  `["Aanpassen sluiten", "Uit deze periode halen"]` with **0** selects.
- **Obligation 1, verified in the browser rather than inferred:** with the panel open, switching to the fine tier
  leaves it open (so nothing remounted), the *Startthema's* fieldset renders **0** selects and the rewritten
  `anderNiveau` sentence, there is **no** stranded notice, and *Jaarplan genereren* stays enabled.
- Side observation, recorded rather than "fixed": an already-open `Aanpassen` panel survives the switch, because
  the first column's key is the same date at both tiers. The picker then disappears from under the teacher — which
  is honest (the destination genuinely does not exist at this tier) and the reason is stated above the board.

**Contrast, measured in the browser with alpha composited up the ancestor chain** (identical at 1440 and 390, in
both states):

| Element | Measured | Floor |
|---|---|---|
| Selected option, white on `petrol` (12px, 600) | **8.90:1** | 4.5:1 |
| Selected option's **fill** vs the page | **8.90:1** | 3:1 (SC 1.4.11) |
| Unselected option, `ink` on `card` (12px, 500) | **15.42:1** | 4.5:1 |
| Track **border** (`--input`) vs the page | ~~3.40:1~~ **3.21:1** | 3:1 (SC 1.4.11) |
| Visible group label *Weergave* (12px, 600) | **14.55:1** | 4.5:1 |

The track's own fill measures 1.06:1 against the page (white on warm off-white), which is exactly why the border
is the carrier and why `border-input` rather than `border-border` was used.

> **Corrected in fix round 1 (finding 9):** the border figure above was the one measured **on a card**
> (`border-input` on `bg-card`, 3.40:1). Where this control actually sits it is on **paper**, and there it measures
> **3.21:1** — still over SC 1.4.11's 3:1, but the quoted number was not the number for this control. The component's
> own comment documented both values and the worklog took the friendlier one, which is the failure mode this repo has
> recorded before: a measurement reported from the wrong context reads as a measurement that was not retaken.

### Self-check vs the acceptance criteria

| Criterion | Met? | Evidence |
|---|---|---|
| *"Level switching works"* | yes | Browser: both directions at both widths; the whole screen (spine, board, headings, accessible name, affordances) follows. Tests 1–6. |
| *"without losing state"* | yes | Two senses, both pinned. **Server state:** both tiers stay cached (tier in `roosterKey`), so a switch back is instant and the fine grid is derived once (test 2). **Teacher state:** an unsent parameter edit survives fine→coarse and is still what a run sends (test 7), and an open disclosure/panel is not remounted (browser + test 7). |
| *"No unit hard-named"* | yes | Only `Themaperiode`/`Subthemaperiode` appear, in code, copy and the wire. `Planningsblokniveau` has no `Maand` member; no month, week-of-year or term name anywhere; the ratified week counts are deliberately absent from the labels. |
| *Obligation 1 (E3-04's form at the finer tier)* | yes | 0 period rows, no stranded claim, `anderNiveau` instead; kept settings travel byte-identically (test 8 + the browser). |
| *Obligation 2 (`anderNiveau` agrees with the label)* | yes | Copy rewritten to name the control and the option; test 9 asserts the agreement, not the sentence. |

### For the test-runner

Unit: `cd frontend && corepack pnpm test` (from Bash; a fresh worktree needs `corepack pnpm install` first).
The zoom tests are the two `describe`s named `(E3-08, FR-6.3)`.

Playwright/browser, against a live API + PostgreSQL (the tier is component state, so it is not deep-linkable —
it must be clicked):

1. `dotnet ef database update` if `GET /api/klassen/{id}/jaarplan/parameters` 500s with `42P01`.
2. Start the API with `Demo__Seed=true`, then Vite with `VITE_API_PROXY_TARGET` pointing at it.
3. Open `/jaarplan?schooljaar=<2026-2027 id>&klas=<L3 derde leerjaar (demo) id>`.
4. Above the year strip: **Weergave · Themaperiodes | Subthemaperiodes**. Press *Subthemaperiodes*.
   Expect 19 columns headed `Subthemaperiode N` + `Hoort bij themaperiode N`; `Ik en mijn klas` in
   *Subthemaperiode 1* only, `Subthemaperiode 2` reading *Nog niets gepland*; no `⠿` grip; the sentence
   *"Thema's worden per themaperiode gepland… Verplaatsen doe je in de weergave “Themaperiodes”."*
5. Open *Aanpassen* on the card: **no** period picker, *Uit deze periode halen* still present.
6. Open *Vooraf instellen*, set a startthema at **Themaperiodes**, switch to **Subthemaperiodes** (panel stays
   open, no rows, `anderNiveau` shown), switch back — the choice must still be there. Then *Jaarplan genereren*
   and check the request body still carries it. (Generation itself 500s here with no `AzureAI:ApiKey`; the body
   on the wire is the thing to look at.)
7. At exactly 390px: no horizontal page scroll at either tier; the strip shows bars without truncated dates at
   the fine tier.
8. Measure the control's contrast in both states with alpha composited, and compare with the table above.

### Open questions / Art. XIV touched

- **ADR-0014/ADR-0021 vs `useState`** (decision 3). A deliberate, argued deviation with precedent (E3-07's drag
  state). Needs an accept-or-overrule, and if overruled, an ADR amendment rather than a quiet code change.
- **Art. XIV stays open and is not pre-empted.** No calendar unit is named; both tiers come from the E3-05 seam.
- **E3-09 untouched on purpose.** `VOORLOPIGE_TE_VOL_DREMPEL` still counts thema's, so at the fine tier a te-vol
  themaperiode also reads te-vol on its first sub-block (same placements, same count). The owner's 2026-07-31
  ruling reassigns that definition to E3-09 along with the five places it is written down; folding it in here
  would have merged two stories and needed a read-side backend change.
- **A thema spanning two periods** (an open E3-10 review question) is *visible* at this tier for the first time: a
  4-week thema in a 5-week themaperiode is drawn in one 2-week sub-column. This story deliberately does **not**
  answer it — drawing the span would require modelling it. Worth putting in front of the teacher review, because
  the fine view is where the question stops being abstract.
- **Sub-column width** is kept at `w-72`, like a coarse column, so the card is the same object at both tiers; the
  cost is a ~5x wider scroll. Recorded as a choice; narrowing would need a second card layout.

---

## Fix round 1 — the antagonist's 3 MAJOR + 6 MINOR + 2 QUESTION on `a1a75d9`

Gate results going in: **test-runner PASS** (196/12, lint, build, backend untouched, real-browser axe clean at
coarse-1440 / fine-1440 / fine-390); **antagonist VIOLATIONS FOUND**. Everything below is per finding, and it says
what was reproduced, what was not, and what was narrowed.

**Gates coming out.** `corepack pnpm lint` exit 0 · `corepack pnpm vitest run` **200 passed / 12 files, 0 failed,
0 skipped** (196 → 200: four new tests) · **zero** `act(` / `stderr` / `console.error` lines in the run · `corepack
pnpm build` exit 0, built in 2.88s · `git diff --stat -- backend/` **empty**, so `dotnet test` / `dotnet format` did
not run and are not claimed.

**Browser evidence.** Playwright MCP is again unavailable here, so Chrome was driven over CDP as before. **My ports,
claimed in the coordination channel first:** API `5386`, fault proxy `5396`, Vite `5376` (proxying to 5396), CDP
`9334`. A parallel session holds 5407/5307 and 5373/5183; nothing here touched those. Every measurement below comes
from `http://localhost:5376` against the real API on 5386 and real PostgreSQL, and the app under it was read back out
of the page rather than assumed.

One environment note worth keeping, because it cost twenty minutes: `dotnet run --no-launch-profile` **does not load
user-secrets**, because with no launch profile there is no `ASPNETCORE_ENVIRONMENT` and that provider is
Development-only. The API then starts, answers, and 500s every query with *"The ConnectionString property has not
been initialized"*, which reads exactly like a broken database. `ASPNETCORE_ENVIRONMENT=Development` is required.

### 1. [MAJOR] The fine tier relabelled a stranded kept startthema as a valid one — fixed, reproduced first

**Reproduced in the browser before fixing**, with the real API and the demo class's own **kept** setting
(`{blokStart: 2026-11-09, themaNaam: "Licht en donker"}`, i.e. themaperiode 3). There is no write endpoint for the
vakantiestructuur and no `psql` on this machine, so the beheerder's edit was produced where it actually reaches the
client: a small proxy in front of the API rewrites the coarse `/rooster` response so that block's start moves one day
(`2026-11-09` to `2026-11-10`). That is precisely what a vakantie edit does to a stored preference. With round 1's code:

| step | tier | trigger summary | stranded region |
|---|---|---|---|
| A (unshifted) | Themaperiodes | `(1 startthema)` | no |
| B (shifted) | Themaperiodes | `(1 zonder themaperiode)` | **yes** |
| C, D (shifted) | Subthemaperiodes | **`(1 startthema)`** | no |
| E (shifted) | Themaperiodes | `(1 zonder themaperiode)` | yes |

C/D against B/E is the finding, in the product, with *Jaarplan genereren* enabled throughout. After the fix the same
script reads `(1 zonder themaperiode)` at **every** step B to E, with the loud region still only at the coarse tier.

**The fix takes the first option the brief offered: resolve the check against the generation-tier grid regardless of
the view.** `Jaarplankalender` now runs a second `usePlanningsrooster(schooljaarId, GENERATIEBLOKNIVEAU)` and hands
*that* grid to the parameter form; the board keeps its own. It is not a second request in the normal path (the board
opens at that tier, so the observer shares the first response's cache entry and stays subscribed when the board zooms
away) and it is not a second grid on screen, because nothing renders from it except the form's own period rows, which
name themaperiodes by definition. The form gained one prop, `weergaveNiveau`, and the two questions are now separate:
`isGeneratieNiveau` ("are these blocks the periods a setting names?") governs every *claim*, and
`toontGeneratieNiveau` ("is the board showing them?") governs only *presentation*. Conflating those two was the bug.

The stranded rows and the loud region stay withheld at the fine tier, which is E3-04's obligation 1 and which the
audit explicitly blessed. What no longer changes with the view is the count: identical state now yields an identical
summary at both tiers, so the summary degrades to the *true* clause rather than to silence, which matters, because
silence here would have fallen through to `(niets ingesteld)` — the one thing this form is documented never to say.

**Test:** *"does not relabel a stranded kept startthema as a valid one at the finer tier"*
(`Generatieparameters.test.tsx`), with a stranded fixture: the missing precondition that made test 7's
`queryByRole("region", …)` vacuous. Mutation check: reverting the two props to the board's grid fails it with
`expected '1 startthema' to be '1 zonder themaperiode'`, i.e. the exact string the antagonist predicted.

### 2. [MAJOR] A failed fine-tier `/rooster` fetch destroyed the whole screen — fixed, reproduced first

**Reproduced in the browser**, as instructed, by serving a 500 for `?niveau=Subthemaperiode`. It is real, and worse
than reading the code suggests:

| | before pressing *Subthemaperiodes* | after (round 1 code) |
|---|---|---|
| zoom control | present | **gone** |
| board columns | 7 | **0** |
| thema cards | 6 | **0** |
| *Jaarplan genereren* | present | **gone** |
| visible text | 2359 chars | **525 chars** |
| retry | n/a | **none** |

So one press replaced a year plan with one sentence and nothing to click. The library gate is what the antagonist
said it was: `placeholderData: keepPreviousData` applies while `status === 'pending'`, and an errored query is not
pending, so the placeholder is dropped.

**The fix keeps a way forward, and prefers degrading to failing.** When the chosen tier errors, the generation tier's
already-cached grid stands in, so the plan, the board, the generation card and the control all stay; the failure is
one line beside the control that caused it, with its own *Opnieuw proberen*. The pressed option deliberately stays the
one the teacher chose: forcing it back to the tier on screen would make pressing it again a no-op, since React skips a
`setState` to the same value, which is this project's banned "control that does nothing". Only when there is genuinely
nothing to draw (a failed **first** load) does the notice take the page, and even then it keeps the zoom control and
the retry. `roosterHerstelGeprobeerd` mirrors E3-04's fix round 4: `refetch()` on an errored query holding no data
resets `status` to `pending`, so keying the notice on `isError` alone would unmount the only live control for the
length of the retry.

After the fix, in the browser: control present, *Subthemaperiodes* still pressed, 7 coarse columns, all 6 cards, the
generate button, 2538 chars of text, and a working retry that recovers to 19 fine columns once the fault is switched
off. Neither sentence says *"herlaad de pagina"* (the E3-04 audit's rejected next step); they name a retry, the other
tier, and the beheerder. The button is a **sibling** of the `role="alert"`, asserted in the browser
(`alert.contains(button) === false`) and in the test.

**Measured with alpha composited, at 1440 and at exactly 390:** notice text `5.18:1` (14px/500, floor 4.5:1), retry
label `15.42:1`, retry **border** `6.48:1` (floor 3:1; the border matters because `variant="outline"` puts `bg-card`
on the wash, so the fill carries nothing). Document overflow 1425/1425 and 390/390 in the failure state.

**Tests:** *"keeps the plan and a way forward when the chosen tier fails to load"* and *"offers a retry and the other
tier when the first grid fetch fails, and recovers on the retry"*. Mutation check: dropping the fallback fails the
first with `Unable to find … De weergave die je koos, kon niet geladen worden`.

### 3. [MINOR] `conceptUitleg` promised moving on a tier that offers none — fixed by dropping the enumeration

It now reads *"Dit scherm is een eerste werkende versie voor de bespreking met directie en leerkrachten. Wat je hier
aanpast, wordt bewaard. Wat je op deze weergave kan doen, staat boven het jaarplan."* Tier-awareness was the other
option; enumerating affordances in a banner is what created the contradiction, and the two sentences that *do* state
the affordances (`sleepUitleg` / `fijnUitleg`) already sit directly above the board and already follow the tier. This
also honours the standing "explanatory prose is the first thing to cut" rule rather than adding a second variant.

### 4. [MINOR] `anderNiveau`'s second sentence was false after an unsent edit — fixed

Now: *"Startthema's horen bij de themaperiodes. Zet de weergave hierboven op “Themaperiodes” om ze te bekijken en in
te stellen. Wat nu ingesteld staat, gaat mee met de volgende generatie, en die generatie bewaart het ook."* It claims
nothing about the stored set being unchanged, states what actually travels (the current settings, edit included) and
that a run saves them. The existing agreement test still binds: the message must contain the option label and the
group label.

### 5. [MINOR] Two ordinal spaces on the delete confirmation — fixed in copy, no component change

`plaatsing.blokOrdinaal` is the **themaperiode** ordinal at both tiers, so the sentence only had to say which object
the number belongs to: *"“{thema}” uit themaperiode {ordinaal} halen? Dat kan je niet ongedaan maken."* A card in
*Subthemaperiode 9* is now asked about *themaperiode 3*, and the two numbers can no longer read as one object.
`uitPeriodeHalen` became *"Uit de themaperiode halen"*: one string for both tiers, with no "deze", which removes the
ambiguity without branching and without touching the panel's structure (a parallel session is adding a lock control in
that same panel, so leaving its shape alone was deliberate).

### 6. [MINOR] Three names for one object — fixed: the coarse block is a "themaperiode" everywhere

`kalender.periode` and `parameters.periodeLabel` were *"Periode {ordinaal}"* while the control's option said
*"Themaperiodes"* and the fine column said *"Hoort bij themaperiode {ordinaal}"*. One word now, applied through the
catalogue rather than only where the audit pointed: the column heading, the row label, `periodeKeuze`,
`verplaatsKies`, `verplaatsMislukt`, `uitPeriodeHalen`, `verwijderVraag`, `weigeringUitleg`, `herplaatsKies`,
`herplaatsAnderNiveau`, `dekkingOnbekend`, the three drag announcements, the `herzien*` trio, every `vervallen*` and
`rapport*` string that named a period, the `moment*` questions, and the `spreiding*` lines (E3-02's, but they count
themaperiodes and would otherwise have become the fourth name).

**Deliberately left:** `kalender.teVol`, `teVolUitleg` and `wordtTeVol` still say "periode". They are three of the
nine places E3-09 owns by the owner's te-vol ruling and are being rewritten wholesale there; editing them here would
have put this story's hand into another story's rewrite. Recorded rather than silently skipped.

### 7. [MINOR, owner ruling] The ADR deviation is now recorded in the ADRs — written

An amendment section on `docs/adr/0014-frontend-state-and-dnd.md` and an amended (struck through, not deleted)
follow-up bullet on `docs/adr/0021-frontend-routing-and-url-selection.md`. Both state the ruling (component state
stays), the reason (a module-scoped store outlives the component, carries one class's grain into the next and leaks
between tests), and the two things the brief required be honest: that it **also covers E3-07's drag state**, which
contradicted a one-day-old ADR-0021 and was never ratified nor noticed by any audit including E3-07's own; and that
the zoom therefore **does not survive a reload and is not shareable**, an accepted consequence rather than an
oversight, with the `?niveau=` mirror named as the follow-up that would fix it. The code comment now points at the
amendment instead of at this worklog.

### 8. [MINOR] `herplaatsAnderNiveau` had no test — pinned

*"tells a stale placement's panel where re-placing works, and keeps the notice non-dismissible"*: a stale fixture, the
coarse tier asserted as the premise (picker present, `herplaatsKies`), then the fine tier with no picker,
`herplaatsAnderNiveau` shown, `herplaatsKies` absent, the message asserted to contain the other view's own button
label, and `TeHerzien`'s **full** control set pinned so a close/dismiss/later affordance would fail it. Mutation
check: making `herplaatsKies` unconditional fails it.

### 9. Worklog numbers — both corrected above, in place

The overflow sentence and the border ratio are struck through where they were written, each with a line saying what
was wrong: the first measured the board (an `overflow-x-auto` ribbon, `scrollWidth 5800`) where it should have
measured the document (1425/1425, 390/390); the second quoted `border-input` **on a card** (3.40:1) for a control that
sits on **paper** (3.21:1, still above the 3:1 floor). Both re-measured in this round's browser pass.

### 10. [QUESTION] Sibling sub-columns claimed "Nog niets gepland" — fixed, copy only

A sub-column belonging to a themaperiode that **does** hold a thema now says *"Deel van een ingeplande themaperiode"*;
a sub-column of a genuinely empty themaperiode keeps *"Nog niets gepland"*. No new data: `Jaarplankalender` already
walks the grid to build `gevuldeOrdinalen`, so it now also collects `gevuldeOuderOrdinalen` from `ouderOrdinaal`, and
`Periodekolom` takes one boolean. `fijnUitleg` lost its own version of the same false claim (*"de andere delen van die
periode blijven leeg"*) and now says the tool does not record which weeks the thema covers, so those columns show no
card. Verified in the browser on the real 19-column grid: **8** columns read the new sentence, **6** the old one, 5
hold cards. Contrast of the new line `5.56:1` (12px/400). Mutation check: hard-coding `legeperiode` fails the "draws a
thema once" test, which now asserts 3 and 3 on its fixture.

### 11. [QUESTION] The withheld move affordance — not re-opened; the comment now carries the right argument

The affordances stay removed, and all four comments (`Periodekolom.kanVerplaatsen`, `Themakaart.kanVerplaatsen`, the
`doelen` computation, and the derivation in `Jaarplankalender`) now lead with the semantic reason: **7 of the 19 fine
columns are accepted targets**, because each parent's first sub-block starts on the parent's own start date, and that
is exactly why the control would be wrong. A drop there moves the thema into the *whole* themaperiode while the
teacher aimed at a fortnight, so it would be honest about the request and dishonest about the effect. The endpoint
argument is recorded as the weaker, partly-false one it is.

### Nothing declined, one thing narrowed

No finding is disputed. The only narrowing is finding 6's scope (the three te-vol strings left to E3-09, above), and
the one thing this round deliberately did **not** touch is the card's `Aanpassen` panel structure, because a parallel
session is adding a lock control inside it; withholding the picker needed no restructuring.

### Still open after this round

- **The zoom is not deep-linkable.** Ruled acceptable by the owner; the `?niveau=` mirror is now named as a follow-up
  on ADR-0021 rather than living only in this worklog.
- **E3-09's te-vol rewrite** still owns `VOORLOPIGE_TE_VOL_DREMPEL`, the three "periode"-worded te-vol strings, and
  the three code comments that call the threshold provisional. Left as instructed.
- **A thema spanning two periods** (E3-10 review question B) is still unanswered, and now visibly so at the fine tier;
  the new sub-column sentence states the limitation instead of implying an extent.
- **A merge-order dependency, not a code one:** a parallel session (E4-06) is changing `Themakaart.tsx`,
  `Jaarplankalender.test.tsx` and `nl.json` on its own branch. Declared in the coordination channel; the proposal on
  the record is that E4-06 merges first and this branch rebases onto it.

---

## Fix round 2 — the two MAJORs my own fix round introduced (`364c3b5` → this commit)

Both gates ran on `364c3b5`: test-runner **FAIL**, antagonist **VIOLATIONS FOUND** (2 MAJOR, 4 MINOR, 1 QUESTION), and
**both MAJORs were new, written by round 1 in a hurry to answer an audit**. The two gates found MAJOR-A independently,
one by reading the code and one by driving the screen. Nine of the eleven round-1 items were confirmed genuinely fixed,
so this round is narrow: two defects of my own making, four small ones, one comment, and one deliberate keep.

**Discipline this round, since that is what went wrong last round.** Every MAJOR was **reproduced in a real browser on
`364c3b5` before any code was touched**, then re-measured after. Every number below was measured this round. Every new
branch has a test, and four mutation checks are listed rather than claimed.

**Environment.** Ports claimed in the coordination channel first: API `5441`, fault proxy `5443`, Vite `5442` (proxying
`/api` to 5443), CDP `9441`. Nothing touched 5407/5307, 5373/5183, 5421-5423/9421 or 5431/5432/9431. Real API with
`ASPNETCORE_ENVIRONMENT=Development` + `Demo__Seed=true`, real PostgreSQL 17, klas `L3 derde leerjaar (demo)`,
schooljaar 2026-2027. The proxy can 500 **one** `?niveau=` selectively and be armed or disarmed over its own
`/__fault?niveau=` endpoint without a reload, which is what makes the asymmetric states reachable at all.

*Demo data, declared in the channel and restored.* To make MAJOR-A maximally damning I stored a **stranded** startthema
for the demo class (`2026-10-05` / `Licht en donker`, not the start of any themaperiode) through
`POST /jaarplan/generatie`, which persists the parameters before the AI call fails on the missing key (E2-09). Restored
afterwards to the verifier's value, confirmed by GET:
`{"gewensteStartthemas":[{"blokStart":"2026-11-09","themaNaam":"Licht en donker"}],"vasteMomenten":[]}`. All six
placements unchanged (`Ik en mijn klas`/1, `Herfst en oogst`/2, `Water`/3, `Lente en groei`/3, `Verkeer`/4 Manueel,
`Zomer en vakantie`/6 Manueel).

### 1. [MAJOR-A, found by both gates] A failed generation-tier `/rooster` re-created finding 1 — fixed

**Reproduced first, on `364c3b5`.** Fault armed for `?niveau=Themaperiode` only, so the generation tier fails and the
fine tier does not: the asymmetry neither round-1 test covers. Read off the page:

| step | board | trigger summary | *Jaarplan genereren* | `role="alert"` on screen |
|---|---|---|---|---|
| 1. first load (coarse fails) | nothing | — | absent | 1 (the full-page notice) |
| 2. press **Subthemaperiodes** | 23 columns, 6 cards | **`(1 startthema)`** | **enabled** | **0** |

Step 2 is the finding, in the product: `(1 startthema)` for a stored `2026-10-05` that the server would report as
`vervallenStartthemas`, generation offered, and **nothing anywhere on screen saying a grid was missing**. The route into
it is the one my own new copy recommends, since `kalender.roosterFout` ends *"kies hierboven de andere weergave"*.

**Fix: the E3-04 rule, applied to the periods as well as to the settings.** A run whose parameters the screen cannot
state is a run nobody can consent to. "The generation tier's grid is absent, errored, or came back at another tier" now
joins `instellingenOnbekend` in the gate that disables generation **and** the form, and the form gained a state that
says the periods could not be derived instead of counting as if they had been.

- One derivation in one place: `periodestaat: "bekend" | "nietGeladen" | "nietGelezen"` in `Jaarplankalender`, passed to
  the form, **replacing** the old `niveau: string` prop. That prop was the defect's shape: two very different
  situations (no grid; a mistiered grid) arrived as the same silent `false`, and neither disabled anything.
- The summary says `(themaperiodes onbekend)` rather than a count. Deliberately the whole summary, including the
  period-independent vaste momenten: generation is refused in this state, and half a summary invites reading the
  missing half as zero.
- The panel says which of the two causes it is (`parameters.periodesNietGeladen` / `periodesNietGelezen`), and
  **`parameters.anderNiveau` is used for neither** — as the brief required, since there is no working view to send the
  teacher to. That was the loop: a view that lies and a view that refuses.
- The state carries its own retry (`kalender.generatieRoosterFout`, beside the button it disabled). Only the
  `nietGeladen` cause gets one: `nietGelezen` means the request *succeeded* and the answer was unusable, so a retry
  would be a control that does nothing.
- **The false invariant comment is gone.** `Generatieparametersformulier.tsx` asserted the mismatch was "now false only
  when the *server* answered another tier", which stopped holding the moment the fetch itself could fail. It is a
  caller-supplied state now, so this file has no invariant left to get wrong.

**After the fix, same script, same fault:** step 2 reads board 23 columns / 6 cards (the plan is not lost), summary
`(themaperiodes onbekend)`, *Jaarplan genereren* **disabled**, one alert naming the missing themaperiodes, with a
retry. Pressing that retry with the fault disarmed: notice gone, generation enabled, summary `(1 zonder themaperiode)`
— round 1's fix still holding, and the stranded setting correctly named as stranded at the fine tier.

**Tests.** *"refuses to state the settings, and to generate, when the generation tier's grid is the one that failed"*:
the asymmetric fault as a one-line `faalRooster` variant, plus a stranded stored setting (`stubZoom` gained an optional
`instellingen` argument, defaulting to none). It asserts the summary, the disabled run, the visible notice, the retry,
the panel's cause-specific sentence and the **absence** of `anderNiveau`. Two mutation checks, both run: dropping
`|| periodesOnbekend` from the button fails it on `toBeDisabled()`; dropping the summary branch fails it — and the
`Generatieparameters` mismatch test with it — with `expected '1 startthema' to be 'themaperiodes onbekend'`, which is
round 1's lie verbatim.

### 2. [MAJOR-B] The fallback notice claimed the wrong tier after a failed background refetch — fixed

**Reproduced first, on `364c3b5`, by a real pointer sequence rather than a synthetic event.** With the fine tier already
cached, switching away and back refetches it in the background (`staleTime: 0`), so arming the fault at that moment
lands the 500 on a query that keeps its data: the same state an alt-tab produces. Read off the page: board `aria-label`
**"Subthemaperiodes van het schooljaar"**, 23 columns, 6 cards, and a `role="alert"` reading *"De weergave die je koos,
kon niet geladen worden. Je ziet nog de themaperiodes…"*. Both clauses false, exactly as the auditor derived from
`query-core@5.101.2`. Note for anyone reproducing it: the alert appears only after TanStack's three retries with
backoff, about 7 s, so a measurement at 3 s sees a healthy screen and would conclude the bug is not there.

**Fix: `terugval` is derived, not passed.** The notice takes a `soort` of four states — `geenGrid`, `terugval`,
`verversen`, `generatie` — computed from `rooster.data === undefined` rather than from `isError`, because data survives
an errored refetch. The new `verversen` sentence (`kalender.roosterVerversenMislukt`) is true and **quiet**: no
`role="alert"`, no red wash, because a refresh that cost the teacher nothing should not interrupt a screen reader
mid-task. It keeps the retry, because a grid that could not be refreshed is exactly what hides a beheerder's vakantie
edit (E3-04).

**After the fix, same sequence:** board still `"Subthemaperiodes van het schooljaar"` with its 6 cards, **0**
`role="alert"` elements, the visible sentence *"Deze weergave kon net niet vernieuwd worden. Je ziet nog wat eerder werd
opgehaald, en er is niets gewijzigd aan je jaarplan…"*, generation untouched and enabled. Real-browser axe on that
state: **0 violations**, 27 passes.

**Test.** *"does not claim the other tier is showing when a refresh of the current one failed"* — the one state no click
can reach in jsdom, so `renderKalender` now **returns its query client** and the test refetches the fine key while the
stub is failing. It asserts that data survived, that the two tier-naming sentences are absent, that
`queryAllByRole("alert")` is **empty**, that the retry is present, and that generation stays enabled. Mutation check:
forcing `soort` back to `terugval` whenever errored fails it with *"Unable to find … Deze weergave kon net niet
vernieuwd worden"*.

### 3. [MINOR-C] "Deel van een ingeplande themaperiode" called an unreviewed proposal *ingepland* — fixed, copy only

Now *"Deel van een themaperiode waarin al een thema staat"*: membership, with no claim that anything is settled, and
true whether the parent holds one `Voorgesteld` proposal or three `Aanvaard` ones. The `Geweigerd`-only parent still
reads *"Nog niets gepland"*, untouched as instructed. The catalogue key keeps its name (`subperiodeIngepland`, a
technical identifier) and `Periodekolom`'s comment records why the sentence no longer matches it. Contrast re-measured
in place: **5.56:1** (12px/400), styling unchanged.

### 4. [MINOR-F] The unrecognised-tier degrade told the teacher to switch to the view they were on — fixed

Two strings, two new sentences, and the guess is now confined to labels:

- the board's line becomes `kalender.roosterNiveauOnbekend` (*"De tool kon deze weergave van het schooljaar niet lezen,
  dus thema's verplaatsen kan hier niet. Er is niets gewijzigd aan je jaarplan…"*) instead of `fijnUitleg`;
- the parameter panel gets `parameters.periodesNietGelezen` instead of `anderNiveau` (see item 1).

`bordNiveau` still falls back to the coarse labels — the columns have to be *called* something — but a new
`bordNiveauOnbekend` flag keeps that fallback out of every **instruction**, which is the actual defect.

**Test.** *"says nothing was changed, rather than where to go, when the tier is one it cannot recognise"*: `stubZoom`
gained an optional `grofRooster` and the test serves `niveau: "Kwartaal"`, which type-checks because
`Planningsrooster.niveau` is deliberately a plain `string` — it is what the server said. Mutation check: restoring the
two-way ternary fails it with *"Unable to find … De tool kon deze weergave van het schooljaar niet lezen"*.

*Declined, with the reason.* The **third** string in that degrade, `kalender.herplaatsAnderNiveau` inside a stale card's
panel, is left alone: it is not in the finding, it needs a new prop through `Themakaart`, and E4-06 is adding a lock
control in that component's panel this hour. Recorded in the open list rather than fixed blind.

### 5. [MINOR] "One word per tier" — completed, and swept this time rather than asserted

The audit named three survivors plus my new `roosterFout` as a fourth name. All four are gone, and I ran the sweep the
round-1 completeness claim should have had: every leaf of `nl.json`, every `periode` not preceded by `thema`.

- `kalender.leegRooster` → *"Dit schooljaar heeft nog geen themaperiodes."* True at both tiers, because the fine tier
  subdivides the coarse one: a year with no themaperiode has no subthemaperiode either.
- `kalender.genereerUitleg` → *"…over de themaperiodes voor…"*.
- `kalender.indelingUitleg` → themaperiode-worded. **This key is rendered nowhere** (`grep` finds no call site); fixed
  anyway so it cannot be reintroduced already wrong.
- `kalender.roosterFout` loses *"periode-indeling"*: it says *"De weergave van dit schooljaar…"*, the word the control
  itself uses, because that notice can be about **either** tier and so must name neither.
- **`spine.titel`, which the audit did not name and the sweep found.** *"Het schooljaar in periodes…"* was the first
  thing a screen-reader user heard about the strip, immediately before ordinals saying "subthemaperiode". Split into
  `spine.titel` / `spine.titelFijn`, selected by the tier the spine already receives.

**What the sweep leaves, deliberately, and this is now the whole list:** `kalender.teVolUitleg` and `wordtTeVol` (plus
`teVol`, which contains no bare "periode" but belongs to the trio) — the three declared in round 1, owned by E3-09's
te-vol rewrite; and `kalender.periodeKeuze`'s `{periode}` **placeholder**, which is filled with a date range, not a
name, and never renders the word.

### 6. [QUESTION-G] The per-focus cost of the second `/rooster` — comment corrected, no `staleTime` added

As instructed. The comment claimed "not a second network round trip in the normal case"; it now says what is true: one
request at mount (shared cache entry at the coarse tier), and **two** grid derivations per window focus at the fine
tier, because `staleTime: 0` + `refetchOnWindowFocus` refetch both keys. Accepted rather than fixed, with the reason on
the record: E3-04 depends on this query refetching on focus to notice a beheerder's vakantie edit, which is what makes a
stranded placement visible at all.

### 7. The page header in the first-load failure state — **kept, deliberately**

The gate left this one to me and I kept it. `Kalenderkop` is extracted and rendered in the failure branch too, so the
title, the class and the school year survive a state that has no board, and `<section aria-labelledby="kalender-titel">`
gets its accessible name back with them. Two lines of markup against a teacher's orientation is not a trade worth
making. The **concept banner is deliberately not** repeated there: it describes what you can do on the board, so it
would promise something that is not on screen. Verified: `koppen` goes from `["H1: Jaarplanner"]` to
`["H1: Jaarplanner", "H2: Jaarplan"]` at 1440 **and** at 390, and the MAJOR-A test asserts both the heading and the
class name in that branch. Real-browser axe on it: **0 violations**, 25 passes.

*Not fixed, as instructed:* the empty well's dashed border at 1.25:1. Pre-existing token; E7-10 owns it.

### 8. [MINOR-E, record only] E3-08 does ship a per-column te-vol mark at the fine tier

No code, by the audit's own allowance, but named in the open list below so E3-09 inherits an obligation rather than a
surprise.

### Measurements, all taken this round, alpha composited

| what | context | value | floor |
|---|---|---|---|
| `roosterVerversenMislukt` (quiet notice) | `text-ink` on the composited `bg-paper` panel, 14px/400 | **14.55:1** | 4.5 |
| its retry label | 12px/600 | **15.42:1** | 4.5 |
| its retry **border** (`border-input`) | 1px, `bg-card` over that panel | **3.21:1** | 3.0 |
| `generatieRoosterFout` (alert) | `text-suggestie-geweigerd` on the `/10` wash over `bg-card`, 14px/500 | **5.48:1** | 4.5 |
| its retry **border** (`border-suggestie-geweigerd`) | 1px | **5.48:1** | 3.0 |
| `parameters.periodesNietGeladen` | 12px/400 on card | **6.08:1** | 4.5 |
| `(themaperiodes onbekend)` summary | 14px/400 | **6.08:1** | 4.5 |
| `subperiodeIngepland`, reworded | 12px/400 in the well | **5.56:1** | 4.5 |
| the node `roosterNiveauOnbekend` renders in | measured as `fijnUitleg`: same node, same classes | **5.73:1** | 4.5 |

The last row is stated precisely on purpose: I could not make the real API answer an unrecognised tier, so I measured
the element the sentence swaps into (`max-w-4xl text-xs leading-snug text-ink-zacht`, class list read off the page).
The branch is a string swap in that node and changes no colour.

**390px** (`Emulation.setDeviceMetricsOverride`, `innerWidth === 390`): no document overflow in either new state
(`scrollWidth 390 / clientWidth 390`), header present, generation disabled, one alert.

**Real-browser axe** (axe-core 4.10.2, wcag2a/2aa/21a/21aa/22aa): first-load failure state **0 violations / 25 passes**;
generation-grid notice **0 / 27**; quiet refresh notice **0 / 27**.

**Screenshots**, ten in `backlog/worklogs/E3-08/`, each bound to a state read out of the DOM in the same run, and
**md5-distinct** (`md5sum r2-*.png | sort | uniq -w32 -D` prints nothing — the check the E1-13 verifier's collided set
taught this repo to run before citing images):

| file | the claim it carries |
|---|---|
| `r2-major-a-voor-1-eerste-laadfout.png` | round 1: the failure state with no title and no class, shell `h1` only |
| `r2-major-a-voor-2-de-leugen.png` | **round 1's defect:** 19 fine columns, `(1 startthema)`, generate enabled, no notice |
| `r2-major-a-na-1-eerste-laadfout-met-kop.png` | the same failure with the header kept (item 7) |
| `r2-major-a-na-2-geweigerd-en-benoemd.png` | after: plan intact, `(themaperiodes onbekend)`, generate disabled, notice + retry |
| `r2-major-a-na-3-herstel-na-retry.png` | the retry recovers, and the setting is named `(1 zonder themaperiode)` |
| `r2-major-b-voor-verkeerde-tier-in-alert.png` | **round 1's defect:** subthemaperiode board under "Je ziet nog de themaperiodes" |
| `r2-major-b-na-stille-ware-melding.png` | after: quiet true sentence, no `alert`, board and generation untouched |
| `r2-390-eerste-laadfout.png` | the failure state at exactly 390px, header present, no overflow |
| `r2-390-generatiemelding.png` | the refusal at 390px |
| `r2-paneelzin-en-samenvatting.png` | the open panel: cause-specific sentence, no rows, no `anderNiveau` |

### Gates

`corepack pnpm lint` exit 0 · `corepack pnpm exec vitest run` **203 passed / 12 files, 0 failed, 0 skipped** (200 → 203,
three new tests), **zero** `act(` or warning lines in the run · `corepack pnpm build` exit 0 · `tsc --noEmit` clean ·
`git diff --stat 0de4851..HEAD -- backend/` **empty**, so `dotnet test` / `dotnet format` did not run and are not
claimed.

### One test assertion changed, and why it is not a weakening

`Generatieparameters.test.tsx` → *"does not read another tier's periods as the periods a kept setting names"* asserted
`(1 startthema)` and then that generating **sent** the kept setting. Its fixture serves a `Subthemaperiode` grid to
*every* `/rooster` request, so it is the `nietGelezen` state — where a count is precisely what the form cannot check.
The assertion pinned the behaviour MAJOR-A calls the defect. It now asserts `(themaperiodes onbekend)`, the refused run,
that pressing the refused button posts nothing, and the cause-specific sentence with `anderNiveau` **and** the
fetch-failure sentence both absent. Strictly more is pinned than before. That the stored settings survive an untouched
form is still pinned, by the first test in that file.

### Still open after this round

- **E3-09 inherits a live defect, named on purpose** (MINOR-E): at the fine tier every placement lands in its parent's
  **first** sub-block, so that column renders `▲ Te vol: 3 thema's` with the attentie border while its siblings say they
  belong to a themaperiode that holds a thema — the misreading the owner's te-vol ruling forbids. `teVolleOrdinalen`
  also carries **sub-block** ordinals into `Jaarspine`. The ruling (te vol at the themaperiode tier only, one summary
  line at the fine tier, whole weeks with the available side rounded up) is what fixes it; E3-08 ships it unfixed.
- **`kalender.herplaatsAnderNiveau`** still names "de weergave Themaperiodes" in the unrecognised-tier degrade (item 4,
  declined with a reason). It needs a prop through `Themakaart`, which a parallel session holds.
- **The three te-vol strings** still say "periode" (item 5); E3-09 owns them.
- **The zoom is not deep-linkable**; `?niveau=` is recorded as a follow-up on ADR-0021.
- **A thema spanning two periods** (E3-10 question B) is still unanswered.
- **The empty well's dashed border at 1.25:1** belongs to E7-10.
- **Merge order:** unchanged. E4-06 is still in `Themakaart.tsx`, `Jaarplankalender.test.tsx`, `useJaarplan.ts` and
  `api.ts`, and holds `nl.json`. This round touched none of the first four and declared the fifth. `Bewerkpaneel`'s DOM
  is untouched, so E4-06's lock control still has room.
