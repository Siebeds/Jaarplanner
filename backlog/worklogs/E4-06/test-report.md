# E4-06 — Test report (round 2, the fix commit)

**Verdict:** PASS
**Mode:** both (xUnit unit + real-PostgreSQL integration, Vitest, and a real headless-Chrome pass at 1440px and exactly 390px against the running API and PostgreSQL)
**Commit verified:** `ec65209` (fix round `889471d..ec65209`; story diff from `01327ce`)
**Worktree:** `C:\source\Jaarplanner\.claude\worktrees\e4-06-vergrendeling`, branch `story/E4-06-vergrendeling`

> Every figure below was re-derived by this run. The fix round's own report was lost, so nothing in
> `implementation.md` was taken on trust. Where its claims are confirmed, that is stated as a match; where my
> measurement differs, mine is given.

## Criteria checked

| # | Acceptance criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Lock and unlock from the kalender; persists across a reload; keyboard-operable with visible focus; not drag-dependent (SC 2.5.7) | **PASS** | Three real `PUT .../vergrendeling` round trips observed over the wire (`{"vergrendeld":true}` then 200, `false` then 200, `true` then 200) against the API on 5407 and database `jp_e406_verify`. After a full browser reload the "Vast" badge is still there, and `SELECT` confirms the row: `Ik en mijn klas | Voorgesteld | Vergrendeld = t`. The lock was reached and fired **by keyboard only**: Tab from the disclosure to the period `select` to the `Vastzetten` button, then Enter. The focus indicator on the focused button is a real ring, `box-shadow rgba(22,81,90,0.98) 0 0 0 3.93px` over an `rgba(250,248,245,0.98)` inner ring. The control is a `button` inside the "Aanpassen" panel, with no drag involved. |
| 2 | Label or icon, never colour alone; all copy in `nl.json`; no em dashes; no server string rendered; error handling branches on `ApiError.status`, not `isError` | **PASS** | The badge renders a lock glyph **plus** the word "Vast" (screenshot `matrix-1440.png`). The 12 new keys are all in `nl.json`; the catalogue-wide em-dash guard in `Generatieparameters.test.tsx` and the plural guard in `i18n/catalogus.test.ts` (3 tests) both pass. In the browser, a **404 fulfilled with a deliberately planted server string** rendered `kalender.vergrendelVerdwenen`, and `document.body.innerText.includes(...)` for that string was `false`. A **blocked request** (no `ApiError` at all, `fetch` rejects) rendered `kalender.vergrendelMislukt`, so the non-`ApiError` branch is genuinely reached, not only the 500 one. |
| 3 | Against real PostgreSQL: a locked placement survives a full regeneration while an unlocked `Voorgesteld` one is replaced | **PASS** | The story's `JaarplanPersistentieTests.Een_vergrendeld_voorstel_overleeft_een_volledige_hergeneratie` passes as a `[PostgresFact]` against local Postgres 17, and it is a real isolation: both placements are `Voorgesteld` and differ only in the flag, the stubbed model answers with a real plan, and survivor and victim are asserted on the **table** via `SELECT "Id" FROM themaplaatsingen`, not only on the aggregate. Independently re-proven below that an unlocked `Aanvaard` and an unlocked `Manueel` placement also survive, and that neither survivor is duplicated when the model re-proposes the same thema in the same period. |
| 4 | Frontend tests cover the round trip **and** the error path | **PASS** | `Jaarplankalender.test.tsx` has 35 tests, 9 of them new this round. The round-trip test asserts method, URL, both request bodies and the badge flipping; the error test drives 404 to `vergrendelVerdwenen` and 500 to `vergrendelMislukt` in two separate renders, branching on `ApiError.status`. I read the assertions: they pin behaviour, not merely a green run. |
| 5 | *Partial* regeneration is E4-05 and does not exist, so the story must not claim it | **PASS** | `GenereerAsync` still takes no period scope. All four lock sentences say "een hergeneratie van **het hele jaarplan**", and a test pins that wording on all four keys. The backlog checkbox is still `[~]`, and the worklog scope table says the partial half is not claimed. |

## The copy-truth matrix, verified empirically

Eight placements were seeded straight into PostgreSQL to produce every `(status, vergrendeld, isVervallen)`
combination in one class, then every card's "Aanpassen" panel was opened in a real browser and its rendered Dutch
read back out of the DOM. **The observed matrix is exactly the specified one.**

| state | card | section? | sentence observed |
| --- | --- | --- | --- |
| `isVervallen && vergrendeld` | Herfst | yes, with control | `vergrendelUitlegVervallen` plus "Losmaken" |
| `isVervallen && !vergrendeld` | Licht en donker | **no section at all** | none: no lock sentence, no "hoeft hier niet", no button |
| `!isVervallen && !Voorgesteld && vergrendeld` | Water (`Aanvaard`) and **Verkeer (`Manueel`)** | yes, with control | `vergrendelUitlegBeslistVast` plus "Losmaken", and no `vergrendelDekking` |
| `!isVervallen && Voorgesteld && vergrendeld` | Herfst en oogst | yes, with control | `vergrendelUitlegVast` **plus** `vergrendelDekking` plus "Losmaken" |
| `!isVervallen && Voorgesteld && !vergrendeld` | Ik en mijn klas | yes, with control | `vergrendelUitlegVrij` **plus** `vergrendelDekking` plus "Vastzetten" |
| `!Voorgesteld && !vergrendeld && !Geweigerd` | Lente en groei (`Aanvaard`) | sentence only | `vergrendelNietNodig`, no lock button |
| `Geweigerd && !vergrendeld` | Zomer en vakantie | no lock sentence | only `weigeringEerstTerugdraaien` and `weigeringUitleg` |

### Is each sentence true of the state it renders in?

- **`vergrendelUitlegBeslistVast`, which claims that losmaken only removes the label and the thema stays put.**
  **True, and proven against real PostgreSQL rather than inferred from `IsVervangbaar`.** A scratch `[PostgresFact]`
  (run, then deleted) seeded an **unlocked** `Aanvaard`, an **unlocked** `Manueel` and an unlocked `Voorgesteld`
  placement, then ran the production `JaarplanGeneratieService` on the production `EfJaarplanOpslag` with a stubbed
  model that re-proposed **both survivors in the periods they already occupied**. Result: `AantalBehouden = 2`,
  `AantalVervangen = 1`, `AantalNieuw = 0`; `SELECT "Id" FROM themaplaatsingen` returned exactly the two survivors,
  still `Vergrendeld = false`, on their original `BlokStart`, with the `Aanvaard` one's original `AiMotivatie`
  intact, and the unlocked proposal's row gone. **No silent duplication:** `VindPlaatsingOp` recognises the
  existing placement and counts it as a `duplicaat` instead of inserting a second row. Verified separately for a
  **locked** `Voorgesteld` placement re-proposed in its own period too: one row before, one row after, motivation
  unchanged.
- **`vergrendelUitlegVervallen`, which says the thema is in no period at all.** Accurate in this codebase's own
  vocabulary, and **not in contradiction with `herzienUitleg`**, which is on screen at the same moment.
  `herzienTitel` already says "staan niet meer in een periode" and `dekkingOnbekend` already says "zolang dit thema
  geen periode heeft"; `herzienUitleg` adds the mechanism, that the stored date is no longer a periodegrens. Same
  fact at two levels of precision, one at region level and one at card level. Both were read off the `Herfst` card
  and its surrounding notice in the same render.
- **`vergrendelDekking`, which says the thema only counts once it is aanvaard.** True of the state it renders in (a
  `Voorgesteld` placement does not count), but **incomplete** against the binding reading in
  `backlog/E5-dekking-export.md:15`, where `Aanvaard` **and `Manueel`** count as placed. See finding 1.
- **`vergrendelMislukt`** no longer claims "niets gewijzigd" and points at a reload. Both failure paths reach the
  right sentence in a real browser: 404 gives `vergrendelVerdwenen`, and a blocked request, which produces no
  `ApiError` at all, gives `vergrendelMislukt`.

### The two states nobody had looked at

- **Locked `Manueel` (Verkeer).** The panel renders `vergrendelUitlegBeslistVast` and keeps "Losmaken", so a lock a
  teacher produced stays undoable. No `vergrendelDekking`, correctly, because it already counts. No `verplaatsGevolg`
  either, because the placement is `Manueel` with no AI motivation and so has nothing to lose.
- **Stale (`isVervallen`).** Locked (Herfst): the vervallen sentence plus "Losmaken". Unlocked (Licht en donker): no
  lock section at all. **Unlocking the stale card was driven live**, not reasoned about: the announcement fired, the
  whole section then disappeared, and no "Vastzetten hoeft hier niet" appeared in its place.

## The success announcement (SC 4.1.3)

Driven with a `MutationObserver` on the card, recording every change to the `role="status"` text.

| toggle | live-region transition observed |
| --- | --- |
| lock, by keyboard with Enter | empty, then "Ik en mijn klas staat nu vast." |
| unlock, immediately after | empty, then "Ik en mijn klas staat niet meer vast." |
| lock again, third in a row | empty, then "Ik en mijn klas staat nu vast." |
| unlock a **decided** card (`Manueel`, whose section disappears) | covered by the Vitest case; the panel-level region survives the section unmounting |
| unlock a **stale** card (section disappears) | empty, then "Herfst staat niet meer vast.", driven in the browser |

The region is empty before the teacher acts, so it cannot announce on open; it is keyed on the persisted
`plaatsing.vergrendeld`, so it reports what the server stored rather than what was requested; and `isPending` empties
it first, which is what lets a repeat announce. All three consecutive toggles fired.

## The `destructiveOutline` variant

Measured in headless Chrome with **every alpha layer composited**: the panel well is `bg-paper-diep/60` over
`bg-card`, which flattens to `rgb(248,247,244)`. My figures, not the worklog's:

| what | colour | against | ratio | requirement |
| --- | --- | --- | --- | --- |
| label "Uit deze periode halen" | `rgb(103,54,20)` | its own fill `rgb(255,255,255)` | **9.93:1** | 4.5 (SC 1.4.3) |
| its 1px border | `rgb(103,54,20)` | panel well `rgb(248,247,244)` | **9.24:1** | 3 (SC 1.4.11) |
| the neighbouring `outline` "Losmaken" border | `rgb(150,138,115)` | same well | 3.16:1 | 3 |
| `destructive` confirm "Ja, verwijderen" | white on `bg-attentie-ink` `rgb(103,54,20)` | its own fill | 9.93:1 | 4.5 |

The worklog claimed 9.74 and 9.07; the real values are 9.93 and 9.24. Both claims were conservative and both clear
their thresholds either way.

- **No new hue:** it reuses `attentie-ink`, the same token `destructive` fills with. Confirmed from the computed
  styles, not from the class name.
- **Not colour alone:** a 9.24:1 dark rule beside the neighbour's 3.16:1 muted rule is a luminance difference of
  roughly 3x, which survives monochrome, and the label states the action.
- **It does not look like the `destructive` button it leads to:** the two are inverses. The trigger is a white
  (`bg-card`) button with a dark border and a dark label; the confirm is a solid `rgb(103,54,20)` fill with white
  text. Checked side by side in the confirm state at both widths.

## 390px

Driven with a genuine 390px layout viewport (`Emulation.setDeviceMetricsOverride`, verified by
`window.innerWidth === 390` and `devicePixelRatio 2`), which sidesteps the roughly 504px `--window-size` clamp
entirely, so no iframe was needed. `documentElement.scrollWidth === 390`, so **no horizontal overflow**. The buttons
are 220x36px, comfortably tappable, and the outlined destructive trigger is clearly distinguishable from "Losmaken"
directly above it. Screenshot `mobile-390.png`.

## Commands run

| command | result |
| --- | --- |
| `JAARPLANNER_TEST_POSTGRES=... dotnet test` (backend, both suites) | **Unit: 496 passed, 0 failed, 0 skipped.** **Integration: 153 passed, 0 failed, 0 skipped.** Matches the worklog exactly. |
| `dotnet test tests/Jaarplanner.IntegrationTests --filter ...` (the story test plus 2 scratch proofs) | **3 passed, 0 failed, 0 skipped** |
| `corepack pnpm test` | **200 passed in 12 files, 0 failed** (`Jaarplankalender.test.tsx` 35, `i18n/catalogus.test.ts` 3). Matches the worklog. |
| `corepack pnpm lint` (`eslint . --max-warnings 0 && tsc --noEmit`) | exit 0, no output |
| `corepack pnpm build` | exit 0, built in 5.29s |
| `dotnet format --verify-no-changes` | exit 0 |
| API on `http://127.0.0.1:5407` against database `jp_e406_verify`, Vite on 5307 proxying to it | `/health` returns `Healthy`; the eight seeded placements are served correctly, with `isVervallen` derived from the real grid |
| headless Chrome over CDP at 1440x1100 and 390x844 | see above; **browser console clean** apart from the deliberately injected 404 |

The connection string used for the backend suites was
`Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable`, so
**no `[PostgresFact]` was skipped** in either run.

## Evidence

Screenshots from this session's scratchpad: `shots/matrix-1440.png` (all eight panels open at once),
`shots/confirm-1440.png` (destructive beside destructiveOutline), `shots/error-network-1440.png`,
`shots/error-404-1440.png`, `shots/stale-unlocked-1440.png`, `shots/mobile-390.png`.

Wire traffic for the round trip:

```
> PUT /api/klassen/75ad.../jaarplan/plaatsingen/5cd5ef3b.../vergrendeling {"vergrendeld":true}    < 200
> PUT .../vergrendeling {"vergrendeld":false}                                                     < 200
> PUT .../vergrendeling {"vergrendeld":true}                                                      < 200
```

Persistence, read straight out of PostgreSQL after the browser reload:

```
5cd5ef3b-0e7f-47a8-9487-c751df7cbde4 | Ik en mijn klas | Voorgesteld | t
```

## Findings (advisory, not criterion failures)

None of these blocks the verdict. All three are copy or UX judgements for the owner or a follow-up story, and the
first is the one that deserves a decision.

1. **[medium] `vergrendelDekking` states an incomplete condition, and the route it omits sits on the same card.**
   The sentence says the thema counts "zodra het **aanvaard** is". The binding reading in
   `backlog/E5-dekking-export.md:15` is that **`Aanvaard` *and* `Manueel`** count as placed. On the very card this
   sentence appears on, "Verplaatsen" converts a `Voorgesteld` placement to `Manueel`, which by that reading makes it
   count. So a teacher who wants the thema to count is pointed at a status this screen cannot set (there is
   deliberately no accept control until E4-01/E4-02) while a control a few pixels above achieves the same coverage
   outcome. Judged against the question "does it leave a teacher able to act": **no, it informs them of a dead end.**
   Two defensible resolutions, both the owner's call: widen the sentence to name both routes, or leave it and
   accept that the actionable half arrives with the accept control. Worth noting too that `/dekking` is still
   `isGebouwd: false`, so the figure the sentence talks about has no screen yet. Not raised as a criterion failure
   because the sentence is true of the state it renders in; raised because it exists precisely to prevent a false
   inference, and it is currently only three-quarters true.
2. **[low] On a stale locked card the "choose a period" instruction is stated twice.** `herplaatsKies` at the top of
   the panel says "Kies hieronder een periode voor dit thema, of versleep de kaart ...", and then
   `vergrendelUitlegVervallen` says "... kies eerst een periode voor dit thema". Not wrong, but CLAUDE.md's own
   rule is that explanatory prose is the first thing to cut and is never repeated. Cosmetic.
3. **[informational] A locked `Geweigerd` card is told "Je hebt dit thema zelf beslist"** by
   `vergrendelUitlegBeslistVast`, beside `weigeringUitleg`. Defensible, since a rejection is the teacher's own
   decision, and the sentence is factually true of that state. The implementer already reported the wider question of
   whether the rejection copy should itself say that a rejection survives a regeneration; that stays an owner question
   and is untouched here.

## Housekeeping

- One scratch `[PostgresFact]` file was added to prove the `Aanvaard`/`Manueel` survival and the no-duplication
  claim, run, and then **deleted**. `git status` is clean apart from this report. No product code was touched, no
  branch was switched, nothing was pushed, and the primary tree at `C:\source\Jaarplanner` was not entered.
- The API, Vite and Chrome processes started for this run (ports 5407 and 5307, plus a private Chrome profile) were
  stopped afterwards. Two `Jaarplanner.Api.exe` processes belonging to *other* worktrees
  (`agent-a8b6127bb7255ef99` and `e3-08-zoom`) were checked first and deliberately left alone; neither held this
  worktree's DLLs, so nothing had to be killed before building.
- The verification database `jp_e406_verify` is left in place, holding the eight seeded lock states plus the three
  toggles this run performed. It is throwaway.

---

# E4-06 — Test report (round 3, the second fix commit)

**Verdict:** PASS
**Mode:** both (xUnit unit + real-PostgreSQL integration, Vitest, guard-mutation testing, and a real headless-Chrome
pass at 1440px and exactly 390px against the running API and PostgreSQL)
**Commit verified:** `81b4ed9` (round 2 = `c8fabe6..81b4ed9`)
**Worktree:** `C:\source\Jaarplanner\.claude\worktrees\e4-06-vergrendeling`, branch `story/E4-06-vergrendeling`

> Round 2 touched **no backend code** (`git diff --stat c8fabe6..81b4ed9 -- backend/` is empty) and
> `Een_vergrendeld_voorstel_overleeft_een_volledige_hergeneratie` is still at
> `backend/tests/Jaarplanner.IntegrationTests/Postgres/JaarplanPersistentieTests.cs:214`. **Criterion 3 therefore
> carries forward from round 2 unchanged**, and it was re-run green here. Everything else below was measured fresh:
> the sixteen-state matrix was read out of a real browser by this run, not taken from the worklog.

## Criteria checked

| # | Acceptance criterion | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Lock and unlock from the kalender; persists; keyboard-operable; not drag-dependent | **PASS** | Re-proven this round on the two states round 1 never reached. On `Geweigerd × vergrendeld × ¬vervallen` and `× vervallen`, "Losmaken" is present and **fires by keyboard only** (`Input.dispatchKeyEvent` Enter on the focused button, no pointer): `PUT /api/klassen/921c…/jaarplan/plaatsingen/b0000000-…-032/vergrendeling` with body `{"vergrendeld":false}` → **200**, then `…-034` → **200**. The badge disappears, and the API read-back gives `Geweigerd/false`. Re-locked over the API, both 200. |
| 2 | Label or icon, never colour alone; all copy in `nl.json`; no em dashes; no server string rendered | **PASS** | Every rendered `<p>` in all 32 opened panels (16 cards × 2 widths) was mapped back to an `nl.json` key: **0 unmapped strings**, so no hard-coded Dutch and no server string reaches the user. The "Vast" badge is text + glyph, and its `title` is now "Blijft staan bij een hergeneratie van het hele jaarplan" on every locked card. Contrast measured composited (below): 5.66:1 for the new copy, 9.24:1 for the border, and the delete trigger no longer shares a class list with "Losmaken" (`del.className === los.className` is **false**). |
| 3 | Against real PostgreSQL: a locked placement survives full regeneration while an unlocked `Voorgesteld` one is replaced | **PASS (carried forward + re-run)** | No backend change this round; the test has not moved. `dotnet test` integration: **153 passed, 0 failed, 0 skipped** against local Postgres 17. |
| 4 | Frontend tests cover the round trip **and** the error path | **PASS** | `corepack pnpm test`: **203 passed in 12 files, 0 failed** (was 200). I read the new `it.each` for `Geweigerd × vergrendeld × (placed, stale)`: it asserts the right sentence, asserts **all four** wrong sentences are absent, and *drives* "Losmaken" and asserts the request body. Behaviour, not a green run. |
| 5 | *Partial* regeneration is E4-05 and must not be claimed | **PASS** | `GenereerAsync` still takes no period scope. The catalogue guard now enforces the qualification over the whole `kalender.vergrendel*` family, and it bites (below). |

## The full sixteen-state matrix, read out of a real browser by this run

Sixteen placements seeded into a throwaway `jp_e406_r2` (migrated from the real migrations), one thema per status
(Water = `Voorgesteld`, Wonen = `Aanvaard`, Herfst en oogst = `Manueel`, Verkeer = `Geweigerd`), each placed twice in
real derived periods and twice on `2027-04-08` / `2027-04-10` inside the Paasvakantie where no block starts. The API
confirmed all sixteen `(status, vergrendeld, isVervallen)` triples before the browser ran. All sixteen "Aanpassen"
panels were opened and every `<p>` in each panel was read in **DOM order** and mapped back to its `nl.json` key.

**The rows are byte-identical at 1440px and at exactly 390px** (`JSON.stringify(sig(1440)) === JSON.stringify(sig(390))`
is `true`, over `[domOrder, titel, badgeVast, selectCount, keys, buttons]`).

| # | thema | status | `vergrendeld` | `isVervallen` | picker | buttons | sentences, in DOM order |
|---|---|---|---|---|---|---|---|
| 0 | Verkeer | Geweigerd | no | yes | 0 | Weigering terugdraaien, Uit het jaarplan halen | `herplaatsKies`, `weigeringEerstTerugdraaien`, `weigeringUitleg` |
| 1 | Wonen | Aanvaard | no | yes | 1 | Verplaatsen, Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg` |
| 2 | Herfst en oogst | Manueel | no | yes | 1 | Verplaatsen, Uit het jaarplan halen | `herplaatsKies` |
| 3 | Water | Voorgesteld | no | yes | 1 | Verplaatsen, Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg` |
| **4** | **Verkeer** | **Geweigerd** | **yes** | **yes** | **0** | **Losmaken**, Weigering terugdraaien, Uit het jaarplan halen | `herplaatsKies`, `weigeringEerstTerugdraaien`, **`vergrendelUitlegGeweigerdVast`**, `weigeringUitleg` |
| 5 | Wonen | Aanvaard | yes | yes | 1 | Verplaatsen, **Losmaken**, Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg`, `vergrendelUitlegVervallen` |
| 6 | Herfst en oogst | Manueel | yes | yes | 1 | Verplaatsen, **Losmaken**, Uit het jaarplan halen | `herplaatsKies`, `vergrendelUitlegVervallen` |
| 7 | Water | Voorgesteld | yes | yes | 1 | Verplaatsen, **Losmaken**, Uit het jaarplan halen | `herplaatsKies`, `verplaatsGevolg`, `vergrendelUitlegVervallen` |
| 8 | Water | Voorgesteld | no | no | 1 | Verplaatsen, **Vastzetten**, Uit deze periode halen | `verplaatsGevolg`, `vergrendelUitlegVrij`, **`vergrendelDekking`** |
| **9** | **Verkeer** | **Geweigerd** | **yes** | no | **0** | **Losmaken**, Weigering terugdraaien, Uit deze periode halen | `weigeringEerstTerugdraaien`, **`vergrendelUitlegGeweigerdVast`**, `weigeringUitleg` |
| 10 | Water | Voorgesteld | yes | no | 1 | Verplaatsen, **Losmaken**, Uit deze periode halen | `verplaatsGevolg`, `vergrendelUitlegVast`, **`vergrendelDekking`** |
| 11 | Wonen | Aanvaard | no | no | 1 | Verplaatsen, Uit deze periode halen | `verplaatsGevolg`, `vergrendelNietNodig` |
| 12 | Wonen | Aanvaard | yes | no | 1 | Verplaatsen, **Losmaken**, Uit deze periode halen | `verplaatsGevolg`, `vergrendelUitlegBeslistVast` |
| 13 | Herfst en oogst | Manueel | no | no | 1 | Verplaatsen, Uit deze periode halen | `vergrendelNietNodig` |
| 14 | Herfst en oogst | Manueel | yes | no | 1 | Verplaatsen, **Losmaken**, Uit deze periode halen | `vergrendelUitlegBeslistVast` |
| 15 | Verkeer | Geweigerd | no | no | 0 | Weigering terugdraaien, Uit deze periode halen | `weigeringEerstTerugdraaien`, `weigeringUitleg` |

**This is exactly the table the implementer reports.** The specific claims it was checked against:

- **The two rows this round exists for (#9 and #4)** render `vergrendelUitlegGeweigerdVast` and **none** of the four
  wrong sentences: no `vergrendelUitlegBeslistVast`, no `vergrendelUitlegVervallen`, no `vergrendelUitlegVast`, no
  `vergrendelNietNodig`, and no `vergrendelDekking`. Verbatim, as read from the DOM:
  > *"Bij een geweigerd thema voegt vastzetten niets toe: de weigering zelf houdt dit thema al buiten bereik van de
  > AI. Losmaken haalt alleen het label “Vast” weg, de weigering blijft."*
- **`vergrendelDekking` renders on exactly rows 8 and 10**, the two `Voorgesteld && !isVervallen` states, and
  nowhere else. That matches the guard `isVoorstel && !plaatsing.isVervallen` at `Themakaart.tsx:419`.
- **"Losmaken" is present on every one of the eight `vergrendeld` rows**, so a lock is always undoable whatever the
  status or staleness.
- **No `kalender.vergrendel*` sentence contains "kies"**; `herplaatsKies` is the only source of that instruction.

## Round-2 fix claims, each verified

1. **`slotUitleg` tests `isGeweigerd` first.** Confirmed in `Themakaart.tsx`, and confirmed empirically: rows #4 and
   #9 above take the `isGeweigerd` branch and not the `isVervallen` one.
2. **The "hier" in `weigeringUitleg` is load-bearing, so the implementer is right.**
   `JaarplanGeneratieService.cs:217` keys idempotence on
   `jaarplan.VindPlaatsingOp(thema.Id, GeneratieNiveau, suggestie.BlokStart)`, i.e. on `(thema, niveau, blokStart)`;
   a hit whose `Status == Geweigerd` is recorded as `afgewezen` and **not** inserted (`:221-223`). A different
   `blokStart` misses that lookup entirely and a fresh `Voorgesteld` row is added. So *"stelt dit thema **hier** niet
   opnieuw voor"* is precisely true, and an unqualified version would have been false. The survival half is true
   too: `Themaplaatsing.IsVervangbaar` is `Status == Voorgesteld && !Vergrendeld` (`Themaplaatsing.cs:105`), so a
   `Geweigerd` row is never discarded by `VerwijderVervangbarePlaatsingen()`.
   **Not an over-promise:** the clause *"de kaart verdwijnt alleen als je ze zelf uit het jaarplan haalt"* holds,
   because `VerwijderPlaatsingAsync` is the only deletion path and `JaarplanConfiguration.cs:111-114` maps
   `Themaplaatsing` to `Thema` with `DeleteBehavior.Restrict`, so a thema cannot be deleted out from under a
   placement.
3. **The new `vergrendelDekking` wording is true against E5.** `backlog/E5-dekking-export.md:15` binds **`Aanvaard`
   *and* `Manueel`**; *"zodra jij dit voorstel zelf overneemt"* covers both, and covers the route this screen can
   actually offer ("Verplaatsen" sets `Manueel`), where the old *"zodra het aanvaard is"* named the one status the
   screen cannot set. The medium finding from round 2 is **resolved**. It renders on exactly two states (above).
4. **The imperative is gone** from `vergrendelUitlegVervallen`, and it no longer renders on a rejected stale card
   (row #4 takes the `Geweigerd` branch).
5. **Contrast records reconciled**, settled with my own composite. See below; `button.tsx` and the worklog now state
   the same figures with the backdrops named.
6. **`vergrendeldUitleg` is qualified.** Read off every locked card badge `title` as
   "Blijft staan bij een hergeneratie van het hele jaarplan".
7. **The two corrected records** are present in `implementation.md`, marked as corrections rather than rewritten:
   the round-1 state table (~373) and the "Seven placements, covering every row" claim.

## The new guards actually bite (mutation-tested)

Each mutation was applied to `frontend/src/i18n/nl.json`, `src/i18n/catalogus.test.ts` was run, and the file was
restored. The tree is clean at `81b4ed9` afterwards.

| mutation | result |
| --- | --- |
| `vergrendeldUitleg` set back to "Blijft staan bij hergenereren" (drop the qualification) | **FAILS**, naming the key: `AssertionError: kalender.vergrendeldUitleg promises a hergeneratie without saying which one: expected "Blijft staan bij hergenereren" to contain "hele jaarplan"` (`catalogus.test.ts:126`). 1 failed, 4 passed |
| all 14 `kalender.vergrendel*` keys renamed to `slotvergrendel*` (the family stops matching) | **FAILS**: `AssertionError: expected 0 to be greater than 0` (`catalogus.test.ts:123`). The guard cannot go vacuous. *(This run was completed and the file restored by the orchestrator after I stalled the watchdog; both runs were `corepack pnpm vitest run src/i18n/catalogus.test.ts`.)* |
| "kies eerst een periode voor dit thema" put back into `vergrendelUitlegVervallen` | **FAILS**, naming the key: `AssertionError: kalender.vergrendelUitlegVervallen repeats the re-placement instruction: expected "dit thema staat vast, maar het staat …" not to match /\bkies\b/` (`catalogus.test.ts:142`). 1 failed, 4 passed |
| unmutated | **5 passed** |

## Contrast, composited, with every backdrop named: my own figures

Measured in headless Chrome on the real locked-rejected panel. The raw computed value of the well is
`rgba(243, 241, 237, 0.6)`; flattened over the white `bg-card` it is `rgb(247.8, 246.6, 244.2)` exactly, which rounds
to the `rgb(248, 247, 244)` every devtools readout shows.

| what | foreground | backdrop | ratio | needs |
| --- | --- | --- | --- | --- |
| `destructiveOutline` label "Uit deze periode halen" | `rgb(103,54,20)` | its own `bg-card` fill `rgb(255,255,255)` | **9.93:1** | 4.5 |
| its 1px border (SC 1.4.11) | `rgb(103,54,20)` | well, **exact** `rgb(247.8,246.6,244.2)` | **9.24:1** | 3.0 |
| the same border | `rgb(103,54,20)` | well, **rounded** `rgb(248,247,244)` | 9.27:1 | 3.0 |
| neutral `outline` "Losmaken" border | `rgb(150,138,115)` | same well | **3.16:1** | 3.0 |
| **`vergrendelUitlegGeweigerdVast`** and **`weigeringUitleg`**, 12px | `text-ink-zacht` `rgb(83,101,110)` | same well | **5.66:1** | 4.5 |
| `weigeringEerstTerugdraaien`, 12px | `rgb(103,54,20)` | same well | **9.24:1** | 4.5 |
| "Losmaken" label | `rgb(21,39,46)` | same well | 15.42:1 | 4.5 |

**Which number belongs in the record: 9.24.** It is the ratio against the actual `rgba(…, .6)` composite; 9.27 comes
from rounding the backdrop first. `button.tsx` now states **both**, says which input each comes from, and names the
backdrop, which is the right resolution: the earlier records were uncheckable precisely for lacking their backdrop.
Both clear the 3.0 of SC 1.4.11 by a wide margin either way. **Not colour alone** is confirmed by measurement rather
than by class name: 9.24:1 beside 3.16:1 is a roughly 3x luminance difference that survives monochrome, and
`del.className === los.className` is **false**, so the two triggers are not merely tinted twins.

## 390px

`Emulation.setDeviceMetricsOverride` with **`mobile: false`, set before the first navigation**. That note from the
implementer is correct and it mattered: the shared harness defaulted to `mobile: width < 600` and had to be patched.
Confirmed `window.innerWidth === 390`. `body.scrollWidth === 390`, and `window.scrollTo(600, 0)` leaves
`scrollX === 0`, so there is **no horizontal page scroll**. Walking every element: 167 sit right of the viewport with
all sixteen panels open, and **0** of them are outside a designated `overflow-x: auto|scroll` region.
`documentElement.scrollWidth` reads 2006 with all sixteen panels open and **390 with one panel open**, which confirms
the large reading is the ribbon scroll region being counted and not a layout defect. Buttons are 220x36; cards are
314px and 266px wide.

## The live region, both directions (SC 4.1.3)

Driven with a `MutationObserver` on the `role="status"` element inside the panel. On both locked-rejected cards the
region was **empty before the teacher acted**, so it cannot announce on open, and then announced exactly once:
*"“Verkeer” staat niet meer vast."* The lock direction was re-proven this round over the API plus a fresh render, and
by the Vitest round-trip test; the three-consecutive-toggle browser proof stands from round 2 on unchanged code.

## Commands run

| command | result |
| --- | --- |
| `dotnet format --verify-no-changes` | **exit 0**, no output |
| `dotnet test` (whole solution, `JAARPLANNER_TEST_POSTGRES` set) | **Unit: 496 passed, 0 failed, 0 skipped.** **Integration: 153 passed, 0 failed, 0 skipped** (2 m 32 s). No `[PostgresFact]` skipped. |
| `corepack pnpm lint` (`eslint . --max-warnings 0 && tsc --noEmit`) | **exit 0**, no output |
| `corepack pnpm test` | **203 passed in 12 files, 0 failed** (37.1 s) |
| `corepack pnpm build` | **exit 0**, built in 8.47 s, CSS 38.18 kB (matches the worklog) |
| `corepack pnpm vitest run src/i18n/catalogus.test.ts` × 4 (3 mutations + control) | see the mutation table |
| `dotnet ef database update` against `jp_e406_r2` | exit 0 |
| API on `http://127.0.0.1:5407`, Vite on 5307 proxying to it | `/health` returns `Healthy`; all 16 placements served with `isVervallen` derived from the real grid |
| headless Chrome over CDP at 1440x1100 and 390x844 | see above |

The connection string used for the backend suites was
`Host=127.0.0.1;Port=5432;Database=postgres;Username=jaarplanner;Password=jaarplanner_local;SSL Mode=Disable`.

## Evidence

Screenshots in this session scratchpad (`C:\Users\desaedeleirs\AppData\Local\Temp\e406r2\`): `m2-1440.png` and
`m2-390.png` (all sixteen panels open, full page), `geweigerd-vast-1440.png` and `geweigerd-vast-390.png` (the locked
rejected panel alone). Machine-readable matrices: `m2-1440.json` and `m2-390.json`.

## Findings (advisory, none blocks the verdict)

1. **[low, pre-existing, E3-07] `herplaatsKies` still renders on a stale *rejected* card that has no picker.** Rows
   #0 and #4 render *"Kies hieronder een periode voor dit thema, of versleep de kaart…"* while the panel contains
   **zero** `<select>` elements and the card is not draggable. Observed at both widths. This is the breach of the
   E3-06 rule that the implementer filed against E3-07 and was told not to fix here; recorded because it is real and
   reproducible. Round 2 correctly stopped `vergrendelUitlegVervallen` from adding a *second* copy of it.
2. **[low] `weigeringUitleg` is now long.** Three clauses, 52 words, in a panel that already carries
   `weigeringEerstTerugdraaien` and `vergrendelUitlegGeweigerdVast` above it, so a locked rejected stale card shows
   four paragraphs. Every sentence is true and the owner asked for the regeneration fact to live here, so this is a
   density judgement for the owner, not a defect.
3. **[informational] `vergrendelDekking` states a necessary condition in language that reads as sufficient.**
   *"telt pas mee voor de dekking zodra jij dit voorstel zelf overneemt"*: taking the placement over is necessary,
   but E5 will also require the `DoelKoppeling`s of the thema to be `aanvaard`/`manueel`, and the stale-placement
   rule replaces the figure with *onbetrouwbaar* while any placement is `isVervallen`. Harmless today, since
   `/dekking` is still `isGebouwd: false`, and clearly better than the round-1 wording. Worth one look when E5-02
   builds the screen this sentence points at.

## Housekeeping

- **No product code was changed.** The three guard mutations were applied to `nl.json`, run, and restored;
  `git status` is clean at `81b4ed9` apart from this report. No branch switch, no push, and no entry into the primary
  tree at `C:\source\Jaarplanner`.
- Ports **5407** (API) and **5307** (Vite) as claimed for this story, plus a private Chrome profile on CDP port 9337.
  All three processes were stopped afterwards and the throwaway database `jp_e406_r2` was **dropped**.
  `Jaarplanner.Api.exe` and Vite processes belonging to the `e3-08-zoom` and `agent-a8b6127bb7255ef99` worktrees were
  identified first and **deliberately left alone**.
- **Process note for whoever runs the next round:** I stalled the watchdog once. The cause was not a foreground
  server, since everything here was backgrounded and polled, but a long uninterrupted stretch of local
  test-mutation work. Poll with short commands even when nothing long-lived is running.

---

# E4-06 — Test report (round 4, the landing commit `01b1613`)

**Verdict: PASS.** Mode: both — xUnit unit + real-PostgreSQL integration, Vitest, guard-mutation testing, and headless Chrome at 1440px and exactly 390px against a running API and PostgreSQL 17.

> **Written into the repo by the orchestrator, from the test-runner's returned report.** The round-4 gate ran under harness instructions that forbade it writing report `.md` files, so it returned its findings as text and offered them for verbatim appending rather than dropping them. The earlier sections of this file are its own and untouched. Nothing here is an orchestrator judgement; where the gate declined to claim something, that is preserved below.

## Gate numbers, all four re-derived independently of the orchestrator's run

| command | result | vs the orchestrator's figures |
| --- | --- | --- |
| `corepack pnpm lint` | exit 0, no output | match |
| `corepack pnpm test` | **205 passed / 12 files**, 0 failed | match |
| `corepack pnpm build` | exit 0, CSS **38.18 kB** | match |
| `dotnet test` (`JAARPLANNER_TEST_POSTGRES` set) | **496 unit + 154 integration**, 0 failed, **0 skipped** | match |
| `dotnet format --verify-no-changes` | exit 0 | extra |

Counts moved from the `origin/main` merge (E1-16 + E3-04), not from this story: integration 153 → 154, Vitest 203 → 205.

## Criteria

| # | Criterion | Result |
| --- | --- | --- |
| 1 | Lock/unlock from the kalender, persists, keyboard-operable, not drag-dependent | **PASS** — keyboard only on the merged tree: Tab to `Vastzetten`, Enter, `PUT …/vergrendeling` → 200, PostgreSQL read-back `Water\|Voorgesteld\|2026-09-01\|t` from a seeded `false`. Focus ring petrol `rgb(22,81,90)` 4px over a 2px inner ring, **8.29:1** against the composited well |
| 2 | Label/icon never colour alone, copy in `nl.json`, no em dashes, no server string | **PASS** — exactly **8** badges across 16 cards, matching the 8 seeded `vergrendeld=true` rows, each `🔒 Vast` with the glyph `aria-hidden`. Every `<p>` in all 16 panels mapped back to a catalogue key; the only unmapped strings are the 12 AI motivations (stored data) and 16 empty live regions |
| 3 | Locked placement survives full regeneration vs unlocked `Voorgesteld` replaced | **PASS (carried forward)** — no backend change in `81b4ed9..01b1613` outside the merge; integration suite green at 154 |
| 4 | Frontend tests cover round trip and error path | **PASS** |
| 5 | Partial regeneration (E4-05) not claimed | **PASS** — all four lock sentences still say "het hele jaarplan", and the family guard enforces it |

## The two reworded sentences, read out of the DOM

Sixteen placements seeded into a throwaway `jp_e406_r4` from the real migrations; the API confirmed all **16 distinct** `(status, vergrendeld, isVervallen)` triples before the browser ran.

- **`vergrendelDekking`: exactly 2 occurrences**, on the two `Voorgesteld && !isVervallen` cards, absent from the other 14.
- **`vergrendelUitlegGeweigerdVast`: exactly 2 occurrences**, on the two `Geweigerd × vergrendeld` cards, absent from the other 14 including all four wrong siblings, and **carrying the new "hier"**. On screen it sits directly above `weigeringUitleg`, which already says *"stelt dit thema hier niet opnieuw voor"*: the two siblings finally scope the same claim the same way, which was the point of the fix.

Both fixes do what they were written for. `matching.manueel` is still the button *"Manueel overnemen"*, and the new dekking sentence contains no form of "overneem", so the verb collision is gone. It also drops the "telt pas mee zodra…" construction, which resolves a round-3 advisory: it now states a fact rather than a promise.

**390px:** the longer sentence wraps to 4 clean lines, `scrollWidth 220 === clientWidth 220`, height 66px. `body.scrollWidth === 390`; `scrollTo(600,0)` leaves `scrollX === 0`; **0** visible elements overflow their own box; of 209 elements sitting right of the viewport, **0** are outside a designated `overflow-x` region. `documentElement.scrollWidth` is 390 with one panel open and 2006 with all 16, which is the ribbon's scroll region. Contrast composited: `text-ink-zacht` `rgb(83,101,110)` on the well `rgb(247.8,246.6,244.2)` = **5.66:1**, unchanged since only the words changed.

## Guards after the merge, mutation-tested

| mutation | result |
| --- | --- |
| control | 5 passed |
| drop "hele jaarplan" from `vergrendeldUitleg` | **FAILS**, naming the key |
| rename the whole `kalender.vergrendel*` family | **both** guards FAIL on non-vacuity |
| reintroduce "kies" into `vergrendelUitlegVervallen` | **FAILS**, naming the key |

**No false firing on E1-16.** The merge added exactly one catalogue key, `doelen.keuzelijstenOnbeschikbaar`; `SLOTTEKSTEN` is prefix-filtered to `kalender.vergrendel*` so it cannot see `doelen.*`, and E1-16's own dead-key guard sits in the same file and is green.

## Two record corrections, and one thing the gate declined to re-prove

- **Round 3's focus-ring figure (`rgba(22,81,90,0.98) 0 0 0 3.93px`) is a transition artifact.** The Button base carries `transition-[…,box-shadow,…] duration-150`, so reading `box-shadow` immediately after Tab catches it mid-animation — which on one reading looked like a *missing* ring. Settled after settle and by cropping pixels: `rgb(22,81,90)` at 4px, 8.29:1. Flagged so a future round does not file it as a defect.
- **The success announcement was not re-proven in this round.** The gate's `MutationObserver` attached to the page-level "Te herzien" `role="status"` rather than the panel's, so it observed the wrong region and explicitly declined to claim a fresh pass. Round 3's evidence stands on unchanged code, and the closing audit verified the region's logic by reading it.
- **The pre-existing E3-07 defect is still reproducible** (not this delta): a stale *rejected* card renders `herplaatsKies` while the panel has **zero** `<select>` elements. Owner ruled on 2026-08-03 that this reopens E3-07.

## Housekeeping

No product code changed by the gate. Three `nl.json` mutations applied, run and restored; `git diff HEAD` empty at `01b1613`. No branch switch, no push, primary tree never entered. Ports released, API/Vite/Chrome stopped, `jp_e406_r4` dropped. Processes belonging to the `e3-08-zoom` and `agent-a8b6127bb7255ef99` worktrees were identified first and deliberately left alone.
