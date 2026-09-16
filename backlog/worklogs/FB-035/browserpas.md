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
