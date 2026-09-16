# ADR-0039 — A control that calls the AI wears a rainbow ring

- **Status:** Accepted; decision 5 amended by [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md) (a proposal wears a faint ring)
- **Date:** 2026-09-15
- **Deciders:** Project owner, in session on 2026-09-15: *"ik wil voor alle buttons die met AI ondersteuning te maken
  hebben (zoals "genereren") dat de knop een regenboogachtige stijl heeft zoals apple dat doet zodat het duidelijk is
  dat die butten een AI button is"*.
- **Amends:** [ADR-0024](0024-single-frontend-inkt-en-signaal.md) decision 4 ("the chrome has no brand hue"). The
  accent's ration of five uses is unchanged; this adds one treatment beside it, reserved for one kind of control.
- **Realises:** TB-023. **Constitution:** Art. IV.1 (AI is advisory), Art. XII (colour conventions, never colour
  alone), Art. II.3 (copy in `nl.json`).
- **Backlog:** TB-023; every AI ticket still to be built (FB-004, FB-024 to FB-028, FB-030 to FB-032) inherits it.

## Context

Two buttons call the model today: *Genereren* on the jaarplan (with *Genereer* in its sheet) and *Vraag suggesties*
on a thema. The first looked like every other primary action, the second like a quiet button with a wand. A teacher
could not tell before pressing that what comes back is a proposal to review rather than a result (Art. IV), and the
owner asked for the convention a teacher already knows from her phone: a rainbow treatment on AI controls.

ADR-0024 decision 4 keeps the chrome achromatic because every free hue sits near one that already means something.
A rainbow touches all of them: oranje near attentie, roze near P and S, paars near manueel, blauw near MD and
voorgesteld, cyaan near the accent.

## Decision

1. **Every control that calls the model is an `AiKnop`** (`frontend/src/components/ui/Knop.tsx`), and nothing else
   wears its look. It renders the wand icon before its label, so the meaning never rests on colour alone (Art. XII).
2. **The look is a ring, not a fill:** a 2px edge in a sweep through five stops (`--color-ai-*` in
   `frontend/src/index.css`) around the ordinary card surface, with the label in ink. A label on a rainbow could not
   hold 4.5:1 across every stop; an edge only has to clear 1.4.11's 3:1, and every stop does on both grounds a button
   sits on, in the light and the dark palette.
3. **The stops may sit near signal hues because they never appear one at a time.** No signal in this app is a sweep,
   and none sits on the edge of a button, the same reasoning that let the K3 stars share hues (FB-002).
4. **It moves only while a run is under way.** `bezig` sets `aria-busy`; the sweep then slides sideways along the
   edge and a soft glow rises, and a disabled busy button stays at full strength so the one sign of the run is not dimmed. At
   rest the ring is still; on hover the glow appears. Reduced motion stops the sweep.
5. **What the AI returns keeps its own colours.** A suggested link is still shown in the suggestiestatus hues of
   Art. XII; the ring marks the control that asks, never the proposal.

## Alternatives considered

- **A rainbow fill, as on some of Apple's own buttons.** Rejected: white or ink text cannot clear 4.5:1 on every stop
  of a sweep, and a filled rainbow would be the loudest object on any screen, louder than the dekking it serves.
- **The wand alone, no colour.** What *Vraag suggesties* had. The owner found it not clear enough, and the plan's
  primary button did not have even that.
- **One new hue for AI.** There is no free arc on the wheel (ADR-0024 decision 4); a single hue would collide with a
  signal outright, where a sweep does not read as any one of them.

## Consequences

**Positive:** AI controls read as AI at a glance and in the same way everywhere; new AI features get the treatment by
using one component.

**Negative / trade-offs:** the plan's *Genereren* is no longer drawn in the accent, so the plan screen's primary action
is marked by its ring rather than by the accent fill. There is one more animation in the app, bound to a user's press.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| The ring never stands alone: the wand is always beside it (Art. XII) | `AiKnop` in `Knop.tsx`; `Knop.test.tsx` |
| The AI buttons wear it, others do not | `ThemadetailScherm.tsx`: `ThemadetailScherm.test.tsx`; `PlanScherm.tsx` has no test file and was checked in a browser (TB-023's Werklog); an ordinary `Knop`: `Knop.test.tsx` |
| Every stop has a dark value (ADR-0027) | `--color-ai-*` in both blocks of `index.css`; `weergave.test.ts` |
| 3:1 for each stop, 4.5:1 for the label | measured in a browser, recorded in TB-023's Werklog |
