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

---

## Fix round 3 — the cross-story regression this story's own string caused (`4e8f6eb` → `ae14b0b`)

**FR / Article:** FR-6.3 (zoomniveaus) · Art. II.3 (all copy in `nl.json`) · Art. IV.1/IV.5 (advisory AI, and never
claim a change that did not happen) · Art. V.2 (a stale placement stays visible until a human resolves it) ·
Art. XII / WCAG 2.2 AA (never colour alone, contrast measured in a browser) · Art. IX.3 (two ratified tiers, no calendar
unit assumed).

**Why there is a fourth build round at all.** The 3-round cap was exceeded on the owner's explicit permission, for one
reason: the false sentence is `kalender.herplaatsAnderNiveau`, a string **this story added**, so the regression is this
story's to repair rather than E3-07's or a waiver's. The coarse-tier half stays with E3-07, which the owner reopened.

Round-3 gate results on `4e8f6eb`: test-runner **PASS** on every criterion of the story; antagonist **VIOLATIONS FOUND,
0 CRITICAL / 0 MAJOR** (5 MINOR, 2 QUESTION). Note for the record: **neither round-3 verdict is on disk** in
`backlog/worklogs/E3-08/` — `antagonist.md` ends at round 2 and `test-report.md` at round 1 — so this round worked from
the findings as relayed in the fix brief, exactly as round 2 had to. The 18 `r3-*.png` files the test-runner left
untracked are committed with this change.

### 1. [owner-ruled] A geweigerd card was sent to a view that cannot help it — fixed, reproduced in a browser first

**The defect.** `Bewerkpaneel` chose the stale-placement instruction on the **tier** alone:

```tsx
{plaatsing.isVervallen && (
  <p …>{kanVerplaatsen ? t("kalender.herplaatsKies") : t("kalender.herplaatsAnderNiveau")}</p>
)}
```

while the picker it points at is withheld by the **rejection**, two lines above:
`isGeweigerd || !kanVerplaatsen ? [] : …`. So for `Geweigerd × stale × fine tier` the card read *"Een themaperiode
kiezen voor dit thema kan in de weergave “Themaperiodes”."* and that view withholds the picker from it as well. A local
contradiction (E3-07's, where both sentences at least sit on one screen beside the corrective control) became a
**cross-view instruction that cannot be kept**, with the mention of dragging dropped, so the single remaining
instruction was false.

**The fix.** A rejected card gets **no re-placement instruction at either tier**. Nothing is lost, and that is the
argument rather than an assumption: `kalender.weigeringEerstTerugdraaien` says why moving is refused, and its *Weigering
terugdraaien* button sits under it **at both tiers** (neither names a block, so the tier cannot take them away —
asserted, not reasoned about). Reversing the rejection makes the placement `Manueel`, and the instruction returns.
As a side effect the coarse-tier contradiction E4-06 filed also disappears, because the same condition covers it; the
rest of E3-07's version (its own picker) is untouched and still E3-07's.

**The prop that made this possible is no longer a boolean.** `kanVerplaatsen` carried two causes with one sentence
between them, which is precisely the collapse round 2 removed from the periods (`Periodestaat`). It is now
`Verplaatsstaat = "kan" | "anderNiveau" | "niveauOnbekend"`, exported from `Themakaart.tsx`, derived once in
`Jaarplankalender` and threaded through `Periodekolom` and `TeHerzien`. Copy is paired to it by two `Record`s
(`BORDUITLEG` for the board sentence, `HERPLAATSUITLEG` for the card's), so **the compiler refuses a fourth state that
has not been given its own sentence**. The card's own status is deliberately *not* folded into the union: a rejection is
a fact about the card, not about the board, and folding the two together is what produced the defect.

### 2. [MINOR-2, second half] The unrecognised-tier degrade told every card to switch to the view it was on — fixed

The surviving third instance of round 2's MINOR-F. In that degrade `verplaatsstaat` is `niveauOnbekend` for **any**
card, while `bordNiveau` falls back to labelling the board *Themaperiodes* — so `herplaatsAnderNiveau` named the view
the teacher was already looking at. It now has its own key, `kalender.herplaatsNiveauOnbekend`, which **names no view at
all**: this app does not know which of its two views those columns belong to, so *"probeer de andere weergave"* would be
a new guess dressed as help. Pinned by a test that also asserts the string contains neither view name.

### 3. [MINOR-1] A refusal with no statement that anything was refused — fixed by wiring both on one condition

`periodesOnbekend` disabled *Jaarplan genereren* for **both** causes while the `Roosterfout soort="generatie"` notice
rendered for `nietGeladen` only. In `nietGelezen` the traces were the collapsed summary and, behind a disclosure that is
closed by default, `parameters.periodesNietGelezen` — which, unlike its two siblings, never mentions the run. Beneath the
dead button sat `kalender.genereerUitleg`, a promise about what generating does.

The notice now renders on `periodesOnbekend`, the same expression that disables the button, with a branch inside it for
which cause. **The `nietGelezen` variant carries no retry**, and that absence is a statement: the request *succeeded* and
answered something unreadable, so a retry is the step already exhausted — the E3-04 ruling that produced this component.
`Roosterfout`'s `onOpnieuw` is therefore optional, documented as the only case allowed to render without a button.

Third round running in which a refusal and its explanation sat on different conditions. They sit on one now.

### 4. [MINOR-4] `kalender.indelingUitleg` deleted

Zero call sites (`grep -rn indelingUitleg src/` returns only the catalogue line), residue of E3-06's reverted
server-string render. Deleted rather than guarded, as the brief preferred: extending `catalogus.test.ts`'s dead-key guard
from `doelen.*` to `kalender.*` is the larger change and this key had no defender.

### Files changed

| file | why |
|---|---|
| `frontend/src/features/jaarplan/Themakaart.tsx` | the `Verplaatsstaat` type; the rejected card gets no re-placement sentence; `HERPLAATSUITLEG` pairs the other three states to copy |
| `frontend/src/features/jaarplan/Periodekolom.tsx` | prop follows the union; the droppable is disabled off `!== "kan"` |
| `frontend/src/features/jaarplan/Jaarplankalender.tsx` | derives `verplaatsstaat`; `BORDUITLEG`; the refusal notice on both causes; `Roosterfout` may render without a retry |
| `frontend/src/i18n/nl.json` | +`kalender.herplaatsNiveauOnbekend`, +`kalender.generatieRoosterNiveauOnbekend`, −`kalender.indelingUitleg` |
| `frontend/src/features/jaarplan/Jaarplankalender.test.tsx` | three new tests, two new assertions on the unrecognised-tier test |

`Bewerkpaneel`'s DOM is **unchanged**, as it has been all story: one paragraph is conditional where it was
unconditional, nothing is added, moved or renested. E4-06's lock control still has its room.

### Tests added (3 new, 206 total)

| test | what it pins |
|---|---|
| *never promises a REJECTED stale card a period picker, at either tier* | at both tiers: no picker, and none of the three re-placement sentences; the rejection sentence **and** its *Weigering terugdraaien* button present in both, which is what makes the silence safe |
| *does not name a view for a stale card when the tier is one it cannot recognise* | the new sentence appears, the two view-naming ones do not, and the string contains neither view's own button label |
| *keeps pointing a re-placeable stale card at the view where the picker really is* | the **control case** (`Manueel × stale × fine`): the sentence survives, and pressing the option it names really does produce a picker with all 7 themaperiodes. Guards against "fixing" the two above by suppressing the sentence everywhere |
| *(existing)* *says nothing was changed … tier it cannot recognise* | now also asserts `toBeDisabled()` on the generate button, the refusal notice, and **no** retry button anywhere. It drove that exact path and asserted nothing about the button |

**Mutation checks, four, each applied and restored in one command** (the round-2 discipline):

| mutation | result |
|---|---|
| drop `!isGeweigerd` from the stale sentence | *never promises a REJECTED stale card…* **fails** |
| `HERPLAATSUITLEG.niveauOnbekend → herplaatsAnderNiveau` | *does not name a view…* **fails** |
| notice back to `periodestaat === "nietGeladen"` | *says nothing was changed…* **fails**, on the new notice assertion |
| `HERPLAATSUITLEG.anderNiveau → herplaatsNiveauOnbekend` | **two** tests fail, the control case among them |

### Browser check, before and after, against the real API and PostgreSQL

Environment (all four ports claimed and released, session `E3-08`): api **5461**, a rewriting proxy **5463**, vite
**5462**, CDP **9461**. The proxy exists for one reason: the controller **400s on an unknown `?niveau=`**, so the
unrecognised-tier states cannot be reached from a healthy API at all. It rewrites `"niveau":"Themaperiode"` to
`"niveau":"Kwartaal"` in the `/rooster` answer for a chosen tier, and nothing else.

**Demo data**, declared in the groepschat before the write and restored after (recorded by DB query *and* verified by
GET): `fc89b501` *Zomer en vakantie* `2027-04-19 / Manueel` → `2027-04-20 / Geweigerd` (nothing in the UI sets
`Geweigerd`), and `dddc1c97` *Verkeer* `2027-01-04` → `2027-01-05`, which gives a **non-rejected** stale card as the
control. Both back, all six placements unchanged, kept startthema still `2026-11-09 / Licht en donker`.

**Before** (`git checkout 4e8f6eb --` the three components and `nl.json`, so this is the shipped code, not a mutation):

| state | what the screen said |
|---|---|
| `Geweigerd × stale`, coarse | `herplaatsKies` **and** `weigeringEerstTerugdraaien`, `picker: false` — E3-07's contradiction |
| `Geweigerd × stale`, **fine** | *"Een themaperiode kiezen voor dit thema kan in de weergave “Themaperiodes”."*, `picker: false` — **the regression**, and the picker is absent in the named view too |
| unrecognised tier, `Manueel × stale` | `herplaatsAnderNiveau: true` on a board labelled *"Themaperiodes van het schooljaar"* — MINOR-2's third instance, on a card with no rejection to blame |
| unrecognised tier, generation | `genereerDisabled: true`, `alerts: []`, `retryKnoppen: 0`, no notice — **MINOR-1**: the primary action refused with nothing on screen saying so |

**After** (same tree as the commit, `git status` clean):

| state | what the screen says |
|---|---|
| `Geweigerd × stale`, coarse | only `weigeringEerstTerugdraaien` + *Weigering terugdraaien*; no `herplaatsKies` |
| `Geweigerd × stale`, **fine** | the same, and **none** of the three re-placement sentences |
| unrecognised tier, `Manueel × stale` | `herplaatsNiveauOnbekend: true`, the other two false |
| unrecognised tier, generation | `genereerDisabled: true`, **exactly one** `role="alert"` carrying `generatieRoosterNiveauOnbekend`, `retryKnoppen: 0` |
| control, `Manueel × stale`, fine → coarse | `herplaatsAnderNiveau` at the fine tier; at the coarse tier the picker with **7** themaperiodes and `herplaatsKies` — the promise is keepable |

**Contrast, measured in the browser with alpha composited** (nearest opaque backdrop, walked up and composited):

| what | context | value | floor |
|---|---|---|---|
| `kalender.herplaatsNiveauOnbekend` (new) | `text-attentie-ink` on the panel's `bg-paper-diep/60` over card, 12px/400 | **9.24:1** | 4.5 |
| `kalender.generatieRoosterNiveauOnbekend` (new) | `text-suggestie-geweigerd` on the `/10` wash over card, 14px/500 | **5.48:1** | 4.5 |
| `kalender.roosterNiveauOnbekend` (existing, re-measured) | 12px/400 | **5.73:1** | 4.5 |

No new colour pair was introduced: both new strings render in nodes whose classes already existed, and the round-2
measurement of the same notice (5.48:1) reproduces exactly. Neither state carries colour alone — each has a full
sentence, and the refusal also has the disabled button beside it.

**390px** (an exactly-390px iframe, not `--window-size`, which headless Chrome clamps to ~504px): `innerWidth 390`,
`documentElement.scrollWidth 390`, **no document overflow**, one alert, panel open and wrapping.
**Real-browser axe** (wcag2a/2aa/21a/21aa/22aa): unrecognised tier with the panel open **0 violations / 27 passes**;
healthy fine tier with the rejected card's panel open **0 / 27**.

**Screenshots**, twelve, `md5sum fix3-*.png | sort | uniq -w32 -D` prints nothing (12 files, 12 hashes):

| file | the claim it carries |
|---|---|
| `fix3-voor-1-grof-geweigerd-vervallen.png` | before, coarse: the two contradicting sentences, no picker |
| `fix3-voor-2-fijn-de-onhoudbare-belofte.png` | **before, fine: the regression, verbatim** |
| `fix3-voor-3-onbekend-niveau-geweigerd.png` | before, unrecognised tier, rejected card |
| `fix3-voor-4-onbekend-niveau-manueel-geen-melding.png` | before: MINOR-2's third instance **and** MINOR-1 in one screen |
| `fix3-na-1-grof-geweigerd-vervallen.png` | after, coarse: one true sentence and its control |
| `fix3-na-2-fijn-alleen-de-ware-zin.png` | **after, fine: the false instruction is gone** |
| `fix3-na-3-onbekend-niveau-geweigerd.png` | after: rejected card silent about re-placing, refusal notice present |
| `fix3-na-4-onbekend-niveau-manueel-met-melding.png` | after: the new card sentence **and** the new refusal notice |
| `fix3-na-5-controle-grof-picker-aanwezig.png` | the control case at the coarse tier: 7 themaperiodes in the picker |
| `fix3-na-6-controle-fijn-verwijst-nog-steeds.png` | the control case at the fine tier: the sentence survives |
| `fix3-na-7-390-kaartzin.png` | 390px, both stale cards, no overflow |
| `fix3-na-8-390-generatiemelding.png` | 390px, the refusal beside the dead button |

The scratch 390px page lived in `frontend/public/` and was **deleted before committing** (it is not in the diff).

### Gates

`corepack pnpm lint` exit 0 (`eslint . --max-warnings 0 && tsc --noEmit`) · `corepack pnpm vitest run` **206 passed /
12 files, 0 failed, 0 skipped**, and `grep -ciE "act\(|Warning: |stderr"` over the full log → **0** ·
`corepack pnpm build` exit 0 · `git diff --stat 0de4851..HEAD -- backend/` **empty**, so `dotnet test` / `dotnet format`
did not run and are not claimed. The suite was run **alone** in this worktree, never beside another agent's run.

### Self-check against the fix brief

| item | met? | evidence |
|---|---|---|
| the owner-ruled fix, conditioned on the rejection as well as the tier | yes | browser before/after above; test 1; mutation 1 bites |
| a rejected card promised a picker in **no** view | yes | both tiers asserted in test 1 and measured in the browser |
| the unrecognised-tier state gets **its own** sentence | yes | test 2; mutation 2 bites; `fix3-na-4` |
| three outcomes rather than two, pinned per state | yes | `Verplaatsstaat` + two exhaustive `Record`s; three tests |
| MINOR-1: refusal and explanation on one condition, `toBeDisabled()` asserted | yes | notice on `periodesOnbekend`; the existing test now asserts disabled, the notice and no retry |
| MINOR-4: dead key deleted | yes | `nl.json` diff |
| `Bewerkpaneel`'s DOM not reshaped | yes | one paragraph made conditional; no node added, moved or renested |
| backend untouched | yes | empty backend diff |
| the test-runner's 18 PNGs committed | yes | `r3-*.png` in `ae14b0b` |

### Recorded, not fixed (as the brief instructed)

- **MINOR-3 — a zero-block grid swallows the switch and every notice.** `Weergaveschakelaar` and the `Roosterfout`
  notices both sit inside the `grid.blokken.length > 0` branch, so a year with **no** periods shows
  *"Dit schooljaar heeft nog geen themaperiodes."* and no way back to the other tier. **The fix is to hoist the control
  and the notices out of that branch**, above the `blokken.length === 0` fork. Not done here because it changes render
  structure, which this round deliberately did not. Not reachable today: nothing in the product can empty a
  periodestructuur until **E6-03**.
- **QUESTION-B — generation is offered on a school year with zero themaperiodes** (pre-existing, **E3-04**). Both gates
  pass: `instellingenOnbekend` is false and `periodestaat` is `bekend`, because an *empty* grid at the right tier is a
  perfectly readable answer. **`periodestaat` is its natural home** — a fourth state, or a `bekend`-plus-empty check,
  next to the two that already gate the run.
- **The test-runner's observation 1 — a failed background refetch of the *generation-tier* grid is silent at the fine
  tier.** `periodestaat` derives from `data === undefined`, and TanStack keeps data on an errored refetch, so no false
  claim is made (which is the point). But the stale-grid risk that earned the *board* tier its `verversen` sentence has
  no equivalent here: a beheerder's vakantie edit can go unnoticed for the settings while it is announced for the board.
  No notice added this round.
- **The order inside the generation card**: button → `genereerUitleg` → refusal. The refusal is now always present, but
  it comes *after* the sentence describing what generating does. Left as it is because the `nietGeladen` case already
  ships that order and reordering touches the card's render structure; worth one look in review.

### QUESTION-A, settled as far as it can be — an unproven hypothesis, written as one

The antagonist saw **2 of 6** full suite runs fail the two regression tests with round 1's error string **verbatim**,
then 10 pass; it also proved that string is **unreachable** in the audited source. The orchestrator then ran the suite
**3× alone in this worktree: 203/203 each time**, 25–33s, environment 85–106s against the contended run's 190s. This
round's runs (206/206, ~31s, environment ~110s) are consistent with that.

**Most likely cause: two gate agents running vitest concurrently in the same worktree, sharing `node_modules/.vite`,**
which can serve a stale module graph and looks exactly like an old defect resurfacing. **The failure was never
reproduced, so this is evidenced but unproven.** What *is* proven: the failing string cannot be produced by this source,
and 13 runs pass against the 2 that fell during parallel gating. Operational consequence, already posted to the
groepschat: if you gate in parallel, give one agent the suite or give them separate worktrees.

### Still open after this round

- Everything in round 2's list still stands, **except** the `herplaatsAnderNiveau` entry, which this round closed.
- **MINOR-3** (the zero-block grid) and **QUESTION-B** (generation on a year with no periods), above.
- **The generation-tier grid's silent stale state** (observation 1), above.
- **E3-09 still inherits MINOR-E** (the per-column te-vol mark at the fine tier) and the three te-vol strings.
- **Merge order, unchanged and now urgent:** E4-06 **is on `origin/main`** as of 12:42 today (`61457bc`), and it
  rewrote `Themakaart.tsx` heavily — including a lock section in `Bewerkpaneel` whose own comment says
  `kalender.herplaatsKies` *"already stands at the top of this panel"* and that on a stale **rejected** card it has no
  picker to point at. That sentence no longer renders for a rejected card, so **whoever rebases must re-read E4-06's
  `slotUitleg` comment against this change** (the behaviour it describes is what this round fixed; the comment's premise
  is now stale). This branch was **not** merged, rebased or pushed, per the brief.

---

## Merge round — `origin/main` (`61457bc`, 28 commits) into `story/E3-08-zoomniveaus`

Not a build round: no new behaviour is intended here. The point is that the gates that matter are the ones on the
tree that **lands**, not on this branch as it stood (the E1-15 precedent, and the test-runner asked for it
explicitly). Merge base `0de4851`; second parent `61457bc`. **Not pushed.** No backlog checkbox touched, and
`backlog/README.md` deliberately untouched: main already carries E4-06's own bookkeeping.

### What landed on main while E3-08 was being built

E4-06 closed (the vergrendeling switch, FR-8.4) and **rewrote `Themakaart.tsx`** around a `slotUitleg` derivation.
The owner also **reopened E3-07 to `[~]`** for the stale-rejected-card defect. Everything auto-merged except two
files, both of them the ones this worklog predicted would conflict.

> **Main moved again mid-merge, and this merge deliberately did not follow it.** The technical lead posted at 13:18
> that `main` went `61457bc` to `efecf73` (three commits, owner-authorised, **not pushed**) and advised merging onto
> `efecf73`. `git merge` was already in progress with `MERGE_HEAD = 61457bc`, so aborting to re-target would have
> thrown away a resolved semantic conflict to gain nothing: the lead's own `--stat` shows those three commits touch
> only `CLAUDE.md`, `assets/` and `backlog/README.md`. No source, no tests, no `nl.json`. They cannot change a
> conflict resolution or a gate number here, and whoever merges E3-08 picks them up for free. Recorded so this is
> not read as a missed merge.

### Conflict 1 — `frontend/src/features/jaarplan/Themakaart.tsx` (semantic, not just textual)

Two hunks, and the second is the interesting one.

**Hunk A, the `Bewerkpaneel` doc comment.** Both sides rewrote its opening sentence. Main's is a strict superset:
it adds the lock to the list of things the panel does. Resolution: **keep main's sentence** (with *periode* changed
to *themaperiode*, see conflict 2) and keep **this branch's `HERPLAATSUITLEG` block** immediately above it. Nothing
was chosen over anything; the two edits were to adjacent concerns that a line-based merge could not see apart.

**Hunk B, the top of the panel's JSX.** Main added a panel-level `role="status"` `sr-only` paragraph that announces
a *successful* lock (WCAG 2.2 SC 4.1.3), and rendered `kalender.herplaatsKies` **unconditionally** for a stale card.
Round 3 of this story replaced that unconditional line with `HERPLAATSUITLEG[verplaatsstaat]` gated on
`!isGeweigerd`. Both intents are kept: the announcement paragraph is preserved verbatim, and the re-placement line
below it is this branch's three-state version. `Bewerkpaneel`'s DOM is otherwise unchanged, as it has been all story.

**The comment whose premise the merge falsified.** E4-06's `toonSlot` doc comment justified saying nothing about
re-placement with: *"`kalender.herplaatsKies` already stands at the top of this panel, and on a stale **rejected**
card that instruction has no picker to point at."* After this merge **both halves are false**: the line at the top
is one of *three*, and only the coarse tier gets `herplaatsKies`; and a rejected card gets no re-placement line at
all. Per this repo's rule, applied twice already in this story, the comment was **corrected rather than deleted or
replaced with a vaguer one** — it now names what is actually the case, including *why the conclusion still holds*:
repeating *"kies een periode"* there would **contradict** the line above it at the fine tier rather than merely
duplicate it, and a rejected card never reaches that sentence anyway because `slotUitleg` tests `isGeweigerd` first
and hands it `vergrendelUitlegGeweigerdVast`, whose remedy button sits directly below.

The `Verplaatsstaat` union and its **two exhaustive `Record`s** survive intact. That is the property worth
preserving: the compiler still refuses a fourth board state that has no sentence of its own, which is the defect
class round 3 was written against.

### Conflict 2 — `frontend/src/i18n/nl.json`

One textual conflict, on `kalender.weigeringUitleg`, which both sides rewrote for different reasons: main gave it
E4-06's regeneration fact (owner ruling, 2026-07-31), this branch changed *periode* to *themaperiode*. Resolution:
**main's full sentence with this branch's terminology**. Neither edit is dropped.

- `kalender.indelingUitleg` **stays deleted**. It was dead before this story and main did not resurrect it.
- **Art. II.4, the synonym check.** The auto-merged part of main's hunk brought in
  `kalender.vergrendelUitlegVervallen` reading *"het staat in geen enkele **periode**"*. This story renamed that
  concept to *themaperiode* everywhere precisely so the fine tier is not ambiguous, so E4-06's new string landed as
  a **second name for one thing** in the same catalogue. Art. II.4 says extend the glossary rather than invent
  synonyms, so the one word was changed and E4-06's sentence is otherwise untouched. This is a merge-integration
  fix, not a copy rewrite.
- **Left alone, deliberately:** `kalender.teVolUitleg` and `kalender.wordtTeVol` still say bare *periode*. Both are
  pre-existing base strings that **neither side of this merge touched**, and they belong to E3-09, which already
  owns the te-vol copy (recorded as MINOR-E above). Changing them inside a merge commit would be scope creep.

After resolution: `nl.json` parses, 110 `kalender` keys.

### The question nobody was allowed to assume: does E3-07's defect survive the merge?

**Answer: it is gone at both tiers.** Determined **empirically in a browser on the merged tree**, not reasoned from
the diff.

E3-07 was reopened because on a stale **rejected** card the panel read *"Kies hieronder een themaperiode … of
versleep de kaart"* and, one paragraph later, *"Dit thema is geweigerd, dus je kan het niet verplaatsen"*, with no
picker and no grip. Round 3 removed the re-placement instruction for a rejected card **at both tiers**, which is the
coarse-tier half of that defect, so the merged tree had to be measured rather than argued about.

**Environment** (ports claimed and released, session `E3-08`): api **5471**, vite **5472**, CDP **9471**. **No
rewriting proxy this time** — unlike round 3, both tiers are reachable from a healthy API through the
Weergaveschakelaar, so nothing had to be faked. Headless Chrome over CDP (this repo has no Playwright), against the
real API and real PostgreSQL. `ASPNETCORE_URLS` alone is **not** enough to move the API's port:
`launchSettings.json` wins, so `--no-launch-profile --urls` is required (the first attempt silently bound 5184).

**Demo data**, declared in the groepschat before the write and restored after: `fc89b501` *Zomer en vakantie*
`2027-04-19 / Manueel` to `2027-04-20 / Geweigerd` (nothing in the UI sets `Geweigerd`), and `dddc1c97` *Verkeer*
`2027-01-04` to `2027-01-05`, `Manueel`, which is the **non-rejected control**. The recorded baseline was
byte-identical to round 3's, which is evidence that round 3's restore was honest.

| state | what a teacher actually reads | picker | grip |
|---|---|---|---|
| `Geweigerd` x stale, **coarse** | *"Dit thema is geweigerd, dus je kan het niet verplaatsen. Draai hieronder eerst de weigering terug."* + `weigeringUitleg`, then the **Weigering terugdraaien** button | none | none |
| `Geweigerd` x stale, **fine** | **identical**, verbatim: none of the three re-placement sentences | none | none |
| control `Manueel` x stale, coarse | `herplaatsKies` + a picker listing **7** themaperiodes + the grip glyph | yes | yes |
| control `Manueel` x stale, fine | *"Een themaperiode kiezen voor dit thema kan in de weergave “Themaperiodes”."* | none | none |

So the contradiction is gone: the only sentence left on a rejected card is the one that is true, and the control it
points at (*Draai hieronder eerst de weigering terug* leads to **Weigering terugdraaien**) is on the same screen at
both tiers. The control card proves the suppression is scoped to the rejection rather than blanket: `herplaatsKies`
and the picker still appear where they can be honoured, and the promise the fine tier makes is keepable, because the
named view really does hold the picker.

**One observation, not a defect.** The remedy on a rejected stale card is two steps (reverse the rejection, *then*
choose a themaperiode) and only the first is named, carried by *"eerst"*. That is round 3's deliberate design and it
reads correctly; it is recorded because it is the kind of thing a reviewer will ask about.

**What this does NOT do.** It does not close E3-07, and **E3-07's checkbox was not touched**. A side effect is not a
verified story: this measured one reopened symptom on one screen, not E3-07's own acceptance criteria, and the
ruling on the owner's own story is the owner's. The evidence is offered; the decision is not taken.

**Also verified in the browser, because this merge rewrote the JSX that carries it:** E4-06's lock switch still
works end to end on the merged tree. *Vastzetten* flips the sentence to `vergrendelUitlegVast`, the persisted flag
comes back from the API, and the `role="status"` region from main's conflict hunk fires with *"“Ik en mijn klas”
staat nu vast."*; *Losmaken* returns it. Set and undone through the UI, so the check left no residue of its own.
(The screenshot probe's crude `textContent.includes('Vast')` also matches the word *Vastzetten*, so **no claim is
made here about the "Vast" badge** — the button-label flip, the sentence flip and the announcement are the evidence.)

**390px** (an exactly-390px iframe, since headless `--window-size` clamps to ~504px): `innerWidth 390`,
`documentElement.scrollWidth 390`, **no document overflow**, panel open and wrapping, still no picker. The parent
frame must be **same origin** as the iframe or `contentDocument` is `null` — an `about:blank` parent has an opaque
origin, which is worth writing down because it fails as if the app were broken.

**Restored, verified twice:** by DB query *and* by `GET /api/klassen/{id}/jaarplan` (6 placements, `isVervallen` 0,
`Geweigerd` 0, `vergrendeld` 0, all six dates and statuses back at baseline). Kept startthema still
`2026-11-09 / Licht en donker`. All ports verified free by `netstat`.

**Screenshots** (six, `md5sum merge-*.png | sort | uniq -w32 -D` prints nothing):

| file | the claim it carries |
|---|---|
| `merge-1-grof-geweigerd-vervallen.png` | **coarse: E3-07's contradiction is gone**, one true sentence and its button |
| `merge-2-fijn-geweigerd-vervallen.png` | **fine: identical, no re-placement sentence at all** |
| `merge-3-controle-grof-picker-aanwezig.png` | control: the picker with 7 themaperiodes, and the grip |
| `merge-4-controle-fijn-verwijst-naar-grof.png` | control: the fine tier's promise, which the coarse tier keeps |
| `merge-5-390-geweigerd.png` | 390px, no overflow |
| `merge-6-e4-06-slot-werkt-na-merge.png` | E4-06's lock still works after the JSX rewrite |

### Gates, on the merged tree

Run **alone** in this worktree (two concurrent vitest runs on one `node_modules/.vite` cost this story an
unexplained QUESTION earlier; nobody else was in the worktree).

| gate | result |
|---|---|
| `corepack pnpm lint` (`eslint . --max-warnings 0 && tsc --noEmit`) | **exit 0**, no output |
| `corepack pnpm vitest run` | **224 passed / 224, 12 files**, 0 failed, 0 skipped |
| `corepack pnpm build` | **exit 0**, built in 4.54s |

**The vitest delta is +18 on the pre-merge 206/206, and all 18 came from main.** Accounted for exactly, none of it
from this resolution:

| file | delta | source |
|---|---|---|
| `Jaarplankalender.test.tsx` | **+14** (10 plain, plus two new 2-row `it.each` blocks at lines 908 and 949) | E4-06 |
| `DoelenPagina.test.tsx` | **+2** | E1-16 |
| `i18n/catalogus.test.ts` | **+2** (E4-06's `kalender.vergrendel*` hergeneratie family guard) | E4-06 |

**Backend: the old no-change check is now invalid, and this is the replacement.** `git diff --stat 0de4851..HEAD --
backend/` was the check up to round 3; after the merge it is non-empty for a reason that has nothing to do with
E3-08, because main's 28 commits contain backend work. Two checks were used instead, both empty:

- `git diff --stat origin/main...HEAD -- backend/` (**three dots**, merge base `0de4851`): empty. **E3-08 itself
  contributes no backend change**, which is what this story has claimed since round 1.
- `git diff --stat origin/main -- backend/` against the merged working tree: empty. **The merged tree's backend is
  byte-identical to `origin/main`'s**, and likewise for `global.json`, `*.sln` and `docker-compose.yml`.

**`dotnet test` was therefore not run, and that is a stated conclusion rather than an omission.** With a zero-byte
backend delta against `origin/main`, a run here would re-verify `61457bc`, whose backend gates E4-06 already passed
(496 unit + 154 integration). The backend *was* exercised, in the way that actually matters for this merge: the
merged frontend drove the real API against real PostgreSQL through every path above, including two writes
(vergrendeling set and undone) that persisted and read back.

### Still open after the merge

- Everything in round 3's open list still stands: **MINOR-3**, **QUESTION-B**, the generation-tier grid's silent
  stale state, and E3-09's inherited **MINOR-E** plus the three te-vol strings (two of which are the bare-*periode*
  strings named above).
- **E3-07's status is the owner's call.** The evidence above says its reopened symptom is gone at both tiers on this
  tree; nothing here verifies the rest of E3-07, and its checkbox is untouched.
- **The merge is committed on `story/E3-08-zoomniveaus` and NOT pushed.** Whoever merges it onward will also pick up
  main's `efecf73` (three doc/asset commits) for free.
