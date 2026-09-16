# FB-035: browser pass (round 1)

**Verdict:** FAIL (one MAJOR drag defect, one MAJOR clipped-label defect; everything else passes)
**Mode:** Playwright (playwright-core driving the installed Chrome, headless; no MCP browser was available in this session)
**App:** frontend http://localhost:5178, API http://localhost:5186, throwaway database `jaarplanner_fb035`, signed in as directie@jaarplanner.local, klas "L3 derde leerjaar (demo)", schooljaar 2026-2027.
**Screenshots:** the session scratchpad, folder `scratchpad/browser/` (C:/Users/Dyllis/AppData/Local/Temp/claude/C--source-Jaarplanner/920d8f69-2a37-45be-8f1f-b8b9fbec21db/scratchpad/browser/)

## Results

| # | Check | Result |
|---|-------|--------|
| 1 | Timeline at 1440x900 | PASS, but the "Geen thema" text is clipped (see D2) |
| 2 | Card + "Week later" | PASS |
| 3 | Thema toevoegen | PASS |
| 4 | Shorter Einddatum shows "Einde aangepast" | PASS |
| 5 | Drag with mouse and keyboard | **FAIL** (D1) |
| 6 | Agenda shows the thema | PASS |
| 7 | 390x844 | PASS |
| 8 | Console | PASS (no JS exceptions) |
| 9 | Contrast | PASS (every text is at least 4.5:1) |

### 1. Timeline at 1440x900: PASS (D2 applies)
- The class picker's "Klas" field is a `<select>`, and choosing "L3 derde leerjaar (demo)" works.
- The timeline shows 38 week columns and 4 named hatched vacation gaps: Herfstvakantie, Kerstvakantie, Krokusvakantie, Paasvakantie.
- Month labels run from September to Juli.
- There are 6 bars, all Voorgesteld.
- The year balance tiles read 38 / 33 / 5, and the "zonder thema" tile has the attention style.
- Five "Geen thema" buttons mark the weeks of 31 mei to 28 jun. Their aria-labels read "Week van maandag 31 mei: geen thema. Thema toevoegen", and so on.
- "Genereren" is disabled, with `aria-describedby="generatie-uit"`. The sentence beside it reads "Het jaarplan genereren wordt aangepast aan de planning met datums en staat tijdelijk uit."
- Screenshots: `01-tijdlijn-l3-1440.png`, `01b-tijdlijn-l3-einde-1440.png`.

### 2. Card + "Week later": PASS
- Pressing "Licht en donker" opens its card below the timeline, showing:
  - "4 jan – 12 feb · 0 doelen", status Voorgesteld, "Duur van het thema: 6 weken" and the motivation.
  - Begindatum 2027-01-04 and Einddatum 2027-02-12.
  - Datums bewaren (disabled while nothing has changed), Week vroeger, Week later, Vergrendeld, Aanvaard, Weiger with its explanation, Open in de agenda, and Verwijder.
- **"Week later" was refused**, because a thema keeps its number of schooldagen, so it would cross the Krokusvakantie into "Verkeer":
  - `PUT .../verschuiving {"van":"2027-01-11"}` returned 400.
  - The alert reads: "Van 22 februari 2027 tot 2 april 2027 loopt al het thema 'Verkeer'. Twee thema's kunnen niet op dezelfde dag lopen: kies andere dagen of verschuif dat thema eerst."
  - The bar did not move. Screenshots: `02a-kaart-licht-en-donker.png`, `02b-week-later.png`.
- **A move that succeeds:** "Week later" on "Zomer en vakantie" moved it from 19 apr – 25 mei to 26 apr – 1 jun (200), and its status became Manueel. Screenshot: `02c-week-later-gelukt.png`.

### 3. Thema toevoegen: PASS
- **Refusal.** Water (6 weken) with Begindatum 2027-01-11 shows the refusal naming "Licht en donker", and "Toevoegen" is disabled. Screenshot: `03a-toevoegen-weigering.png`.
- **Proposal with parts.** Begindatum 2027-03-29 (a free week, after "Verkeer" was shortened in step 4) shows:
  - "Voorgesteld einde: vrijdag 23 april", with the Einddatum filled in as 2027-04-23.
  - "Het thema Zomer en vakantie begint eerder, dus het einde valt vroeger."
  - "Door een vakantie komt dit thema in 2 delen: 29 mrt – 2 apr / 19 apr – 23 apr".
  - Screenshot: `03b-toevoegen-voorstel-delen.png`.
- **Toevoegen.** The POST returned 200 and the sheet closed. The timeline shows "Water deel 1/2" and "Water deel 2/2" on either side of the Paasvakantie, and the card opens on part 1 with "De andere delen van dit thema: 19 apr – 23 apr". Screenshots: `03c-water-in-delen.png`, `03f-water-delen-zoom.png`.
- **The dashed join is barely visible:** see D4.
- **Adding from a "Geen thema" marker.** Pressing the marker for 7 jun pre-fills Begindatum 2027-06-07. The sheet shows "Voorgesteld einde: woensdag 30 juni" and "Het schooljaar eindigt eerder, dus het einde valt vroeger.", and the thema was added. Screenshots: `03d-toevoegen-vanuit-geen-thema.png`, `03e-na-toevoegen-juni.png`.

### 4. Shorter Einddatum: PASS
- **Lente en groei.** Einddatum 18 dec → 11 dec, then "Datums bewaren" (200). The card and the bar both show "Einde aangepast: 5 van 6 weken", a "Geen thema" marker appears in the week of 14 dec, and the balance moved to 31 / 7. Screenshot: `04-einde-aangepast.png`.
- **Verkeer.** It was 6 weeks against a duration of 5, and shortening it by one week made it exactly 5 weeks. The marker correctly disappeared.

### 5. Drag: FAIL (D1)
- **The mechanics work.** A pointer drag of more than 6px starts, the target week is highlighted, and a PUT to `/verschuiving` is sent.
- **The keyboard works.** Space picks up, the arrow keys move, and Space drops. The live region announces "Lente en groei boven maandag 30 november" and then "Lente en groei op maandag 30 november gezet".
- **But the week it moves to is wrong** (D1):

| Action | Request sent | Actual move |
|---|---|---|
| 8px nudge of "Lente en groei" (starts 9 nov) | `{"van":"2026-11-23"}` | +2 weeks |
| 72px drag (one week) of "Lente en groei" | `{"van":"2026-11-30"}` | +3 weeks |
| 3 × ArrowRight on "Lente en groei" | `{"van":"2026-11-30"}` | +3 weeks |
| 8px nudge of "Zomer en vakantie" (26 apr) | `{"van":"2027-05-10"}`, **saved (200)** | +2 weeks, to 10 mei – 11 jun |

- The three "Lente en groei" attempts were refused only because they overlapped "Licht en donker".
- I restored "Zomer en vakantie" to 26 apr – 1 jun afterwards with the card fields.
- Screenshots: `05a-slepen-bezig.png`, `05b-na-slepen.png`, `05c-toetsenbord-bezig.png`, `05d-klein-duwtje-bezig.png` (the "10 mei" column is highlighted while the bar has barely moved), `05e-na-klein-duwtje.png`.

### 6. Agenda: PASS
- "Open in de agenda" on "Licht en donker" goes to `/agenda/dag/2027-01-04`, which opens in week view. The thema band "Licht en donker" is on MA 4. Screenshot: `06a-agenda-dag-licht-en-donker.png`.
- `/agenda/dag/2027-04-21` shows "Water" for the week of 19 apr (`06b-agenda-dag-water-deel2.png`).
- `/agenda` shows "Ik en mijn klas" in the current week (`06c-agenda.png`).
- The week of 14 dec, which has no thema, shows no thema band.

### 7. At 390x844: PASS
- `document.documentElement.scrollWidth` is 390, the same as `clientWidth`. No element outside the timeline overflows.
- The timeline section is `overflow-x: auto`, 2788px wide inside a 390px box.
- The card fields and buttons stack and fit.
- The add sheet opens as a bottom sheet 390px wide, with the Toevoegen button visible.
- Screenshots: `07a-390-tijdlijn.png`, `07b-390-kaart.png` (the header appearing mid-page is a full-page-capture artefact of the sticky header), `07c-390-toevoegen.png`.

### 8. Console: PASS (no JS exceptions)
- There are no `pageerror` events and no React warnings.
- The only console errors are "Failed to load resource" for:
  - the intended 400 refusals (verschuiving, voorstel);
  - one needless 400 described in D3;
  - 401 `/api/ik` and 404 `/favicon.ico` on the development sign-in page, before signing in.

### 9. Contrast: PASS
Measured in Chrome by resolving the computed colours on a canvas and compositing background alpha up the ancestor chain. No opacity is applied anywhere in these chains.

| Text | Size / weight | Foreground | Background | Ratio |
|---|---|---|---|---|
| "Geen thema" marker | 11px / 500 | rgb(103,54,20) | rgb(254,248,236) | **9.39:1** |
| Bar date text (text-inkt-zacht) | 10px / 400 | rgb(88,94,106) | rgb(234,236,240) | **5.51:1** |
| Bar "Einde aangepast" text | 10px | rgb(103,54,20) | rgb(234,236,240) | 8.40:1 |
| Selected bar small text | 10px | rgb(103,54,20) | rgb(232,246,248) | 8.97:1 |
| Bar name | 13px / 600 | – | – | 15.03:1 |
| Vacation label | 11px / 600 | – | white | 6.51:1 |
| Week date label (text-inkt-zwak) | 11px | – | white | 4.97:1 |
| "Generatie uit" sentence | – | – | – | 6.08:1 |
| Attention balance-tile label | – | – | – | 9.39:1 |

- The vacation label sits on a hatched gap. Against its darker stripe, rgb(234,236,240), it measures about 5.5:1.
- The week date label is the tightest pass (4.97:1).

## Defects

**D1 [MAJOR]: a dragged bar moves by about half its own length too far.**
- **Cause:**
  - `Jaartijdlijn` uses `closestCenter`.
  - The `DragOverlay` measures as wide as the bar (346px for "Lente en groei").
  - So `event.over` is the week under the bar's middle, not under its first day.
  - `eindigSleep` then treats that week as the new start: `weken = round(dagenVerschil(maandagVan(van), over) / 7)`.
- **Effect:**
  - An 8px nudge moves a 5-week thema 2 weeks later, and the server saves it when those days are free.
  - A one-week drag moves it 3 weeks.
  - A drop back onto the bar's own start is impossible without dragging left by half its length.
  - The keyboard drag has the same offset.
- **Repro:** open L3 on /agenda/periodes, press the mouse on the left of "Zomer en vakantie", move 8px right, release. The bar lands on 10 mei instead of staying on 26 apr.
- **Expected:** the target week is the week under the bar's start, or the offset is measured as the pointer or overlay delta. A drop without a whole-week displacement writes nothing.
- **Possible fixes:**
  - collision detection on the overlay's left edge (e.g. `pointerWithin` plus the grab offset);
  - compute `weken` from `event.delta.x / weekWidth`;
  - a narrow overlay anchored at the bar start.
- **Tests:** add a unit test for a small drag of a multi-week bar.

**D2 [MAJOR]: the "Geen thema" label is clipped to "Geen …" at every viewport.**
- The span is 40px wide against 61px needed: a week column is a fixed ~70px, and the marker holds a 12px icon plus 11px text.
- This is the non-colour cue for a week without a thema, so visually it reads as "+ Geen …".
- The aria-label is complete, so only sighted users are affected.
- **Screenshots:** `01b-tijdlijn-l3-einde-1440.png`, `05d-klein-duwtje-bezig.png`.
- **Possible fixes:** shorten the visible copy (e.g. drop the icon or wrap to two lines), or widen the columns.

**D3 [MINOR]: a needless 400 after a successful add.**
- After POST `/jaarplan/plaatsingen` succeeds, the invalidation refetches `/jaarplan/voorstel?themaId=…&van=…` for the thema that was just placed.
- That request now overlaps itself and returns 400, which logs a console error on every add.
- **Timing seen:** POST at 2594ms, then refetch of plan and voorstel at 2683ms, then 400 at 2732ms.
- **Possible fixes:** exclude the voorstel query from invalidation, or disable it once the sheet closes.

**D4 [MINOR]: the dashed rule joining the parts is barely visible.**
- Across a vacation the rule is 20px wide and is drawn on top of the vertical "Paasvakantie" text, so it looks like a stray tick through the letters.
- See `03f-water-delen-zoom.png`.

**D5 [MINOR]: the short-bar label is clipped.**
- On one-week bars (the Water parts) the adjusted-end label shows only "Einde a…" (48px wide against 180px needed).
- The card says it in full, so only the bar is affected.

**D6 [MINOR, copy]: "Einde aangepast: 5 van 5 weken" contradicts itself.**
- It appears on "Zomer en vakantie", where the API returns `eindeAangepast: true` with `weken 5 == duurWeken 5`.
- The end differs from the proposed end because holidays fall inside and the thema kept its schooldagen, but the rounded week count is equal.
- A teacher reads this as "adjusted, but not changed". Consider hiding the label, or phrasing it by date, when the week counts are equal.

**D7 [MINOR, observations]:**
- **Month labels sit one week early.** A month label sits above the week containing the 1st of that month, so "Oktober" is above "28 sep", "April" above "29 mrt" and "Juli" above "28 jun". This looks off by a week at a glance.
- **Short Einddatum text.** "Voorgesteld einde: vrijdag 23 april" has no year, which is fine within a school year.
- **The agenda band covers the weekend.** In week view the thema band also covers ZA and ZO.
- **"Open in de agenda" opens week view.** The link goes to `/agenda/dag/{datum}` but the agenda opened in week view, which may be the remembered view.
- **Uneven tiles at 390px.** The balance tiles stack with uneven widths, sized to their content, which looks ragged.

## Data changed in jaarplanner_fb035 (throwaway)
L3 derde leerjaar (demo) now has:
- "Zomer en vakantie": 26 apr – 1 jun (Manueel);
- "Verkeer": 22 feb – 26 mrt (Manueel);
- "Lente en groei": 9 nov – 11 dec (Manueel);
- "Water" in 2 parts: 29 mrt – 2 apr and 19 – 23 apr.

A June "Ik en mijn klas" placement was added and then removed.

---

# Round 2 (re-check of commit 6ccc209a)

**Verdict:** FAIL (D1 is still broken in a new way; D2, D3, D4, D6 and D7 pass)
**Mode:** Playwright (the same playwright-core + Chrome setup, Vite hot-reloaded, the same throwaway database and klas L3). New screenshots are named `r2-*.png` in the same scratchpad folder.

| Item | Result |
|---|---|
| D1 | **FAIL** |
| D2 | PASS |
| D3 | PASS |
| D4 | PASS (minor note) |
| D6 | PASS |
| D7 | PASS |
| Contrast of the marker | unchanged, 9.39:1 |

## D1: FAIL (MAJOR): a mouse drag is measured from the wrong week whenever the timeline is scrolled

The drop target (highlighted week) is right, but the source week is wrong.

**Cause:**
- In `beginSleep`, `event.active.rect.current.initial` is still null at `onDragStart`.
- So `grijpX` falls back to 1, and `x = (start?.left ?? 0) + 1 = 1`.
- `bronWeek` becomes whatever `[data-lesweek]` column lies under viewport x = 1:
  - **Timeline not scrolled** (or scrolled a little): nothing lies there, and the fallback `maandagVan(plaatsing.van)` gives the right answer by luck.
  - **Timeline scrolled** so that a week column slides under the left edge of the window (behind the sidebar at 1440, straight away at 390): that column becomes the source week.
- The collision detection has the same `grijpX = 1`, so it effectively targets the bar's first day plus the drag delta, not the pointer. That part happens to give the right drop week.

Measured PUT bodies:

| Case | scrollLeft | Highlighted | PUT `van` | Verdict |
|---|---|---|---|---|
| 8px nudge "Ik en mijn klas" (grabbed 31 aug column) | 0 | 2026-08-31 | none | OK |
| 80px (one column) "Ik en mijn klas" | 0 | 2026-09-07 | 2026-09-08 (+1 wk) | OK (refused: overlap with Herfst en oogst) |
| 8px nudge "Herfst en oogst" | 0 / 160 | 2026-09-28 | none | OK |
| 8px nudge "Herfst en oogst" | 400 | 2026-09-28 | **2026-10-23 (+3 wk)** | WRONG |
| 8px nudge "Zomer en vakantie" (grabbed 26 apr column) | scrolled to April | 2027-04-26 | **2027-07-26 (+13 wk)** | WRONG (refused: outside the school year) |
| One column (80px) "Zomer en vakantie" | scrolled to April | 2027-05-03 | **2027-08-02** | WRONG (refused) |
| 390x844, 8px nudge "Zomer en vakantie" | 2245 | 2027-04-26 | **2027-05-24 (+4 wk), SAVED 200** | WRONG; the run also became 24 mei – 24 jun "4 van 5 weken" |
| Across the Kerstvakantie: "Lente en groei" 9 nov column to 4 jan column | 200 | none at release | **2027-02-22** (expected 2027-01-04) | WRONG (refused: overlap with Verkeer) |
| Drop on the Kerstvakantie gap itself | 200 | none | none | OK |
| Keyboard Space, ArrowRight, Space on "Ik en mijn klas" | 0 | 2026-09-07 | 2026-09-08 (+1 wk) | OK |
| Keyboard Space, ArrowRight, Space on "Zomer en vakantie" | 2037 | 2027-05-03 | 2027-05-03 (+1 wk), saved | OK |

- The keyboard works: arrows step one column (80px), and the move is exactly one week even when scrolled.
- Every moved placement was restored with the card fields. "Zomer en vakantie" is back at 26 apr – 1 jun.
- **Repro:**
  1. At 390x844, on /agenda/periodes (L3), scroll the timeline to April.
  2. Press the mouse on the first week of "Zomer en vakantie", move 8px, release.
  3. The thema is saved 4 weeks later.
- **Suggested fix:**
  - At drag start, take the grabbed bar's rect from the DOM (e.g. `(event.activatorEvent.target as Element).closest("button").getBoundingClientRect()`, or the draggable node), not from `active.rect.current.initial`.
  - Never let the fallback x hit an arbitrary column: when there is no rect, use `maandagVan(plaatsing.van)` directly.
  - Use the same grab offset in the collision detection, so the highlighted week is the week under the pointer.
  - Add a test with a scrolled container, or with `initial` null at drag start. jsdom has no scroll, which is why the unit tests pass.

## D2: PASS
- At 1440 and at 390, all five "Geen thema" labels have span scrollWidth 61 = clientWidth 61, and the button is 74/74.
- The text is no longer truncated, and the page at 390 is still 390/390.
- Screenshots: `r2-d2-geen-thema-1440.png`, `r2-d2-geen-thema-390.png`.
- **Contrast:** the marker lost its icon but kept its colours: rgb(103,54,20) on rgb(254,248,236), 11px, opacity 1, **9.39:1** (unchanged).

## D3: PASS
- Adding Verkeer from the 7 jun "Geen thema" marker (POST 200, 7 jun – 30 jun) produced no 4xx response at all, and no console error.
- I removed that placement again afterwards (no errors).

## D4: PASS (minor note)
- The join is now a 36px, 3px dashed rule in rgb(88,94,106), at z-index 10, and it is clearly visible between the two Water parts.
- It still crosses the vertical "Paasvakantie" label, but it reads as a join.
- Screenshot: `r2-d4-delen-zoom.png`.

## D6: PASS
"Zomer en vakantie" (26 apr – 1 jun, 5 lesweken for a 5-week thema) now reads:
- on the card: "Einde aangepast: iets langer dan 5 weken";
- on the bar: "Einde: ruim 5 wk";
- in the aria-label: "… Einde aangepast: iets langer dan 5 weken".

A scan of the body text and every aria-label found no "N van N weken" or "N/N wk" with equal numbers.
- Screenshot: `r2-d6-ruim.png`.
- **Still open (D5, not in this round):** the one-week Water parts show "Einde: 2/6 wk", clipped (78px needed, 58px available).

## D7: PASS
Every month label sits on the week whose Wednesday falls in that month:

| Label | Week of | Wednesday |
|---|---|---|
| september | 31 aug | 2 sep |
| oktober | 5 okt | 7 okt |
| november | 9 nov | 11 nov |
| december | 30 nov | 2 dec |
| januari | 4 jan | 6 jan |
| februari | 1 feb | 3 feb |
| maart | 1 mrt | 3 mrt |
| april | 19 apr | 21 apr |
| mei | 3 mei | 5 mei |
| juni | 31 mei | 2 jun |

Screenshot: `r2-d7-maanden.png`.

## Data after round 2
Unchanged from the end of round 1: every placement moved during this round was restored.
