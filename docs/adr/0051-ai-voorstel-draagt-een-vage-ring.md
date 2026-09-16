# ADR-0051 — An AI proposal wears a faint ring, and is decided with quiet icons

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** Project owner, 2026-09-16, choosing from a design proposal with three edges: *"we gaan voor de vage
  lijn, de aanvaard en weiger knop zijn wel te groot en te druk, ik wil subtiele icoontjes"*.
- **Amends:** [ADR-0039](0039-ai-knoppen-regenboogring.md) decision 5 ("the ring marks the control that asks, never the
  proposal").
- **Realises:** FB-057. **Constitution:** Art. IV.1, XII (never colour alone), II.3; WCAG 2.2 AA via ADR-0017.

## Context

ADR-0039 gave the controls that call the model a rainbow ring and kept it off what the model returns. The owner wants a
proposal to be recognisable as AI output too, with an edge from the same family that does not read as a button, and
found the full-size *Aanvaard* and *Weiger* buttons on every proposal too loud.

## Decision

1. **A card that holds an undecided AI proposal wears a faint ring:** a 1px edge in the same five-stop sweep, each stop
   mixed half-way with the card surface, static, with no glow and no hover change (`voorstel-ai` in
   `frontend/src/index.css`). The button keeps its 2px, full-strength, moving ring, so the two stay apart.
2. **The ring never carries the meaning alone.** The card also shows the wand with "AI-voorstel" (or what is proposed)
   and the suggestiestatus mark with its label. The ring is therefore decoration beside text, and WCAG 1.4.11 does not
   require it to reach 3:1.
3. **Once decided, the ring goes.** An accepted proposal is an ordinary row; a rejected one leaves the list.
4. **Accept and reject are quiet icon buttons** beside the status mark: a check and a cross, 28px, in the weak ink,
   taking the aanvaard or geweigerd hue only on hover and focus. Their names are in `aria-label` and in a tooltip. A
   proposed new subthema adds a pencil to change it first.
5. **Where it applies:** the proposals of FB-057 first. Other AI proposals (doelsuggesties, woordweb words) take it when
   they are built or reworked, not by this change.

## Consequences

**Positive:** AI output is recognisable at a glance, and a list of proposals is calm enough to read.

**Negative / trade-offs:** the rainbow now appears on content as well as on controls, faintly; an icon-only decision is
less discoverable than a labelled button, which the tooltip and the accessible name have to carry.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| The ring is worn beside text, never alone | `Subdoelplaatsing` components and their tests |
| Each icon button has an accessible name | the component tests (queried by role and name) |
| Both themes | `voorstel-ai` uses the `--color-ai-*` tokens, which have dark values (`weergave.test.ts`) |
