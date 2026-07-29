# E3-10 — Kalender wireframe (FR-6)

**Status:** **approved 2026-07-28 by directie (auteur)** as the basis for E3-06 (calendar view) and
E3-07 (drag-and-drop). Recorded in [`backlog/worklogs/E3-10/implementation.md`](../../../backlog/worklogs/E3-10/implementation.md).
The five review questions below were **not** individually answered at approval — they stay open as
build-time decisions carried into E3-06/E3-09.

> **What was approved, and what the teachers still assess** *(clarified by the project owner, 2026-07-29)*.
> ADR-0017 names two reviewer groups, *directie **and** teachers*, and only the directie half is on
> record here. That is **by design, not an omission**: this wireframe is approved as the basis for
> building the **first clickable draft** of the kalender (E3-06), and *that* draft is what directie **and
> teachers** will assess and click through. The teacher review is **sequenced after** the draft, not
> skipped — a paper wireframe is a poor thing to hand a non-technical teacher when the interaction is
> the whole point.
>
> Two consequences, both binding:
> 1. **E3-06 is a review artifact before it is a feature.** It is built to be assessed and changed, so
>    prefer the cheapest structure that can be clicked through honestly. Do not harden or optimise
>    against requirements the review has not confirmed.
> 2. **The five open questions below stay open, and the draft must not quietly answer them.** Where the
>    build has to pick something to be clickable, pick visibly and reversibly, and list it for the review
>    rather than letting an implementation detail become a decision nobody made.
>
> *Prior states of this header, each wrong differently:* it read "draft, awaiting review — nothing here
> is approved" until 2026-07-29, contradicting the backlog and worklog that authorise the build; the
> first correction asserted a bare "approved" with no actor; the second inferred from the missing
> teacher record that the teacher half had been **skipped and was owed**, when in fact it is scheduled
> against the artifact this approval authorises. Absent evidence was read as evidence of absence. The
> lesson worth keeping is the narrow one: **the gate you name is the gate you can check** — the record
> should have said *when* the teacher review happens, and now it does.
**Artifact:** [`e3-10-kalender.html`](e3-10-kalender.html) — open it in a browser; no build step, works offline.
**Refs:** FR-6.1–6.5, [ADR-0017](../../adr/0017-ui-ux-design-system.md) (wireframes-first),
[ADR-0013](../../adr/0013-planningsblok-abstraction.md), [`ui-ux-approach.md` §4](../ui-ux-approach.md),
Art. IX.3, NFR-2.

Why it exists: ADR-0017 requires a low-fidelity wireframe reviewed with real users **before** E3-06
(calendar view) and E3-07 (drag-and-drop) are built. E3-10's acceptance criterion is *"a wireframe is
approved and informs the build"* — so the deliverable is a conversation aid, not a design spec.

## Deliberately low fidelity

Greyscale, dashed borders, mono annotations. The `doelsoort`/`dekking` colour tokens from E0-09 exist and
are **not used here**: doelsoort appears as grey chips with letter labels (`MD 4`, `G 6`, `+ 1`). Two
reasons — reviewers critique structure rather than palette, and the letter labels double as the proof that
colour is never the sole carrier of meaning (Art. XII, WCAG 2.2 AA). Final colours arrive at E3-06.

## The one idea worth arguing about

**The year is a ribbon of unequal periods, and the vacations are literal gaps in it.**

Block width is proportional to actual teaching days, and each vacation is a physical break in the ribbon
with the vacation named in the gap. So a teacher sees *why* periode 1 (4,4 weken) is shorter than periode 3
(6,0 weken) instead of being told.

This is a rejection of the obvious design. A uniform month grid — twelve equal columns — is what every
calendar UI reaches for, and here it would be a lie twice over: the school year runs September→June, and
Belgian vacations fall mid-month and split the teaching year into five uneven stretches. Art. IX.3 forbids
assuming months and ADR-0013 forbids referencing them anywhere in planning; a month grid would smuggle that
model back in through the picture. Everything else on the screen is kept deliberately quiet so this one
structural idea carries the design.

Consequence to check in review: proportional width means a 7-week period is genuinely wider than a 4-week
one, so a long period can hold more cards before it looks full. Question C below asks whether "te vol"
should therefore scale with the period's length.

## How it satisfies FR-6

| FR | Where |
| --- | --- |
| 6.1 render the plan per block | The ribbon; one column per themaperiode, with its dates and length in weeks |
| 6.2 drag thema's between periods | Grabbable cards with a visible grip + an explicit on-screen keyboard route |
| 6.3 zoom jaar ↔ periode/blok | "Hele jaar" / "Per periode" toggle; the zoom strip shows P3 split into subthemaperiodes. The control never says "maand" or "week" |
| 6.4 knelpunt-signalering | Over-full period: border + ▲ + the words "Te vol". Goals placed nowhere: their own tray, because something absent cannot stand out in the ribbon |
| 6.5 save immediately, dekking live | Stated on the keyboard-help strip; each card shows its own coverage count |
| Art. IX.3 `vergrendeld` | "Feesten in december" carries a 🔒 lock on the card itself, not hidden in a menu (E4-06) |

## Accessibility built into the wireframe, not deferred

- The keyboard route for drag-and-drop is **printed on the screen** (`Tab` → `Space` → `←`/`→` → `Space`,
  `Esc` to cancel), not hidden in a shortcut sheet. Keyboard-operable DnD is mandatory (E7-10).
- Visible focus ring on every thema card.
- Every flag carries an icon **and** a word.
- `prefers-reduced-motion` respected.
- ⚠️ **Not yet verified:** the narrow-width (phone) rendering. The stacking media query is written but the
  render was not visually checked — do that before quoting this as responsive.

## Questions for the review session

These are in the artifact too, marked A–E, so they can be walked through on screen:

- **A. Do 7 periods per year match your rhythm?** At ±5 weeks per themaperiode, 2026-2027 yields 7. Or do
  you plan in 8–9 shorter blocks?
- **B. Does a thema live in exactly one period, or may it span two?** Currently one. Do your thema's run
  across a vacation?
- **C. When is a period "te vol"?** Currently 3 thema's. Is it a count of thema's, of goals, or something
  else — and should it scale with the period's length?
- **D. Is the unplaced-goals tray usable, or too long?** After a full Op.stap import it holds hundreds.
  Filter by discipline, by doelsoort, or something else?
- **E. What belongs on a card?** Currently naam, doelsoort mix, coverage count. Missing anything —
  subthema's, activiteiten, who wrote it?

## What building this wireframe exposed in E3-05

Wireframing with real dates was not decoration — it surfaced a genuine model defect before any UI was
built, which is exactly what ADR-0017's wireframes-first rule is for.

Feeding the actual 2026-2027 Belgian calendar through the E3-05 derivation produced **ten** themaperioden,
three of them **exactly one week long** (14–20 dec, 8–14 feb, 29 mrt–4 apr) and one of 3,9 weeks — outside
the ratified 4–6 week range. Greedy chopping takes 35 days off the front of each teaching stretch and
leaves the remainder as its own block; a 42-day stretch therefore becomes 35 + 7.

Distributing each stretch over `round(stretchdagen / blokdagen)` near-equal blocks instead yields **7
periods, all between 4,4 and 6,0 weeks** — inside the ratified range. **This wireframe shows that corrected
grid**, so the artifact reflects the intended model rather than the shipped one.

The independent antagonist audit of E3-05 reached the same finding from the code side, and added two the
wireframe could not see: the two tiers do not nest (a subthemaperiode can straddle two themaperioden, which
would make this wireframe's zoom strip incoherent), and `Planningsblok.Ordinaal` is not the stable key it is
documented to be. All are recorded in [`E3-05/antagonist.md`](../../../backlog/worklogs/E3-05/antagonist.md)
and must be fixed before E3-06 builds on this grid.
