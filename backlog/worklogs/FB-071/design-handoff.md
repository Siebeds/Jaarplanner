# FB-071 design handoff: Chuck

Design session with the owner, 2026-09-22. This note is what the build session needs; the
decisions themselves are also in the ticket. Read it before touching code.

- Prototype: `chuck-atelier.html` in this folder (open it in a browser), also published at
  https://claude.ai/artifact/MLgAot5kDtiPk8sNwcmHVb (private to the owner).
- Generator: `chuck-ik.mjs` in this folder. `node chuck-ik.mjs` prints the baked keyframes;
  `--log` prints the step plan, `--diag` prints per-leg overreach.

The prototype is a design reference, not code to copy. It is one HTML file with a hand-built
mock of the app; the real component must follow the rules below, which are stricter.

## Decisions (owner, 2026-09-22)

| Question | Decision |
|---|---|
| Name | **Chuck**. Not a Flemish first name, so it never collides with a child in the klas. |
| Voice | First person, plain adult Dutch ("Ik heb de voorbereiding klaargezet."). No cat behaviour in the language. |
| Coat | **Gember**: warm, 44% saturation. Tokens below. |
| Can a user hide him | No. He sleeps, never lies on data, comes out on his own at most a few times a day. |
| Knocks something over on a refusal | No. A refusal is a normal outcome, not a fault. |
| How he speaks | In a **comic speech balloon**: 2px ink outline, tail to his head. What the teacher types stays a plain box. Typeface stays IBM Plex Sans, no comic font. |
| When he speaks | **Only when he has something.** "Iets klaar" and "doel in gevaar" are balloons; sleeping and purring get a quiet text label. |
| How many cats on screen | **Exactly one.** In "doel in gevaar" his basket in the header is empty and he lies on the corner of the week strip, with his balloon beside him. |
| Basket | **Low**, like a real cat bed, so he can step out. |
| Leaving and entering the basket | **Paw by paw, no hop**: one paw at a time, each paw on the rim before it crosses. |
| Walk | Like a cat or tiger, **one paw at a time**: lateral sequence (left hind, left fore, right hind, right fore), each foot 75% on the ground and 25% in the air, so three paws are always down. Body slightly crouched and gliding. Front legs bend backward at the elbow, not forward like a horse's knee. |
| Technique | Inline SVG driven by CSS, keyframes generated from a small two-bone IK rig. No animation library, no Rive, no Lottie. |

Still open, for the owner: the ticket says the onderwijsadviseur approves Chuck before he becomes
central in the huisstijl. Ask the owner whether FB-071 ships behind a setting until then.

## Scope of FB-071 against the other cat tickets

- Built and usable now: TB-056 (constitution, ADR-0059), TB-057 (signal layer), FB-069 and FB-070
  (in te-testen). Chuck's posture and the doormat items read from those.
- **Not built: the chat (FB-031, FB-032).** The window shows the doormat on top; where the chat goes,
  show visible text that it is not there yet. Never ship an input that does nothing (CLAUDE.md, UI work).
- No cat in exports or in the ontwikkelingsrapport.

## The drawing and the rig

All coordinates are SVG user units. Take them from the prototype's `<defs>`, not from memory.

- Two drawings: **lying** (`kat-lig-vorm`, 240×176 space) and **standing** (`kat-sta-vorm`, same space).
- The basket scene is 400×176 with the cat drawing offset **+160**; the standing cat's body centre
  in the scene is **(290, 82)**.
- Nesting of the standing cat, outside in: path (`--ux`, `--uy`, `--stap-x`) › turn (`--kijk`,
  scaleX about 290,82) › tilt (`--pitch`, rotate about 290,82) › `translate(160 0)` › the cat.
- Legs, in the 240 space. Thigh then shin then paw, each rotating about its own joint:

  | Leg | Hip | Thigh | Shin to paw centre | Rest angles (thigh, shin) | Joint bends |
  |---|---|---|---|---|---|
  | near fore `vn` | (92, 98) | 26 | 24 | 0°, 0° | backward |
  | far fore `vv` | (104, 100) | 26 | 23 | 0°, 0° | backward |
  | far hind `av` | (146, 100) | 26 | 23 | −19°, +28° | backward |
  | near hind `an` | (158, 98) | 26 | 24 | −19°, +28° | backward |

  A joint's CSS rotation is `rest + animated`, with `--dij` and `--scheen` registered via `@property`
  as `<angle>`, so the browser can interpolate them.
- Ground heights for a paw centre, in the scene: **basket floor 148**, **rim 124** (left rim, x 172–194),
  **floor 165**. Standing in the basket is `--uy: 0`; walking on the floor is `--uy: 21`
  (floor height 17 plus a 4-unit crouch).
- Low basket: front panel top `M12 128 C12 146 228 146 228 128`, back rim
  `M16 124 C16 104 224 104 224 124`. The lying cat is clipped to everything above that front-panel
  curve, so the tail can never show beside or under the basket.
- The lying cat's tail lies **over** the flank, with a darker under-stroke so it reads on the body.

## Motion

| Moment | Duration | Notes |
|---|---|---|
| Stand up in the basket | 220 ms | crouch, stretch, slight overshoot |
| Step out | 2600 ms | 16 steps, one paw at a time, every paw on the rim first |
| Walk | 900 ms per cycle, 36 units | continues seamlessly from the last step out |
| Turn around | 240 ms | scaleX through 0; he also turns inside the basket before lying down |
| Step in | 2600 ms | mirror of stepping out, facing right |
| Sink and lie down | 200 ms | then cross-fade to the lying drawing |
| Window opens | after 300 ms | nobody waits for the cat |

In the app he fades out **while** walking (last 70% of the one walk cycle) and fades in while
walking back; a fade at a standstill reads as vanishing. Body tilt is capped at 14°: a cat keeps
its body level and folds the paw on the rim instead of rearing.

Idle life: breathing 4.4 s; the lying tail and its tip sway on a 5.2 s cycle, the tip 150 ms late;
an ear flick every 5.2 to 13 s and a blink every 3.4 to 9 s, each at a random moment on a random
visible cat. Purring: faster breathing plus a fine vibration and two small wave marks.

Reduced motion (`prefers-reduced-motion` or the Weergave setting): no walk and no step-out, the
window opens and closes at once, no idle life, posture changes without transition.

## Colour

Gember, light / dark:

| Token | Light | Dark |
|---|---|---|
| coat | `hsl(24 44% 56%)` | `hsl(26 52% 64%)` |
| stripes | `hsl(19 42% 38%)` | `hsl(20 44% 42%)` |
| belly, muzzle, paws, inner ear | `hsl(32 44% 87%)` | `hsl(32 42% 86%)` |
| basket | `hsl(220 12% 84%)` | `hsl(220 10% 26%)` |
| basket dark | `hsl(220 12% 70%)` | `hsl(220 9% 36%)` |
| eyeball | `hsl(40 18% 90%)` | `hsl(40 16% 80%)` |
| pupil | `hsl(220 28% 12%)` | `hsl(220 28% 12%)` |

The basket is achromatic on purpose: Chuck is the only warm thing on screen.

Why the coat is allowed at all: `index.css` says the chrome has no brand hue and every saturated
pixel carries meaning. There is no free warm hue (ai-oranje 22, ster-oranje 28, attentie 30,
doelsoort A 36). Chuck is defended the way `index.css` defends the stars: low chroma (44% against
85 to 100%) and form (an animal in one fixed place, always with a label, never a dot, square or wash).
**This is an exception to the rule at the top of `index.css`: record it there, and in an ADR if
the build session judges it significant (it probably is).**

Measured in a real browser with the prototype's meter: the silhouette must clear WCAG 1.4.11's 3:1
on a card and on the page, which is why the coat sits at 56% lightness and not lighter. Re-measure
the final tokens in the real app, light and dark.

## Speech balloon

Card background, `--color-inkt` 2px border, radius 18px, tail as a small inline SVG path whose fill
covers the border where it joins. Tails: to the left (chat, towards a round avatar of his head),
to the right (header, towards the basket; corner of the week strip), downward (a balloon above his
head). The balloon text is the visible label a posture needs (FB-071 criterion), so it also carries
the state for a screen reader. Balloon text lives in `nl.json`.

## Pitfalls the prototype ran into

- **Never render Chuck through `<symbol>` + `<use>`.** CSS cannot select into a `<use>` shadow
  tree, so rules like `.loopt .dij` silently do nothing: the legs stay still and he slides like a
  board. This shipped unnoticed for three prototype versions. Inline the SVG in the component.
- With `transform-box: view-box`, `transform-origin` in px is read in the element's own user space
  (inside the `translate(160 0)`), which is why the leg origins are in the 240 space.
- Animated custom properties (`--dij`, `--scheen`, `--hef`, `--ux`, `--uy`, `--pitch`, `--kijk`,
  `--stap-x`) must be registered with `@property`, or they jump instead of interpolating.
- When a one-shot animation ends, set the static state that holds its last frame (the prototype's
  `.buiten` class) in the same tick as removing the animation class, or he jumps back.
- One Chuck: the empty-basket state must also block the step-out, or a cat climbs out of an empty
  basket. Open the window instantly in that state.
- Focus returns to the basket button immediately on close, not after the walk back. A close during
  the step-out waits for it to finish before walking back.
- The old tail poked out beside the basket because it curved past the rim; the clip on the rim line
  is the guarantee, not the drawing.

## What "more precise" means for the build

1. **One source of truth for the rig**: a module with the drawing's joint coordinates, lengths and
   rest angles, used by both the React component and the generator. The prototype duplicates them.
2. **Generate the keyframes from that module** with a script under the frontend, instead of pasting
   the 1000-line output. Either generate at build time, or commit the output with a test that fails
   when it is stale.
3. **Test the choreography, not just the component**: a Vitest test that runs the planner and
   asserts that no foot overreaches by more than 3 units, that exactly one foot is in the air at a
   time, and that every foot touches the rim once on the way out and once on the way in.
4. **Check it in a real browser**: screenshots per posture at desktop and at 390px, and a paused
   filmstrip (negative `animation-delay` plus `animation-play-state: paused`) of stepping out, the
   walk and stepping in. The prototype's filmstrips caught every real bug in this session; a single
   still frame hid the biggest one.
5. Coat and basket as tokens in `frontend/src/index.css`, each with a dark value
   (`src/state/weergave.test.ts` fails otherwise).
6. The posture is driven by the signal layer (TB-057), not by local state.
