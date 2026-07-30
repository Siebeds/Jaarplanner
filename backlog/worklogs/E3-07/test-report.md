# E3-07 — test report

**Verdict: PASS** on every acceptance criterion that can be met today. One criterion is a forward obligation on
an unbuilt epic and is reported as such rather than as a pass.

Run 2026-07-30 in the `story-E3-07-dnd` worktree, on its **own** database (`jaarplanner_e307`) and **own** ports
(API 5194, Vite 5175), because another agent is working E3-04 in the main checkout.

## Automated

| Suite | Result |
| --- | --- |
| `dotnet test` (`JAARPLANNER_TEST_POSTGRES` set) | 454 unit + 91 integration, **0 failed, 0 skipped** |
| `pnpm test` | **87 passed** |
| `pnpm lint`, `pnpm build`, `dotnet format --verify-no-changes` | clean |

**What the frontend tests deliberately do not do: simulate a drag.** `jsdom` gives every element a zero-sized
bounding rect and dnd-kit resolves a drop by measuring rectangles, so a "drag test" there lands nowhere and would
be green while proving nothing. The suite drives the *same mutation* through the picker and pins the contract the
drop shares with it — which request, which body, which message on refusal. **The gesture is verified in a
browser, below.** Stated rather than implied, because a green suite that cannot fail is this project's recorded
failure mode.

## Browser — real API, real PostgreSQL 17, real drag

Chromium via Playwright against `http://localhost:5175`, API on 5194, demo seeder data (7 placements over 7
periods, the genuine 2026-2027 Belgian calendar).

### 1. Dragging moves a thema and persists immediately (FR-6.2, FR-6.5) ✅

Dragged the grip of **"Ik en mijn klas"** from Periode 1 onto the empty Periode 4, with 25 intermediate pointer
moves.

- **During** the gesture Periode 4 read `Nog niets gepland` + **`Hierheen verplaatsen`**.

  > *Correction (antagonist audit).* This line originally added "and its border turned to the attentie hue".
  > That was not measured and is not what the code paints: Periode 4 was **empty**, and the attentie border
  > requires the te-vol preview (`gepland.length + 1 >= 3`), so an empty drop target paints `border-petrol`.
  > §2 below is the attentie case and does quote the measured `rgb`. A detail asserted from expectation rather
  > than observation is the same defect as a wrong contrast figure, in a report whose whole job is evidence.
- **After** the drop: Periode 1 empty, Periode 4 holds the thema, status **`Manueel`**, motivation gone.
- **After a full page reload:** unchanged. `Periode 4: Ik en mijn klas / Manueel / no "Waarom hier?"`,
  `Periode 1: leeg`. This is the FR-6.5 half a mutation test cannot prove — it went to Postgres and came back.

Screenshot: [board](../../../docs/ux/wireframes/e3-07-bord.jpeg).

### 1b. The drag overlay carries no controls, and no duplicate draggable ✅

Found by reviewing the diff rather than by a failing test, and worth recording as the shape of the mistake: the
first version rendered a full `Themakaart` inside `DragOverlay`, which (a) called `useDraggable` with an id the
**source** card had already registered, so two live registrations shared one key in dnd-kit's internal map, and
(b) put an interactive `Aanpassen` disclosure inside a copy following the cursor. It *worked* — which is the
problem: nothing would have caught it until a library bump.

Replaced with a presentational `Sleepkaart`. Measured mid-drag: exactly **one** floating card, its text
`"⠿ Verkeer Manueel"`, **0 buttons, 0 selects**, and the drop still landed (Periode 2 → Periode 3).

### 2. The te-vol preview fires *before* the drop ✅

With Periode 2 holding two thema's, dragging a third over it (from the adjacent Periode 3) showed
**"Deze periode wordt dan te vol"** together with "Hierheen verplaatsen", and the column border measured
`rgb(179, 97, 15)` — the attentie hue. Icon **and** words, never colour alone (Art. XII).

### 3. The picker does the move dragging cannot ✅ — and this is a finding, not just a pass

Dragging **"Zomer en vakantie"** from Periode 6 to Periode 2 **failed**: the two columns are far enough apart
that the board scrolls horizontally between them, and the pointer never entered the target. The **picker moved
it in two clicks** (Periode 6 → Periode 1), and correctly offered every period **except Periode 6**, the one it
was already in: `Periode 1, 2, 3, 4, 5, 7`.

So the panel is not merely the accessibility alternative SC 2.5.7 demands — over a 7-period year it is the
*primary* route for any move that is not a nudge to a neighbouring period. Recorded in the implementation log as
decision 2.

### 4. The delete confirmation names the thema and the period ✅

On the moved (`Manueel`, therefore guarded) card, `Uit deze periode halen` produced:

> "Ik en mijn klas" uit periode 4 halen? Dat kan je niet ongedaan maken.

with `Ja, verwijderen` and `Annuleren`, and the guarded button gone while the question stood. Verified in Vitest
for both guarded branches (accepted, and locked-but-still-`Voorgesteld`), that cancelling issues **no** request,
and that an untouched proposal deletes on one click.

Screenshots: [desktop](../../../docs/ux/wireframes/e3-07-bevestiging.png),
[390px](../../../docs/ux/wireframes/e3-07-mobiel-bevestiging.png).

### 5. Contrast, measured in the browser with alpha composited ✅

jsdom cannot evaluate colour, so axe passing says nothing about the palette — this repo has shipped WCAG
failures twice that way. Every value below is composited over its real painted backdrop.

| Element | Measured | Floor | |
| --- | --- | --- | --- |
| `Ja, verwijderen` (white on `attentie-ink`) | **9.93:1** | 4.5 | ✅ |
| …its hover state (`brightness-110`) | 8.98:1 | 4.5 | ✅ |
| *(rejected alternative)* white on `attentie` | **4.53:1** | 4.5 | ⚠️ passes by 0.03 |
| Period picker, text | 15.42:1 | 4.5 | ✅ |
| Period picker, **border** (`border-ink-zacht`) | **6.08:1** | 3.0 | ✅ |
| `Aanpassen` disclosure (petrol on card) | 8.90:1 | 4.5 | ✅ |
| Confirmation question | 14.36:1 | 4.5 | ✅ |
| `Verplaats naar` label | 14.36:1 | 4.5 | ✅ |
| Drag explanation (`ink-zacht` on paper) | 5.73:1 | 4.5 | ✅ |
| `Annuleren`, text | 15.42:1 | 4.5 | ✅ |
| **`Annuleren`, border (`--input`)** | **1.42:1** | 3.0 | ❌ pre-existing → **fixed at merge, see below** |

The `--input` row was E7-10's known app-wide failure, reproduced at exactly the figure already recorded in the
backlog. Every token **this story authored** passes; the picker avoids the broken token on purpose.

> **Superseded at merge (2026-07-30): `--input` was fixed to `40 14% 52%` by E3-04, so these buttons inherit
> 3,40:1 and never shipped failing.** Two stories one day apart independently measured the same token; only one
> fixed it. The figure above is kept as measured against this story's base commit rather than quietly updated,
> because a report that silently retcons its own measurements is worth less than one that dates them.

> *Correction (antagonist audit).* The `attentie` row was first reported as **4.31:1 — fails**, and used as the
> justification for the `destructive` variant. It is **4.53:1 and passes**; the error was an arithmetic slip in
> the green channel, and it reached three backlog entries and a commit message before the audit re-derived it.
> `attentie-ink` is still the right choice, on margin (0.03 is not a margin) and hierarchy — but the reason had
> to be restated rather than the figure quietly swapped.

### 6. 390px ✅

Card 266px wide, **zero** elements overflowing it, all controls ≥36px tall, the picker not overlapping its own
label, and the confirmation question wrapping to three readable lines.

## Round 2 — the audit fixes, in the browser (2026-07-30)

Re-run after the 12 antagonist findings were addressed. Gates first: **455 unit + 92 integration** (0 skipped),
**98 frontend** (was 87), lint/tsc/build/format clean.

### 7. A rejected placement offers no way to move it ✅

Rejected `Licht en donker` through the API (there is no UI route to *make* a rejection on this screen), reloaded,
opened its panel:

| | |
| --- | --- |
| drag grip present | **no** |
| period picker present | **no** |
| says *"Draai hieronder eerst de weigering terug"* | **yes** |
| offers `Weigering terugdraaien` | **yes** |

So the transition that would have silently granted dekking is unreachable from the UI, and the server refuses it
independently (400, asserted at service and endpoint level). The explained route out is the only route.

### 8. The irreversibility disclosure ✅

A normal card's panel shows *"…de motivatie van de AI verdwijnt. Dat kan je niet terugdraaien."* above the
`Verplaatsen` button, with the picker still present. Suppressed on a card with nothing to lose (tested in Vitest).

### 9. A dead tool is told apart from a refused move ✅ — and the defect was reproduced first

**The 93 console errors from round 1 turned out to be the evidence for finding 10.** They are all proxy 500s from
the window when the API process had died (the API log carries **zero** errors across 859 lines and both
instances, so nothing reached the application) — including one on `PUT …/blok`. Under the round-1 code that 500
rendered *"Het thema kon niet verplaatst worden. **Kies een periode uit dit jaarplan.**"*: a teacher told to fix a
choice, in front of a tool that was simply not running.

Re-tested deliberately, with the API stopped:

> Verplaatsen is nu niet beschikbaar. Er is niets gewijzigd aan je jaarplan. Meld dit aan de beheerder van de tool.

and *not* the "kies een periode" copy, and with no server or proxy text echoed. Same 422-vs-5xx discipline the
generation panel has had since E3-01.

### Not verified in round 2, stated so it is not assumed

The restructured stale notice (`role="region"` + `sr-only role="status"`) could **not** be exercised in the
browser: the demo seeder deliberately seeds no stale placement, so `TeHerzien` never rendered. It is covered by
two Vitest assertions (the region is found by its accessible name; the status line carries the count sentence).
The nesting defect is fixed by construction, but **no screen reader has been run over it** — `axe` cannot judge
announcement behaviour, and that remains the one open item on this story.

## The criterion that is not a pass

> *"Coverage refuses to report a number until it is resolved"* (ruling clause 4, Art. V.2).

**Not verifiable: E5 does not exist.** No dekkingsoverzicht and no export have been built, so there is nothing
that could report or refuse a figure. E3-07 delivers the two halves it owns — a stale placement is detected and
persisted, and it can now be re-placed inline — and the refusal is recorded as a forward obligation on E5.
Reporting this as a pass would be the kind of claim this backlog has had to retract twice.

## Not covered by any test

- **A live Azure AI round trip** (no `AzureAI:ApiKey` on this machine). Unchanged from E3-01/E2-08 and untouched
  by this story.
- **A real vakantie edit producing a stale placement end-to-end.** The stale *path* is covered by a service test
  against a genuinely reshaped calendar and by a frontend test, and the re-placement UI was driven in the
  browser — but nobody edited a vakantie through a UI, because no UI edits vakanties yet (E6).
- **Touch dragging.** The pointer sensor is `touch-none`-guarded and dnd-kit handles touch, but this was driven
  with a mouse. The picker is the touch route regardless.
