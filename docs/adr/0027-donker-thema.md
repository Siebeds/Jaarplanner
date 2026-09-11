# ADR-0027 — A dark palette ("donker") for "Inkt en Signaal"

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** Project owner (Siebe De Saedeleir), in session on 2026-09-11: "kan je een dark mode voorzien",
  with the mechanism ruled the same day (follow the device, plus an explicit choice in Instellingen).
- **Relates to:** [ADR-0024](0024-single-frontend-inkt-en-signaal.md) (extends decision 4, supersedes nothing);
  [ADR-0017](0017-ui-ux-design-system.md) decision 4 (WCAG 2.2 AA, colour never the only signal, WCAG 1.4.1),
  which binds the dark palette exactly as it binds the light one.
- **Realises:** NFR-2 (calm interface), NFR-7 (recent browsers). **Constitution:** Art. XII (the doelsoort colour
  conventions: MD blue, G neutral, + green, P/S pink, A yellow), Art. VIII (WCAG 2.2 AA target), Art. II.3
  (copy in `nl.json`), Art. X (Definition of Done gates).
- **Backlog:** none yet. This is an owner request outside the epics. If it is to be tracked, it belongs in E9
  (UX herwerking), and that placement is the lead's call.

## Context

The owner asked for a dark mode. The design direction of ADR-0024 makes this less free than it sounds. The
chrome has no brand hue because Art. XII already spends nine hues on meaning, and those meanings have to
survive the switch. A dark palette that re-picks the doelsoort colours is a second colour vocabulary, and a
teacher who learned "MD is blue" in the morning should not have to relearn it in the evening.

Two facts about the existing code shaped the decision:

- **Components use tokens almost exclusively.** One file, `features/activiteiten/kleuren.ts`, carries literal
  washes, so a palette swap reaches nearly every pixel.
- **The signal tokens serve two roles at once.** They are a *fill* under a white `-op` label (the doelsoort
  badge), and they are *text or a dot* on a card (`text-doelsoort-md`, `text-dekking-niet-gedekt`, the status
  dot). At the paper palette's 30 to 45% lightness, a fill works on slate, but text in the same colour measures
  under 3:1 there.

## Decision

1. **The device decides by default, and a teacher may override it per browser.**
   - `systeem` ("Zoals het toestel") is the default and needs no script: the stylesheet answers
     `prefers-color-scheme` itself.
   - Instellingen gains a last section, Weergave, offering Zoals het toestel / Licht / Donker.
   - The choice is kept in `localStorage` (`state/weergave.ts`, zustand `persist`), because it is a view
     preference and not school data. That is the same reasoning as for the class selection.
   - `localStorage` belongs to a browser profile, not to a device, so the screen says "Geldt alleen in deze
     browser." Another browser on the same laptop starts from the default, and "toestel" would have promised
     more than the mechanism keeps.
2. **One attribute, one variant.**
   - An explicit choice stamps `data-weergave="licht|donker"` on `<html>`.
   - Tailwind's `dark` variant is **redefined** in `index.css` to mean "explicit donker, or the system is dark
     and the choice is not licht". Left at Tailwind's default, every `dark:` utility would ignore the teacher's
     choice.
   - A pre-paint script in `index.html` applies a stored choice before the first frame, so an explicit choice
     never flashes the other theme.
3. **Surfaces keep their lightness order** (kaart > vlak > vlak-diep), still at hue 220. Components compose
   the planes by that order: a hover darkens a card, and a well sits below the page. That order is what makes
   the swap mechanical.
4. **A signal keeps its hue and raises its lightness, and its `-op` label becomes ink.** This is the decision
   that keeps Art. XII intact: the hue carries the meaning and does not move.
   - A raised signal is legible as a fill under an ink label, at 6.37:1 to 9.39:1 across the six doelsoorten.
   - It is also legible as text on a card: MD measures 5.82:1.
   - Every doelsoort, suggestie, dekking and attentie hue is identical in both palettes.
   - As a side effect, A (anderstalige) reads as the yellow Art. XII names, which on a light ground it never
     could.
5. **The accent ration is unchanged.** The accent keeps its hue, raised in lightness, and is spent on the same
   five things. `accent-diep`, the hover, becomes lighter rather than darker, because a hover moves away from
   the ground.
6. **The scrim gets a token** (`--color-waas`). It used to be `inkt/35`, and ink is the colour the dark palette
   turns light.
7. **Every colour token has a dark value, and tests enforce it.**
   - `state/weergave.test.ts` fails when a `--color-*` in `@theme` has no counterpart in the dark block, or
     when the dark block names a token that does not exist. It also pins the storage key and the shape that
     the `index.html` script reads.
   - `features/activiteiten/kleuren.test.ts` does the same for the activiteit washes, which live outside the
     token file.
8. **`Segment`'s selected option is outlined in `inkt-zwak`**, in both palettes.
   - The audit found that its selected state failed WCAG 1.4.11 (non-text contrast, 3:1): the fill measured
     1.18:1, the border 1.39:1 in light and 2.04:1 in dark, and the shadow vanishes on slate.
   - This defect predates the dark palette and affected all eight uses of the component, the new Weergave
     control among them.
   - The outline now measures 4.2:1 against the light track and 6.8:1 against the dark one.
9. **No dark shadows.** Tailwind v4 bakes a `--shadow-*` value into its utility at build time, so overriding
   the variable does nothing; the built CSS showed it. On slate the paper's faint shadows vanish, and the
   lighter card carries the elevation.

## Verification, and what it did not cover

- **Calculated.** Every token pair was calculated with alpha composited over its real backdrop:
  - The lowest text pair is `inkt-zwak` on `kaart` at 5.76:1.
  - The lowest control boundary is `lijn-veld` on `kaart` at 3.41:1.
  - The focus ring measures at least 5.14:1 on every ground.
- **Measured in a real browser.** Headless Chrome was driven over CDP on the running app, in dark, at 1440
  and 390 wide.
  - Screens covered: Agenda (month), Thema's, Doelen, Dekking, Instellingen, a thema detail page, and an open
    sheet.
  - Every visible text node was compared against its composited backdrop: zero failures, lowest 5.13:1, and
    the window never scrolls horizontally.
  - The switch works live and keeps `theme-color` in step.
  - All four combinations of system setting and choice resolve correctly, for the page and for a `dark:`
    utility on a descendant element.
- **Not covered by the browser pass:**
  - **The day agenda with real coloured activiteiten.** The demo data has none. The washes were verified on an
    injected element and by calculation: ink on a wash at least 10.07:1, `inkt-zacht` at least 5.79:1.
    `inkt-zwak` on the Olijf and Zand washes measures 4.41:1. It is used there only on an icon, where the
    floor is 3:1, and it would fail as text.
  - **Non-text contrast beyond `Segment`.** The browser pass walked text. `lijn-veld` on `accent-zacht`
    calculates to 2.68:1. Whether any form field ever sits on a selected row was not verified.

## Alternatives considered

- **Follow the device only, with no control.** Offered to the owner and not chosen. It needs no copy, but a
  teacher on a school laptop set to light cannot choose dark.
- **A switch in the navigation.** Offered and not chosen. It is always reachable, but it adds an item to a
  sidebar the owner keeps deliberately short, and the phone's bottom bar has no room for a sixth tab.
- **Separate dark hues per doelsoort, tuned by eye.** That gives two colour vocabularies for one meaning, and
  nothing would guarantee that a dark "blue" is still the blue a teacher learned.
- **Keep the signal fills, and add separate text tokens for dark.** It doubles the signal tokens, and every
  component would have to know which role it is in. Raising the lightness serves both roles with one token.
- **`filter: invert()` on the page.** It inverts the hues too, which violates Art. XII outright.

## Consequences

- Anyone adding a colour token now adds two values, and a test says so the moment one is missing. The same
  holds for an activiteit colour.
- Contrast in the dark palette has the same blind spot as in the light one: jsdom cannot evaluate colour. Any
  change that touches colour needs a browser look at both themes.
- The inline pre-paint script needs a hash if NFR-5 hardening ever adds a Content Security Policy. The repo
  has none today.
- The ADR index (`docs/adr/README.md`) still needs a row for this ADR. It was claimed by another session when
  this was written.
