# E4-02 — Test report (round 1, first independent gate for this story)

**Verdict:** PASS
**Mode:** both (headless Chrome over CDP + Playwright MCP, live API + real PostgreSQL, plus the Vitest suite)
**Tree:** worktree `.claude/worktrees/e4-02-aanvaarden`, branch `story/E4-02-aanvaarden`, HEAD `e47e7e8`
**Stack:** API `http://localhost:5493` (`/health` -> `Healthy`) against database `jp_e402`; Vite `http://localhost:5494`

Every load-bearing figure in this story was self-reported and no independent gate record existed
(E1-13, E3-08 and E4-06 each have one). All nine claims below were **re-derived from scratch**, not
taken from the implementer's worklog. **All nine hold.** One is reported with a correction to the
*explanation* rather than the result, and three limitations are recorded that the claims did not state.

## Criteria checked

### 1. Accepting moves the coverage figure (the central claim) -> PASS

> "Pressing Aanvaarden on `Water en weer` should take `GET /api/klassen/{klasId}/dekking` from 0 of 2
> gedekt to 2 of 2, with the placement readable back from PostgreSQL as `Aanvaard`."

Driven by the **button in the browser**, not the API.

| Step | Evidence |
|---|---|
| Baseline (placement forced to `Voorgesteld` by `psql`) | `isBetrouwbaar: True, aantalOnopgelosteVervallenPlaatsingen: 0, aantalGedekt: 0, aantalLeerplandoelen: 2` |
| Clicked `Water en weer aanvaarden` (Playwright MCP) | badge flipped `Voorgesteld` -> `Aanvaard`; both decision buttons unmounted |
| DB read-back | `SELECT "Status" ... '54c1fa0d...'` -> `Aanvaard` |
| Dekking after | `aantalGedekt: 2, aantalLeerplandoelen: 2`, both doelen `isGedekt: true`, `dekkendeThemas: ['Water en weer']` |

**0 of 2 -> 2 of 2 confirmed**, through E5-01's real computation against real Postgres.

*Limitation the claim does not state (not a defect of this story):* the figure is at **leerplandoel**
level only. `minimumdoelen` is **empty** (0 rows) because E1-12 is blocked, so minimumdoel-level
coverage, the level the onderwijsinspectie tests, is **not exercised by this evidence** and cannot be
until E1-12 lands. Also, no screen shows this figure yet (`/dekking` is still `binnenkort`), so
"accepting moves the coverage figure" is verified **at the API**, not as something a teacher can see.

### 2. Rejecting a *stale* proposal restores the withheld figure -> PASS

> "With the stale placement `Voorgesteld`, dekking should report `isBetrouwbaar: false`,
> `aantalOnopgelosteVervallenPlaatsingen: 1`, `aantalGedekt: null`. Press Weigeren; it should become
> `true` / `0` with a figure."

| Step | Evidence |
|---|---|
| Stale `Feesten in december` (`BlokStart 2026-12-01`) set `Voorgesteld` | `isBetrouwbaar: False, aantalOnopgelosteVervallenPlaatsingen: 1, aantalGedekt: None` — matches the claim exactly |
| Clicked `Feesten in december weigeren` | badge -> `Geweigerd`; DB read-back `Geweigerd` |
| Dekking after | `isBetrouwbaar: True, aantalOnopgelosteVervallenPlaatsingen: 0, aantalGedekt: 2` |

A weigering is indeed what resolves a stale proposal and restores the withheld figure
(`DekkingService`'s `IsVervallen && !IsGeweigerd`).

### 3. The state matrix -> PASS (all five states)

| Card state | Expected | Observed |
|---|---|---|
| `Voorgesteld`, not stale (`Water en weer`) | both buttons | `Aanvaarden` + `Weigeren` |
| `Voorgesteld`, **stale** (`Feesten in december`) | `Weigeren` only + `kalender.beslisVervallen` | `Weigeren` only, with "Zolang dit thema in geen enkele periode staat, kan je het niet aanvaarden. Weigeren kan wel." — byte-identical to `nl.json` `kalender.beslisVervallen` |
| `Aanvaard` (`Herfst en oogst`) | neither | only `Aanpassen` |
| `Geweigerd` (`Wonen en bouwen`, and stale `Feesten`) | neither | only `Aanpassen` |
| `Manueel` (`Wonen en bouwen`) | neither | only `Aanpassen` |

Also confirmed on **E3-08's fine tier**: after switching to Subthemaperiodes, the stale card still
offers `Weigeren` and every decided card offers nothing.

### 4. Keyboard round trip -> PASS

`Voorgesteld -> Geweigerd -> Manueel` driven **by Tab/Enter only** (CDP `Input.dispatchKeyEvent`, no clicks):

- Tab reached `Water en weer aanvaarden`, then `Water en weer weigeren` (focus order verified via `document.activeElement`); **Enter** -> badge `Geweigerd`, DB `Geweigerd`.
- The `role="status"` region carried the decision sentence and is genuinely `sr-only` (`position: absolute`, `width: 1px`).
- Tab -> `Aanpassen`, **Enter** -> panel opened with `Weigering terugdraaien`.
- Tab -> `Weigering terugdraaien`, **Enter** -> badge `Manueel`, region read the teruggedraaid sentence.
- **DB final: `Manueel`.**

This also discharges the story's formal *Done when* ("overriding a `voorgesteld`/`aanvaard` link sets
`manueel` and sticks"): a separate pass confirmed `Aanvaard` **survives a full page reload**
(`before: Voorgesteld` -> `afterAccept: Aanvaard` -> `afterReload: Aanvaard`, DB `Aanvaard`).

### 5. Contrast, alpha composited -> PASS, all four figures exact

Measured in real Chrome, compositing every semi-transparent ancestor background down to the page (a
10% tint is never treated as a solid fill). jsdom cannot do this, which is why it was re-derived.

| Element | Claimed | Measured | Floor |
|---|---|---|---|
| `Aanvaarden` fill vs card | 8,90:1 | **8.90:1** (`rgb(22,81,90)` on `rgb(255,255,255)`) | SC 1.4.11 3:1, passes |
| `Weigeren` outline border vs card | 3,40:1 | **3.40:1** (`rgb(150,138,115)`) | SC 1.4.11 3:1, passes (narrow) |
| `Aanvaarden` label vs its fill | 8,90:1 | **8.90:1** | SC 1.4.3, passes |
| `Weigeren` label vs card | 15,42:1 | **15.42:1** | SC 1.4.3, passes |

### 6. Target size -> PASS, and the pre-existing failure is real

| Control | Claimed | Measured |
|---|---|---|
| `Aanvaarden` | 106x36 | **106.14 x 36** |
| `Weigeren` | 91x36 | **91.48 x 36** |
| `Aanpassen` (pre-existing) | 61x16 | **61.42 x 16** — **fails SC 2.5.8's 24x24 floor** on height |

The two new buttons clear the floor comfortably. The `Aanpassen` failure predates this story
(E3-06/E3-07) and **is properly routed**: `backlog/E7-niet-functioneel.md` lines 72-75 record it in the
destination file with the same measurement, so it is filed rather than merely named.

### 7. 390px -> PASS, with a correction to the explanation

| Check | 390px | 375px |
|---|---|---|
| Card width | 266px | **266px** (the claimed figure, at both widths) |
| Decision buttons | `106x36` + `91x36`, `sameRow: true` (identical `top` 1646.5) | same, unshrunk |
| `document.body.scrollWidth === clientWidth` | 390 === 390, no overflow | 375 === 375, no overflow |
| `documentElement.scrollWidth` | **680** > 390 (naive check false-positives) | 680 > 375 |
| `window.scrollTo(9999,0)` then `scrollX` | **0**, page genuinely does not scroll | **0** |

**Which check I used:** all three, and I add a stronger one the claim did not use. `body.scrollWidth`
vs `clientWidth` is the check that reports no overflow; `documentElement.scrollWidth` is the naive
check that false-positives here. The decisive evidence is that **attempting to scroll the window
horizontally leaves `scrollX` at 0**, which settles it independently of either `scrollWidth`.

**Correction:** the claim attributes the inflated `documentElement.scrollWidth` to "the period ribbon".
Enumerating the actually-overflowing elements shows **two** independent scrollers contribute, not one:
the **nav ribbon** (`NAV.subtle-scrollbar ... overflow-x-auto`, nav items out to `right: 584.8`) and the
**period ribbon** (`OL.subtle-scrollbar`, `LI.w-72` out to `right: 604`). Every overflowing element is
inside one of the two `overflow-x-auto` scrollers. The conclusion holds; the stated cause was incomplete.

### 8. The copy split -> PASS

Opened the `Aanpassen` panel on all four cards at once and tested for both sentences:

| Card | Stale | `weigeringUitleg` | `weigeringUitlegVervallen` | Both? |
|---|---|---|---|---|
| `Feesten in december` (`Geweigerd`) | yes | no | **yes** | **no** |
| `Water en weer` (`Geweigerd`, placed, from the keyboard pass) | no | **yes** | no | **no** |

The rejected **stale** card gets `weigeringUitlegVervallen` ("... maar dit thema staat in geen enkele
periode ...") and the rejected **placed** card gets `weigeringUitleg` ("... het thema komt dan als jouw
eigen keuze in deze themaperiode."). `bothOnOneCard: false` on every card.

### 9. The gates -> PASS, count exact

- `corepack pnpm lint` -> clean (`eslint . --max-warnings 0 && tsc --noEmit`, no output)
- `corepack pnpm build` -> built in 4.57s
- `corepack pnpm test` -> **`Test Files 15 passed (15)` / `Tests 314 passed (314)`**, matching the claimed 314 / 15 exactly

**The tests are not vacuous.** I read the E4-02 assertions rather than trusting green. They pin the
request body (`{status: "Aanvaard"}`), the PUT route, the **resulting card state rendered from the
server's response** (not an optimistic guess), the live-region text, and the full no-decision matrix
across `Aanvaard`/`Manueel`/`Geweigerd`. The stale test deliberately supplies a distinct `naPlan` so the
`Geweigerd x vervallen` screen is actually rendered, with a comment explaining that asserting the
request alone proves the button is wired and proves nothing about what the teacher then sees.

## Commands run

- `curl /health` -> `Healthy`; `curl /api/klassen/{id}/dekking` (six times across states) -> figures above
- `psql -h 127.0.0.1 -U postgres -d jp_e402` — read/forced `themaplaatsingen."Status"` per case; read-back after every browser action
- Playwright MCP: `browser_navigate`, `browser_snapshot`, `browser_click` (Aanvaarden, Weigeren)
- Headless Chrome over CDP (this MCP toolset exposes no `browser_evaluate`/`browser_resize`) for contrast, geometry, overflow, keyboard dispatch and console capture
- `corepack pnpm lint` / `build` / `test` in `frontend`

## Evidence

- `backlog/worklogs/E4-02/evidence/desktop-1440-beslispaar.png` — decision pair at 1440px
- `backlog/worklogs/E4-02/evidence/mobiel-390-beslispaar.png` — 390px: card 266px, both buttons on one row
- `backlog/worklogs/E4-02/evidence/mobiel-390-vervallen-kaart.png` — 390px: stale card, `Weigeren` only + `beslisVervallen`
- Live-region text captured verbatim for all three transitions (aanvaard / geweigerd / teruggedraaid)

## Investigated and dismissed (not defects)

- **`ReferenceError: magBeslissen is not defined` / `openBeslissingen is not defined`** appear in the
  Playwright MCP browser's *historical* console buffer and look alarming. They are **stale Vite HMR
  artefacts from the implementer's own editing session**, not HEAD behaviour: the URLs carry HMR
  cache-bust stamps (`?t=1785775384948`), the line numbers do not match HEAD (error at
  `Jaarplankalender.tsx:409`, while `openBeslissingen` is defined at 359 and used at 636), and
  `magBeslissen` **does not exist at HEAD at all** — `git log -S` shows it in
  `3795c16`/`cd6e3e0`/`447fe0a`, i.e. it was the single flag that antagonist round 1 split into
  `magAanvaarden`/`magWeigeren`. **A fresh full page load at HEAD produces 0 console errors and 0
  warnings** (CDP `Runtime.exceptionThrown` + `Runtime.consoleAPICalled` + `Log.entryAdded`).
- **All user-facing text resolves from `nl.json`.** No hard-coded Dutch in `Themakaart.tsx`; the only
  Dutch-looking string literals are inside English code comments. Every sentence observed on screen was
  matched back to its key.

## Limitations of this report (stated rather than glossed)

1. **Minimumdoel-level coverage is untested** — `minimumdoelen` has 0 rows (E1-12 blocked), so the 0->2 movement is leerplandoel-level only.
2. **No teacher-visible dekking figure exists** — `/dekking` is `binnenkort`, so claim 1 is verified at the API, not on a screen.
3. **The known accept/move race is not exercised.** `Themakaart.tsx` documents it (face buttons check only `statuswijziging.isPending`, so with the panel open two PUTs can be outstanding against one row, last-response-wins). I did not attempt to trigger it; it remains deliberately open and documented, not verified either way.

## Defects

None. No criterion is unmet and no gate is red.

## Fixture state left behind

`jp_e402` restored to the documented starting state: `Water en weer` `Voorgesteld`,
`Wonen en bouwen` `Geweigerd`, `Herfst en oogst` `Aanvaard`, `Feesten in december` `Voorgesteld`
(stale) -> dekking `isBetrouwbaar: false`, `aantalOnopgelosteVervallenPlaatsingen: 1`, `aantalGedekt: null`.
