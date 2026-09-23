# ADR-0065 — Chuck: how the cat is drawn, coloured, placed and switched on

- **Status:** Accepted
- **Date:** 2026-09-23
- **Deciders:** Project owner, in the design session of 2026-09-22 (name, voice, coat, basket, balloon, walk, technique)
  and in this ticket's session (the school setting). Directie has not been asked. The onderwijsadviseur reviews Chuck
  before the school turns him on.
- **Relates to:** [ADR-0059](0059-de-kat-proactieve-agent.md) (the cat as an agent; this ADR is how K4, K5 and D7 are
  built), [ADR-0024](0024-single-frontend-inkt-en-signaal.md) (the palette whose "no brand hue" rule this ADR makes one
  exception to), [ADR-0039](0039-ai-knoppen-regenboogring.md) and [ADR-0051](0051-ai-voorstel-draagt-een-vage-ring.md)
  (AI controls and proposals keep their look), [ADR-0060](0060-activiteitvoorstellen-op-een-aanbod-gat.md) (the
  proposals the window decides), [ADR-0017](0017-ui-ux-design-system.md) (WCAG 2.2 AA).
- **Realises:** FB-071. **Constitution:** Art. IV.1, IV.8, VI.1, VI.7 and XII unchanged.

## Context

ADR-0059 decided that the cat exists, what it notices and that its posture is its status. It left the drawing, the
colour and the switch to FB-071. The design was worked out with the owner in a prototype
(`backlog/worklogs/FB-071/`), and building it raised three questions the prototype could not answer: how a coat can
be warm in a palette that has no free warm hue, how the motion stays correct when it is a thousand baked keyframes, and
how the app waits for the onderwijsadviseur.

## Decision

1. **His name is Chuck,** not a Flemish first name, so it never collides with a child in the klas. He speaks in the
   first person, in plain adult Dutch, and only when he has something: then in a comic balloon (a 2px ink outline and
   a tail to his head, the text in IBM Plex Sans), otherwise his posture carries a quiet label. What a teacher types
   stays a plain box.

2. **The coat is the one warm thing that means nothing: an exception to "no brand hue" (ADR-0024).** There is no free
   warm hue (ai-oranje 22, ster-oranje 28, attentie 30, doelsoort A 36), so the coat is defended the way the stars of
   the ontwikkelingsrapport are: by chroma and by form. It is gember, `hsl(24 44% 54%)` light and `hsl(26 52% 64%)`
   dark, at 44 to 52% saturation against 85 to 100% for every signal near it, and it is an animal in one fixed place
   that always carries its label, never a dot, a square or a wash. The basket is achromatic, so he is the only warm
   thing on screen. The light lightness is set by measurement, not taste: the prototype's 56% measured 2.90:1 on the
   page where he lies, under WCAG 1.4.11's 3:1; 54% measures 3.09:1 on the page and 3.32:1 on a card. The exception
   is not a precedent: it is recorded at the top of `frontend/src/index.css`.

3. **He is inline SVG driven by CSS, with keyframes generated from one rig.** No animation library, no Rive, no
   Lottie. The joints, bone lengths and rest angles live in `features/kat/rig.ts`, read by both the drawing and the
   choreography (`choreografie.ts`), which plans every paw and turns it into thigh and shin angles by two-bone inverse
   kinematics. `pnpm kat:keyframes` writes `chuck-keyframes.css`; a test fails when that file is stale. The rules of a
   walking cat are tested on the plan, not on a picture: never more than one paw in the air stepping out or in, three
   paws down while walking, every paw on the rim before it crosses, no leg stretched more than 3 units, and a planted
   paw drawn where it stands. Never `<symbol>` with `<use>`: CSS cannot reach into it.

4. **His posture is derived, never stored:** from the deurmat (TB-057) and the klas's dekkingsvoortgang, in this
   order. A goal at risk (`MinimumdoelInGevaar`, then `SubthemaNietGepland`): he lies on the corner of the week strip
   of that klas, his basket in the header empty, with his balloon beside him, or in his basket with his ears up and
   the balloon there when no such week strip is on screen. Anything else on the deurmat: ears up, "Ik heb iets voor je
   klaargezet." Nothing waiting and every minimumdoel gedekt or in the dekkingsprognose: he purrs. Otherwise he sleeps.
   The purr reads a count the dekkingsoverzicht already computes (`AantalMinimumdoelenInPrognose`, now also on the
   voortgang read), never the ceiling over undecided proposals. There is exactly one Chuck on screen.

5. **The window shows what he brought and decides only what has no other screen.** A signal can be looked at (its
   klas is selected first, since its link carries none) or put off until the next schooldag. A proposal with its own
   screen is a link there. An activiteitvoorstel the cat brought a klas (ADR-0060) is shown whole, with its klas and
   its moment, and accepted or rejected in the window through the route every activiteitvoorstel is decided by. The
   chat (FB-031, FB-032) is not built: the window says so in visible text and offers no input. It says that no name or
   information about a child belongs in it.

6. **A school setting, admin only, off by default** (`Katinstelling`, Instellingen, Chuck). The school turns him on
   once the onderwijsadviseur has approved him. A gebruiker cannot hide him for herself. It only hides the drawing;
   the background job keeps its own operator switch (`Kat:Ingeschakeld`).

7. **Less motion is the system's setting.** With `prefers-reduced-motion` he does not walk, the window opens at once
   and every posture changes without transition. The app has no motion setting of its own.

8. **No cat in the ontwikkelingsrapport** (its screens pass `zonderKat` to their header) **or in an export** (the only
   export is a server-built Excel file, which draws nothing).

## Alternatives considered

- **Keep the prototype's 56% coat.** Rejected: it fails 3:1 on the page, which is where he lies.
- **Paste the prototype's baked keyframes.** Rejected: they were a thousand lines nobody could check, and the checks
  written for this ADR found two faults in them (a hind paw that crossed the rim without touching it, and a jump of
  the body at the start and end of each move).
- **A personal "hide Chuck" switch.** Rejected by the owner: he sleeps, never covers data, and wakes at most a few
  times a day; hiding him would hide what he brought.
- **An app setting (configuration) instead of a school setting.** Rejected: whether to show him is the school's
  decision after the onderwijsadviseur's review, not an operator's.

## Consequences

**Positive:** the motion is testable and regenerable; the colour exception is argued and measured where the rule
lives; the school decides when he appears, without a release.

**Negative / trade-offs:** one warm pixel that carries no meaning, defended only by chroma and form; "Later" exists for
signals only, so a proposal on the deurmat can be looked at but not put off (the server has no postponement for
proposals); the corner of the week strip exists in the week and werkweek views only, so elsewhere a goal at risk is
said from the basket.

## Compliance trace

| Claim | Where it is enforced |
| --- | --- |
| The walk keeps a cat's rules (3) | `features/kat/choreografie.test.ts` |
| The keyframes are the choreography's (3) | the same test, against `chuck-keyframes.css` |
| The posture is derived, and purring never counts proposals (4) | `features/kat/houding.test.ts`; `DekkingsprognoseTests` pins the count to the dekkingsoverzicht's |
| One Chuck; the window's focus, Escape, less motion, Later, the decision (4, 5, 7) | `features/kat/Katmand.test.tsx` |
| Admin alone turns him on; off by default (6) | `KatinstellingEndpointsTests` |
| A cat proposal carries its klas and moment (5) | `AanbodgatEndpointsTests` |
| The coat clears 3:1 (2) | measured in a browser, light and dark; FB-071 worklog |
