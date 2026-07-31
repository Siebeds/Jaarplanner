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
