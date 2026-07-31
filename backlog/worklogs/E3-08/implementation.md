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
- **No horizontal page overflow at either width or tier:** `scrollWidth === clientWidth` (1440/1440, 390/390).
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
| Track **border** (`--input`) vs the page | **3.40:1** | 3:1 (SC 1.4.11) |
| Visible group label *Weergave* (12px, 600) | **14.55:1** | 4.5:1 |

The track's own fill measures 1.06:1 against the page (white on warm off-white), which is exactly why the border
is the carrier and why `border-input` rather than `border-border` was used.

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
